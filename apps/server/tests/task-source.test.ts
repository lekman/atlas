import { findBrokenReferences, type Dataset } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { beforeEach, describe, expect, test } from "bun:test";

import {
  appendEvent,
  claimantOf,
  createApi,
  createTaskCache,
  failureName,
  mapTaskRows,
  mergeTasks,
  onlyClients,
  openDatabase,
  passwordFromCommand,
  PasswordCommandFailed,
  readConfiguration,
  readDataset,
  seedDataset,
  splitCommand,
  type AtlasDatabase,
  type ClientRow,
  type ItemRow,
  type TaskRecords,
  type TaskRows,
  type TaskSource,
  type WorkstreamRow,
} from "../src";

/** A client row the task database could hold. Invented, like every fixture. */
function clientRow(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: "kestrel",
    classification: "client-confidential",
    boundary: "home-server",
    name: "Kestrel Freight Group",
    home: null,
    ...overrides,
  };
}

function workstreamRow(overrides: Partial<WorkstreamRow> = {}): WorkstreamRow {
  return {
    id: "kestrel-partners",
    classification: "client-confidential",
    boundary: "home-server",
    client_id: "kestrel",
    title: "Partner integrations",
    summary: null,
    order: null,
    ...overrides,
  };
}

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
    state: "todo",
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

function rows(overrides: Partial<TaskRows> = {}): TaskRows {
  return {
    clients: [clientRow()],
    workstreams: [workstreamRow()],
    items: [
      itemRow({ workstream_id: "kestrel-partners", state: "doing" }),
      itemRow({ id: "rate-limits", workstream_id: "kestrel-partners" }),
      itemRow({ id: "retention-draft", state: "review" }),
    ],
    history: [],
    ...overrides,
  };
}

/** A task source that answers from memory, or fails when told to. */
function fakeSource(initial: TaskRows) {
  let current: TaskRows = initial;
  let failure: Error | undefined;
  let reads = 0;
  const source: TaskSource = {
    async read() {
      reads++;
      if (failure) throw failure;
      return mapTaskRows(current);
    },
  };
  return {
    source,
    set(next: TaskRows) {
      current = next;
    },
    fail(error: Error | undefined) {
      failure = error;
    },
    reads: () => reads,
  };
}

const empty: TaskRecords = {
  clients: [],
  workstreams: [],
  items: [],
  claims: [],
  skipped: 0,
};

