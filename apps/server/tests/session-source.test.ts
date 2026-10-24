import { Dataset, type Agent } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createApi,
  createSessionReader,
  dockedAgentId,
  dockedNote,
  listEvents,
  matchSession,
  moreActive,
  openDatabase,
  parseSessionFile,
  readConfiguration,
  readDataset,
  seedDataset,
  type Api,
  type AtlasDatabase,
  type Session,
  type SessionReader,
} from "../src";
import * as schema from "../src/schema";

/** An invented agent, for the cases the fixtures do not cover. */
function agent(id: string, name: string): Agent {
  return {
    id,
    name,
    groupId: "upkeep",
    accountId: "claude-work",
    host: "mini",
    reach: "local",
    status: "idle",
    workingOn: [],
    note: "",
    classification: "internal",
    boundary: "home-server",
  };
}

function session(overrides: Partial<Session> = {}): Session {
  return { pid: 100, status: "idle", statusUpdatedAt: 0, ...overrides };
}

/** The shape Claude Code writes, with fields Atlas must never keep. */
function sessionFile(pid: number, name: string, status: string, at = 1) {
  return JSON.stringify({
    pid,
    sessionId: `0000000${pid}-aaaa-bbbb-cccc-000000000000`,
    cwd: "/Users/example/projects/sample-app",
    startedAt: 1,
    version: "9.9.9",
    kind: "interactive",
    entrypoint: "sdk-cli",
    name,
    nameSource: "user",
    nameSince: 1,
    status,
    statusUpdatedAt: at,
    updatedAt: at,
  });
}

describe("session files", () => {
  test("keep only the fields Atlas reads", () => {
    const parsed = parseSessionFile(sessionFile(4321, " Invoices ", "busy"), 1);
    expect(parsed).toEqual({
      pid: 4321,
      name: "Invoices",
      status: "busy",
      sessionId: "00000004321-aaaa-bbbb-cccc-000000000000",
      statusUpdatedAt: 1,
      entrypoint: "sdk-cli",
    });
    expect(JSON.stringify(parsed)).not.toContain("projects");
  });

  test("take the process id from the file name when the file has none", () => {
    expect(parseSessionFile('{"status":"idle"}', 77)?.pid).toBe(77);
  });

  test("refuse text that is half written or has another shape", () => {
    expect(parseSessionFile('{"status":"bu', 1)).toBeUndefined();
    expect(parseSessionFile('{"status":"thinking"}', 1)).toBeUndefined();
    expect(parseSessionFile("[]", 1)).toBeUndefined();
    expect(parseSessionFile('{"status":"idle","pid":-1}', 0)).toBeUndefined();
  });

  test("read leniently: a field of the wrong type is dropped, not fatal", () => {
    expect(
      parseSessionFile('{"status":"idle","name":42,"statusUpdatedAt":"x"}', 5),
    ).toEqual({ pid: 5, status: "idle", statusUpdatedAt: 0 });
  });
});

