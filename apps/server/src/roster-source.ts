/**
 * Keeps Atlas's agents in step with Commander's roster
 * (`~/.claude/commander.json`). The seed copies the roster once, into an
 * empty database; workers added to the roster later were never known, and
 * their sessions docked as "Not in the roster" under the home client.
 *
 * Each read adds the roster agents Atlas lacks and sets, for every roster
 * agent, its client's group, governance, account, host, reach and note, in
 * the machines file's mapping. It never changes an agent's status or work, and
 * never removes an agent: a name gone from the roster stays until removed
 * by hand. Agents docked for sessions on this machine get the roster's name
 * for it ("Mac mini") instead of the raw host name, so one machine is one
 * host. A docked agent whose name now names a roster agent is forgotten by
 * the session reader on its next read.
 */
import { readFileSync, statSync } from "node:fs";
import { hostname as osHostname } from "node:os";

import { eq } from "drizzle-orm";

import type { AtlasDatabase } from "./database";
import * as schema from "./schema";

/** One worker in the roster, as Commander keeps it. */
export interface RosterAgent {
  name: string;
  client: string;
  machine?: string;
  owns?: string[];
  note?: string;
}

export interface Roster {
  /** The commander's own name. */
  commander: string;
  /** The machine the commander runs on. */
  machine: string;
  agents: RosterAgent[];
}

/**
 * What each roster machine means in Atlas: the host name views show, the
 * account its sessions run under, and how Commander reaches it. Kept on
 * the machine (`ATLAS_ROSTER_MACHINES`), not in the code, since it names
 * real machines.
 */
export type RosterMachines = Readonly<
  Record<string, { host?: string; account?: string; reach?: Reach }>
>;

type Reach = "ssh" | "local" | "none";

/** A machine's host name for views: its mapped name, else the machine's own. */
export const hostName = (
  machines: RosterMachines,
  machine: string | undefined,
): string => (machine && machines[machine]?.host) || machine || "unknown";

/** The machines file, or none when it is missing or not an object. */
export function readMachines(path: string | undefined): RosterMachines {
  if (!path) return {};
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as RosterMachines)
      : {};
  } catch {
    return {};
  }
}

/** The seed's id for a name: lower case, runs of other characters as one "-". */
export const rosterId = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const shorten = (text: string, length: number) =>
  text.length <= length ? text : `${text.slice(0, length - 1)}…`;

/** The roster file, or null when it is missing or not a roster. */
export function readRoster(path: string): Roster | null {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as Partial<Roster>;
    if (
      typeof value.commander !== "string" ||
      typeof value.machine !== "string" ||
      !Array.isArray(value.agents)
    )
      return null;
    return {
      commander: value.commander,
      machine: value.machine,
      agents: value.agents.filter(
        (a): a is RosterAgent =>
          !!a && typeof a.name === "string" && typeof a.client === "string",
      ),
    };
  } catch {
    return null;
  }
}

export interface RosterSyncResult {
  added: string[];
  updated: string[];
  /** Roster agents left out: their client is not in Atlas. */
  skipped: string[];
  /** Docked agents renamed from the raw host name to the roster's. */
  rehosted: number;
}

/**
 * One pass over the roster: the agents Atlas lacks are added, the rest set
 * to the roster's mapping. Returns what changed.
 */