describe("mapping task database rows", () => {
  test("maps clients, workstreams and items onto the core model", () => {
    const records = mapTaskRows(
      rows({
        clients: [
          clientRow(),
          clientRow({ id: "orchard", name: "Orchard Dairy", home: false }),
        ],
        workstreams: [workstreamRow({ summary: "", order: 2 })],
        items: [
          itemRow({
            workstream_id: "kestrel-partners",
            requirement_id: "shipment-api",
            summary: "Sign every webhook body",
            state: "done",
            priority: "high",
            tracker: {
              system: "github",
              key: "#12",
              url: "https://example.com/issues/12",
            },
            effort: "M",
            scheduled_for: "2026-10-23",
            done_on: "2026-10-24",
            blocked: false,
            details_id: "webhook-notes",
          }),
        ],
      }),
    );
    expect(records.skipped).toBe(0);
    expect(records.clients).toEqual([
      {
        id: "kestrel",
        classification: "client-confidential",
        boundary: "home-server",
        name: "Kestrel Freight Group",
      },
      {
        id: "orchard",
        classification: "client-confidential",
        boundary: "home-server",
        name: "Orchard Dairy",
      },
    ]);
    expect(records.workstreams).toEqual([
      {
        id: "kestrel-partners",
        classification: "client-confidential",
        boundary: "home-server",
        clientId: "kestrel",
        title: "Partner integrations",
        order: 2,
      },
    ]);
    expect(records.items).toEqual([
      {
        id: "webhooks",
        classification: "client-confidential",
        boundary: "home-server",
        clientId: "kestrel",
        requirementId: "shipment-api",
        workstreamId: "kestrel-partners",
        title: "Sign the shipment webhooks",
        summary: "Sign every webhook body",
        state: "done",
        priority: "high",
        tracker: {
          system: "github",
          key: "#12",
          url: "https://example.com/issues/12",
        },
        effort: "M",
        scheduledFor: "2026-10-23",
        doneOn: "2026-10-24",
        detailsId: "webhook-notes",
      },
    ]);
  });

  test("marks a client home only when the row says so", () => {
    const records = mapTaskRows(rows({ clients: [clientRow({ home: true })] }));
    expect(records.clients[0]?.home).toBe(true);
  });

  test("leaves dropped items out, without counting them as skipped", () => {
    const records = mapTaskRows(
      rows({
        items: [itemRow(), itemRow({ id: "old-idea", state: "dropped" })],
      }),
    );
    expect(records.items.map((item) => item.id)).toEqual(["webhooks"]);
    expect(records.skipped).toBe(0);
  });

  test("skips and counts a row that fails the model, and keeps the rest", () => {
    const records = mapTaskRows(
      rows({
        clients: [clientRow(), clientRow({ id: "Not An Id" })],
        workstreams: [workstreamRow({ classification: "secret" })],
        items: [
          itemRow(),
          itemRow({ id: "no-title", title: "" }),
          itemRow({ id: "bad-date", scheduled_for: "next week" }),
        ],
      }),
    );
    expect(records.clients.map((client) => client.id)).toEqual(["kestrel"]);
    expect(records.workstreams).toEqual([]);
    expect(records.items.map((item) => item.id)).toEqual(["webhooks"]);
    expect(records.skipped).toBe(4);
  });

  test("keeps an item whose tracker does not match, without the tracker", () => {
    const records = mapTaskRows(
      rows({
        items: [
          itemRow({ tracker: { system: "github", key: "#3", url: "nowhere" } }),
          itemRow({
            id: "rate-limits",
            tracker: JSON.stringify({
              system: "jira",
              key: "KST-4",
              url: "https://example.com/browse/KST-4",
            }),
          }),
        ],
      }),
    );
    expect(records.items[0]?.tracker).toBeUndefined();
    expect(records.items[1]?.tracker?.key).toBe("KST-4");
    expect(records.skipped).toBe(0);
  });

  test("keeps only added and moved history, with a from that is a date", () => {
    const records = mapTaskRows(
      rows({
        items: [itemRow()],
        history: [
          { item_id: "webhooks", kind: "added", on: "2026-10-20", from: null },
          {
            item_id: "webhooks",
            kind: "state",
            on: "2026-10-21",
            from: "todo",
          },
          {
            item_id: "webhooks",
            kind: "moved",
            on: "2026-10-22",
            from: "2026-10-21",
          },
          { item_id: "webhooks", kind: "moved", on: "2026-10-23", from: "Fri" },
          { item_id: "webhooks", kind: "added", on: "someday", from: null },
        ],
      }),
    );
    expect(records.items[0]?.history).toEqual([
      { kind: "added", on: "2026-10-20" },
      { kind: "moved", on: "2026-10-22", from: "2026-10-21" },
      { kind: "moved", on: "2026-10-23" },
    ]);
  });

  test("reads claims on open items, earliest first", () => {
    const records = mapTaskRows(
      rows({
        items: [
          itemRow({
            claim_by: "tracking",
            claim_at: new Date("2026-10-24T10:00:00Z"),
          }),
          itemRow({
            id: "rate-limits",
            claim_by: "tracking",
            claim_at: "2026-10-24T09:00:00Z",
          }),
          itemRow({
            id: "retention-draft",
            state: "done",
            done_on: "2026-10-24",
            claim_by: "policy-writer",
            claim_at: "2026-10-24T08:00:00Z",
          }),
          itemRow({ id: "audit-log", claim_by: "tracking" }),
        ],
      }),
    );
    expect(records.claims).toEqual([
      {
        itemId: "rate-limits",
        claimedBy: "tracking",
        claimedAt: "2026-10-24T09:00:00.000Z",
      },
      {
        itemId: "webhooks",
        claimedBy: "tracking",
        claimedAt: "2026-10-24T10:00:00.000Z",
      },
      { itemId: "audit-log", claimedBy: "tracking" },
    ]);
  });
});

