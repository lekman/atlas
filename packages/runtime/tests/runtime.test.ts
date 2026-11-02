import { describe, expect, it } from "bun:test";

import {
  createFakeRuntime,
  describeError,
  Runtime,
  toolData,
  toRuntimeError,
  type FeedState,
} from "../src";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const NOW = new Date("2026-11-01T10:00:00Z");

interface Hosts {
  hosts: Array<{ host: string; lastSeen: string }>;
}
const acceptHosts = (d: unknown): Hosts | null =>
  d && Array.isArray((d as Hosts).hosts) ? (d as Hosts) : null;

describe("toRuntimeError", () => {
  it("keeps a known code and its message", () => {
    expect(toRuntimeError({ code: "tool_error", message: "boom" })).toEqual({
      code: "tool_error",
      message: "boom",
    });
  });

  it("turns an unknown code, a string or nothing into upstream_error", () => {
    expect(toRuntimeError({ code: "weird" }).code).toBe("upstream_error");
    expect(toRuntimeError("down")).toEqual({
      code: "upstream_error",
      message: "down",
    });
    expect(toRuntimeError(undefined)).toEqual({ code: "upstream_error" });
  });
});

describe("describeError", () => {
  it.each([
    ["not_granted", "Live connectors aren't available in this view."],
    [
      "server_not_connected",
      "Host isn't connected for you. Add it in claude.ai Settings → Connectors.",
    ],
    [
      "server_unavailable",
      "Host didn't answer. Showing the last data received; it tries again on the next refresh.",
    ],
  ] as const)("%s", (code, text) => {
    expect(describeError({ code }, "Host")).toBe(text);
  });

  it("includes the tool's message for tool_error", () => {
    expect(describeError({ code: "tool_error", message: "bad" }, "Host")).toBe(
      "Host reported an error: bad.",
    );
  });
});

describe("toolData", () => {
  it("prefers structuredContent, then payload, then JSON text", () => {
    expect(
      toolData({ structuredContent: { a: 1 }, payload: { a: 2 } }),
    ).toEqual({
      a: 1,
    });
    expect(toolData({ payload: [1] })).toEqual([1]);
    expect(toolData({ content: [{ type: "text", text: '{"b":2}' }] })).toEqual({
      b: 2,
    });
    expect(toolData({ content: [{ type: "text", text: "plain" }] })).toBe(
      "plain",
    );
  });
});

describe("Runtime without a host", () => {
  it("fails every call with not_granted", async () => {
    const runtime = Runtime.fromWindow({});
    expect(runtime.present).toBe(false);
    await expect(runtime.call("host:dashboard", "worklist")).rejects.toEqual({
      code: "not_granted",
    });
    await expect(runtime.read("board/tasks")).rejects.toEqual({
      code: "not_granted",
    });
  });
});

describe("Runtime.call", () => {
  it("returns the data and records the call", async () => {
    const fake = createFakeRuntime({
      tools: { "host:dashboard/worklist": () => ({ payload: { items: [] } }) },
    });
    const runtime = new Runtime(fake);
    expect(await runtime.call("host:dashboard", "worklist")).toEqual({
      items: [],
    });
    expect(fake.calls).toEqual([
      { server: "host:dashboard", tool: "worklist", args: null },
    ]);
  });

  it.each([
    "not_granted",
    "server_not_connected",
    "server_unavailable",
    "tool_error",
  ] as const)("rejects with %s", async (code) => {
    const fake = createFakeRuntime({
      tools: {
        "host:dashboard/worklist": () => {
          throw { code, message: "x" };
        },
      },
    });
    await expect(
      new Runtime(fake).call("host:dashboard", "worklist"),
    ).rejects.toEqual({ code, message: "x" });
  });
});

describe("Runtime store", () => {
  it("reads, writes, removes and follows a document", async () => {
    const runtime = new Runtime(createFakeRuntime());
    const seen: unknown[] = [];
    const stop = runtime.subscribe("board/x", (d) => seen.push(d));
    await tick();
    await runtime.write("board/x", { n: 1 });
    expect(await runtime.read("board/x")).toEqual({ n: 1 });
    await runtime.remove("board/x");
    stop();
    await runtime.write("board/x", { n: 2 });
    expect(seen).toEqual([undefined, { n: 1 }, undefined]);
  });
});

