import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createApi,
  createDashboardHost,
  dashboardTools,
  markPage,
  openDatabase,
  readConfiguration,
  sidebarPageFile,
  stdioConnector,
  type Api,
  type AtlasDatabase,
  type DashboardHost,
} from "../src";

let database: AtlasDatabase;

beforeEach(() => {
  database = openDatabase(":memory:");
});

const nobody = async () => undefined;

function apiWith(options: Partial<Parameters<typeof createApi>[0]> = {}): Api {
  return createApi({
    database,
    version: "0.0.0-test",
    lookupNode: nobody,
    ...options,
  });
}

const send = (
  api: Api,
  path: string,
  init: RequestInit & { json?: unknown } = {},
) => {
  const { json, ...rest } = init;
  return api.handle(
    new Request(`http://atlas.test${path}`, {
      ...rest,
      ...(json !== undefined
        ? {
            body: JSON.stringify(json),
            headers: { "content-type": "application/json", ...rest.headers },
          }
        : {}),
    }),
    "127.0.0.1",
  );
};

/** A dashboard host that records calls and answers from a table. */
function recordingHost(
  answer: DashboardHost["call"] = async () => ({
    ok: true,
    result: { structuredContent: { tasks: [] } },
  }),
) {
  const calls: Array<{ tool: string; args: unknown }> = [];
  const host: DashboardHost = {
    async call(tool, args) {
      calls.push({ tool, args });
      return answer(tool, args);
    },
    close: async () => undefined,
  };
  return { host, calls };
}

describe("the dashboard tool route", () => {
  test("forwards an allowed tool with its arguments and returns the MCP result", async () => {
    const { host, calls } = recordingHost();
    const api = apiWith({ dashboard: host });
    const response = await send(api, "/api/host/dashboard/worklist", {
      method: "POST",
      json: { day: "2026-11-09" },
    });
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      structuredContent: { tasks: [] },
    });
    expect(calls).toEqual([{ tool: "worklist", args: { day: "2026-11-09" } }]);
  });

  test("refuses a tool the sidebar does not use, without calling the server", async () => {
    const { host, calls } = recordingHost();
    const api = apiWith({ dashboard: host });
    for (const name of ["delete_everything", "worklist/../x", "WORKLIST"]) {
      const response = await send(api, `/api/host/dashboard/${name}`, {
        method: "POST",
        json: {},
      });
      expect(response?.status).toBe(404);
      expect(await response?.json()).toMatchObject({ code: "not_in_manifest" });
    }
    expect(calls).toEqual([]);
  });

  test("allows exactly the tools the sidebar calls", () => {
    expect([...dashboardTools].sort()).toEqual([
      "commander_answer",
      "commander_plan",
      "commander_requests",
      "commander_send",
      "details_read",
      "host_stats",
      "release_status",
      "sync_now",
      "task_assess",
      "task_done",
      "task_grade_many",
      "task_move",
      "task_move_many",
      "task_prs",
      "waiting_on_you",
      "worklist",
    ]);
  });

  test("answers server_not_connected when no dashboard server is set up", async () => {
    const api = apiWith();
    const response = await send(api, "/api/host/dashboard/worklist", {
      method: "POST",
      json: {},
    });
    expect(response?.status).toBe(503);
    expect(await response?.json()).toMatchObject({
      code: "server_not_connected",
    });
  });

  test("passes a tool error and an unreachable server on as their codes", async () => {
    const { host } = recordingHost(async (tool) =>
      tool === "task_done"
        ? { ok: false, code: "tool_error", message: "no such task" }
        : { ok: false, code: "server_unavailable", message: "down" },
    );
    const api = apiWith({ dashboard: host });
    const failed = await send(api, "/api/host/dashboard/task_done", {
      method: "POST",
      json: { ref: "x" },
    });
    expect(failed?.status).toBe(502);
    expect(await failed?.json()).toEqual({
      code: "tool_error",
      error: "no such task",
    });
    const down = await send(api, "/api/host/dashboard/worklist", {
      method: "POST",
      json: {},
    });
    expect(down?.status).toBe(503);
    expect(await down?.json()).toMatchObject({ code: "server_unavailable" });
  });

  test("takes only a JSON object, sent as JSON, by POST", async () => {
    const { host, calls } = recordingHost();
    const api = apiWith({ dashboard: host });
    const asForm = await send(api, "/api/host/dashboard/worklist", {
      method: "POST",
      body: "day=x",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(asForm?.status).toBe(415);
    const asList = await send(api, "/api/host/dashboard/worklist", {
      method: "POST",
      json: [1],
    });
    expect(asList?.status).toBe(400);
    const asGet = await send(api, "/api/host/dashboard/worklist");
    expect(asGet?.status).toBe(405);
    expect(calls).toEqual([]);
  });

  test("sits behind the same caller check as the rest of the API", async () => {
    const { host, calls } = recordingHost();
    const api = apiWith({ dashboard: host, requireTokens: true });
    const anonymous = await send(api, "/api/host/dashboard/worklist", {
      method: "POST",
      json: {},
    });
    expect(anonymous?.status).toBe(401);
    const person = await send(api, "/api/host/dashboard/worklist", {
      method: "POST",
      json: {},
      headers: { "tailscale-user-login": "person@example.com" },
    });
    expect(person?.status).toBe(200);
    expect(calls).toHaveLength(1);
  });
});

