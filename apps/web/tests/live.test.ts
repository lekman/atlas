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
});
