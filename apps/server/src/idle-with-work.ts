/**
 * Agents that hold open work and are not working. An agent should be
 * working when it holds a claimed task in `todo` or `doing` that is not
 * blocked, and its Claude Code session has been idle for longer than
 * `idleMinutes`, or gone for longer than `goneMinutes`. This module joins
 * the task database's claims (the agents' `workingOn`) to the session
 * reader's states, and:
 *
 * - records one `signal` event (source `atlas`, kind `agent`, event
 *   `idle_with_work`) when an agent starts to qualify, and one with event
 *   `cleared` and the same key when it stops;
 * - lays a fixed note over the agent in the dataset views read, such as
 *   "Idle 34 min with 2 open tasks", so the map and the sidebar show it;
 * - lists the agents on `GET /api/digest`;
 * - runs the dispatcher's `nudge-idle-with-work` rule on each flagged agent.
 *
 * A task waiting on the owner is always blocked: the task database stores
 * `blockedOn` only on a blocked task, so the blocked check covers the
 * Waiting on you list. A session under a usage limit is the account-switch
 * rule's signal; the agent gets a note about its open tasks and nothing
 * more. An agent whose session this machine has never seen, such as one on
 * another machine or a script, is not judged.
 *
 * The log holds counts and failure names only, never an agent or a task.
 */
import {
  isVessel,
  type AgentDispatchEvent,
  type AtlasEvent,
  type BacklogItem,
  type Dataset,
  type IdleWithWorkSignalEvent,
} from "@atlas/core";

import type { AtlasDatabase } from "./database";
import type { AgentWaker } from "./dispatcher";
import {
  decideNudge,
  type IdleWithWorkSettings,
  type NudgePlan,
  type RuleMode,
} from "./dispatcher-rules";
import * as schema from "./schema";
import type { AgentSessionState } from "./session-source";
import { failureName } from "./task-cache";

export type { AgentSessionState };

/** A task an agent has claimed, with what the rule reads. */
export interface ClaimedTask {
  id: string;
  title: string;
  state: BacklogItem["state"];
  blocked: boolean;
  clientId: string;
  /** The tracker key, such as a ticket or `owner/name#12`, when it has one. */
  trackerKey?: string;
}

/** One agent, its session, and the tasks it has claimed, earliest claim first. */
export interface AgentWork {
  agentId: string;
  agentName: string;
  /** The client of the agent's group, or null when the group is gone. */
  clientId: string | null;
  /** Absent when this machine has never seen a session for the agent. */
  session?: AgentSessionState;
  tasks: ClaimedTask[];
}

/** An agent that should be working and is not. */
export interface IdleFinding {
  kind: "idle";
  agentId: string;
  agentName: string;
  clientId: string | null;
  /** `idle`: a live session at its prompt. `gone`: no live session. */
  session: "idle" | "gone";
  /** When the session went idle or away, ISO 8601. */
  since: string;
  minutes: number;
  /** The open tasks it holds, earliest claim first. */
  tasks: ClaimedTask[];
  /** One key per spell: the agent and when the spell began. */
  signalKey: string;
  /** The fixed note the agent shows, such as "Idle 34 min with 2 open tasks". */
  note: string;
  /** Which task, and idle or gone for how long. */
  reason: string;
}

/** An agent under a usage limit while it holds open tasks: a note, no signal. */
export interface LimitedFinding {
  kind: "limited";
  agentId: string;
  tasks: ClaimedTask[];
  note: string;
}

export type WorkFinding = IdleFinding | LimitedFinding;

const openStates: ReadonlySet<BacklogItem["state"]> = new Set([
  "todo",
  "doing",
]);

/** A number of minutes in a few words: "34 min", "1 h", "2 h 5 min". */
export function durationText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function tasksText(count: number): string {
  return `${count} open ${count === 1 ? "task" : "tasks"}`;
}

/**
 * The agents that should be working and are not, and the limited agents
 * that hold open work. Pure, so every condition is tested without a
 * session or a database.
 */
