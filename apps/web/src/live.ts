/**
 * The web app's link to the server: the dataset to start from, the event
 * stream that keeps it current, and the events this page sends back.
 *
 * An event this page sends is applied on the page straight away, and then
 * comes back on the stream like every other event. The echo is recognised
 * and skipped, so the log shows it once.
 */
import { AtlasEvent, Dataset } from "@atlas/core";

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
}

export function createLiveLink(
  after: number,
  environment: LiveEnvironment = {
    openStream: (url) => new EventSource(url),
    fetch: (url, init) => fetch(url, init),
  },
  onProblem: (message: string) => void = (message) => console.warn(message),
): LiveLink {
  const fromServer = new WeakSet<AtlasEvent>();
  const sentFromHere: string[] = [];

  return {
    subscribe(fire) {
      const stream = environment.openStream(`/api/stream?after=${after}`);
      const receive = (message: MessageEvent<string>) => {
        let event: AtlasEvent;
        try {
          event = AtlasEvent.parse(JSON.parse(message.data).event);
        } catch {
          onProblem("skipped an event the model does not recognise");
          return;
        }
        if (message.lastEventId) after = Number(message.lastEventId);
        const echo = sentFromHere.indexOf(canonical(event));
        if (echo !== -1) {
          sentFromHere.splice(echo, 1);
          return;
        }
        fromServer.add(event);
        fire(event);
      };
      stream.addEventListener("atlas", receive as EventListener);
      return () => {
        stream.removeEventListener("atlas", receive as EventListener);
        stream.close();
      };
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
