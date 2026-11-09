/**
 * The account-switch rule: when a Claude Code session hits a subscription
 * usage limit, restart it under another configured account and resume its
 * conversation there. It runs on each `limited` session the session reader
 * reports (see `session-source.ts`), and records every decision as an
 * `account-switch` event linked to the usage-limit signal by its key, the
 * way the dispatcher records `dispatch` events.
 *
 * - The rule has a mode: `off` decides nothing, `dry` decides and records
 *   the restart without doing it, `on` does it. It is `off` unless the
 *   accounts file says otherwise.
 * - One decision per signal key: the decision row is written before the
 *   act, so a signal seen twice, or a restart of Atlas in the middle of an
 *   act, never restarts a session twice.
 * - Each account's newest limit is kept, whatever the mode, so a session is
 *   never moved onto an account that is limited while no session runs on it.
 * - Atlas does not stop or start Claude Code itself. A launcher command on
 *   the machine does, called with named arguments and no shell.
 *
 * The log holds counts and failure names only, never a session, a folder
 * or an account.
 */
import type { AccountSwitchEvent, AtlasEvent, Dataset } from "@atlas/core";
import { eq } from "drizzle-orm";

import type { AtlasDatabase } from "./database";
import type { RuleMode } from "./dispatcher-rules";
import * as schema from "./schema";
import type { LimitedSession } from "./session-source";
import { failureName } from "./task-cache";

/** One Claude Code account: a name, and the folder `CLAUDE_CONFIG_DIR` points at for it. */
export interface ClaudeAccount {
  name: string;
  directory: string;
}

export interface AccountSwitchSettings {
  /** In order of preference: the first free account is chosen. */
  accounts: readonly ClaudeAccount[];
  mode: RuleMode;
  /** A limit Atlas sees later than this after it was hit is recorded but not acted on. */
  maxAgeMinutes: number;
}

/** The newest limit seen on an account. */
export interface AccountLimitState {
  kind: string;
  /** When it resets, ISO 8601, or null when Claude Code gave no time. */
  resetsAt: string | null;
  /** When a session on the account hit it, ISO 8601. */
  seenAt: string;
}

/** How long a limit with no reset time is taken to hold: the shortest limit window. */
export const UNKNOWN_RESET_HOURS = 5;

/** Whether an account's limit still holds at `now`. */
export function accountIsLimited(
  limit: AccountLimitState | undefined,
  now: Date,
): boolean {
  if (!limit) return false;
  const until = limit.resetsAt
    ? Date.parse(limit.resetsAt)
    : Date.parse(limit.seenAt) + UNKNOWN_RESET_HOURS * 3_600_000;
  return until > now.getTime();
}

interface PlanBase {
  mode: Exclude<RuleMode, "off">;
  from: string | null;
  needsYou: boolean;
  text: string;
}

/** A decision before it is acted on. */
export type SwitchPlan =
  | (PlanBase & { outcome: "skip"; to: null })
  | (PlanBase & { outcome: "switch"; to: string; directory: string });

/**
 * What the rule decides about one limited session, or null while it is
 * off. Pure, so each reason is tested without a process.
 */
export function decideSwitch(
  session: LimitedSession,
  settings: AccountSwitchSettings,
  limits: ReadonlyMap<string, AccountLimitState>,
  now: Date,
): SwitchPlan | null {
  if (settings.mode === "off") return null;
  const mode = settings.mode;
  const from = session.account;
  const skip = (text: string, needsYou = false): SwitchPlan => ({
    outcome: "skip",
    mode,
    from,
    to: null,
    needsYou,
    text,
  });
  if (!from || !settings.accounts.some((account) => account.name === from))
    return skip("The session's account is not in the accounts file");
  if (!session.sessionId || !session.cwd)
    return skip("The session has no id or folder to resume it by", true);
  const age = now.getTime() - Date.parse(session.limit.at);
  if (age > settings.maxAgeMinutes * 60_000)
    return skip(`The limit is older than ${settings.maxAgeMinutes} minutes`);
  const free = settings.accounts.find(
    (account) =>
      account.name !== from && !accountIsLimited(limits.get(account.name), now),
  );
  if (!free) return skip("Every other account is limited", true);
  return {
    outcome: "switch",
    mode,
    from,
    to: free.name,
    directory: free.directory,
    needsYou: false,
    text:
      mode === "dry"
        ? `Would restart the session under account ${free.name}`
        : `Restart the session under account ${free.name}`,
  };
}

/** What the launcher is asked to do. */
export interface RestartRequest {
  /** The session's name, for `--name` and `--remote-control`. */
  sessionName: string;
  /** The conversation to resume. */
  sessionId: string;
  /** The folder the session runs in. */
  cwd: string;
  /** The account folder to set as `CLAUDE_CONFIG_DIR`. */
  configDirectory: string;
  /** The process to stop first. */
  pid: number;
}

/** Stops a session and starts it again under another account. Resolves once it runs. */
export interface SessionLauncher {
  restart(request: RestartRequest): Promise<void>;
}

/** The launcher's arguments: the configured command, then the request as named arguments. */
export function launcherArguments(
  command: readonly string[],
  request: RestartRequest,
): string[] {
  return [
    ...command,
    "--name",
    request.sessionName,
    "--session-id",
    request.sessionId,
    "--cwd",
    request.cwd,
    "--config-directory",
    request.configDirectory,
    "--pid",
    String(request.pid),
  ];
}