export function findIdleWithWork(
  agents: readonly AgentWork[],
  settings: Pick<IdleWithWorkSettings, "idleMinutes" | "goneMinutes">,
  now: Date,
): WorkFinding[] {
  const found: WorkFinding[] = [];
  for (const agent of agents) {
    const tasks = agent.tasks.filter(
      (task) => openStates.has(task.state) && !task.blocked,
    );
    const session = agent.session;
    if (tasks.length === 0 || !session) continue;
    if (session.state === "limited") {
      found.push({
        kind: "limited",
        agentId: agent.agentId,
        tasks,
        note: `${tasksText(tasks.length)} wait for the reset`,
      });
      continue;
    }
    if (session.state !== "idle" && session.state !== "offline") continue;
    const elapsed = now.getTime() - Date.parse(session.since);
    const threshold =
      session.state === "idle" ? settings.idleMinutes : settings.goneMinutes;
    if (!(elapsed > threshold * 60_000)) continue;
    const minutes = Math.floor(elapsed / 60_000);
    const gone = session.state === "offline";
    const spell = gone
      ? `No session for ${durationText(minutes)}`
      : `Idle ${durationText(minutes)}`;
    const first = tasks[0]!;
    const more = tasks.length > 1 ? ` and ${tasks.length - 1} more` : "";
    found.push({
      kind: "idle",
      agentId: agent.agentId,
      agentName: agent.agentName,
      clientId: agent.clientId,
      session: gone ? "gone" : "idle",
      since: session.since,
      minutes,
      tasks,
      signalKey: `atlas:idle-with-work:${agent.agentId}:${session.since}`,
      note: `${spell} with ${tasksText(tasks.length)}`,
      reason: `Holds ${first.title} (${first.state})${more}; ${
        gone
          ? `no session for ${durationText(minutes)}`
          : `session idle ${durationText(minutes)}`
      }`,
    });
  }
  return found;
}

/** Each agent of the dataset, except vessels, with its session and claimed tasks. */
export function agentWorkOf(
  dataset: Dataset,
  sessions: ReadonlyMap<string, AgentSessionState>,
): AgentWork[] {
  const items = new Map(dataset.items.map((item) => [item.id, item]));
  const groups = new Map(dataset.groups.map((group) => [group.id, group]));
  return dataset.agents
    .filter((agent) => !isVessel(agent))
    .map((agent) => {
      const session = sessions.get(agent.id);
      const tasks = agent.workingOn.flatMap((id): ClaimedTask[] => {
        const item = items.get(id);
        if (!item) return [];
        return [
          {
            id: item.id,
            title: item.title,
            state: item.state,
            blocked: item.blocked === true,
            clientId: item.clientId,
            ...(item.tracker ? { trackerKey: item.tracker.key } : {}),
          },
        ];
      });
      return {
        agentId: agent.id,
        agentName: agent.name,
        clientId: groups.get(agent.groupId)?.clientId ?? null,
        ...(session ? { session } : {}),
        tasks,
      };
    });
}

/** One entry of `GET /api/digest` for an agent idle with open work. */
export interface IdleDigestEntry {
  kind: "idle-with-work";
  agentId: string;
  agentName: string;
  session: "idle" | "gone";
  since: string;
  minutes: number;
  taskIds: string[];
  text: string;
}

/** How the watcher reaches the rest of the server. */
export interface IdleConnection {
  dataset(): Dataset;
  record(event: AtlasEvent): unknown;
}

/** The session reader, as the watcher uses it. */
export interface AgentSessions {
  /** Each agent's session state, or undefined until a read has worked. */
  agentSessions(): ReadonlyMap<string, AgentSessionState> | undefined;
}

export interface IdleWatcher {
  connect(connection: IdleConnection): void;
  /** Finds idle agents, records signals and runs the nudge rule. Never throws. */
  check(): void;
  /** Resolves when every check started so far has finished. */
  settled(): Promise<void>;
  /** The dataset with each flagged agent's note, for views. */
  overlay(dataset: Dataset): Dataset;
  /** The agents idle with open work now, longest first. */
  digest(): IdleDigestEntry[];
  /** Calls `listener` when an agent is flagged or cleared. Returns a way to stop. */
  subscribe(listener: () => void): () => void;
  start(): void;
  stop(): void;
}

export interface IdleWatcherOptions {
  database: AtlasDatabase;
  sessions: AgentSessions;
  settings: IdleWithWorkSettings;
  /** The nudge rule's mode. */
  mode: RuleMode;
  /** Without one, a wake is recorded as dry. */
  waker?: AgentWaker;
  /** Seconds between checks. 60 unless set. */
  checkSeconds?: number;
  log?: (line: string) => void;
  now?: () => Date;
}

