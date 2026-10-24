import type { ItemLogEntry } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { beforeEach, describe, expect, test } from "bun:test";

import {
  createApi,
  createTaskCache,
  itemLogLimit,
  mapItemLogRows,
  mapTaskRows,
  onlyClients,
  openDatabase,
  seedDataset,
  type AtlasDatabase,
  type ItemRow,
  type TaskRows,
  type TaskSource,
} from "../src";

/** An item row the task database could hold. Invented, like every fixture. */
function itemRow(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: "webhooks",
    classification: "client-confidential",
    boundary: "home-server",
    client_id: "kestrel",
    requirement_id: null,
    workstream_id: null,
    title: "Sign the shipment webhooks",
    summary: null,
    state: "doing",
    priority: "normal",
    tracker: null,
    effort: null,
    scheduled_for: null,
    blocked: null,
    done_on: null,
    details_id: null,
    claim_by: null,
    claim_at: null,
    ...overrides,
  };
}

const taskRows: TaskRows = {
  clients: [
    {
      id: "kestrel",
      classification: "client-confidential",
      boundary: "home-server",
      name: "Kestrel Freight",
      home: null,
    },
    {
      id: "meridian",
      classification: "client-confidential",
      boundary: "home-server",
      name: "Meridian Bank",
      home: null,
    },
  ],
  workstreams: [],
  items: [
    itemRow(),
    itemRow({ id: "audit-trail", client_id: "meridian", title: "Audit" }),
  ],
  history: [],
};

const webhookLog: ItemLogEntry[] = [
  {
    at: "2026-10-24T09:12:00.000Z",
    status: "review",
    note: "Signed webhooks ready for review",
    by: "tracking",
  },
  {
    at: "2026-10-24T08:40:00.000Z",
    status: "doing",
    note: "Started on the signing key rotation",
  },
];

/** A task source that answers from memory, and records the log reads it was asked for. */
function fakeSource(options: { failLog?: boolean } = {}) {
  const asked: { itemId: string; limit: number }[] = [];
  const source: TaskSource = {
    async read() {
      return mapTaskRows(taskRows);
    },
    async readItemLog(itemId, limit) {
      asked.push({ itemId, limit });
      if (options.failLog) throw new Error("connection refused");
      return itemId === "webhooks" ? webhookLog : [];
    },
  };
  return { source, asked };
}

let database: AtlasDatabase;
beforeEach(() => {
  database = openDatabase(":memory:");
  seedDataset(database, sampleDataset);
});

async function setUp(
  source: TaskSource | undefined,
  options: { requireTokens?: boolean } = {},
) {
  const lines: string[] = [];
  const tasks = source
    ? createTaskCache({
        source,
        pollSeconds: 30,
        log: (line) => lines.push(line),
      })
    : undefined;
  await tasks?.refresh();
  const api = createApi({
    database,
    version: "0.0.0-test",
    ...(tasks ? { tasks } : {}),
    ...(options.requireTokens
      ? { requireTokens: true, lookupNode: async () => undefined }
      : {}),
  });
  const call = async (path: string) =>
    (await api.handle(new Request(`http://atlas.test${path}`)))!;
  return { call, lines };
}

describe("mapping item log rows", () => {
  test("keeps the order, reads times as ISO 8601, and an empty note as empty text", () => {
    expect(
      mapItemLogRows([
        {
          at: new Date("2026-10-24T09:12:00Z"),
          status: "review",
          note: "Signed webhooks ready for review",
          by: " tracking ",
        },
        { at: "2026-10-24T08:40:00Z", status: "doing", note: null, by: null },
      ]),
    ).toEqual([
      {
        at: "2026-10-24T09:12:00.000Z",
        status: "review",
        note: "Signed webhooks ready for review",
        by: "tracking",
      },
      { at: "2026-10-24T08:40:00.000Z", status: "doing", note: "" },
    ]);
  });

  test("leaves out a row with an unknown status or no valid time", () => {
    expect(
      mapItemLogRows([
        { at: "2026-10-24T09:12:00Z", status: "parked", note: "", by: null },
        { at: "not a time", status: "done", note: "", by: null },
        { at: "2026-10-24T09:14:00Z", status: "done", note: "Done", by: "" },
      ]),
    ).toEqual([
      { at: "2026-10-24T09:14:00.000Z", status: "done", note: "Done" },
    ]);
  });
});

describe("GET /api/items/:id/log", () => {
  test("serves the item's log, newest first, asking for at most the limit", async () => {
    const fake = fakeSource();
    const { call } = await setUp(fake.source);
    const response = await call("/api/items/webhooks/log");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: webhookLog });
    expect(fake.asked).toEqual([{ itemId: "webhooks", limit: itemLogLimit }]);
    expect(itemLogLimit).toBe(200);
  });

  test("refuses an id that is not an identifier, before asking the source", async () => {
    const fake = fakeSource();
    const { call } = await setUp(fake.source);
    for (const id of [
      "Webhooks",
      "web%20hooks",
      "%2Fetc",
      "%E0%A4%A",
      "-webhooks",
    ])
      expect((await call(`/api/items/${id}/log`)).status).toBe(400);
    expect(fake.asked).toEqual([]);
  });

  test("answers an empty list for an item the task source does not cover", async () => {
    const fake = fakeSource();
    const { call } = await setUp(fake.source);
    // A SQLite item of the home client, which the task source does not hold.
    const response = await call("/api/items/send-invoices/log");
    expect(await response.json()).toEqual({ entries: [] });
    expect(fake.asked).toEqual([]);
  });

  test("answers an empty list for a client left out by a client limit", async () => {
    const fake = fakeSource();
    const { call } = await setUp(onlyClients(fake.source, ["meridian"]));
    expect(await (await call("/api/items/webhooks/log")).json()).toEqual({
      entries: [],
    });
    expect(await (await call("/api/items/audit-trail/log")).json()).toEqual({
      entries: [],
    });
    expect(fake.asked).toEqual([{ itemId: "audit-trail", limit: 200 }]);
  });

  test("answers an empty list without a task source", async () => {
    const { call } = await setUp(undefined);
    const response = await call("/api/items/webhooks/log");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: [] });
  });

  test("answers an empty list when the source keeps no log", async () => {
    const { call } = await setUp({ read: async () => mapTaskRows(taskRows) });
    expect(await (await call("/api/items/webhooks/log")).json()).toEqual({
      entries: [],
    });
  });

  test("says the task database did not answer, and logs only the failure's name", async () => {
    const { call, lines } = await setUp(fakeSource({ failLog: true }).source);
    const response = await call("/api/items/webhooks/log");
    expect(response.status).toBe(503);
    expect(lines.at(-1)).toBe("item log unreadable (Error)");
    expect(lines.join("\n")).not.toContain("connection refused");
  });

  test("follows the same sign-in rule as the rest of the API", async () => {
    const { call } = await setUp(fakeSource().source, { requireTokens: true });
    expect((await call("/api/items/webhooks/log")).status).toBe(401);
  });
});
