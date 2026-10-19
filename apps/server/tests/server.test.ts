import { applyEvent, type AtlasEvent } from "@atlas/core";
import { busyDataset, sampleDataset, sampleScript } from "@atlas/fixtures";
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import {
  appendEvent,
  createApi,
  EventRejected,
  isEmpty,
  listEvents,
  openDatabase,
  readConfiguration,
  readDataset,
  readSeedFile,
  seedDataset,
  sequenceHeader,
  type Api,
  type AtlasDatabase,
} from "../src";

const scriptedEvents = sampleScript.filter(
  (step): step is AtlasEvent => step.type !== "reset",
);
function firstOf<Type extends AtlasEvent["type"]>(type: Type) {
  const found = scriptedEvents.find((event) => event.type === type);
  if (!found) throw new Error(`the scripted day has no ${type} event`);
  return found as Extract<AtlasEvent, { type: Type }>;
}
const statusChange = firstOf("status-change");
const answer = firstOf("question-answered");

let database: AtlasDatabase;

beforeEach(() => {
  database = openDatabase(":memory:");
  seedDataset(database, sampleDataset);
});

describe("the store", () => {
  test("reads back exactly the dataset it was seeded with", () => {
    expect(readDataset(database)).toEqual(sampleDataset);
  });

  test("reads back workstreams, and the items grouped under them", () => {
    const busy = openDatabase(":memory:");
    seedDataset(busy, busyDataset);
    const read = readDataset(busy);
    expect(read).toEqual(busyDataset);
    expect(read.workstreams.length).toBeGreaterThan(10);
    expect(read.items.some((item) => item.workstreamId)).toBe(true);
    expect(read.items.some((item) => !item.workstreamId)).toBe(true);
  });

  test("reads a dataset with no workstreams", () => {
    const none = openDatabase(":memory:");
    const plain = {
      ...sampleDataset,
      workstreams: [],
      items: sampleDataset.items.map(({ workstreamId: _, ...item }) => item),
    };
    seedDataset(none, plain);
    expect(readDataset(none)).toEqual(plain);
  });

  test("an empty database says so, and seeding twice is refused", () => {
    expect(isEmpty(openDatabase(":memory:"))).toBe(true);
    expect(isEmpty(database)).toBe(false);
    expect(() => seedDataset(database, sampleDataset)).toThrow(
      "already holds records",
    );
  });

  test("the scripted day leaves the database where the model says", () => {
    let expected = sampleDataset;
    for (const event of scriptedEvents) {
      appendEvent(database, event);
      expected = applyEvent(expected, event);
    }
    expect(readDataset(database)).toEqual(expected);
    expect(listEvents(database)).toHaveLength(scriptedEvents.length);
  });

  test("the log is in order and reads from a sequence", () => {
    const first = appendEvent(database, scriptedEvents[0]);
    const second = appendEvent(database, scriptedEvents[1]);
    expect(second.sequence).toBeGreaterThan(first.sequence);
    expect(listEvents(database, first.sequence)).toEqual([second]);
  });

  test("an event about a missing agent is refused and not logged", () => {
    expect(() =>
      appendEvent(database, {
        type: "status-change",
        agentId: "nobody",
        to: "idle",
        text: "Gone",
      }),
    ).toThrow(EventRejected);
    expect(listEvents(database)).toHaveLength(0);
  });

  test("a question cannot be answered twice", () => {
    appendEvent(database, answer);
    expect(() => appendEvent(database, answer)).toThrow("already answered");
    expect(listEvents(database)).toHaveLength(1);
  });

  test("an event that does not match the model is refused", () => {
    expect(() => appendEvent(database, { type: "status-change" })).toThrow();
    expect(listEvents(database)).toHaveLength(0);
  });
});

describe("the API", () => {
  let api: Api;
  const call = async (path: string, init?: RequestInit) => {
    const response = await api.handle(
      new Request(`http://atlas.test${path}`, init),
    );
    if (!response) throw new Error(`no response for ${path}`);
    return response;
  };
  const post = (body: unknown, contentType = "application/json") =>
    call("/api/events", {
      method: "POST",
      headers: { "content-type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeEach(() => {
    api = createApi({ database, version: "0.0.0-test" });
  });

  test("answers health with its version", async () => {
    const response = await call("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      version: "0.0.0-test",
    });
  });

  test("serves the dataset with the last event it includes", async () => {
    const response = await call("/api/dataset");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get(sequenceHeader)).toBe("0");
    expect(await response.json()).toEqual(sampleDataset);
    const stored = appendEvent(database, statusChange);
    const after = await call("/api/dataset");
    expect(after.headers.get(sequenceHeader)).toBe(String(stored.sequence));
  });

  test("leaves paths outside /api/ to the caller", async () => {
    expect(
      await api.handle(new Request("http://atlas.test/index.html")),
    ).toBeUndefined();
  });

  test("an unknown API route is a 404", async () => {
    expect((await call("/api/nothing")).status).toBe(404);
    expect((await call("/api/dataset", { method: "DELETE" })).status).toBe(404);
  });

  test("a posted event is stored, applied and listed", async () => {
    const response = await post(statusChange);
    expect(response.status).toBe(201);
    const stored = await response.json();
    expect(stored.event).toEqual(statusChange);
    const listed = await (await call("/api/events?after=0")).json();
    expect(listed).toEqual([stored]);
    const dataset = readDataset(database);
    expect(
      dataset.agents.find((agent) => agent.id === statusChange.agentId)?.status,
    ).toBe(statusChange.to);
  });

  test("refuses an event that is not JSON by content type", async () => {
    expect((await post(statusChange, "text/plain")).status).toBe(415);
    expect(listEvents(database)).toHaveLength(0);
  });

  test("refuses a body that is not JSON, or not an event", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ type: "status-change" })).status).toBe(400);
  });

  test("refuses an event that is too large", async () => {
    const response = await post({
      ...statusChange,
      text: "x".repeat(70 * 1024),
    });
    expect(response.status).toBe(413);
  });

  test("a missing record is a 404 and a second answer a 409", async () => {
    expect((await post({ ...statusChange, agentId: "nobody" })).status).toBe(
      404,
    );
    expect((await post(answer)).status).toBe(201);
    expect((await post(answer)).status).toBe(409);
  });

  test("refuses a sequence that is not a number", async () => {
    expect((await call("/api/events?after=first")).status).toBe(400);
  });

  test("a page opening the stream names the last event it has in ?after=", async () => {
    const first = appendEvent(database, scriptedEvents[0]);
    const second = appendEvent(database, scriptedEvents[1]);
    const controller = new AbortController();
    const response = await call(`/api/stream?after=${first.sequence}`, {
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes(": connected")) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toStartWith(`id: ${second.sequence}\n`);
    expect(text).not.toContain(`id: ${first.sequence}\n`);
    controller.abort();
  });

  test("streams each new event, and what a reconnecting reader missed", async () => {
    const missed = appendEvent(database, scriptedEvents[0]);
    const controller = new AbortController();
    const response = await call("/api/stream", {
      headers: { "last-event-id": "0" },
      signal: controller.signal,
    });
    expect(response.headers.get("content-type")).toStartWith(
      "text/event-stream",
    );
    expect(api.listeners()).toBe(1);
    await post(statusChange);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes(`"agentId":"${statusChange.agentId}"`)) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toStartWith(`id: ${missed.sequence}\n`);
    expect(text).toContain(": connected");
    controller.abort();
    expect(api.listeners()).toBe(0);
  });
});

