import type { UsageLimitSignalEvent } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createApi,
  createSessionReader,
  listEvents,
  openDatabase,
  readDataset,
  seedDataset,
  type Api,
  type AtlasDatabase,
  type LimitedSession,
  type SessionReader,
} from "../src";

const cwd = "/Users/example/work/sample-app";
const sessionId = "11111111-2222-3333-4444-555555555555";
// 25 Oct 2026 18:00 UTC, as Unix seconds.
const resetsAt = Date.parse("2026-10-25T18:00:00Z") / 1000;

/** The usage-limit line Claude Code 2.1.317 writes, text included. */
function limitLine(at: string) {
  const limits = {
    status: "rejected",
    resetsAt,
    rateLimitType: "seven_day",
    overageStatus: "rejected",
  };
  return `${JSON.stringify({
    type: "assistant",
    timestamp: at,
    message: {
      model: "<synthetic>",
      content: [
        {
          type: "text",
          text: "You've hit your weekly limit · resets Oct 25 at 6pm (Europe/London)",
        },
      ],
    },
    apiError: "usage_limit_reached",
    apiErrorParams: { rate_limit_info: limits },
    quotaLimits: limits,
    error: "rate_limit",
    isApiErrorMessage: true,
    apiErrorStatus: 429,
  })}\n`;
}

function replyLine(at: string) {
  return `${JSON.stringify({
    type: "assistant",
    timestamp: at,
    message: {
      model: "claude-example",
      content: [{ type: "text", text: "Done" }],
    },
  })}\n`;
}

