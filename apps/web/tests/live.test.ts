import type { AtlasEvent } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { describe, expect, test } from "bun:test";

import {
  canonical,
  createLiveLink,
  loadSnapshot,
  sequenceHeader,
  type LiveEnvironment,
} from "../src/live";

const statusChange: AtlasEvent = {
  type: "status-change",
  agentId: "test-runner",
  to: "running",
  text: "Picked up the tests",
};

/** A stream the test writes to, standing in for the browser's EventSource. */
class FakeStream extends EventTarget {
  closed = false;
  readyState = 1;
  constructor(readonly url: string) {
    super();
  }
  close() {
    this.closed = true;
  }
  send(sequence: number, event: unknown) {
    this.dispatchEvent(
      new MessageEvent("atlas", {
        data: JSON.stringify({ sequence, event }),
        lastEventId: String(sequence),
      }),
    );
  }
}

function harness(status = 201) {
  const streams: FakeStream[] = [];
  const posts: { url: string; body: string }[] = [];
  const problems: string[] = [];
  const environment: LiveEnvironment = {
    openStream(url) {
      const stream = new FakeStream(url);
      streams.push(stream);
      return stream as unknown as EventSource;
    },
    async fetch(url, init) {
      posts.push({ url, body: String(init?.body) });
      return new Response(null, { status });
    },
  };
  return { environment, streams, posts, problems };
}

describe("canonical", () => {
  test("is the same whatever order the keys were written in", () => {
    expect(canonical({ b: 1, a: { d: 2, c: [3] } })).toBe(
      canonical({ a: { c: [3], d: 2 }, b: 1 }),
    );
  });
});

describe("loadSnapshot", () => {
  test("reads the dataset and the sequence it includes", async () => {
    const snapshot = await loadSnapshot(
      async () =>
        new Response(JSON.stringify(sampleDataset), {
          headers: { [sequenceHeader]: "12" },
        }),
    );
    expect(snapshot.sequence).toBe(12);
    expect(snapshot.dataset).toEqual(sampleDataset);
  });

  test("fails when the server does", async () => {
    expect(
      loadSnapshot(async () => new Response(null, { status: 500 })),
    ).rejects.toThrow("500");
  });
});

describe("the live link", () => {
  test("opens the stream after the snapshot and applies what arrives", () => {
    const { environment, streams } = harness();
    const link = createLiveLink(7, environment);
    const fired: AtlasEvent[] = [];
    const disconnect = link.subscribe((event) => fired.push(event));
    expect(streams[0]?.url).toBe("/api/stream?after=7");
    streams[0]?.send(8, statusChange);
    expect(fired).toEqual([statusChange]);
    disconnect();
    expect(streams[0]?.closed).toBe(true);
  });

  test("skips an event the model does not recognise", () => {
    const { environment, streams, problems } = harness();
    const link = createLiveLink(0, environment, (text) => problems.push(text));
    const fired: AtlasEvent[] = [];
    link.subscribe((event) => fired.push(event));
    streams[0]?.send(1, { type: "unknown" });
    expect(fired).toEqual([]);
    expect(problems).toHaveLength(1);
  });

  test("sends an event made on the page, and skips its echo", async () => {
    const { environment, streams, posts } = harness();
    const link = createLiveLink(0, environment);
    const fired: AtlasEvent[] = [];
    link.subscribe((event) => fired.push(event));
    link.report(statusChange);
    expect(posts).toEqual([
      { url: "/api/events", body: JSON.stringify(statusChange) },
    ]);
    // The server returns the event with its keys in the schema's order.
    const { text, to, agentId, type } = statusChange as Extract<
      AtlasEvent,
      { type: "status-change" }
    >;
    streams[0]?.send(1, { text, to, agentId, type });
    expect(fired).toEqual([]);
    // A second, equal event from elsewhere is not an echo.
    streams[0]?.send(2, statusChange);
    expect(fired).toEqual([statusChange]);
  });

  test("does not send back an event that came from the server", () => {
    const { environment, streams, posts } = harness();
    const link = createLiveLink(0, environment);
    link.subscribe((event) => link.report(event));
    streams[0]?.send(1, statusChange);
    expect(posts).toEqual([]);
  });

  test("forgets a refused event, so a later equal one is applied", async () => {
    const { environment, streams, posts, problems } = harness(404);
    const link = createLiveLink(0, environment, (text) => problems.push(text));
    const fired: AtlasEvent[] = [];
    link.subscribe((event) => fired.push(event));
    link.report(statusChange);
    await Bun.sleep(0);
    expect(posts).toHaveLength(1);
    expect(problems).toEqual(["the server refused the event (404)"]);
    streams[0]?.send(1, statusChange);
    expect(fired).toEqual([statusChange]);
  });

  test("asks for a reload when the server says the tasks changed", () => {
    const { environment, streams } = harness();
    let reloads = 0;
    const link = createLiveLink(0, environment, undefined, () => reloads++);
    const disconnect = link.subscribe(() => {});
    streams[0]?.dispatchEvent(
      new MessageEvent("refresh", { data: '{"lastRefresh":null}' }),
    );
    expect(reloads).toBe(1);
    disconnect();
    streams[0]?.dispatchEvent(new MessageEvent("refresh", { data: "{}" }));
    expect(reloads).toBe(1);
  });

  test("lays the events received after a reloaded snapshot over it", () => {
    const { environment, streams } = harness();
    const link = createLiveLink(0, environment);
    link.subscribe(() => {});
    const waiting = { ...statusChange, to: "waiting", text: "Waits" } as const;
    streams[0]?.send(1, waiting);
    streams[0]?.send(2, statusChange);
    // The reloaded snapshot holds event 1, not event 2.
    const dataset = link.catchUp({ dataset: sampleDataset, sequence: 1 });
    expect(
      dataset.agents.find((agent) => agent.id === "test-runner")?.status,
    ).toBe("running");
    // A snapshot that holds both needs nothing laid over it.
    expect(link.catchUp({ dataset: sampleDataset, sequence: 2 })).toBe(
      sampleDataset,
    );
  });
});