/**
 * A launcher that runs a command on this machine. It succeeds on exit 0.
 * Its output is not read into Atlas, so a failure is reported by its exit
 * code only.
 */
export function commandLineLauncher(
  command: readonly string[],
  timeoutSeconds = 300,
): SessionLauncher {
  return {
    async restart(request) {
      const child = Bun.spawn(launcherArguments(command, request), {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });
      const timer = setTimeout(() => child.kill(), timeoutSeconds * 1000);
      const code = await child.exited;
      clearTimeout(timer);
      if (child.signalCode)
        throw new Error(
          `the launcher did not finish within ${timeoutSeconds} seconds`,
        );
      if (code !== 0) throw new Error(`the launcher exited with code ${code}`);
    },
  };
}

/** How the switcher reaches the rest of the server. */
export interface SwitchConnection {
  record(event: AtlasEvent): unknown;
  dataset(): Dataset;
}

export interface AccountSwitcher {
  /** Notes the limit, then decides and acts in the background. Never throws. */
  handle(session: LimitedSession, connection: SwitchConnection): void;
  /** Resolves when every session handed in so far is handled. */
  settled(): Promise<void>;
  /** The newest limit seen on each account. */
  limits(): Map<string, AccountLimitState>;
}

export interface AccountSwitcherOptions {
  database: AtlasDatabase;
  settings: AccountSwitchSettings;
  /** Without one, a switch is recorded as dry. */
  launcher?: SessionLauncher;
  log?: (line: string) => void;
  now?: () => Date;
}

function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : failureName(error);
  return message.replace(/\s+/g, " ").slice(0, 160);
}

export function createAccountSwitcher({
  database,
  settings,
  launcher,
  log = console.log,
  now = () => new Date(),
}: AccountSwitcherOptions): AccountSwitcher {
  let queue: Promise<void> = Promise.resolve();

  function limits(): Map<string, AccountLimitState> {
    return new Map(
      database
        .select()
        .from(schema.accountLimits)
        .all()
        .map((row) => [
          row.account,
          { kind: row.kind, resetsAt: row.resetsAt, seenAt: row.seenAt },
        ]),
    );
  }

  /** Keeps the account's newest limit. */
  function note(session: LimitedSession) {
    if (!session.account) return;
    const known = limits().get(session.account);
    if (known && Date.parse(known.seenAt) >= Date.parse(session.limit.at))
      return;
    const values = {
      kind: session.limit.kind,
      resetsAt: session.limit.resetsAt,
      seenAt: session.limit.at,
    };
    database
      .insert(schema.accountLimits)
      .values({ account: session.account, ...values })
      .onConflictDoUpdate({ target: schema.accountLimits.account, set: values })
      .run();
  }

  /** Writes the decision row. Returns false when the signal was already decided. */
  function claim(session: LimitedSession, plan: SwitchPlan): boolean {
    return (
      database
        .insert(schema.accountSwitchDecisions)
        .values({
          signalKey: session.signalKey,
          agentId: session.agentId,
          fromAccount: plan.from,
          toAccount: plan.to,
          mode: plan.mode,
          outcome: "pending",
          decidedAt: now().toISOString(),
        })
        .onConflictDoNothing()
        .returning({ signalKey: schema.accountSwitchDecisions.signalKey })
        .all().length > 0
    );
  }

  async function act(
    session: LimitedSession,
    plan: SwitchPlan,
  ): Promise<AccountSwitchEvent> {
    const base: AccountSwitchEvent = {
      type: "account-switch",
      signalKey: session.signalKey,
      mode: plan.mode,
      outcome: plan.outcome,
      agentId: session.agentId,
      from: plan.from,
      to: plan.to,
      needsYou: plan.needsYou,
      text: plan.text,
    };
    if (plan.outcome === "skip" || plan.mode === "dry") return base;
    const dry = `Would restart the session under account ${plan.to}`;
    if (!launcher)
      return {
        ...base,
        mode: "dry",
        text: `${dry}: no launcher is configured`,
      };
    if (!session.sessionId || !session.cwd) return base;
    try {
      await launcher.restart({
        sessionName: session.sessionName,
        sessionId: session.sessionId,
        cwd: session.cwd,
        configDirectory: plan.directory,
        pid: session.pid,
      });
      return {
        ...base,
        text: `Restarted the session under account ${plan.to}`,
      };
    } catch (error) {
      return {
        ...base,
        outcome: "fail",
        needsYou: true,
        text: `Could not restart the session under account ${plan.to}: ${reasonOf(error)}`,
      };
    }
  }

  async function run(session: LimitedSession, connection: SwitchConnection) {
    note(session);
    const plan = decideSwitch(session, settings, limits(), now());
    if (!plan || !claim(session, plan)) return;
    const event = await act(session, plan);
    database
      .update(schema.accountSwitchDecisions)
      .set({ mode: event.mode, outcome: event.outcome })
      .where(eq(schema.accountSwitchDecisions.signalKey, session.signalKey))
      .run();
    try {
      connection.record(event);
    } catch (error) {
      log(`account switch could not record a decision (${failureName(error)})`);
    }
  }

  return {
    handle(session, connection) {
      queue = queue
        .then(() => run(session, connection))
        .catch((error: unknown) => {
          log(`account switch failed on a session (${failureName(error)})`);
        });
    },
    settled() {
      return queue;
    },
    limits,
  };
}
