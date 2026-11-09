import { describe, expect, it } from "bun:test";

import {
  createServerRuntime,
  Runtime,
  serverRuntimeFor,
  type DocSnapshot,
  type ServerStream,
} from "../src";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async () => {
  for (let i = 0; i < 5; i++) await tick();
};

interface Sent {
  method: string;
  url: string;
  body?: unknown;
}

/** A stand-in for the Atlas server's sidebar routes, in memory. */
function fakeServer(
  options: {
    tools?: Record<string, (args: unknown) => Response>;
  } = {},
) {
  const sent: Sent[] = [];
  const docs = new Map<string, { data: unknown; version: number }>();
  const fetcher = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body =
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    sent.push({ method, url: url.pathname + url.search, body });
    const tool = /^\/api\/host\/dashboard\/(.+)$/.exec(url.pathname)?.[1];
    if (tool) {
      const handler = options.tools?.[tool];
      return handler
        ? handler(body)
        : Response.json(
            { code: "not_in_manifest", error: "no such tool" },
            { status: 404 },
          );
    }
    if (url.pathname === "/api/sidebar/doc") {
      const path = url.searchParams.get("path") ?? "";
      const held = docs.get(path);
      if (method === "GET")
        return Response.json({
          path,
          exists: held !== undefined && held.data !== null,
          data: held?.data ?? null,
          version: held?.version ?? 0,
        });
      const version = (held?.version ?? 0) + 1;
      docs.set(path, { data: method === "PUT" ? body : null, version });
      return Response.json({ path, version });
    }
    return Response.json({ error: "no route" }, { status: 404 });
  };
  return { sent, docs, fetch: fetcher as typeof fetch };
}

