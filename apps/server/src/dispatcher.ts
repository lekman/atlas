/**
 * Runs the dispatcher's rules (`dispatcher-rules.ts`) on each new signal
 * and records every outcome as an Atlas `dispatch` event linked to the
 * signal by its key.
 *
 * - One decision per signal key: the decision row is written before the
 *   act, so a signal read twice, or a restart in the middle of an act,
 *   never acts twice.
 * - A pull request or alert is not delegated again while the task an
 *   earlier delegation created is still open.
 * - Signals are handled one at a time, in the order they arrive.
 *
 * The task database, the agent waker and the merger are interfaces, so
 * the rules and this runner are tested without a network. Without a task
 * database or a merger, an act that needs one is recorded as `dry`.
 *
 * The log holds counts and failure names only, never a repository, a
 * number or a client.
 */
import type {
  AtlasEvent,
  Dataset,
  DispatchEvent,
  SignalEvent,
} from "@atlas/core";
import { desc, eq } from "drizzle-orm";

import type { AtlasDatabase } from "./database";
import {
  decide,
  type DispatcherSettings,
  type MergeMethod,
  type Plan,
  type SignalContext,
  type TaskDraft,
} from "./dispatcher-rules";
import * as schema from "./schema";
import { failureName } from "./task-cache";

/** The task database, as the dispatcher uses it. */
export interface TaskApi {
  /** Adds a task and returns its id. */
  add(draft: TaskDraft, by: string, today: string): Promise<{ id: string }>;
  /** Whether a task is still open: not done and not dropped. */
  isOpen(taskId: string): Promise<boolean>;
}

/** What an agent is woken with: the task to start on. */
export interface WakeRequest {
  /** The same id for the same signal, so asking twice is one request. */
  requestId: string;
  taskId: string;
  /** The client's name, as the task database holds it. */
  clientName: string;
  title: string;
  url: string;
  key: string | null;
  day: string;
}

/** Asks an agent to start on a task. */
export interface AgentWaker {
  wake(request: WakeRequest): Promise<void>;
}

/** Merges a pull request at a known head commit. */
export interface Merger {
  merge(request: {
    repository: string;
    number: number;
    sha: string;
    method: MergeMethod;
  }): Promise<void>;
}

/** How the dispatcher reaches the rest of the server. */
export interface DispatchConnection {
  record(event: AtlasEvent): unknown;
  dataset(): Dataset;
}

export interface DigestEntry {
  repository: string;
  number: number;
  url: string;
  alertType: string | null;
  severity: string | null;
  decidedAt: string;
}

export interface Dispatcher {
  /** Decides about a new signal and acts on it in the background. Never throws. */
  handle(
    signal: SignalEvent,
    context: Omit<SignalContext, "now">,
    connection: DispatchConnection,
  ): void;
  /** Resolves when every signal handed in so far is handled. */
  settled(): Promise<void>;
  /** The digest list: alerts left for a digest, newest first. */
  digest(limit?: number): DigestEntry[];
}

export interface DispatcherOptions {
  database: AtlasDatabase;
  settings: DispatcherSettings;
  /** The name changes in the task database are recorded under. */
  by?: string;
  tasks?: TaskApi;
  waker?: AgentWaker;
  merger?: Merger;
  log?: (line: string) => void;
  now?: () => Date;
}

/** A short, stable id for a signal key, for the waker's request id. */
function requestIdOf(signalKey: string): string {
  const hash = new Bun.CryptoHasher("sha256").update(signalKey).digest("hex");
  return `dash-atlas-${hash.slice(0, 32)}`;
}

/** Why an act failed, in a few plain words. A message from our own server is kept short. */
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : failureName(error);
  return message.replace(/\s+/g, " ").slice(0, 160);
}