describe("Runtime.feed", () => {
  function hostsFeed(fake: ReturnType<typeof createFakeRuntime>) {
    const states: Array<FeedState<Hosts>> = [];
    const stop = new Runtime(fake, { now: () => NOW }).feed(
      {
        server: "host:dashboard",
        tool: "host_stats",
        path: "board/hosts",
        accept: acceptHosts,
        signature: (d) =>
          d.hosts.map((x) => `${x.host}@${x.lastSeen}`).join("|"),
        toStored: (d, now) => ({ ...d, storedAt: now.toISOString() }),
      },
      (s) => states.push(s),
    );
    return { states, stop };
  }

  it("shows live data and stores a copy with its time", async () => {
    const hosts = { hosts: [{ host: "a", lastSeen: "t1" }] };
    const fake = createFakeRuntime({
      tools: { "host:dashboard/host_stats": () => ({ payload: hosts }) },
    });
    const { states, stop } = hostsFeed(fake);
    await tick();
    await tick();
    stop();
    expect(states.at(-1)?.live).toEqual(hosts);
    expect(fake.docs.get("board/hosts")).toEqual({
      ...hosts,
      storedAt: NOW.toISOString(),
    });
  });

  it("does not rewrite a stored copy with the same signature", async () => {
    const hosts = { hosts: [{ host: "a", lastSeen: "t1" }] };
    const fake = createFakeRuntime({
      tools: { "host:dashboard/host_stats": () => ({ payload: hosts }) },
      docs: { "board/hosts": { ...hosts, storedAt: "old" } },
    });
    const { stop } = hostsFeed(fake);
    await tick();
    await tick();
    stop();
    expect(fake.docs.get("board/hosts")).toEqual({ ...hosts, storedAt: "old" });
  });

  it("falls back to the stored copy on a device without the server", async () => {
    const stored = { hosts: [{ host: "a", lastSeen: "t0" }], storedAt: "s" };
    const fake = createFakeRuntime({
      tools: {
        "host:dashboard/host_stats": () => {
          throw { code: "server_not_connected" };
        },
      },
      docs: { "board/hosts": stored },
    });
    const { states, stop } = hostsFeed(fake);
    await tick();
    await tick();
    stop();
    const last = states.at(-1);
    expect(last?.live).toBeNull();
    expect(last?.stored).toEqual(stored);
    expect(last?.error?.code).toBe("server_not_connected");
  });

  it("keeps live data as last known after server_unavailable", async () => {
    const hosts = { hosts: [{ host: "a", lastSeen: "t1" }] };
    let fail = false;
    const fake = createFakeRuntime({
      tools: {
        "host:dashboard/host_stats": () => {
          if (fail) throw { code: "server_unavailable" };
          return { payload: hosts };
        },
      },
    });
    const runtime = new Runtime(fake);
    const states: Array<FeedState<Hosts>> = [];
    const stop = runtime.feed(
      {
        server: "host:dashboard",
        tool: "host_stats",
        accept: acceptHosts,
        watch: { refetchInterval: 5 },
      },
      (s) => states.push(s),
    );
    await tick();
    fail = true;
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();
    const last = states.at(-1);
    expect(last?.error?.code).toBe("server_unavailable");
    expect(last?.live).toEqual(hosts);
  });

  it("reports an answer it cannot read as tool_error", async () => {
    const fake = createFakeRuntime({
      tools: { "host:dashboard/host_stats": () => ({ payload: { nope: 1 } }) },
    });
    const { states, stop } = hostsFeed(fake);
    await tick();
    await tick();
    stop();
    expect(states.at(-1)?.error?.code).toBe("tool_error");
  });
});

describe("Runtime.watch raw", () => {
  it("hands over the host's result untouched when asked", async () => {
    const result = {
      content: [
        { type: "text", text: '{"id":1}' },
        { type: "text", text: '{"id":2}' },
      ],
    };
    const fake = createFakeRuntime({ tools: { "m/t": () => result } });
    const seen: unknown[] = [];
    const stop = new Runtime(fake).watch("m", "t", null, {
      onData: (d) => seen.push(d),
      raw: true,
    });
    await tick();
    await tick();
    stop();
    expect(seen).toEqual([result]);
  });
});
