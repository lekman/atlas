/**
 * Tasks from the task database. The task database is the master copy of
 * clients, workstreams and tasks; Atlas's SQLite keeps agents, groups,
 * accounts, requirements, questions and decisions. This module turns task
 * database rows into core records and merges them into the SQLite dataset,
 * one client at a time.
 *
 * A row that does not match the core model is skipped and counted, never
 * thrown, so one bad row cannot stop the server.
 */
import {
  type Agent,
  BacklogItem,
  Client,
  Dataset,
  IsoDate,
  TaskHistoryEntry,
  TrackerReference,
  Workstream,
} from "@atlas/core";

/** An agent's claim on an open item: the agent is working on it. */
export interface TaskClaim {
  itemId: string;
  /**
   * Who claimed it, as `claim_by` holds it: an Atlas agent id, or the
   * agent's name as other sessions address it. Matched without regard to case.
   */
  claimedBy: string;
  /** When it was claimed, ISO 8601, or absent when the row has no time. */
  claimedAt?: string;
}

/** The records a task source holds, already checked against the core model. */
export interface TaskRecords {
  clients: Client[];
  workstreams: Workstream[];
  items: BacklogItem[];
  /** Claims on items that are not done, earliest first. */
  claims: TaskClaim[];
  /** Rows left out because they did not match the core model. */
  skipped: number;
}

/** Where tasks come from. The server reads it on every poll. */
export interface TaskSource {
  read(): Promise<TaskRecords>;
}

/**
 * A task source that keeps only some clients, with their workstreams, items
 * and claims. For a view that shows one real client among invented ones.
 */
export function onlyClients(
  source: TaskSource,
  clientIds: readonly string[],
): TaskSource {
  const wanted = new Set(clientIds);
  return {
    async read() {
      const records = await source.read();
      const items = records.items.filter((item) => wanted.has(item.clientId));
      const kept = new Set(items.map((item) => item.id));
      return {
        clients: records.clients.filter((client) => wanted.has(client.id)),
        workstreams: records.workstreams.filter((stream) =>
          wanted.has(stream.clientId),
        ),
        items,
        claims: records.claims.filter((claim) => kept.has(claim.itemId)),
        skipped: records.skipped,
      };
    },
  };
}

/** A `client` row, with the columns Atlas reads. */
export interface ClientRow {
  id: string;
  classification: string;
  boundary: string;
  name: string;
  home: boolean | null;
}

/** A `workstream` row, with the columns Atlas reads. */
export interface WorkstreamRow {
  id: string;
  classification: string;
  boundary: string;
  client_id: string;
  title: string;
  summary: string | null;
  order: number | null;
}

/** A `dashboard_item` row, with the columns Atlas reads. Dates are `YYYY-MM-DD` text. */
export interface ItemRow {
  id: string;
  classification: string;
  boundary: string;
  client_id: string;
  requirement_id: string | null;
  workstream_id: string | null;
  title: string;
  summary: string | null;
  state: string;
  priority: string;
  tracker: unknown;
  effort: string | null;
  scheduled_for: string | null;
  blocked: boolean | null;
  done_on: string | null;
  details_id: string | null;
  /** The id of the agent that claimed the item. */
  claim_by: string | null;
  /** When it was claimed. Bun reads a timestamp as a `Date`. */
  claim_at: Date | string | null;
}

/** An `item_history` row. `on` is `YYYY-MM-DD` text; `from` is free text. */
export interface HistoryRow {
  item_id: string;
  kind: string;
  on: string;
  from: string | null;
}

export interface TaskRows {
  clients: ClientRow[];
  workstreams: WorkstreamRow[];
  items: ItemRow[];
  history: HistoryRow[];
}

/** The fields of a row that hold a value, so an empty column reads as absent. */
function present<Row extends Record<string, unknown>>(row: Row) {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([, value]) => value !== null && value !== undefined,
    ),
  );
}

/** The tracker as the core model holds it, or nothing when it does not match. */
function trackerOf(value: unknown) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  const result = TrackerReference.safeParse(parsed);
  return result.success ? result.data : undefined;
}