describe("stored documents", () => {
  test("round-trip through SQLite, with a version that only rises", async () => {
    const api = apiWith();
    const path = "/api/sidebar/doc?path=board%2Ftasks";
    expect(await (await send(api, path))?.json()).toEqual({
      path: "board/tasks",
      exists: false,
      data: null,
      version: 0,
    });
    const put = await send(api, path, {
      method: "PUT",
      json: { tasks: ["a"] },
    });
    expect(await put?.json()).toEqual({ path: "board/tasks", version: 1 });
    expect(await (await send(api, path))?.json()).toEqual({
      path: "board/tasks",
      exists: true,
      data: { tasks: ["a"] },
      version: 1,
    });
    await send(api, path, { method: "PUT", json: { tasks: ["b"] } });
    const removed = await send(api, path, { method: "DELETE" });
    expect(await removed?.json()).toEqual({ path: "board/tasks", version: 3 });
    expect(await (await send(api, path))?.json()).toMatchObject({
      exists: false,
      version: 3,
    });
    await send(api, path, { method: "PUT", json: { tasks: [] } });
    expect(await (await send(api, path))?.json()).toMatchObject({
      exists: true,
      version: 4,
    });
  });

  test("survive a restart of the server", async () => {
    const folder = mkdtempSync(join(tmpdir(), "atlas-sidebar-"));
    try {
      const file = join(folder, "atlas.db");
      database = openDatabase(file);
      await send(apiWith(), "/api/sidebar/doc?path=details%2Fa-page", {
        method: "PUT",
        json: { title: "A page" },
      });
      database.$client.close();
      database = openDatabase(file);
      const read = await send(
        apiWith(),
        "/api/sidebar/doc?path=details%2Fa-page",
      );
      expect(await read?.json()).toMatchObject({ data: { title: "A page" } });
      database.$client.close();
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  test("refuse a path the sidebar does not store", async () => {
    const api = apiWith();
    for (const path of [
      "other/x",
      "board/",
      "board/../x",
      "board/A",
      "board/a/b",
    ]) {
      const response = await send(
        api,
        `/api/sidebar/doc?path=${encodeURIComponent(path)}`,
        { method: "PUT", json: {} },
      );
      expect(response?.status).toBe(400);
    }
  });

  test("tell every open stream which document changed, and nothing of its content", async () => {
    const api = apiWith();
    const controller = new AbortController();
    const response = await send(api, "/api/stream", {
      signal: controller.signal,
    });
    await send(api, "/api/sidebar/doc?path=board%2Fhosts", {
      method: "PUT",
      json: { secret: "do-not-stream" },
    });
    const reader = response!.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes("event: sidebar-doc")) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    controller.abort();
    expect(text).toContain(
      `event: sidebar-doc\ndata: {"path":"board/hosts","version":1}\n\n`,
    );
    expect(text).not.toContain("do-not-stream");
  });
});

describe("the sidebar page", () => {
  test("is not found when no built page is configured", async () => {
    const response = await send(apiWith(), "/sidebar");
    expect(response?.status).toBe(404);
  });

  test("is the built page, marked as served by Atlas", async () => {
    const api = apiWith({
      sidebarPage: () =>
        markPage("<html><head><title>Atlas</title></head></html>"),
    });
    const response = await send(api, "/sidebar");
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toStartWith("text/html");
    expect(await response?.text()).toContain(
      '<meta name="atlas-runtime" content="server" />',
    );
  });

  test("can be shown in a frame inside another app", async () => {
    const api = apiWith({
      sidebarPage: () => markPage("<html><head></head></html>"),
    });
    const response = await send(api, "/sidebar");
    expect(response?.status).toBe(200);
    expect(response?.headers.get("x-frame-options")).toBeNull();
    expect(
      response?.headers.get("content-security-policy") ?? "",
    ).not.toContain("frame-ancestors");
  });

  test("is refused to a caller the API refuses", async () => {
    const api = apiWith({
      requireTokens: true,
      sidebarPage: () => "<html></html>",
    });
    expect((await send(api, "/sidebar"))?.status).toBe(401);
    const person = await send(api, "/sidebar", {
      headers: { "tailscale-user-login": "person@example.com" },
    });
    expect(person?.status).toBe(200);
  });

  test("is read from its file again only after the file changes", () => {
    const folder = mkdtempSync(join(tmpdir(), "atlas-sidebar-"));
    try {
      const file = join(folder, "index.html");
      const page = sidebarPageFile(file);
      expect(page()).toBeUndefined();
      writeFileSync(file, "<html><head></head>one</html>");
      expect(page()).toContain("one");
      expect(page()).toContain('name="atlas-runtime"');
      writeFileSync(file, "<html><head></head>two</html>");
      utimesSync(file, new Date(), new Date(Date.now() + 5000));
      expect(page()).toContain("two");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("the dashboard host", () => {
  const fixture = join(import.meta.dir, "fixtures", "dashboard-server.ts");

  test("calls a tool on a stdio MCP server and reads a tool error", async () => {
    const host = createDashboardHost(
      stdioConnector(`"${process.execPath}" "${fixture}"`),
    );
    try {
      const answer = await host.call("worklist", { day: "2026-11-09" });
      expect(answer).toMatchObject({
        ok: true,
        result: { structuredContent: { echoed: { day: "2026-11-09" } } },
      });
      expect(await host.call("task_done", {})).toEqual({
        ok: false,
        code: "tool_error",
        message: "no task with that ref",
      });
    } finally {
      await host.close();
    }
  });

  test("says the server is unavailable when the command does not start, and tries again", async () => {
    let attempts = 0;
    const host = createDashboardHost(async () => {
      attempts += 1;
      throw new Error("no such program");
    });
    expect(await host.call("worklist", {})).toMatchObject({
      ok: false,
      code: "server_unavailable",
    });
    await host.call("worklist", {});
    expect(attempts).toBe(2);
  });
});

describe("configuration", () => {
  test("reads the dashboard command and the sidebar file, both off by default", () => {
    expect(readConfiguration({}).dashboardCommand).toBeUndefined();
    expect(readConfiguration({}).sidebarFile).toBeUndefined();
    const configured = readConfiguration({
      ATLAS_DASHBOARD_MCP_COMMAND:
        ' /usr/bin/python3 "/srv/dash board/server.py" ',
      ATLAS_SIDEBAR_FILE: "/srv/sidebar/index.html",
    });
    expect(configured.dashboardCommand).toBe(
      '/usr/bin/python3 "/srv/dash board/server.py"',
    );
    expect(configured.sidebarFile).toBe("/srv/sidebar/index.html");
  });
});