export function syncRoster(
  database: AtlasDatabase,
  roster: Roster,
  machines: RosterMachines = {},
  rawHost: string = osHostname(),
): RosterSyncResult {
  const clients = database.select().from(schema.clients).all();
  const groups = database.select().from(schema.agentGroups).all();
  const accounts = new Set(
    database
      .select()
      .from(schema.accounts)
      .all()
      .map((a) => a.id),
  );
  const existing = new Map(
    database
      .select()
      .from(schema.agents)
      .all()
      .map((a) => [a.id, a]),
  );
  const home = clients.find((c) => c.home === true);
  const firstAccount = [...accounts][0] ?? "";
  const accountFor = (machine: string | undefined) => {
    const wanted = machine ? machines[machine]?.account : undefined;
    return wanted && accounts.has(wanted) ? wanted : firstAccount;
  };
  const reachFor = (machine: string | undefined): Reach =>
    (machine ? machines[machine]?.reach : undefined) ?? "none";
  const groupOf = (clientName: string) => {
    const client =
      clients.find((c) => c.name.toLowerCase() === clientName.toLowerCase()) ??
      null;
    return client ? groups.find((g) => g.clientId === client.id) : undefined;
  };

  const wanted = [
    {
      id: rosterId(roster.commander),
      name: roster.commander,
      group: home ? groups.find((g) => g.clientId === home.id) : undefined,
      machine: roster.machine,
      note: "Plans the day and hands work to the other sessions",
      account: accountFor(roster.machine),
      reach: reachFor(roster.machine),
    },
    ...roster.agents.map((agent) => ({
      id: rosterId(agent.name),
      name: agent.name,
      group: groupOf(agent.client),
      machine: agent.machine,
      note: shorten((agent.owns ?? []).join("; ") || agent.note || "", 200),
      account: accountFor(agent.machine),
      reach: reachFor(agent.machine),
    })),
  ];

  const result: RosterSyncResult = {
    added: [],
    updated: [],
    skipped: [],
    rehosted: 0,
  };
  const thisHost = hostName(machines, roster.machine);
  database.transaction((transaction) => {
    for (const want of wanted) {
      if (!want.group || !want.id) {
        result.skipped.push(want.name);
        continue;
      }
      const fields = {
        classification: want.group.classification,
        boundary: want.group.boundary,
        groupId: want.group.id,
        name: want.name,
        accountId: want.account,
        host: hostName(machines, want.machine),
        reach: want.reach,
        ...(want.note ? { note: want.note } : {}),
      };
      const current = existing.get(want.id);
      if (!current) {
        transaction
          .insert(schema.agents)
          .values({
            id: want.id,
            ...fields,
            note: fields.note ?? "",
            status: "idle",
            workingOn: [],
          })
          .run();
        result.added.push(want.id);
        continue;
      }
      const differs = (Object.keys(fields) as Array<keyof typeof fields>).some(
        (key) => current[key] !== fields[key],
      );
      if (differs) {
        transaction
          .update(schema.agents)
          .set(fields)
          .where(eq(schema.agents.id, want.id))
          .run();
        result.updated.push(want.id);
      }
    }
    // Agents docked for this machine's sessions carry the raw host name.
    if (rawHost && rawHost !== thisHost) {
      for (const agent of existing.values()) {
        if (agent.host !== rawHost) continue;
        transaction
          .update(schema.agents)
          .set({ host: thisHost })
          .where(eq(schema.agents.id, agent.id))
          .run();
        result.rehosted++;
      }
    }
  });
  return result;
}

export interface RosterSource {
  /** Reads the roster when it changed and applies it. Never throws. */
  poll(): void;
  start(): void;
  stop(): void;
  /** Called after a read that changed agents, so open pages reload. */
  subscribe(listener: () => void): () => void;
  health(): {
    ok: boolean;
    path: string;
    agents: number;
    lastSync: string | null;
    error: string | null;
  };
  /** The roster's name for this machine, such as "Mac mini", or undefined before a read. */
  hostName(): string | undefined;
}

export function createRosterSource({
  path,
  machines = {},
  database,
  pollSeconds = 60,
  log = console.log,
  now = () => new Date(),
}: {
  path: string;
  /** What each roster machine means in Atlas; see `RosterMachines`. */
  machines?: RosterMachines;
  database: AtlasDatabase;
  pollSeconds?: number;
  log?: (...parts: unknown[]) => void;
  now?: () => Date;
}): RosterSource {
  const listeners = new Set<() => void>();
  let seen: number | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let state = {
    ok: false,
    agents: 0,
    lastSync: null as string | null,
    error: "the roster has not been read yet" as string | null,
  };
  let machine: string | undefined;

  function poll() {
    try {
      const mtime = statSync(path).mtimeMs;
      if (seen === mtime) return;
      const roster = readRoster(path);
      if (!roster) {
        state = { ...state, ok: false, error: "the roster is not valid JSON" };
        return;
      }
      seen = mtime;
      machine = roster.machine;
      const result = syncRoster(database, roster, machines);
      state = {
        ok: true,
        agents: roster.agents.length + 1,
        lastSync: now().toISOString(),
        error: null,
      };
      const changed =
        result.added.length + result.updated.length + result.rehosted > 0;
      if (changed) {
        log(
          `roster: added ${result.added.join(", ") || "none"}; updated ${result.updated.join(", ") || "none"}; rehosted ${result.rehosted}`,
        );
        for (const listener of listeners) listener();
      }
      if (result.skipped.length)
        log(`roster: no client in Atlas for ${result.skipped.join(", ")}`);
    } catch (error) {
      state = {
        ...state,
        ok: false,
        error: `the roster could not be read: ${String(error).slice(0, 120)}`,
      };
    }
  }

  return {
    poll,
    start() {
      timer ??= setInterval(poll, pollSeconds * 1000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    health: () => ({ ...state, path }),
    hostName: () => (machine ? hostName(machines, machine) : undefined),
  };
}