/** A claim time as ISO 8601, or nothing when it is missing or not a time. */
function claimTime(value: Date | string | null): string | undefined {
  if (value === null) return undefined;
  const time = value instanceof Date ? value : new Date(value);
  return Number.isNaN(time.getTime()) ? undefined : time.toISOString();
}

/** Claims with a time first, earliest first; then those without, by item id. */
function byClaimTime(left: TaskClaim, right: TaskClaim): number {
  if (left.claimedAt && right.claimedAt)
    return (
      left.claimedAt.localeCompare(right.claimedAt) ||
      left.itemId.localeCompare(right.itemId)
    );
  if (left.claimedAt) return -1;
  if (right.claimedAt) return 1;
  return left.itemId.localeCompare(right.itemId);
}

/**
 * The added and moved entries of an item's history, oldest first. The core
 * model keeps only those two kinds. A `from` that is not a date is left
 * out, and an entry that still does not match is dropped.
 */
function historyOf(rows: HistoryRow[]) {
  const entries: TaskHistoryEntry[] = [];
  for (const row of rows) {
    if (row.kind !== "added" && row.kind !== "moved") continue;
    const from =
      row.from && IsoDate.safeParse(row.from).success ? row.from : undefined;
    const entry = TaskHistoryEntry.safeParse({
      kind: row.kind,
      on: row.on,
      ...(from ? { from } : {}),
    });
    if (entry.success) entries.push(entry.data);
  }
  return entries;
}

/**
 * Task database rows as core records. Dropped items are left out. A row
 * that fails the core schema is counted in `skipped`. A tracker that does
 * not match is left off its item rather than losing the item. A claim on
 * an item that is kept and not done becomes a `TaskClaim`.
 */
export function mapTaskRows(rows: TaskRows): TaskRecords {
  let skipped = 0;
  const keep = <Record>(result: {
    success: boolean;
    data?: Record;
  }): Record[] => {
    if (result.success && result.data !== undefined) return [result.data];
    skipped++;
    return [];
  };

  const clients = rows.clients.flatMap((row) =>
    keep(
      Client.safeParse({
        id: row.id,
        classification: row.classification,
        boundary: row.boundary,
        name: row.name,
        ...(row.home === true ? { home: true } : {}),
      }),
    ),
  );

  const workstreams = rows.workstreams.flatMap((row) =>
    keep(
      Workstream.safeParse(
        present({
          id: row.id,
          classification: row.classification,
          boundary: row.boundary,
          clientId: row.client_id,
          title: row.title,
          summary: row.summary || null,
          order: row.order,
        }),
      ),
    ),
  );

  const historyByItem = new Map<string, HistoryRow[]>();
  for (const row of rows.history) {
    const list = historyByItem.get(row.item_id) ?? [];
    list.push(row);
    historyByItem.set(row.item_id, list);
  }

  const claims: TaskClaim[] = [];
  const items = rows.items
    .filter((row) => row.state !== "dropped")
    .flatMap((row) => {
      const history = historyOf(historyByItem.get(row.id) ?? []);
      const item = keep(
        BacklogItem.safeParse(
          present({
            id: row.id,
            classification: row.classification,
            boundary: row.boundary,
            clientId: row.client_id,
            requirementId: row.requirement_id,
            workstreamId: row.workstream_id,
            title: row.title,
            summary: row.summary || null,
            state: row.state,
            priority: row.priority,
            tracker: trackerOf(row.tracker),
            effort: row.effort,
            scheduledFor: row.scheduled_for,
            blocked: row.blocked === true ? true : null,
            doneOn: row.done_on,
            detailsId: row.details_id,
            history: history.length > 0 ? history : null,
          }),
        ),
      );
      const claimedAt = claimTime(row.claim_at);
      if (item.length > 0 && row.claim_by && row.state !== "done")
        claims.push({
          itemId: row.id,
          claimedBy: row.claim_by,
          ...(claimedAt ? { claimedAt } : {}),
        });
      return item;
    });

  return {
    clients,
    workstreams,
    items,
    claims: claims.sort(byClaimTime),
    skipped,
  };
}