export function createDispatcher({
  database,
  settings,
  by = "atlas-dispatcher",
  tasks,
  waker,
  merger,
  log = console.log,
  now = () => new Date(),
}: DispatcherOptions): Dispatcher {
  let queue: Promise<void> = Promise.resolve();

  /** Writes the decision row. Returns false when the signal was already decided. */
  function claim(signal: SignalEvent, plan: Plan): boolean {
    const rows = database
      .insert(schema.dispatchDecisions)
      .values({
        signalKey: signal.key,
        rule: plan.rule,
        mode: plan.mode,
        outcome: "pending",
        repository: signal.repository.toLowerCase(),
        number: signal.number,
        url: signal.url,
        alertType: signal.alertType ?? null,
        severity: signal.severity ?? null,
        decidedAt: now().toISOString(),
      })
      .onConflictDoNothing()
      .returning({ signalKey: schema.dispatchDecisions.signalKey })
      .all();
    return rows.length > 0;
  }

  function settle(signal: SignalEvent, event: DispatchEvent) {
    database
      .update(schema.dispatchDecisions)
      .set({ mode: event.mode, outcome: event.outcome })
      .where(eq(schema.dispatchDecisions.signalKey, signal.key))
      .run();
  }

  /** The open task an earlier delegation of this subject created, if any. */
  async function openTask(subject: string): Promise<string | undefined> {
    const row = database
      .select()
      .from(schema.dispatchDelegations)
      .where(eq(schema.dispatchDelegations.subject, subject))
      .get();
    if (!row || !tasks) return undefined;
    return (await tasks.isOpen(row.taskId)) ? row.taskId : undefined;
  }

  async function act(
    signal: SignalEvent,
    plan: Plan,
    connection: DispatchConnection,
  ): Promise<DispatchEvent> {
    const base = {
      type: "dispatch" as const,
      signalKey: signal.key,
      rule: plan.rule,
      mode: plan.mode,
      outcome: plan.outcome,
      repository: signal.repository,
      number: signal.number,
      url: signal.url,
      client: signal.client,
      needsYou: plan.needsYou,
      text: plan.text,
    };
    if (plan.outcome === "skip" || plan.outcome === "digest") return base;

    if (plan.outcome === "merge") {
      const dry = { ...base, mergeMethod: plan.method };
      if (plan.mode === "dry") return dry;
      if (!merger)
        return {
          ...dry,
          mode: "dry",
          text: `${plan.text}: not merged, because no merger is configured`,
        };
      try {
        await merger.merge({
          repository: signal.repository,
          number: signal.number,
          sha: plan.sha,
          method: plan.method,
        });
        return {
          ...dry,
          text: `Merged pull request #${signal.number} by ${plan.method}`,
        };
      } catch (error) {
        return {
          ...dry,
          outcome: "fail",
          text: `Could not merge pull request #${signal.number}: ${reasonOf(error)}`,
        };
      }
    }

    if (plan.outcome !== "delegate" || plan.mode === "dry") return base;
    if (!tasks)
      return {
        ...base,
        mode: "dry",
        text: `${plan.text}: no task added, because no task database API is configured`,
      };
    const today = now().toISOString().slice(0, 10);
    let taskId: string;
    try {
      const open = await openTask(plan.subject);
      if (open)
        return {
          ...base,
          outcome: "skip",
          needsYou: false,
          taskId: open,
          text: `Already delegated: task ${open} is still open`,
        };
      taskId = (await tasks.add(plan.task, by, today)).id;
    } catch (error) {
      return {
        ...base,
        outcome: "fail",
        text: `Could not add the task: ${reasonOf(error)}`,
      };
    }
    database
      .insert(schema.dispatchDelegations)
      .values({
        subject: plan.subject,
        taskId,
        delegatedAt: now().toISOString(),
      })
      .onConflictDoUpdate({
        target: schema.dispatchDelegations.subject,
        set: { taskId, delegatedAt: now().toISOString() },
      })
      .run();
    if (!waker)
      return {
        ...base,
        taskId,
        woken: false,
        text: `${plan.text}: task added; no agent woken, because no waker is configured`,
      };
    const client = connection
      .dataset()
      .clients.find((candidate) => candidate.id === plan.task.clientId);
    try {
      await waker.wake({
        requestId: requestIdOf(signal.key),
        taskId,
        clientName: client?.name ?? plan.task.clientId,
        title: plan.task.title,
        url: signal.url,
        key: plan.task.tracker?.key ?? null,
        day: today,
      });
      return {
        ...base,
        taskId,
        woken: true,
        text: `${plan.text}: task added, agent asked to start`,
      };
    } catch (error) {
      return {
        ...base,
        taskId,
        woken: false,
        text: `${plan.text}: task added; waking an agent failed (${reasonOf(error)})`,
      };
    }
  }

  async function run(
    signal: SignalEvent,
    context: Omit<SignalContext, "now">,
    connection: DispatchConnection,
  ) {
    const plan = decide(signal, { ...context, now: now() }, settings);
    if (!plan || !claim(signal, plan)) return;
    const event = await act(signal, plan, connection);
    settle(signal, event);
    try {
      connection.record(event);
    } catch (error) {
      log(`dispatcher could not record a decision (${failureName(error)})`);
    }
  }

  return {
    handle(signal, context, connection) {
      queue = queue
        .then(() => run(signal, context, connection))
        .catch((error: unknown) => {
          log(`dispatcher failed on a signal (${failureName(error)})`);
        });
    },
    settled() {
      return queue;
    },
    digest(limit = 100) {
      return database
        .select({
          repository: schema.dispatchDecisions.repository,
          number: schema.dispatchDecisions.number,
          url: schema.dispatchDecisions.url,
          alertType: schema.dispatchDecisions.alertType,
          severity: schema.dispatchDecisions.severity,
          decidedAt: schema.dispatchDecisions.decidedAt,
        })
        .from(schema.dispatchDecisions)
        .where(eq(schema.dispatchDecisions.outcome, "digest"))
        .orderBy(desc(schema.dispatchDecisions.decidedAt))
        .limit(limit)
        .all();
    },
  };
}