describe("merging the task source over SQLite", () => {
  const merge = (overrides: Partial<TaskRows> = {}, base = sampleDataset) =>
    mergeTasks(base, mapTaskRows(rows(overrides)));

  test("replaces a covered client's row, workstreams and items, and nothing else", () => {
    const { dataset } = merge();
    expect(
      dataset.clients.find((client) => client.id === "kestrel")?.name,
    ).toBe("Kestrel Freight Group");
    expect(
      dataset.items
        .filter((item) => item.clientId === "kestrel")
        .map((item) => item.id),
    ).toEqual(["webhooks", "rate-limits", "retention-draft"]);
    expect(
      dataset.workstreams
        .filter((workstream) => workstream.clientId === "kestrel")
        .map((workstream) => workstream.id),
    ).toEqual(["kestrel-partners"]);
    for (const clientId of ["ashgrove", "halcyon", "larchwood", "meridian"]) {
      expect(
        dataset.items.filter((item) => item.clientId === clientId),
      ).toEqual(
        sampleDataset.items.filter((item) => item.clientId === clientId),
      );
      expect(
        dataset.workstreams.filter(
          (workstream) => workstream.clientId === clientId,
        ),
      ).toEqual(
        sampleDataset.workstreams.filter(
          (workstream) => workstream.clientId === clientId,
        ),
      );
    }
    expect(dataset.groups).toEqual(sampleDataset.groups);
    expect(dataset.accounts).toEqual(sampleDataset.accounts);
    expect(dataset.requirements).toEqual(sampleDataset.requirements);
    expect(findBrokenReferences(dataset)).toEqual([]);
  });

  test("adds a client SQLite does not have", () => {
    const { dataset } = merge({
      clients: [
        clientRow(),
        clientRow({ id: "orchard", name: "Orchard Dairy" }),
      ],
      items: [itemRow({ id: "milk-route", client_id: "orchard" })],
      workstreams: [],
    });
    expect(dataset.clients.map((client) => client.id)).toContain("orchard");
    expect(
      dataset.items.find((item) => item.id === "milk-route")?.clientId,
    ).toBe("orchard");
  });

  test("keeps the SQLite home client home", () => {
    const { dataset } = merge({
      clients: [clientRow({ home: true })],
    });
    expect(
      dataset.clients
        .filter((client) => client.home)
        .map((client) => client.id),
    ).toEqual(["ashgrove"]);
    const home = merge({
      clients: [
        clientRow({
          id: "ashgrove",
          name: "Ashgrove",
          classification: "internal",
        }),
      ],
      items: [],
      workstreams: [],
    }).dataset.clients.find((client) => client.id === "ashgrove");
    expect(home?.home).toBe(true);
  });

  test("drops and counts references the swap breaks", () => {
    const { dataset, dangling } = merge({
      items: [
        itemRow({ requirement_id: "no-such-requirement" }),
        itemRow({ id: "rate-limits", workstream_id: "halcyon-go-live" }),
      ],
    });
    // retention-draft is gone, so the question that blocks it goes too.
    expect(
      dataset.questions.find((question) => question.id === "scan-retention"),
    ).toBeUndefined();
    expect(
      dataset.items.find((item) => item.id === "webhooks")?.requirementId,
    ).toBeUndefined();
    expect(
      dataset.items.find((item) => item.id === "rate-limits")?.workstreamId,
    ).toBeUndefined();
    // Two item fields and one question. The policy writer's retention-draft
    // was a covered client's item, so the claims replace it uncounted.
    expect(dangling).toBe(3);
    expect(findBrokenReferences(dataset)).toEqual([]);
  });

  test("leaves out a task record whose id another record already has", () => {
    const { dataset, dangling } = merge({
      items: [itemRow(), itemRow({ id: "cut-over" })],
    });
    expect(
      dataset.items
        .filter((item) => item.id === "cut-over")
        .map((item) => item.clientId),
    ).toEqual(["halcyon"]);
    expect(dangling).toBeGreaterThanOrEqual(1);
    expect(findBrokenReferences(dataset)).toEqual([]);
  });

  test("leaves the dataset as SQLite holds it when the source covers no client", () => {
    expect(mergeTasks(sampleDataset, empty)).toEqual({
      dataset: sampleDataset,
      dangling: 0,
      unknownClaimers: { count: 0, names: [] },
      unknownClaims: [],
      ambiguousClaims: 0,
    });
  });
});