/** A short, stable id for one nudge, for the waker's request id. */
function requestIdOf(signalKey: string, at: string): string {
  const hash = new Bun.CryptoHasher("sha256")
    .update(`${signalKey}|${at}`)
    .digest("hex");
  return `dash-atlas-${hash.slice(0, 32)}`;
}

function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : failureName(error);
  return message.replace(/\s+/g, " ").slice(0, 160);
}

type IdleRow = typeof schema.idleWithWork.$inferSelect;

export function createIdleWatcher({
  database,
  sessions,
  settings,
  mode,
  waker,
  checkSeconds = 60,
  log = console.log,
  now = () => new Date(),
}: IdleWatcherOptions): IdleWatcher {
  let connection: IdleConnection | undefined;
  let current: WorkFinding[] = [];
  let queue: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();

  function rows(): Map<string, IdleRow> {
    return new Map(
      database
        .select()
        .from(schema.idleWithWork)
        .all()
        .map((row) => [row.agentId, row]),
    );
  }

  function save(agentId: string, values: Partial<Omit<IdleRow, "agentId">>) {
    database
      .insert(schema.idleWithWork)
      .values({ agentId, ...values })
      .onConflictDoUpdate({ target: schema.idleWithWork.agentId, set: values })
      .run();
  }

  function signal(
    finding: IdleFinding,
    event: IdleWithWorkSignalEvent["event"],
    at: Date,
    text: string,
  ): IdleWithWorkSignalEvent {
    return {
      type: "signal",
      source: "atlas",
      key: finding.signalKey,
      kind: "agent",
      event,
      agentId: finding.agentId,
      session: finding.session,
      minutes: finding.minutes,
      taskIds: finding.tasks.map((task) => task.id),
      client: finding.clientId,
      recordIds: [finding.agentId, ...finding.tasks.map((task) => task.id)],
      at: at.toISOString(),
      text,
    };
  }

  /** The signal that closes a spell, from what the row kept of it. */
  function cleared(
    row: IdleRow,
    at: Date,
    text: string,
  ): IdleWithWorkSignalEvent {
    const since = row.since ?? at.toISOString();
    return {
      type: "signal",
      source: "atlas",
      key: row.signalKey ?? `atlas:idle-with-work:${row.agentId}:${since}`,
      kind: "agent",
      event: "cleared",
      agentId: row.agentId,
      session: row.session === "gone" ? "gone" : "idle",
      minutes: Math.max(
        0,
        Math.floor((at.getTime() - Date.parse(since)) / 60_000),
      ),
      taskIds: row.taskIds ?? [],
      client: row.clientId,
      recordIds: [row.agentId, ...(row.taskIds ?? [])],
      at: at.toISOString(),
      text,
    };
  }

  async function act(
    finding: IdleFinding,
    plan: NudgePlan,
    dataset: Dataset,
    at: Date,
  ): Promise<AgentDispatchEvent> {
    const base: AgentDispatchEvent = {
      type: "dispatch",
      signalKey: finding.signalKey,
      rule: "nudge-idle-with-work",
      mode: plan.mode,
      outcome: plan.outcome,
      agentId: finding.agentId,
      taskIds: finding.tasks.map((task) => task.id),
      client: finding.clientId,
      needsYou: plan.needsYou,
      ...(plan.outcome === "ask" ? { command: plan.command } : {}),
      text: plan.text,
    };
    if (plan.outcome !== "wake" || plan.mode === "dry") return base;
    if (!waker)
      return {
        ...base,
        mode: "dry",
        woken: false,
        text: `Would wake the session to continue ${plan.task.title}: no waker is configured`,
      };
    const task = plan.task;
    const client = dataset.clients.find(
      (candidate) => candidate.id === task.clientId,
    );
    try {
      await waker.wake({
        requestId: requestIdOf(finding.signalKey, at.toISOString()),
        taskId: task.id,
        clientName: client?.name ?? task.clientId,
        title: plan.message,
        url: null,
        key: task.trackerKey ?? null,
        day: at.toISOString().slice(0, 10),
      });
      return {
        ...base,
        woken: true,
        text: `Woke the session to continue ${task.title}`,
      };
    } catch (error) {
      return {
        ...base,
        outcome: "fail",
        woken: false,
        text: `Could not wake the session: ${reasonOf(error)}`,
      };
    }
  }

  function record(event: AtlasEvent) {
    try {
      connection?.record(event);
    } catch (error) {
      log(`idle watcher could not record an event (${failureName(error)})`);
    }
  }

  async function run() {
    if (!connection) return;
    const states = sessions.agentSessions();
    if (!states) return;
    const at = now();
    const dataset = connection.dataset();
    const found = findIdleWithWork(agentWorkOf(dataset, states), settings, at);
    const idle = new Map(
      found
        .filter((finding): finding is IdleFinding => finding.kind === "idle")
        .map((finding) => [finding.agentId, finding]),
    );
    const before = current
      .map((finding) => `${finding.kind}:${finding.agentId}`)
      .sort()
      .join(",");
    current = found;
    const after = found
      .map((finding) => `${finding.kind}:${finding.agentId}`)
      .sort()
      .join(",");

    const stored = rows();
    // Spells that ended: the agent works again, or holds no open work.
    for (const row of stored.values()) {
      if (!row.signalKey) continue;
      const still = idle.get(row.agentId);
      if (still?.signalKey === row.signalKey) continue;
      const state = states.get(row.agentId)?.state;
      const text =
        state === "busy" || state === "waiting"
          ? "Working again"
          : "No longer idle with open work";
      record(cleared(row, at, text));
      save(row.agentId, { signalKey: null });
    }
    // Spells that began, then the nudge rule on every flagged agent.
    for (const finding of idle.values()) {
      const row = stored.get(finding.agentId);
      if (row?.signalKey !== finding.signalKey) {
        record(signal(finding, "idle_with_work", at, finding.note));
        save(finding.agentId, {
          signalKey: finding.signalKey,
          session: finding.session,
          since: finding.since,
          clientId: finding.clientId,
          taskIds: finding.tasks.map((task) => task.id),
        });
      }
      const plan = decideNudge(
        finding,
        { mode, lastNudgedAt: row?.nudgedAt ?? null, now: at },
        settings,
      );
      if (!plan) continue;
      // Written before the act, so a restart in the middle never nudges twice.
      save(finding.agentId, { nudgedAt: at.toISOString() });
      record(await act(finding, plan, dataset, at));
    }
    if (before !== after) for (const listener of listeners) listener();
  }

  function check() {
    queue = queue.then(run).catch((error: unknown) => {
      log(`idle watcher failed on a check (${failureName(error)})`);
    });
  }

  function overlay(dataset: Dataset): Dataset {
    if (current.length === 0) return dataset;
    const at = now();
    const notes = new Map<string, string>();
    for (const finding of current) {
      if (finding.kind === "limited") {
        notes.set(finding.agentId, finding.note);
        continue;
      }
      const minutes = Math.max(
        finding.minutes,
        Math.floor((at.getTime() - Date.parse(finding.since)) / 60_000),
      );
      const spell =
        finding.session === "gone"
          ? `No session for ${durationText(minutes)}`
          : `Idle ${durationText(minutes)}`;
      notes.set(
        finding.agentId,
        `${spell} with ${tasksText(finding.tasks.length)}`,
      );
    }
    return {
      ...dataset,
      agents: dataset.agents.map((agent) => {
        const note = notes.get(agent.id);
        if (note === undefined) return agent;
        // A limited agent keeps its usage-limit note, with the tasks after it.
        const limited = current.some(
          (finding) =>
            finding.kind === "limited" && finding.agentId === agent.id,
        );
        return {
          ...agent,
          note: limited && agent.note ? `${agent.note}. ${note}` : note,
        };
      }),
    };
  }

  return {
    connect(next) {
      connection = next;
    },
    check,
    settled() {
      return queue;
    },
    overlay,
    digest() {
      return current
        .filter((finding): finding is IdleFinding => finding.kind === "idle")
        .sort((left, right) => left.since.localeCompare(right.since))
        .map((finding) => ({
          kind: "idle-with-work" as const,
          agentId: finding.agentId,
          agentName: finding.agentName,
          session: finding.session,
          since: finding.since,
          minutes: finding.minutes,
          taskIds: finding.tasks.map((task) => task.id),
          text: finding.reason,
        }));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      timer ??= setInterval(check, checkSeconds * 1000);
    },
    stop() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    },
  };
}