describe("matching a session to an agent", () => {
  const agents = [
    agent("invoices", "Invoices"),
    agent("tracker-sync", "Tracker sync"),
    agent("release", "Release"),
    agent("release-notes", "Release notes"),
  ];

  test("by id or name, without regard to case", () => {
    expect(matchSession(agents, "INVOICES").agentId).toBe("invoices");
    expect(matchSession(agents, " tracker SYNC ").agentId).toBe("tracker-sync");
  });

  test("by the id or name followed by a hyphen", () => {
    expect(matchSession(agents, "invoices-69").agentId).toBe("invoices");
    expect(matchSession(agents, "Tracker sync-2").agentId).toBe("tracker-sync");
    expect(matchSession(agents, "invoicesX").agentId).toBeUndefined();
  });

  test("exact beats prefix, and the longer prefix wins", () => {
    expect(matchSession(agents, "release-notes").agentId).toBe("release-notes");
    expect(matchSession(agents, "release-notes-3").agentId).toBe(
      "release-notes",
    );
    expect(matchSession(agents, "release-7").agentId).toBe("release");
  });

  test("two agents matching equally name nobody", () => {
    const twins = [agent("harbour", "Pier"), agent("harbour-two", "Harbour")];
    expect(matchSession(twins, "harbour")).toEqual({ ambiguous: true });
    expect(matchSession(agents, "lighthouse")).toEqual({ ambiguous: false });
  });

  test("the most active session wins, then the latest change", () => {
    const busy = session({ status: "busy" });
    const waiting = session({ status: "waiting", statusUpdatedAt: 9 });
    const idleLater = session({ statusUpdatedAt: 5 });
    expect(moreActive(busy, waiting)).toBe(true);
    expect(moreActive(waiting, idleLater)).toBe(true);
    expect(moreActive(idleLater, session())).toBe(true);
    expect(moreActive(session(), idleLater)).toBe(false);
  });

  test("a docked agent's id never collides", () => {
    expect(dockedAgentId("Lighthouse Keeper!", new Set())).toBe(
      "session-lighthouse-keeper",
    );
    expect(
      dockedAgentId(
        "lighthouse",
        new Set(["session-lighthouse", "session-lighthouse-2"]),
      ),
    ).toBe("session-lighthouse-3");
    expect(dockedAgentId("***", new Set())).toBe("session");
  });
});