describe("claims", () => {
  const agentOf = (dataset: Dataset, id: string) =>
    dataset.agents.find((agent) => agent.id === id);

  test("set workingOn for a covered client's agents, earliest claim first", () => {
    const { dataset } = mergeTasks(
      sampleDataset,
      mapTaskRows(
        rows({
          items: [
            itemRow({ claim_by: "tracking", claim_at: "2026-10-24T10:00:00Z" }),
            itemRow({
              id: "rate-limits",
              claim_by: "tracking",
              claim_at: "2026-10-24T09:00:00Z",
            }),
            itemRow({ id: "retention-draft", state: "review" }),
          ],
        }),
      ),
    );
    expect(agentOf(dataset, "tracking")?.workingOn).toEqual([
      "rate-limits",
      "webhooks",
    ]);
    // Nothing is claimed for the policy writer, so it works on nothing here.
    expect(agentOf(dataset, "policy-writer")?.workingOn).toEqual([]);
    // Agents of clients the source does not cover keep SQLite's list.
    expect(agentOf(dataset, "test-runner")?.workingOn).toEqual([
      "database-tests",
    ]);
  });

  test("match an agent by id or by name, whatever the case", () => {
    const { dataset } = mergeTasks(
      sampleDataset,
      mapTaskRows(
        rows({
          items: [
            itemRow({ claim_by: " Tracking " }),
            itemRow({ id: "retention-draft", claim_by: "POLICY-WRITER" }),
          ],
        }),
      ),
    );
    expect(agentOf(dataset, "tracking")?.workingOn).toEqual(["webhooks"]);
    expect(agentOf(dataset, "policy-writer")?.workingOn).toEqual([
      "retention-draft",
    ]);
  });

  test("prefer the id when a claim matches one agent's id and another's name", () => {
    const base: Dataset = {
      ...sampleDataset,
      agents: sampleDataset.agents.map((agent) =>
        agent.id === "kpi-loader" ? { ...agent, name: "Tracking" } : agent,
      ),
    };
    expect(claimantOf(base.agents, "tracking")).toEqual({
      agentId: "tracking",
      ambiguous: true,
    });
    const merged = mergeTasks(
      base,
      mapTaskRows(rows({ items: [itemRow({ claim_by: "tracking" })] })),
    );
    expect(agentOf(merged.dataset, "tracking")?.workingOn).toEqual([
      "webhooks",
    ]);
    expect(merged.ambiguousClaims).toBe(1);
  });

  test("name nobody when two agents share the name and neither has it as id", () => {
    const agents = sampleDataset.agents.map((agent) =>
      agent.id === "kpi-loader" || agent.id === "split"
        ? { ...agent, name: "Lantern" }
        : agent,
    );
    expect(claimantOf(agents, "lantern")).toEqual({ ambiguous: true });
  });

  test("by an agent Atlas does not know are reported, and no agent is made", () => {
    const merged = mergeTasks(
      sampleDataset,
      mapTaskRows(
        rows({
          items: [
            itemRow({ claim_by: "Lighthouse Keeper" }),
            itemRow({ id: "rate-limits", claim_by: "Lighthouse Keeper" }),
            itemRow({ id: "retention-draft", claim_by: "harbour-pilot" }),
          ],
        }),
      ),
    );
    expect(merged.unknownClaimers).toEqual({
      count: 3,
      names: ["Lighthouse Keeper", "harbour-pilot"],
    });
    expect(merged.dataset.agents.map((agent) => agent.id)).toEqual(
      sampleDataset.agents.map((agent) => agent.id),
    );
  });
});