/** A stand-in for EventSource that the test drives. */
function fakeStream() {
  const listeners = new Map<
    string,
    Array<(event: { data?: string }) => void>
  >();
  const opened: string[] = [];
  let closed = false;
  const open = (url: string): ServerStream => {
    opened.push(url);
    return {
      addEventListener(type, listener) {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      close() {
        closed = true;
      },
    };
  };
  const emit = (type: string, data?: unknown) => {
    for (const listener of listeners.get(type) ?? [])
      listener(data === undefined ? {} : { data: JSON.stringify(data) });
  };
  return { open, emit, opened, closed: () => closed };
}

describe("serverRuntimeFor", () => {
  const page = (
    content: string | null,
    extra: Record<string, unknown> = {},
  ) => ({
    location: { origin: "https://atlas.example" },
    fetch: async () => new Response("{}"),
    document: {
      querySelector: (selector: string) =>
        selector === 'meta[name="atlas-runtime"]' && content !== null
          ? {
              getAttribute: (name: string) =>
                name === "content" ? content : null,
            }
          : null,
    },
    ...extra,
  });

  it("is the server runtime when the page carries the server's marker", () => {
    expect(serverRuntimeFor(page("server"))).not.toBeNull();
  });

  it("is none without the marker, as in the artifact or a plain build", () => {
    expect(serverRuntimeFor(page(null))).toBeNull();
    expect(serverRuntimeFor(page("other"))).toBeNull();
    expect(serverRuntimeFor({})).toBeNull();
    expect(serverRuntimeFor(null)).toBeNull();
  });
});

describe("Runtime.fromWindow", () => {
  const marked = {
    location: { origin: "https://atlas.example" },
    fetch: async () => new Response("{}"),
    document: {
      querySelector: () => ({ getAttribute: () => "server" }),
    },
  };

  it("prefers window.claude, so the artifact and VS Code keep their host", () => {
    const claude = { use: () => Promise.reject({ code: "not_granted" }) };
    const runtime = Runtime.fromWindow({ ...marked, claude });
    expect(runtime.present).toBe(true);
    expect(runtime.connectors).toBe(true);
  });

  it("uses the server when there is no window.claude and the server served the page", () => {
    const runtime = Runtime.fromWindow(marked);
    expect(runtime.present).toBe(true);
    expect(runtime.connectors).toBe(false);
  });

  it("has nothing in a plain browser", () => {
    const runtime = Runtime.fromWindow({});
    expect(runtime.present).toBe(false);
    expect(runtime.connectors).toBe(false);
  });
});

describe("createServerRuntime: tools", () => {
  it("sends a dashboard tool call to the server and returns its data", async () => {
    const server = fakeServer({
      tools: {
        worklist: () =>
          Response.json({ structuredContent: { tasks: [1, 2] }, content: [] }),
      },
    });
    const runtime = new Runtime(
      createServerRuntime({
        base: "https://atlas.example",
        fetch: server.fetch,
        openStream: () => null,
      }),
    );
    expect(
      await runtime.call("host:dashboard", "worklist", { day: "x" }),
    ).toEqual({ tasks: [1, 2] });
    expect(server.sent[0]).toEqual({
      method: "POST",
      url: "/api/host/dashboard/worklist",
      body: { day: "x" },
    });
  });

  it("trims any run of trailing slashes from the base, quickly", async () => {
    const server = fakeServer({
      tools: { worklist: () => Response.json({ structuredContent: {} }) },
    });
    const runtime = new Runtime(
      createServerRuntime({
        base: `https://atlas.example${"/".repeat(100_000)}`,
        fetch: server.fetch,
        openStream: () => null,
      }),
    );
    const started = performance.now();
    await runtime.call("host:dashboard", "worklist");
    expect(performance.now() - started).toBeLessThan(1000);
    expect(server.sent[0]?.url).toBe("/api/host/dashboard/worklist");
  });

  it("rejects with the server's code when the tool is not allowed or not set up", async () => {
    const server = fakeServer({
      tools: {
        worklist: () =>
          Response.json(
            { code: "server_not_connected", error: "not set up" },
            { status: 503 },
          ),
      },
    });
    const runtime = new Runtime(
      createServerRuntime({
        base: "https://atlas.example",
        fetch: server.fetch,
        openStream: () => null,
      }),
    );
    await expect(
      runtime.call("host:dashboard", "worklist"),
    ).rejects.toMatchObject({ code: "server_not_connected" });
    await expect(
      runtime.call("host:dashboard", "anything_else"),
    ).rejects.toMatchObject({ code: "not_in_manifest" });
  });

  it("answers server_not_connected for a claude.ai connector without asking the server", async () => {
    const server = fakeServer();
    const runtime = new Runtime(
      createServerRuntime({
        base: "https://atlas.example",
        fetch: server.fetch,
        openStream: () => null,
      }),
    );
    await expect(
      runtime.call("monday.com", "get_board_items_page"),
    ).rejects.toMatchObject({ code: "server_not_connected" });
    expect(server.sent).toEqual([]);
  });

  it("answers server_unavailable when the server cannot be reached", async () => {
    const runtime = new Runtime(
      createServerRuntime({
        base: "https://atlas.example",
        fetch: (async () => {
          throw new TypeError("offline");
        }) as unknown as typeof fetch,
        openStream: () => null,
      }),
    );
    await expect(
      runtime.call("host:dashboard", "worklist"),
    ).rejects.toMatchObject({ code: "server_unavailable" });
  });

  it("stops watching a tool the server will never answer", async () => {
    const server = fakeServer();
    const runtime = new Runtime(
      createServerRuntime({
        base: "https://atlas.example",
        fetch: server.fetch,
        openStream: () => null,
      }),
    );
    const errors: string[] = [];
    const stop = runtime.watch(
      "host:dashboard",
      "missing",
      null,
      { onData: () => undefined, onError: (e) => errors.push(e.code) },
      { refetchInterval: 1 },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();
    expect(errors).toEqual(["not_in_manifest"]);
  });

  it("refuses the editor host, as the artifact does", async () => {
    const runtime = new Runtime(
      createServerRuntime({
        base: "https://atlas.example",
        fetch: fakeServer().fetch,
        openStream: () => null,
      }),
    );
    expect(await runtime.host()).toBeNull();
  });
});

describe("createServerRuntime: stored documents", () => {
  it("writes, reads and removes a document", async () => {
    const server = fakeServer();
    const runtime = new Runtime(
      createServerRuntime({
        base: "https://atlas.example",
        fetch: server.fetch,
        openStream: () => null,
      }),
    );
    expect(await runtime.read("board/tasks")).toBeUndefined();
    await runtime.write("board/tasks", { tasks: ["a"] });
    expect(await runtime.read("board/tasks")).toEqual({ tasks: ["a"] });
    await runtime.remove("board/tasks");
    expect(await runtime.read("board/tasks")).toBeUndefined();
    expect(server.sent.map((s) => `${s.method} ${s.url}`)).toContain(
      "PUT /api/sidebar/doc?path=board%2Ftasks",
    );
  });

  it("tells a subscriber now, after its own write, and after another page's write", async () => {
    const server = fakeServer();
    const stream = fakeStream();
    const runtime = new Runtime(
      createServerRuntime({
        base: "https://atlas.example",
        fetch: server.fetch,
        openStream: stream.open,
      }),
    );
    const seen: unknown[] = [];
    const stop = runtime.subscribe("board/hosts", (doc) => seen.push(doc));
    await settle();
    expect(seen).toEqual([undefined]);
    expect(stream.opened).toEqual(["https://atlas.example/api/stream"]);

    await runtime.write("board/hosts", { hosts: 1 });
    await settle();
    expect(seen).toEqual([undefined, { hosts: 1 }]);

    // The stream echoes our own write: already known, so no second read.
    const reads = server.sent.length;
    stream.emit("sidebar-doc", { path: "board/hosts", version: 1 });
    await settle();
    expect(server.sent.length).toBe(reads);

    // Another page writes.
    server.docs.set("board/hosts", { data: { hosts: 2 }, version: 2 });
    stream.emit("sidebar-doc", { path: "board/hosts", version: 2 });
    await settle();
    expect(seen).toEqual([undefined, { hosts: 1 }, { hosts: 2 }]);

    // A document nobody follows is not read.
    stream.emit("sidebar-doc", { path: "board/other", version: 9 });
    await settle();
    expect(server.sent.some((s) => s.url.includes("board%2Fother"))).toBe(
      false,
    );

    stop();
    server.docs.set("board/hosts", { data: { hosts: 3 }, version: 3 });
    stream.emit("sidebar-doc", { path: "board/hosts", version: 3 });
    await settle();
    expect(seen).toHaveLength(3);
  });

  it("reads every followed document again when the stream reconnects", async () => {
    const server = fakeServer();
    const stream = fakeStream();
    const runtime = new Runtime(
      createServerRuntime({
        base: "https://atlas.example",
        fetch: server.fetch,
        openStream: stream.open,
      }),
    );
    const seen: unknown[] = [];
    runtime.subscribe("board/tasks", (doc) => seen.push(doc));
    await settle();
    server.docs.set("board/tasks", { data: { tasks: [] }, version: 4 });
    stream.emit("open");
    await settle();
    expect(seen).toEqual([undefined, { tasks: [] }]);
  });

  it("polls followed documents when the page has no event stream", async () => {
    const server = fakeServer();
    const runtime = new Runtime(
      createServerRuntime({
        base: "https://atlas.example",
        fetch: server.fetch,
        openStream: () => null,
        pollMilliseconds: 5,
      }),
    );
    const seen: unknown[] = [];
    const stop = runtime.subscribe("board/waiting", (doc) => seen.push(doc));
    await settle();
    server.docs.set("board/waiting", { data: { n: 1 }, version: 1 });
    await new Promise((resolve) => setTimeout(resolve, 30));
    stop();
    expect(seen).toEqual([undefined, { n: 1 }]);
  });

  it("gives each snapshot the document's path as its id", async () => {
    const server = fakeServer();
    const claude = createServerRuntime({
      base: "https://atlas.example",
      fetch: server.fetch,
      openStream: () => null,
    });
    const db = await claude.use("db");
    const snapshot: DocSnapshot = await db.doc("board/tasks").get();
    expect(snapshot.id).toBe("board/tasks");
    expect(snapshot.exists).toBe(false);
  });
});