describe("the session reader", () => {
  let directory: string;
  let database: AtlasDatabase;
  let api: Api;
  let reader: SessionReader;
  let alive: Set<number>;
  let clock: Date;
  let refreshes: number;
  let logged: string[];

  function makeReader() {
    const made = createSessionReader({
      directory,
      database,
      isAlive: (pid) => alive.has(pid),
      host: "test-host",
      forgetHours: 24,
      now: () => clock,
      log: (line) => logged.push(line),
    });
    made.subscribe(() => refreshes++);
    return made;
  }

  function write(pid: number, name: string, status: string, at = 1) {
    writeFileSync(
      join(directory, `${pid}.json`),
      sessionFile(pid, name, status, at),
    );
    alive.add(pid);
  }

  function agentById(id: string) {
    return readDataset(database).agents.find((each) => each.id === id);
  }

  function statusEvents() {
    return listEvents(database)
      .map((stored) => stored.event)
      .filter((event) => event.type === "status-change");
  }

  async function health() {
    const response = await api.handle(
      new Request("http://atlas.test/api/health"),
    );
    return (await response?.json()).sessions;
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "atlas-sessions-"));
    database = openDatabase(":memory:");
    seedDataset(database, sampleDataset);
    alive = new Set();
    clock = new Date("2026-10-24T09:00:00Z");
    refreshes = 0;
    logged = [];
    reader = makeReader();
    api = createApi({ database, version: "0.0.0-test", sessions: reader });
  });

  afterEach(() => {
    api.close();
    reader.stop();
    database.$client.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("maps busy, waiting and idle to running, waiting and idle", () => {
    write(11, "test-runner-1", "busy");
    write(12, "Portal", "waiting");
    write(13, "schema", "idle");
    reader.poll();
    expect(agentById("test-runner")).toMatchObject({
      status: "running",
      note: "Session busy",
    });
    expect(agentById("portal")).toMatchObject({
      status: "waiting",
      note: "Session waiting on you",
    });
    expect(agentById("schema")).toMatchObject({
      status: "idle",
      note: "Session idle",
    });
    expect(statusEvents()).toHaveLength(3);
  });

  test("records no event when nothing changed", () => {
    // Invoices is already running in the fixtures.
    write(11, "invoices", "busy");
    reader.poll();
    reader.poll();
    expect(statusEvents()).toHaveLength(0);
    write(11, "invoices", "idle");
    reader.poll();
    reader.poll();
    expect(statusEvents()).toHaveLength(1);
  });

  test("keeps a status the agent reported itself until its session changes", async () => {
    write(11, "schema", "idle");
    reader.poll();
    await api.handle(
      new Request("http://atlas.test/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "status-change",
          agentId: "schema",
          to: "blocked",
          text: "Waiting on the schema review",
        }),
      }),
    );
    reader.poll();
    expect(agentById("schema")?.status).toBe("blocked");
    write(11, "schema", "busy");
    reader.poll();
    expect(agentById("schema")?.status).toBe("running");
  });

  test("lets the most active of several sessions speak for one agent", () => {
    write(11, "schema-1", "idle", 50);
    write(12, "schema-2", "waiting", 10);
    write(13, "Schema", "waiting", 20);
    reader.poll();
    expect(agentById("schema")?.status).toBe("waiting");
    write(14, "schema-3", "busy", 5);
    reader.poll();
    expect(agentById("schema")?.status).toBe("running");
  });

  test("sets an agent offline when its file goes, or its process ends", () => {
    write(11, "test-runner", "busy");
    write(12, "portal", "idle");
    reader.poll();
    unlinkSync(join(directory, "11.json"));
    alive.delete(12);
    reader.poll();
    expect(agentById("test-runner")).toMatchObject({
      status: "idle",
      note: "Session offline",
    });
    expect(agentById("portal")).toMatchObject({
      status: "idle",
      note: "Session offline",
    });
    reader.poll();
    expect(
      statusEvents().filter((event) => event.text === "Session offline"),
    ).toHaveLength(2);
  });

  test("remembers across a restart which agents follow a session", () => {
    write(11, "test-runner", "busy");
    reader.poll();
    unlinkSync(join(directory, "11.json"));
    const restarted = makeReader();
    api.close();
    api = createApi({ database, version: "0.0.0-test", sessions: restarted });
    restarted.poll();
    expect(agentById("test-runner")?.note).toBe("Session offline");
  });

  test("leaves agents with no session alone", () => {
    write(11, "invoices", "idle");
    reader.poll();
    const before = Dataset.parse(sampleDataset).agents.filter(
      (each) => each.id !== "invoices",
    );
    const after = readDataset(database).agents.filter(
      (each) => each.id !== "invoices",
    );
    expect(after).toEqual(before);
  });

  test("docks an unknown session at home, then forgets it", async () => {
    write(21, "Lighthouse keeper", "busy");
    reader.poll();
    const docked = agentById("session-lighthouse-keeper");
    expect(docked).toEqual({
      id: "session-lighthouse-keeper",
      name: "Lighthouse keeper",
      groupId: "upkeep",
      accountId: sampleDataset.accounts[0]?.id ?? "",
      host: "test-host",
      reach: "local",
      status: "running",
      workingOn: [],
      note: dockedNote,
      classification: sampleDataset.groups[0]?.classification ?? "internal",
      boundary: sampleDataset.groups[0]?.boundary ?? "",
    });
    expect(refreshes).toBe(1);
    expect(await health()).toMatchObject({ unknownDocked: 1, matched: 0 });

    alive.delete(21);
    clock = new Date("2026-10-24T10:00:00Z");
    reader.poll();
    expect(agentById("session-lighthouse-keeper")).toMatchObject({
      status: "idle",
      note: "Session offline",
    });
    clock = new Date("2026-10-25T09:59:00Z");
    reader.poll();
    expect(agentById("session-lighthouse-keeper")).toBeDefined();
    clock = new Date("2026-10-25T10:00:00Z");
    reader.poll();
    expect(agentById("session-lighthouse-keeper")).toBeUndefined();
    expect(refreshes).toBe(2);
    expect(readDataset(database).agents).toHaveLength(
      sampleDataset.agents.length,
    );
  });

  test("docks two sessions of one unknown name as one agent, and never reuses an id", () => {
    database
      .insert(schema.agents)
      .values({ ...agent("session-beacon", "Old beacon"), groupId: "go-live" })
      .run();
    write(21, "beacon", "idle", 5);
    write(22, "Beacon", "busy", 1);
    reader.poll();
    const docked = readDataset(database).agents.filter(
      (each) => each.note === dockedNote,
    );
    expect(docked).toHaveLength(1);
    expect(docked[0]).toMatchObject({
      id: "session-beacon-2",
      status: "running",
    });
  });

  test("removes a docked agent once its name is on the roster", () => {
    write(21, "lighthouse-2", "busy");
    reader.poll();
    expect(agentById("session-lighthouse-2")).toBeDefined();
    database
      .insert(schema.agents)
      .values(agent("lighthouse", "Lighthouse"))
      .run();
    reader.poll();
    expect(agentById("session-lighthouse-2")).toBeUndefined();
    expect(agentById("lighthouse")).toMatchObject({
      status: "running",
      note: "Session busy",
    });
  });

  test("counts an ambiguous session and changes nothing", async () => {
    database.insert(schema.agents).values(agent("harbour", "Pier")).run();
    database
      .insert(schema.agents)
      .values(agent("harbour-two", "Harbour"))
      .run();
    write(21, "harbour", "busy");
    reader.poll();
    expect(agentById("harbour")?.status).toBe("idle");
    expect(agentById("harbour-two")?.status).toBe("idle");
    expect(statusEvents()).toHaveLength(0);
    expect(await health()).toMatchObject({ ambiguous: 1, unknownDocked: 0 });
  });

  test("skips a malformed file and ignores everything that is not a session", async () => {
    write(11, "test-runner", "busy");
    writeFileSync(join(directory, "12.json"), '{"status":"bu');
    writeFileSync(join(directory, "13.abcdef.key"), "secret-ish");
    writeFileSync(join(directory, "notes.json"), "{}");
    reader.poll();
    expect(agentById("test-runner")?.status).toBe("running");
    expect(await health()).toEqual({
      source: "files",
      ok: true,
      files: 2,
      live: 1,
      matched: 1,
      unknownDocked: 0,
      ambiguous: 0,
      skipped: 1,
      lastReadAt: clock.toISOString(),
      error: null,
    });
  });

  test("reports a whole-format change in health and changes nothing", async () => {
    write(11, "test-runner", "busy");
    reader.poll();
    writeFileSync(
      join(directory, "11.json"),
      JSON.stringify({ pid: 11, name: "test-runner", state: "working" }),
    );
    reader.poll();
    expect(agentById("test-runner")?.status).toBe("running");
    const reported = await health();
    expect(reported).toMatchObject({ ok: false, files: 1, skipped: 1 });
    expect(reported.error).toContain("expected shape");
    expect(logged).toHaveLength(1);
    reader.poll();
    expect(logged).toHaveLength(1);
  });

  test("reports a folder it cannot read", async () => {
    rmSync(directory, { recursive: true, force: true });
    reader.poll();
    expect(await health()).toMatchObject({
      source: "files",
      ok: false,
      error: "the sessions folder cannot be read",
    });
  });

  test("health never names a session", async () => {
    write(21, "Lighthouse keeper", "busy");
    reader.poll();
    const text = JSON.stringify(await health());
    expect(text.toLowerCase()).not.toContain("lighthouse");
  });
});