describe("the task cache", () => {
  test("tells its listeners only when a read changes the records", async () => {
    const fake = fakeSource(rows());
    const lines: string[] = [];
    const cache = createTaskCache({
      source: fake.source,
      pollSeconds: 30,
      log: (line) => lines.push(line),
      now: () => new Date("2026-10-24T12:00:00Z"),
    });
    let changes = 0;
    cache.subscribe(() => changes++);
    expect(cache.current()).toBeUndefined();
    expect(await cache.refresh()).toBe(true);
    expect(await cache.refresh()).toBe(false);
    fake.set(rows({ items: [itemRow()] }));
    expect(await cache.refresh()).toBe(true);
    expect(changes).toBe(2);
    expect(cache.health()).toEqual({
      source: "postgres",
      clients: 1,
      items: 1,
      skipped: 0,
      lastRefresh: "2026-10-24T12:00:00.000Z",
      ok: true,
    });
    // Counts only: no title or name reaches the log.
    expect(lines.join("\n")).not.toContain("Kestrel");
    expect(lines.join("\n")).not.toContain("webhook");
  });

  test("keeps the last good read when the source fails, and logs once", async () => {
    const fake = fakeSource(rows());
    const lines: string[] = [];
    const cache = createTaskCache({
      source: fake.source,
      pollSeconds: 30,
      log: (line) => lines.push(line),
    });
    await cache.refresh();
    fake.fail(
      Object.assign(new Error("password=hunter2"), { code: "ECONNREFUSED" }),
    );
    expect(await cache.refresh()).toBe(false);
    expect(await cache.refresh()).toBe(false);
    expect(cache.current()?.items).toHaveLength(3);
    expect(cache.health().ok).toBe(false);
    const failures = lines.filter((line) => line.includes("unreachable"));
    expect(failures).toEqual([
      "task source unreachable (ECONNREFUSED); keeping the last read, retrying every 30 s",
    ]);
    expect(lines.join("\n")).not.toContain("hunter2");
    fake.fail(undefined);
    await cache.refresh();
    expect(cache.health().ok).toBe(true);
  });

  test("has nothing to serve when the source is unreachable from the start", async () => {
    const fake = fakeSource(rows());
    fake.fail(new Error("down"));
    const lines: string[] = [];
    const cache = createTaskCache({
      source: fake.source,
      pollSeconds: 30,
      log: (line) => lines.push(line),
    });
    await cache.refresh();
    expect(cache.current()).toBeUndefined();
    expect(lines).toEqual([
      "task source unreachable (Error); serving SQLite only, retrying every 30 s",
    ]);
  });

  test("polls on its timer until stopped", async () => {
    const fake = fakeSource(rows());
    const cache = createTaskCache({
      source: fake.source,
      pollSeconds: 0.01,
      log: () => {},
    });
    cache.start();
    await Bun.sleep(50);
    cache.stop();
    const reads = fake.reads();
    expect(reads).toBeGreaterThan(1);
    await Bun.sleep(30);
    expect(fake.reads()).toBe(reads);
  });

  test("names a failure by its code or class, never its message", () => {
    expect(
      failureName(Object.assign(new Error("secret"), { code: "28P01" })),
    ).toBe("28P01");
    expect(failureName(new TypeError("secret"))).toBe("TypeError");
    expect(failureName("secret")).toBe("unknown error");
  });
});