describe("a database from before workstreams", () => {
  const directory = mkdtempSync(join(tmpdir(), "atlas-upgrade-"));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  test("keeps its records when the workstreams migration runs", () => {
    // The migrations as they were before 0002: the first two, and a journal
    // that names only them.
    const migrations = join(import.meta.dir, "..", "drizzle");
    const before = join(directory, "drizzle");
    cpSync(migrations, before, { recursive: true });
    rmSync(join(before, "0002_workstreams.sql"));
    const journalPath = join(before, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ tag: string }>;
    };
    journal.entries = journal.entries.filter(
      (entry) => entry.tag !== "0002_workstreams",
    );
    writeFileSync(journalPath, JSON.stringify(journal));

    const path = join(directory, "atlas.db");
    const old = new Database(path, { create: true });
    migrate(drizzle({ client: old }), { migrationsFolder: before });
    old.run(
      "INSERT INTO clients (id, classification, boundary, name, home) VALUES ('ashgrove', 'internal', 'home-server', 'Ashgrove Consulting', 1)",
    );
    old.run(
      "INSERT INTO items (id, classification, boundary, client_id, title, state, priority) VALUES ('send-invoices', 'internal', 'home-server', 'ashgrove', 'Send October invoices', 'doing', 'high')",
    );
    old.close();

    const upgraded = readDataset(openDatabase(path));
    expect(upgraded.workstreams).toEqual([]);
    expect(upgraded.items).toEqual([
      {
        id: "send-invoices",
        classification: "internal",
        boundary: "home-server",
        clientId: "ashgrove",
        title: "Send October invoices",
        state: "doing",
        priority: "high",
      },
    ]);
  });
});

describe("a seed file", () => {
  const directory = mkdtempSync(join(tmpdir(), "atlas-seed-"));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  test("is read and checked against the model", async () => {
    const path = join(directory, "seed.json");
    await Bun.write(path, JSON.stringify(sampleDataset));
    const empty = openDatabase(":memory:");
    seedDataset(empty, await readSeedFile(path));
    expect(readDataset(empty)).toEqual(sampleDataset);
  });

  test("written before workstreams existed, is still read", async () => {
    const path = join(directory, "older.json");
    const { workstreams: _, ...older } = sampleDataset;
    await Bun.write(path, JSON.stringify(older));
    expect((await readSeedFile(path)).workstreams).toEqual([]);
  });

  test("is refused when missing or not a dataset", async () => {
    const path = join(directory, "broken.json");
    await Bun.write(path, JSON.stringify({ clients: "none" }));
    await expect(readSeedFile(path)).rejects.toThrow();
    await expect(readSeedFile(join(directory, "absent.json"))).rejects.toThrow(
      "no seed file",
    );
  });
});

describe("the configuration", () => {
  test("listens on the loopback address unless told otherwise", () => {
    const configuration = readConfiguration({});
    expect(configuration.hostname).toBe("127.0.0.1");
    expect(configuration.port).toBe(7400);
    expect(configuration.seed).toEqual({ kind: "none" });
    expect(configuration.databasePath).toEndWith("Atlas/atlas.db");
  });

  test("reads the environment and refuses a bad port", () => {
    expect(
      readConfiguration({ ATLAS_PORT: "7500", ATLAS_SEED: "fixtures" }),
    ).toMatchObject({ port: 7500, seed: { kind: "fixtures" } });
    expect(() => readConfiguration({ ATLAS_PORT: "port" })).toThrow();
  });

  test("seeds from a .json file, and refuses any other seed", () => {
    expect(readConfiguration({ ATLAS_SEED: "/data/seed.json" }).seed).toEqual({
      kind: "file",
      path: "/data/seed.json",
    });
    expect(() => readConfiguration({ ATLAS_SEED: "real" })).toThrow();
  });
});
