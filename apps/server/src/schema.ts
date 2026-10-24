/**
 * The tables behind the Atlas data model. Each record type in `@atlas/core`
 * has one table. Lists and nested objects are stored as JSON text, and every
 * row is checked against the core schema when it is read back, so the
 * database never hands out a record the model would reject.
 */
import type {
  AgentStatus,
  AtlasEvent,
  BacklogItem,
  Classification,
  Reach,
  Runtime,
} from "@atlas/core";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const governed = {
  id: text().primaryKey(),
  classification: text().$type<Classification>().notNull(),
  boundary: text().notNull(),
};

export const clients = sqliteTable("clients", {
  ...governed,
  name: text().notNull(),
  home: integer({ mode: "boolean" }),
});

export const accounts = sqliteTable("accounts", {
  id: text().primaryKey(),
  label: text().notNull(),
  runtime: text().$type<Runtime>().notNull(),
});

export const agentGroups = sqliteTable("agent_groups", {
  ...governed,
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  name: text().notNull(),
});

export const agents = sqliteTable("agents", {
  ...governed,
  groupId: text("group_id")
    .notNull()
    .references(() => agentGroups.id),
  name: text().notNull(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  host: text().notNull(),
  reach: text().$type<Reach>().notNull(),
  status: text().$type<AgentStatus>().notNull(),
  workingOn: text("working_on", { mode: "json" }).$type<string[]>().notNull(),
  note: text().notNull(),
  /**
   * The agent a launch vessel was launched from; empty for every other
   * agent. The store checks it names an agent, so it carries no foreign key
   * and the migration only adds a column.
   */
  parentId: text("parent_id"),
});

export const requirements = sqliteTable("requirements", {
  ...governed,
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  title: text().notNull(),
  state: text().$type<"open" | "done">().notNull(),
});

export const workstreams = sqliteTable("workstreams", {
  ...governed,
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  title: text().notNull(),
  summary: text(),
  order: real(),
});

export const items = sqliteTable("items", {
  ...governed,
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  requirementId: text("requirement_id"),
  workstreamId: text("workstream_id"),
  title: text().notNull(),
  summary: text(),
  state: text().$type<BacklogItem["state"]>().notNull(),
  priority: text().$type<BacklogItem["priority"]>().notNull(),
  tracker: text({ mode: "json" }).$type<BacklogItem["tracker"]>(),
  effort: text().$type<BacklogItem["effort"]>(),
  value: integer().$type<BacklogItem["value"]>(),
  scheduledFor: text("scheduled_for"),
  blocked: integer({ mode: "boolean" }),
  doneOn: text("done_on"),
  detailsId: text("details_id"),
  history: text({ mode: "json" }).$type<BacklogItem["history"]>(),
});

export const questions = sqliteTable("questions", {
  ...governed,
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  title: text().notNull(),
  blocks: text().notNull(),
  asks: text().notNull(),
  state: text().$type<"open" | "answered">().notNull(),
  answer: text(),
});

export const decisions = sqliteTable("decisions", {
  ...governed,
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  title: text().notNull(),
  decides: text(),
  fromQuestion: text("from_question"),
  state: text().$type<"made" | "proposed">().notNull(),
});

/**
 * Every event, in the order it was received. Rows are only ever added: the
 * log is the history the map replays and the record of who changed what.
 */
export const events = sqliteTable("events", {
  sequence: integer().primaryKey({ autoIncrement: true }),
  receivedAt: text("received_at").notNull(),
  type: text().$type<AtlasEvent["type"]>().notNull(),
  event: text({ mode: "json" }).$type<AtlasEvent>().notNull(),
});

/**
 * A machine allowed to call Atlas. Its token is stored only as a SHA-256
 * hash, and is accepted only from the Tailscale node it was issued to.
 */
export const machines = sqliteTable("machines", {
  id: text().primaryKey(),
  /** The Tailscale node's stable id, as `tailscale whois` reports it. */
  nodeStableId: text("node_stable_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  /** The client ids the machine may see, or `["*"]` for every client. */
  clients: text({ mode: "json" }).$type<string[]>().notNull(),
  issuedAt: text("issued_at").notNull(),
  revokedAt: text("revoked_at"),
});

/**
 * Where the GitHub reader stopped in gh-events' `events.jsonl`: the file's
 * inode and the byte offset after the last whole line read. One row.
 */
export const githubCursor = sqliteTable("github_cursor", {
  id: integer().primaryKey(),
  inode: text().notNull(),
  offset: integer().notNull(),
  lastKey: text("last_key"),
});

/**
 * The `events.jsonl` lines already read, by their key, so a restart
 * neither replays a line nor skips one. `applied` is whether the line
 * matched a backlog item and became an Atlas event. Only the newest lines
 * are kept (see `github-reader.ts`).
 */
export const githubEvents = sqliteTable("github_events", {
  sequence: integer().primaryKey({ autoIncrement: true }),
  key: text().notNull().unique(),
  event: text().notNull(),
  kind: text().notNull(),
  /** `owner/name`, in lower case. */
  repository: text().notNull(),
  number: integer().notNull(),
  client: text(),
  at: text().notNull(),
  applied: integer({ mode: "boolean" }).notNull(),
});

/**
 * Pull requests as `registry.json` last showed them: the issues each one
 * closes and its checks. A merged pull request leaves the registry, so
 * this is how it still finds its backlog item.
 */
export const githubPullRequests = sqliteTable(
  "github_pull_requests",
  {
    /** `owner/name`, in lower case. */
    repository: text().notNull(),
    number: integer().notNull(),
    closes: text({ mode: "json" }).$type<number[]>().notNull(),
    ci: text(),
    seenAt: text("seen_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.repository, table.number] })],
);