describe("the API with a task source", () => {
  let database: AtlasDatabase;
  beforeEach(() => {
    database = openDatabase(":memory:");
    seedDataset(database, sampleDataset);
  });

  async function setUp(source = fakeSource(rows())) {
    const tasks = createTaskCache({
      source: source.source,
      pollSeconds: 30,
      log: () => {},
      now: () => new Date("2026-10-24T12:00:00Z"),
    });
    await tasks.refresh();
    const api = createApi({ database, version: "0.0.0-test", tasks });
    const call = async (path: string, init?: RequestInit) =>
      (await api.handle(new Request(`http://atlas.test${path}`, init)))!;
    return { api, tasks, call, source };
  }

  test("serves the merged dataset", async () => {
    const { call } = await setUp();
    const dataset = (await (await call("/api/dataset")).json()) as Dataset;
    expect(
      dataset.items
        .filter((item) => item.clientId === "kestrel")
        .map((item) => item.id),
    ).toEqual(["webhooks", "rate-limits", "retention-draft"]);
    expect(dataset.agents).toHaveLength(sampleDataset.agents.length);
  });

  test("serves SQLite alone while the source has never answered", async () => {
    const source = fakeSource(rows());
    source.fail(new Error("down"));
    const { call } = await setUp(source);
    expect(await (await call("/api/dataset")).json()).toEqual(sampleDataset);
    const health = await (await call("/api/health")).json();
    expect(health.tasks).toMatchObject({
      source: "postgres",
      ok: false,
      lastRefresh: null,
    });
  });

  test("reports counts and unknown claimers in health", async () => {
    const { call } = await setUp(
      fakeSource(
        rows({
          items: [
            itemRow({ claim_by: "harbour-pilot" }),
            itemRow({ id: "rate-limits" }),
          ],
        }),
      ),
    );
    const health = await (await call("/api/health")).json();
    expect(health.tasks).toEqual({
      source: "postgres",
      clients: 1,
      items: 2,
      skipped: 0,
      lastRefresh: "2026-10-24T12:00:00.000Z",
      ok: true,
      // The scan-retention question, whose retention-draft is gone.
      dangling: 1,
      ambiguousClaims: 0,
      unknownClaimers: 1,
    });
  });

  test("sends a refresh on the stream when the tasks change, and no id with it", async () => {
    const source = fakeSource(rows());
    const { api, tasks, call } = await setUp(source);
    const controller = new AbortController();
    const response = await call("/api/stream?after=0", {
      signal: controller.signal,
    });
    source.set(rows({ items: [itemRow()] }));
    await tasks.refresh();
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes("event: refresh")) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toContain(
      'event: refresh\ndata: {"lastRefresh":"2026-10-24T12:00:00.000Z"}\n\n',
    );
    expect(text).not.toContain("id:");
    controller.abort();
    api.close();
  });

  test("lets a vessel work on a task only the task database holds", async () => {
    const { tasks } = await setUp(
      fakeSource(rows({ items: [itemRow({ id: "carrier-onboarding" })] })),
    );
    const overlay = (dataset: Dataset) =>
      mergeTasks(dataset, tasks.current()!).dataset;
    appendEvent(
      database,
      {
        type: "agent-launched",
        parentId: "tracking",
        agentId: "carrier-notes",
        name: "Carrier notes",
        workingOn: ["carrier-onboarding"],
        text: "Writing up onboarding",
      },
      new Date(),
      overlay,
    );
    expect(
      readDataset(database, overlay).agents.find(
        (agent) => agent.id === "carrier-notes",
      )?.workingOn,
    ).toEqual(["carrier-onboarding"]);
  });

  test("gives the MCP tools the claims, so list_my_work agrees with them", async () => {
    const { call: _, api } = await setUp(
      fakeSource(
        rows({
          items: [
            itemRow({ claim_by: "Tracking", claim_at: "2026-10-24T09:00:00Z" }),
            itemRow({ id: "rate-limits", priority: "high" }),
            itemRow({ id: "audit-log", claim_by: "Lighthouse Keeper" }),
          ],
        }),
      ),
    );
    const client = new Client({ name: "atlas-test", version: "0.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("http://atlas.test/mcp"), {
        fetch: async (input, init) =>
          (await api.handle(new Request(input, init))) ??
          new Response("Not found", { status: 404 }),
      }),
    );
    const text = async (name: string, args: Record<string, unknown> = {}) =>
      JSON.parse(
        (
          (await client.callTool({ name, arguments: args })) as {
            content: { text: string }[];
          }
        ).content[0]!.text,
      );
    const work = await text("list_my_work", { agentId: "tracking" });
    expect(work.workingOn.map((item: { id: string }) => item.id)).toEqual([
      "webhooks",
    ]);
    expect(work.open.map((item: { id: string }) => item.id)).toEqual([
      "rate-limits",
      "audit-log",
    ]);
    const listed = await text("list_agents");
    expect(listed.unknownClaimers).toEqual({
      count: 1,
      names: ["Lighthouse Keeper"],
    });
    await client.close();
  });
});