describe("usage limits in the session reader", () => {
  let root: string;
  let database: AtlasDatabase;
  let api: Api;
  let reader: SessionReader;
  let alive: Set<number>;
  let clock: Date;
  let limited: LimitedSession[];

  /** An account folder as Claude Code lays it out: sessions/ and projects/. */
  function folder(name: string) {
    const path = join(root, name);
    mkdirSync(join(path, "sessions"), { recursive: true });
    mkdirSync(join(path, "projects", cwd.replace(/[/.]/g, "-")), {
      recursive: true,
    });
    return path;
  }

  function transcript(account: string) {
    return join(
      root,
      account,
      "projects",
      cwd.replace(/[/.]/g, "-"),
      `${sessionId}.jsonl`,
    );
  }

  function writeSession(
    account: string,
    pid: number,
    name: string,
    startedAt = Date.parse("2026-10-24T08:00:00Z"),
  ) {
    writeFileSync(
      join(root, account, "sessions", `${pid}.json`),
      JSON.stringify({
        pid,
        sessionId,
        cwd,
        startedAt,
        name,
        status: "idle",
        statusUpdatedAt: 1,
      }),
    );
    alive.add(pid);
  }

  function make(folders: { account: string | null; path: string }[]) {
    reader = createSessionReader({
      folders: folders.map(({ account, path }) => ({
        account,
        sessions: join(path, "sessions"),
        projects: join(path, "projects"),
      })),
      database,
      isAlive: (pid) => alive.has(pid),
      host: "test-host",
      timeZone: "UTC",
      now: () => clock,
      log: () => {},
      onUsageLimit: (session) => limited.push(session),
    });
    api = createApi({ database, version: "0.0.0-test", sessions: reader });
  }

  function agentById(id: string) {
    return readDataset(database).agents.find((each) => each.id === id);
  }

  function signals() {
    return listEvents(database)
      .map((stored) => stored.event)
      .filter(
        (event): event is UsageLimitSignalEvent =>
          event.type === "signal" && event.kind === "usage-limit",
      );
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "atlas-accounts-"));
    database = openDatabase(":memory:");
    seedDataset(database, sampleDataset);
    alive = new Set();
    clock = new Date("2026-10-24T09:00:00Z");
    limited = [];
  });

  afterEach(() => {
    api?.close();
    reader?.stop();
    database.$client.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("shows a session whose transcript ends in a usage limit as blocked, with one signal", () => {
    const path = folder("default");
    make([{ account: null, path }]);
    writeSession("default", 11, "Schema");
    writeFileSync(
      transcript("default"),
      replyLine("2026-10-24T08:30:00Z") + limitLine("2026-10-24T08:55:00Z"),
    );
    reader.poll();
    reader.poll();
    expect(agentById("schema")).toMatchObject({
      status: "blocked",
      note: "Weekly usage limit reached, resets 25 Oct 18:00",
    });
    expect(signals()).toEqual([
      {
        type: "signal",
        source: "claude",
        key: `claude:usage-limit:${sessionId}:2026-10-24T08:55:00Z`,
        kind: "usage-limit",
        event: "limit_reached",
        agentId: "schema",
        account: null,
        limitKind: "weekly",
        resetsAt: "2026-10-25T18:00:00.000Z",
        client: expect.any(String),
        recordIds: ["schema"],
        at: "2026-10-24T08:55:00Z",
        text: "Weekly usage limit reached, resets 25 Oct 18:00",
      },
    ]);
    expect(JSON.stringify(signals())).not.toContain("hit your");
    expect(JSON.stringify(signals())).not.toContain("sample-app");
  });

  test("clears the block when a reply follows, and after the reset time", () => {
    const path = folder("default");
    make([{ account: null, path }]);
    writeSession("default", 11, "Schema");
    writeFileSync(transcript("default"), limitLine("2026-10-24T08:55:00Z"));
    reader.poll();
    expect(agentById("schema")?.status).toBe("blocked");
    appendFileSync(transcript("default"), replyLine("2026-10-24T09:01:00Z"));
    reader.poll();
    expect(agentById("schema")).toMatchObject({
      status: "idle",
      note: "Session idle",
    });

    writeFileSync(transcript("default"), limitLine("2026-10-24T09:05:00Z"));
    reader.poll();
    expect(agentById("schema")?.status).toBe("blocked");
    clock = new Date("2026-10-25T18:01:00Z");
    reader.poll();
    expect(agentById("schema")?.status).toBe("idle");
    expect(signals()).toHaveLength(2);
  });

  test("ignores a limit hit before the session's process started", () => {
    const path = folder("default");
    make([{ account: null, path }]);
    // Resumed at 09:00 under another account; the limit line is from 08:55.
    writeSession("default", 11, "Schema", Date.parse("2026-10-24T09:00:00Z"));
    writeFileSync(transcript("default"), limitLine("2026-10-24T08:55:00Z"));
    reader.poll();
    expect(agentById("schema")?.status).toBe("idle");
    expect(signals()).toHaveLength(0);
  });

  test("reads each account's folder and names the account", async () => {
    make([
      { account: "ultra-a", path: folder("ultra-a") },
      { account: "ultra-b", path: folder("ultra-b") },
    ]);
    writeSession("ultra-b", 21, "Schema");
    writeFileSync(transcript("ultra-b"), limitLine("2026-10-24T08:55:00Z"));
    reader.poll();
    expect(signals()[0]?.account).toBe("ultra-b");
    expect(limited).toEqual([
      {
        signalKey: `claude:usage-limit:${sessionId}:2026-10-24T08:55:00Z`,
        agentId: "schema",
        account: "ultra-b",
        sessionName: "Schema",
        sessionId,
        cwd,
        pid: 21,
        limit: {
          kind: "weekly",
          resetsAt: "2026-10-25T18:00:00.000Z",
          at: "2026-10-24T08:55:00Z",
        },
      },
    ]);
    const response = await api.handle(
      new Request("http://atlas.test/api/health"),
    );
    const health = (await response?.json()).sessions;
    expect(health).toMatchObject({ live: 1, limited: 1 });
    expect(JSON.stringify(health)).not.toContain("ultra");
  });

  test("counts a session in two folders once", () => {
    const a = folder("ultra-a");
    make([
      { account: "ultra-a", path: a },
      { account: "ultra-a-again", path: a },
    ]);
    writeSession("ultra-a", 21, "Schema");
    writeFileSync(transcript("ultra-a"), limitLine("2026-10-24T08:55:00Z"));
    reader.poll();
    expect(limited).toHaveLength(1);
    expect(limited[0]?.account).toBe("ultra-a");
  });
});