describe("the sessions configuration", () => {
  test("is off without a folder", () => {
    expect(readConfiguration({}).sessions).toBeUndefined();
  });

  test("polls every 5 seconds and forgets after 24 hours unless set", () => {
    expect(
      readConfiguration({ ATLAS_SESSIONS_DIR: "/tmp/sessions" }).sessions,
    ).toEqual({ directory: "/tmp/sessions", pollSeconds: 5, forgetHours: 24 });
    expect(
      readConfiguration({
        ATLAS_SESSIONS_DIR: "/tmp/sessions",
        ATLAS_SESSIONS_POLL_SECONDS: "2",
        ATLAS_SESSIONS_FORGET_HOURS: "0.5",
      }).sessions,
    ).toEqual({ directory: "/tmp/sessions", pollSeconds: 2, forgetHours: 0.5 });
  });

  test("refuses a poll or a window that makes no sense", () => {
    expect(() =>
      readConfiguration({
        ATLAS_SESSIONS_DIR: "/tmp/sessions",
        ATLAS_SESSIONS_POLL_SECONDS: "0",
      }),
    ).toThrow();
    expect(() =>
      readConfiguration({
        ATLAS_SESSIONS_DIR: "/tmp/sessions",
        ATLAS_SESSIONS_FORGET_HOURS: "never",
      }),
    ).toThrow();
  });
});