describe("the task database settings", () => {
  test("are off unless ATLAS_TASKS_HOST is set", () => {
    expect(readConfiguration({}).tasks).toBeUndefined();
  });

  test("read the environment, with a default port and poll", () => {
    expect(
      readConfiguration({
        ATLAS_TASKS_HOST: "127.0.0.1",
        ATLAS_TASKS_DATABASE: "tasks",
        ATLAS_TASKS_USER: "reader",
        ATLAS_TASKS_PASSWORD_COMMAND: " printf secret ",
      }).tasks,
    ).toEqual({
      hostname: "127.0.0.1",
      port: 5432,
      database: "tasks",
      username: "reader",
      passwordCommand: "printf secret",
      pollSeconds: 30,
    });
  });

  test("refuse a missing database or user, a bad port or a bad poll", () => {
    const base = {
      ATLAS_TASKS_HOST: "127.0.0.1",
      ATLAS_TASKS_DATABASE: "tasks",
      ATLAS_TASKS_USER: "reader",
    };
    expect(() =>
      readConfiguration({ ATLAS_TASKS_HOST: "127.0.0.1" }),
    ).toThrow();
    expect(() =>
      readConfiguration({ ...base, ATLAS_TASKS_PORT: "port" }),
    ).toThrow();
    expect(() =>
      readConfiguration({ ...base, ATLAS_TASKS_POLL_SECONDS: "0" }),
    ).toThrow();
    expect(
      readConfiguration({ ...base, ATLAS_TASKS_POLL_SECONDS: "5" }).tasks
        ?.pollSeconds,
    ).toBe(5);
  });
});

describe("the password command", () => {
  test("splits into arguments without a shell", () => {
    expect(
      splitCommand(`security find-generic-password -s "atlas tasks" -w`),
    ).toEqual(["security", "find-generic-password", "-s", "atlas tasks", "-w"]);
    expect(splitCommand("echo '$HOME' ; ls")).toEqual([
      "echo",
      "$HOME",
      ";",
      "ls",
    ]);
  });

  test("gives its trimmed output, and runs once", async () => {
    const password = passwordFromCommand("printf ' invented-password \\n'");
    expect(await password()).toBe("invented-password");
    expect(await password()).toBe("invented-password");
  });

  test("fails without its output when the command fails", async () => {
    const password = passwordFromCommand("false");
    const failure = await password().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PasswordCommandFailed);
    expect(failureName(failure)).toBe("PASSWORD_COMMAND_FAILED");
  });
});

describe("a task source limited to some clients", () => {
  const twoClients = () =>
    rows({
      clients: [
        clientRow(),
        clientRow({ id: "meridian", name: "Meridian Bank" }),
      ],
      items: [
        itemRow({
          workstream_id: "kestrel-partners",
          state: "doing",
          claim_by: "tracking",
        }),
        itemRow({
          id: "audit-trail",
          client_id: "meridian",
          workstream_id: null,
          claim_by: "split",
        }),
      ],
    });

  test("keeps only those clients, their workstreams, items and claims", async () => {
    const limited = await onlyClients(fakeSource(twoClients()).source, [
      "meridian",
    ]).read();
    expect(limited.clients.map((client) => client.id)).toEqual(["meridian"]);
    expect(limited.workstreams).toEqual([]);
    expect(limited.items.map((item) => item.id)).toEqual(["audit-trail"]);
    expect(limited.claims.map((claim) => claim.itemId)).toEqual([
      "audit-trail",
    ]);
  });

  test("is set by ATLAS_TASKS_CLIENTS, and refuses anything but ids", () => {
    const base = {
      ATLAS_TASKS_HOST: "127.0.0.1",
      ATLAS_TASKS_DATABASE: "tasks",
      ATLAS_TASKS_USER: "reader",
    };
    expect(
      readConfiguration({ ...base, ATLAS_TASKS_CLIENTS: "meridian, kestrel" })
        .tasks?.clients,
    ).toEqual(["meridian", "kestrel"]);
    expect(readConfiguration(base).tasks?.clients).toBeUndefined();
    expect(() =>
      readConfiguration({ ...base, ATLAS_TASKS_CLIENTS: "Meridian Bank" }),
    ).toThrow();
  });
});