describe("a new build", () => {
  const announce = (stream: FakeStream | undefined, build: string) =>
    stream?.dispatchEvent(
      new MessageEvent("build", { data: JSON.stringify({ build }) }),
    );

  test("keeps the first build, and reloads only when a different one arrives", () => {
    const { environment, streams } = harness();
    let reloads = 0;
    const link = createLiveLink(
      0,
      environment,
      () => {},
      () => {},
      () => reloads++,
    );
    link.subscribe(() => {});
    announce(streams[0], "0.8.0-a");
    announce(streams[0], "0.8.0-a");
    expect(reloads).toBe(0);
    announce(streams[0], "0.8.0-b");
    expect(reloads).toBe(1);
  });

  test("ignores a build message it cannot read", () => {
    const { environment, streams } = harness();
    let reloads = 0;
    const link = createLiveLink(
      0,
      environment,
      () => {},
      () => {},
      () => reloads++,
    );
    link.subscribe(() => {});
    streams[0]?.dispatchEvent(new MessageEvent("build", { data: "not json" }));
    announce(streams[0], "0.8.0-a");
    expect(reloads).toBe(0);
  });
});

describe("a stream the browser gives up on", () => {
  test("is reopened from the last event, and stays closed after unsubscribing", async () => {
    const { environment, streams } = harness();
    const link = createLiveLink(4, environment);
    const unsubscribe = link.subscribe(() => {});
    streams[0]?.send(5, statusChange);
    // A proxy answered the reconnect with an error, so the browser closed it.
    streams[0]!.readyState = 2;
    streams[0]?.dispatchEvent(new Event("error"));
    expect(streams[0]?.closed).toBe(true);
    await Bun.sleep(1100);
    expect(streams).toHaveLength(2);
    expect(streams[1]?.url).toBe("/api/stream?after=5");
    unsubscribe();
    expect(streams[1]?.closed).toBe(true);
  });

  test("is left to the browser while it is still reconnecting", () => {
    const { environment, streams } = harness();
    createLiveLink(0, environment).subscribe(() => {});
    streams[0]?.dispatchEvent(new Event("error"));
    expect(streams[0]?.closed).toBe(false);
    expect(streams).toHaveLength(1);
  });
});