export interface MergedDataset {
  dataset: Dataset;
  /**
   * References left out of the served dataset because the record they
   * named no longer exists, and task records left out because their id or
   * client did not fit.
   */
  dangling: number;
  /** Claims that name no agent Atlas knows. No agent is ever made from one. */
  unknownClaimers: UnknownClaimers;
  /** The same claims one by one, with the client of the claimed item, for a scoped reader. */
  unknownClaims: UnknownClaim[];
  /** Claims that matched more than one agent. An id match wins; otherwise the claim is left out. */
  ambiguousClaims: number;
}

/** Claims whose claimer Atlas does not know: how many, and the distinct names they used. */
export interface UnknownClaimers {
  count: number;
  names: string[];
}

export const noUnknownClaimers: UnknownClaimers = { count: 0, names: [] };

/** One claim whose claimer Atlas does not know. */
export interface UnknownClaim {
  claimedBy: string;
  clientId: string;
}

/** How many unknown claims there are among `claims`, and the distinct names, sorted. */
export function summariseUnknownClaims(
  claims: readonly UnknownClaim[],
): UnknownClaimers {
  return {
    count: claims.length,
    names: [...new Set(claims.map((claim) => claim.claimedBy))].sort(),
  };
}

/**
 * The agent a claim names. `claimedBy` is trimmed and matched without
 * regard to case against each agent's id, then its name. An id match wins
 * over name matches; several name matches and no id match name nobody.
 */
export function claimantOf(
  agents: readonly Agent[],
  claimedBy: string,
): { agentId?: string; ambiguous: boolean } {
  const key = claimedBy.trim().toLowerCase();
  if (key === "") return { ambiguous: false };
  const byId = agents.filter((agent) => agent.id.toLowerCase() === key);
  const byName = agents.filter(
    (agent) => agent.name.trim().toLowerCase() === key,
  );
  const matches = new Set([...byId, ...byName].map((agent) => agent.id));
  const ambiguous = matches.size > 1;
  if (byId[0]) return { agentId: byId[0].id, ambiguous };
  if (byName.length === 1 && byName[0])
    return { agentId: byName[0].id, ambiguous };
  return { ambiguous };
}

/**
 * The SQLite dataset with the task source's clients laid over it. For every
 * client the task source holds, its client row, workstreams and items come
 * from the task source and replace what SQLite has for that client. Every
 * other client keeps its SQLite records, and agents, groups, accounts,
 * requirements, questions and decisions always come from SQLite.
 *
 * An agent's `workingOn` follows the task database's claims: the items it
 * has claimed and not finished, earliest claim first. Items of clients the
 * task source does not cover keep their place from SQLite, after the
 * claims.
 *
 * The home client in SQLite stays home. A reference that breaks because
 * of the swap is removed and counted, so the result still reads as one
 * consistent dataset.
 */
