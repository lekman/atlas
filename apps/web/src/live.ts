/**
 * The web app's link to the server: the dataset to start from, the event
 * stream that keeps it current, and the events this page sends back.
 *
 * An event this page sends is applied on the page straight away, and then
 * comes back on the stream like every other event. The echo is recognised
 * and skipped, so the log shows it once.
 *
 * A `refresh` message on the stream means the task database changed. The
 * page loads the dataset again, and `catchUp` lays over it the events the
 * page applied after the server read it, so nothing already shown is lost.
 */
import { applyEvent, AtlasEvent, Dataset } from "@atlas/core";

/** The header the server sets on the dataset: the last event it includes. */
export const sequenceHeader = "x-atlas-sequence";

/** The one way the link calls the server, so tests can answer instead. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface Snapshot {
  dataset: Dataset;
  /** The last event already applied to the dataset. */
  sequence: number;
}

export async function loadSnapshot(
  fetcher: Fetcher = (url, init) => fetch(url, init),
): Promise<Snapshot> {
  const response = await fetcher("/api/dataset", {
    headers: { accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`the server answered ${response.status} for the dataset`);
  const sequence = Number(response.headers.get(sequenceHeader) ?? 0);
  return {
    dataset: Dataset.parse(await response.json()),
    sequence: Number.isSafeInteger(sequence) ? sequence : 0,
  };
}

/** JSON with every object's keys sorted, so two equal events compare equal. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([left], [right]) =>
            left < right ? -1 : left > right ? 1 : 0,
          ),
        )
      : inner,
  );
}

/** The parts of the browser the link uses, so tests can stand in for them. */
export interface LiveEnvironment {
  openStream(url: string): EventSource;
  fetch: Fetcher;
}

export interface LiveLink {
  /** For `AtlasShell`'s `subscribe`: applies every event from the stream. */
  subscribe(fire: (event: AtlasEvent) => void): () => void;
  /** For `AtlasShell`'s `onEvent`: sends an event made on this page to the server. */
  report(event: AtlasEvent): void;
  /**
   * A snapshot loaded again, with the events this page received after the
   * server read it applied on top.
   */
  catchUp(snapshot: Snapshot): Dataset;
}

/** How many received events the link keeps for `catchUp`. */
const keptEvents = 200;

/** EventSource.CLOSED, written out so tests need no browser. */
const closedState = 2;
/** How long to wait before reopening a closed stream, doubling up to the longest. */
const firstPause = 1000;
const longestPause = 30_000;

export function createLiveLink(
  after: number,
  environment: LiveEnvironment = {
    openStream: (url) => new EventSource(url),
    fetch: (url, init) => fetch(url, init),
  },
  onProblem: (message: string) => void = (message) => console.warn(message),
  /** Called when the server says the task database changed. */
  onRefresh: () => void = () => {},
  /** Called when the stream reconnects to a newer build of the server. */
  onNewBuild: () => void = () => {},
): LiveLink {
  let build: string | undefined;
  const fromServer = new WeakSet<AtlasEvent>();
  const sentFromHere: string[] = [];
  const received: { sequence: number; event: AtlasEvent }[] = [];

  return {
    subscribe(fire) {
      let stream = environment.openStream(`/api/stream?after=${after}`);
      let retry: ReturnType<typeof setTimeout> | undefined;
      let pause = firstPause;
      let stopped = false;
      const receive = (message: MessageEvent<string>) => {
        let event: AtlasEvent;
        try {
          event = AtlasEvent.parse(JSON.parse(message.data).event);
        } catch {
          onProblem("skipped an event the model does not recognise");
          return;
        }
        if (message.lastEventId) {
          after = Number(message.lastEventId);
          received.push({ sequence: after, event });
          if (received.length > keptEvents) received.shift();
        }
        const echo = sentFromHere.indexOf(canonical(event));
        if (echo !== -1) {
          sentFromHere.splice(echo, 1);
          return;
        }
        fromServer.add(event);
        fire(event);
      };
      const refresh = () => onRefresh();
      // The first build seen is this page's; a different one after a
      // reconnect means a deploy, and the page reloads to pick it up.
      const announce = (message: MessageEvent<string>) => {
        let next: unknown;
        try {
          next = JSON.parse(message.data).build;
        } catch {
          return;
        }
        if (typeof next !== "string") return;
        if (build === undefined) build = next;
        else if (next !== build) onNewBuild();
      };
      // A browser stops for good when a reconnect gets an error status, as
      // a proxy answers while the server restarts. Reopen it, waiting a
      // little longer each time, from the last event this page has.
      const attach = (target: EventSource) => {
        target.addEventListener("atlas", receive as EventListener);
        target.addEventListener("refresh", refresh);
        target.addEventListener("build", announce as EventListener);
        target.addEventListener("open", opened);
        target.addEventListener("error", failed);
      };
      const detach = (target: EventSource) => {
        target.removeEventListener("atlas", receive as EventListener);
        target.removeEventListener("refresh", refresh);
        target.removeEventListener("build", announce as EventListener);
        target.removeEventListener("open", opened);
        target.removeEventListener("error", failed);
      };
      function opened() {
        pause = firstPause;
      }
      function failed() {
        if (stopped || stream.readyState !== closedState) return;
        detach(stream);
        stream.close();
        retry = setTimeout(() => {
          if (stopped) return;
          stream = environment.openStream(`/api/stream?after=${after}`);
          attach(stream);
        }, pause);
        pause = Math.min(pause * 2, longestPause);
      }
      attach(stream);
      return () => {
        stopped = true;
        clearTimeout(retry);
        detach(stream);
        stream.close();
      };
    },

    catchUp(snapshot) {
      while (received[0] && received[0].sequence <= snapshot.sequence)
        received.shift();
      return received.reduce(
        (dataset, { event }) => applyEvent(dataset, event),
        snapshot.dataset,
      );
    },

    report(event) {
      if (fromServer.has(event)) return;
      const key = canonical(event);
      sentFromHere.push(key);
      environment
        .fetch("/api/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(event),
        })
        .then((response) => {
          if (response.ok) return;
          const index = sentFromHere.indexOf(key);
          if (index !== -1) sentFromHere.splice(index, 1);
          onProblem(`the server refused the event (${response.status})`);
        })
        .catch(() => onProblem("the event did not reach the server"));
    },
  };
}