export function mergeTasks(base: Dataset, tasks: TaskRecords): MergedDataset {
  let dangling = 0;
  const fromSource = new Set(tasks.clients.map((client) => client.id));
  const homeId =
    base.clients.find((client) => client.home === true)?.id ??
    tasks.clients.find((client) => client.home === true)?.id;
  const withHome = (client: Client): Client => {
    const { home: _, ...rest } = client;
    return client.id === homeId ? { ...rest, home: true } : rest;
  };

  const clients = [
    ...base.clients.map(
      (client) =>
        tasks.clients.find((candidate) => candidate.id === client.id) ?? client,
    ),
    ...tasks.clients.filter(
      (client) => !base.clients.some((existing) => existing.id === client.id),
    ),
  ].map(withHome);

  // Ids SQLite keeps for itself. A task record that reuses one is left out.
  const keptWorkstreams = base.workstreams.filter(
    (workstream) => !fromSource.has(workstream.clientId),
  );
  const keptItems = base.items.filter((item) => !fromSource.has(item.clientId));
  const taken = new Set<string>(
    [
      ...base.clients,
      ...base.accounts,
      ...base.groups,
      ...base.agents,
      ...base.requirements,
      ...keptWorkstreams,
      ...keptItems,
      ...base.questions,
      ...base.decisions,
    ].map((record) => record.id),
  );
  const fits = (record: { id: string; clientId: string }) => {
    if (!fromSource.has(record.clientId) || taken.has(record.id)) {
      dangling++;
      return false;
    }
    taken.add(record.id);
    return true;
  };
  const workstreams = [...keptWorkstreams, ...tasks.workstreams.filter(fits)];
  const workstreamClient = new Map(
    workstreams.map((workstream) => [workstream.id, workstream.clientId]),
  );
  const requirementIds = new Set(
    base.requirements.map((requirement) => requirement.id),
  );

  const items = [...keptItems, ...tasks.items.filter(fits)].map((item) => {
    let repaired = item;
    if (
      repaired.requirementId !== undefined &&
      !requirementIds.has(repaired.requirementId)
    ) {
      const { requirementId: _, ...rest } = repaired;
      repaired = rest;
      dangling++;
    }
    if (
      repaired.workstreamId !== undefined &&
      workstreamClient.get(repaired.workstreamId) !== repaired.clientId
    ) {
      const { workstreamId: _, ...rest } = repaired;
      repaired = rest;
      dangling++;
    }
    return repaired;
  });
  const itemClient = new Map(items.map((item) => [item.id, item.clientId]));
  const workIds = new Set([...requirementIds, ...itemClient.keys()]);

  // Claims, by agent, in claim order. A claim on an item that did not fit
  // above is left out with that item.
  let ambiguousClaims = 0;
  const unknownClaims: UnknownClaim[] = [];
  const claimed = new Map<string, string[]>();
  for (const claim of tasks.claims) {
    const { agentId, ambiguous } = claimantOf(base.agents, claim.claimedBy);
    if (ambiguous) ambiguousClaims++;
    const clientId = itemClient.get(claim.itemId);
    if (agentId === undefined) {
      if (!ambiguous && clientId !== undefined)
        unknownClaims.push({ claimedBy: claim.claimedBy.trim(), clientId });
      continue;
    }
    if (clientId === undefined || !fromSource.has(clientId)) {
      dangling++;
      continue;
    }
    const list = claimed.get(agentId) ?? [];
    if (!list.includes(claim.itemId)) list.push(claim.itemId);
    claimed.set(agentId, list);
  }

  const agents = base.agents.map((agent) => {
    // SQLite's own entries count only for clients the source does not cover.
    const fromSqlite = agent.workingOn.filter((id) => {
      const clientId = base.items.find((item) => item.id === id)?.clientId;
      return clientId === undefined || !fromSource.has(clientId);
    });
    const kept = fromSqlite.filter((id) => itemClient.has(id));
    dangling += fromSqlite.length - kept.length;
    const workingOn = [
      ...(claimed.get(agent.id) ?? []),
      ...kept.filter((id) => !claimed.get(agent.id)?.includes(id)),
    ];
    return workingOn.length === agent.workingOn.length &&
      workingOn.every((id, index) => id === agent.workingOn[index])
      ? agent
      : { ...agent, workingOn };
  });
  // A question must block something, so one whose work is gone is left out.
  const questions = base.questions.filter((question) => {
    if (workIds.has(question.blocks)) return true;
    dangling++;
    return false;
  });
  const decisions = base.decisions.map((decision) => {
    if (decision.decides === undefined || workIds.has(decision.decides))
      return decision;
    dangling++;
    const { decides: _, ...rest } = decision;
    return rest;
  });

  return {
    dataset: Dataset.parse({
      ...base,
      clients,
      agents,
      workstreams,
      items,
      questions,
      decisions,
    }),
    dangling,
    unknownClaimers: summariseUnknownClaims(unknownClaims),
    unknownClaims,
    ambiguousClaims,
  };
}
