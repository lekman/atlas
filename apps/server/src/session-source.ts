/**
 * Live agent status from the Claude Code sessions on this machine. Set
 * `ATLAS_SESSIONS_DIR` to the folder where Claude Code keeps one file per
 * live session (`~/.claude/sessions`); without it the reader is off and
 * the server behaves as before.
 *
 * Claude Code writes `<pid>.json` for each session it runs. That file is
 * Claude Code's internal state, not a documented interface, so it is read
 * leniently: only `pid`, `name`, `status`, `sessionId`, `statusUpdatedAt`,
 * `entrypoint`, `cwd` and `startedAt` are kept, every other field is
 * dropped on parse, and a file that is half written or has another shape is
 * skipped for that poll.
 * When files exist and none of them has the expected shape, health reports
 * it and nothing is changed. A file can outlive its process, so a session
 * counts only while its process is alive.
 *
 * Each poll matches the live sessions to agents:
 *
 * - A session matches an agent when its trimmed name equals the agent's id
 *   or name, without regard to case (exact), or starts with the id or name
 *   followed by "-" (prefix: roster "Example" is session "example-69").
 *   Exact beats prefix, and a longer prefix beats a shorter one. A session
 *   that matches two agents equally is ambiguous: counted, never applied.
 * - Of several live sessions on one agent, the most active wins (busy, then
 *   waiting, then idle), then the most recent status change.
 * - A status change is recorded only when the session's state changes, and
 *   only when the agent's status then differs, as a `status-change` event
 *   through the same path as `POST /api/events`. A status an agent reported
 *   itself through MCP stays until its session's state next changes.
 * - A session that matches no agent is docked: it becomes an agent in the
 *   home client's group, and is removed again once it has been offline for
 *   the forget window, or once its name matches a roster agent.
 *
 * Usage limits: a session's file says `idle` after it hits a subscription
 * usage limit, and only its transcript says why. Where a folder's
 * `projects/` is known, each live session's transcript tail is read with
 * `@atlas/collector`. A limit hit after the process started puts the
 * session in the `limited` state: its agent shows `blocked` with a fixed
 * note ("Weekly usage limit reached, resets 25 Oct 18:00"), and entering
 * the state records one `signal` event (source `claude`, kind
 * `usage-limit`) and calls `onUsageLimit`. A later reply, or the reset
 * time passing, ends it. A limit from before the process started belongs
 * to an earlier run, such as one under another account, and is ignored.
 *
 * Accounts: with `folders`, each Claude Code configuration folder (one per
 * `CLAUDE_CONFIG_DIR`) is read, and a session belongs to the account whose
 * folder holds its file. A process seen in two folders counts once, in the
 * first.
 *
 * The log holds counts and problems only, never a session's name or folder.
 */
import {
  closeSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
} from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";

import {
  readTail,
  usageLimitIsActive,
  usageLimitNote,
  type UsageLimit,
} from "@atlas/collector";

import {
  isVessel,
  type Agent,
  type AgentStatus,
  type AtlasEvent,
  type Dataset,
  type UsageLimitSignalEvent,
} from "@atlas/core";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import type { AtlasDatabase } from "./database";
import * as schema from "./schema";
import type { SessionState } from "./schema";

/** A session status as Claude Code writes it. */
export const sessionStatuses = ["busy", "waiting", "idle"] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

/** The fields Atlas reads from a session file. Everything else is dropped. */
/**
 * Newer Claude Code versions write more states than the three Atlas keeps:
 * "running" while it works, "requires_action" while a permission prompt or
 * question waits in the session, and "shell" at an idle prompt. Each maps to
 * the nearest of the three, so those files are read instead of skipped.
 */
const STATUS_ALIASES: Readonly<Record<string, SessionStatus>> = {
  busy: "busy",
  running: "busy",
  waiting: "waiting",
  requires_action: "waiting",
  idle: "idle",
  shell: "idle",
};

const SessionStatusField = z.string().transform((value, context) => {
  const status = STATUS_ALIASES[value];
  if (!status) {
    context.addIssue({ code: "custom", message: "not a session status" });
    return z.NEVER;
  }
  return status;
});

const SessionFileShape = z.object({
  pid: z.number().int().positive().optional().catch(undefined),
  name: z.string().optional().catch(undefined),
  status: SessionStatusField,
  sessionId: z.string().optional().catch(undefined),
  statusUpdatedAt: z.number().optional().catch(undefined),
  entrypoint: z.string().optional().catch(undefined),
  cwd: z.string().optional().catch(undefined),
  startedAt: z.number().optional().catch(undefined),
});

/** One live Claude Code session, as Atlas keeps it. */
export interface Session {
  pid: number;
  /** The name other sessions address it by, trimmed; absent when it has none. */
  name?: string;
  status: SessionStatus;
  sessionId?: string;
  /** When the status last changed, in milliseconds since 1970; 0 when unknown. */
  statusUpdatedAt: number;
  entrypoint?: string;
  /** The folder the session runs in. Used to find its transcript; never logged or reported. */
  cwd?: string;
  /** When the process started, in milliseconds since 1970. */
  startedAt?: number;
}

/** The session file name: the process id, then `.json`. */
const sessionFileName = /^(\d+)\.json$/;

/**
 * A session file's text as a session, or `undefined` when it is not JSON
 * or has another shape. `filePid` is the process id from the file name,
 * used when the file holds none.
 */
export function parseSessionFile(
  text: string,
  filePid: number,
): Session | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  const parsed = SessionFileShape.safeParse(value);
  if (!parsed.success) return undefined;
  const pid = parsed.data.pid ?? filePid;
  if (!Number.isSafeInteger(pid) || pid < 1) return undefined;
  const name = parsed.data.name?.trim();
  return {
    pid,
    ...(name ? { name } : {}),
    status: parsed.data.status,
    ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
    statusUpdatedAt: parsed.data.statusUpdatedAt ?? 0,
    ...(parsed.data.entrypoint ? { entrypoint: parsed.data.entrypoint } : {}),
    ...(parsed.data.cwd ? { cwd: parsed.data.cwd } : {}),
    ...(parsed.data.startedAt !== undefined
      ? { startedAt: parsed.data.startedAt }
      : {}),
  };
}

/**
 * Whether a process is alive, by sending it signal 0. A process of another
 * user answers "not permitted", which still means it exists.
 */
export function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as { code?: string }).code === "EPERM";
  }
}

/** What one read of the sessions folder found. */
export interface SessionRead {
  /** Session files in the folder, whether or not they parsed. */
  files: number;
  /** Files that parsed, live or not. */
  parsed: number;
  /** Parsed sessions whose process is alive. */
  live: Session[];
  /** Why the folder could not be used, or `null`. */
  error: string | null;
}

/** Reads every `<pid>.json` in `directory`. Never throws. */
export function readSessionDirectory(
  directory: string,
  isAlive: (pid: number) => boolean,
): SessionRead {
  let names: string[];
  try {
    names = readdirSync(directory);
  } catch {
    return {
      files: 0,
      parsed: 0,
      live: [],
      error: "the sessions folder cannot be read",
    };
  }
  let files = 0;
  let parsed = 0;
  const live: Session[] = [];
  for (const name of names) {
    const match = sessionFileName.exec(name);
    if (!match?.[1]) continue;
    files++;
    let text: string;
    try {
      text = readFileSync(join(directory, name), "utf8");
    } catch {
      // Removed between the listing and the read: the session ended.
      continue;
    }
    const session = parseSessionFile(text, Number(match[1]));
    if (!session) continue;
    parsed++;
    if (isAlive(session.pid)) live.push(session);
  }
  const error =
    files > 0 && parsed === 0
      ? "no session file has the expected shape; Claude Code may have changed it"
      : null;
  return { files, parsed, live, error };
}

/** How a session name matched the agents. */
export interface SessionMatch {
  agentId?: string;
  ambiguous: boolean;
}

/**
 * The agent a session name names. Exact (the id or name, without regard to
 * case) beats prefix (the id or name followed by "-"), and a longer prefix
 * beats a shorter one. Two agents matching equally well name nobody.
 */
export function matchSession(
  agents: readonly Agent[],
  sessionName: string,
): SessionMatch {
  const key = sessionName.trim().toLowerCase();
  if (key === "") return { ambiguous: false };
  // A score per agent: exact is above every prefix, and a prefix scores its length.
  const exact = Number.MAX_SAFE_INTEGER;
  let best = 0;
  let winners = new Set<string>();
  for (const agent of agents) {
    let score = 0;
    for (const candidate of [agent.id, agent.name.trim()]) {
      const lower = candidate.toLowerCase();
      if (lower === "") continue;
      if (key === lower) score = exact;
      else if (key.startsWith(`${lower}-`))
        score = Math.max(score, lower.length);
    }
    if (score === 0) continue;
    if (score > best) {
      best = score;
      winners = new Set([agent.id]);
    } else if (score === best) winners.add(agent.id);
  }
  if (winners.size === 1) return { agentId: [...winners][0], ambiguous: false };
  return { ambiguous: winners.size > 1 };
}

/** A session and what its transcript says about a usage limit. */
type RankedSession = Session & { usageLimit?: UsageLimit | null };

/** A live session's state: `limited` while a usage limit holds, else Claude Code's own. */
function stateOf(session: RankedSession): Exclude<SessionState, "offline"> {
  return session.usageLimit ? "limited" : session.status;
}

const activity: Record<Exclude<SessionState, "offline">, number> = {
  busy: 4,
  waiting: 3,
  limited: 2,
  idle: 1,
};

/**
 * Whether `left` is more active than `right`: busy, then waiting, then
 * limited, then idle, then the latest change.
 */
export function moreActive(left: RankedSession, right: RankedSession): boolean {
  const difference = activity[stateOf(left)] - activity[stateOf(right)];
  if (difference !== 0) return difference > 0;
  return left.statusUpdatedAt > right.statusUpdatedAt;
}

/** An agent status for each session state, and the note that goes with it. */
const statusFor: Record<SessionState, { to: AgentStatus; text: string }> = {
  busy: { to: "running", text: "Session busy" },
  waiting: { to: "waiting", text: "Session waiting on you" },
  limited: { to: "blocked", text: "Usage limit reached" },
  idle: { to: "idle", text: "Session idle" },
  offline: { to: "idle", text: "Session offline" },
};

/**
 * One Claude Code configuration folder: its `sessions/`, its `projects/`
 * (where the transcripts are, or null to read none), and the account name
 * it signs in as (null when no accounts are configured).
 */
export interface SessionFolder {
  account: string | null;
  sessions: string;
  projects: string | null;
}

/** A session that has just entered the `limited` state, for the account-switch rule. */
export interface LimitedSession {
  /** The key of the signal recorded for it. */
  signalKey: string;
  agentId: string;
  account: string | null;
  /** The session's name as Claude Code has it, for restarting it under the same name. */
  sessionName: string;
  sessionId?: string;
  cwd?: string;
  pid: number;
  limit: UsageLimit;
}

/** The transcript of a session: `<projects>/<cwd with / and . as ->/<sessionId>.jsonl`. */
export function transcriptPath(
  projects: string,
  cwd: string,
  sessionId: string,
): string {
  return join(projects, cwd.replace(/[/.]/g, "-"), `${sessionId}.jsonl`);
}

/** The bytes read from the end of a transcript: enough for its last turns. */
const TAIL_BYTES = 256 * 1024;

/** The last whole lines of a file, or none when it cannot be read. */
function lastLines(path: string, size: number): string[] {
  const length = Math.min(size, TAIL_BYTES);
  const buffer = Buffer.alloc(length);
  const file = openSync(path, "r");
  try {
    readSync(file, buffer, 0, length, size - length);
  } finally {
    closeSync(file);
  }
  const lines = buffer.toString("utf8").split("\n");
  // The first line is cut when the read starts inside the file.
  return size > length ? lines.slice(1) : lines;
}

/**
 * The usage limit a session's transcript ends in, hit after its process
 * started, or null. Reads are cached by the file's size and change time.
 */
function createLimitReader() {
  const cache = new Map<
    string,
    { size: number; changed: number; limit: UsageLimit | null }
  >();
  return (projects: string | null, session: Session): UsageLimit | null => {
    if (!projects || !session.cwd || !session.sessionId) return null;
    const path = transcriptPath(projects, session.cwd, session.sessionId);
    let size: number;
    let changed: number;
    try {
      const stat = statSync(path);
      size = stat.size;
      changed = stat.mtimeMs;
    } catch {
      return null;
    }
    const cached = cache.get(path);
    let limit: UsageLimit | null;
    if (cached && cached.size === size && cached.changed === changed)
      limit = cached.limit;
    else {
      try {
        limit = readTail(lastLines(path, size)).usageLimit;
      } catch {
        limit = null;
      }
      cache.set(path, { size, changed, limit });
    }
    if (
      limit &&
      session.startedAt !== undefined &&
      Date.parse(limit.at) < session.startedAt
    )
      return null;
    return limit;
  };
}

/** The note a docked agent starts with. */
export const dockedNote = "Not in the roster";

/** A session name as a lower-case identifier, for a docked agent's id. */
export function sessionSlug(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** An id for a docked agent that no record in `taken` uses: `session-<slug>`, then -2, -3. */
export function dockedAgentId(
  name: string,
  taken: ReadonlySet<string>,
): string {
  const slug = sessionSlug(name);
  const base = slug ? `session-${slug}` : "session";
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** What `GET /api/health` reports about sessions. Counts only, never a name. */
export interface SessionHealth {
  source: "files" | "none";
  /** The folder could be read and, when it holds session files, at least one parsed. */
  ok: boolean;
  /** Session files at the latest read. */
  files: number;
  /** Sessions whose process is alive. */
  live: number;
  /** Live sessions that matched a roster agent. */
  matched: number;
  /** Live sessions that matched no agent and are docked at home. */
  unknownDocked: number;
  /** Live sessions that matched two agents equally, and so changed nothing. */
  ambiguous: number;
  /** Live sessions whose transcript shows a usage limit that still holds. */
  limited: number;
  /** Session files left out at the latest read, because they did not parse. */
  skipped: number;
  /** When the folder was last read, or `null`. */
  lastReadAt: string | null;
  error: string | null;
}

/** The health reported when no sessions folder is configured. */
export const noSessionSource: SessionHealth = {
  source: "none",
  ok: true,
  files: 0,
  live: 0,
  matched: 0,
  unknownDocked: 0,
  ambiguous: 0,
  limited: 0,
  skipped: 0,
  lastReadAt: null,
  error: null,
};

/** How the reader reaches the rest of the server. */
export interface SessionConnection {
  /** The dataset sessions are matched against, as the API serves it. */
  dataset(): Dataset;
  /** Records an event the way `POST /api/events` does: stored, then streamed. */
  record(event: AtlasEvent): void;
}

export interface SessionReader {
  /** Gives the reader the dataset and the record path. Nothing is applied until then. */
  connect(connection: SessionConnection): void;
  /** Reads the folder and applies what changed. Never throws. */
  poll(): void;
  health(): SessionHealth;
  /** Calls `listener` when a docked agent was added or removed. Returns a way to stop. */
  subscribe(listener: () => void): () => void;
  /** Polls on a timer until `stop`. */
  start(): void;
  stop(): void;
}

export interface SessionReaderOptions {
  /**
   * The folder that holds Claude Code's `<pid>.json` session files. Its
   * sibling `projects/` is read for transcripts. Ignored when `folders` is set.
   */
  directory?: string;
  /** One entry per Claude Code configuration folder, for several accounts. */
  folders?: readonly SessionFolder[];
  database: AtlasDatabase;
  /** Seconds between reads. 5 unless set. */
  pollSeconds?: number;
  /** Hours a docked agent stays after its session ends. 24 unless set. */
  forgetHours?: number;
  /** Whether a process is alive. `processIsAlive` unless set. */
  isAlive?: (pid: number) => boolean;
  /** The host name docked agents get. This machine's unless set. */
  host?: string;
  /** Where one-line notices go. `console.log` by default. */
  log?: (line: string) => void;
  now?: () => Date;
  /** The time zone of the reset time in a usage-limit note. This machine's unless set. */
  timeZone?: string;
  /** Called once when a session enters the `limited` state, after its signal is recorded. */
  onUsageLimit?: (
    session: LimitedSession,
    connection: SessionConnection,
  ) => void;
}

/** A live session, with the account whose folder holds it and its usage limit. */
type LiveSession = Session & {
  account: string | null;
  usageLimit: UsageLimit | null;
};

type SessionRow = typeof schema.sessionAgents.$inferSelect;

export function createSessionReader({
  directory,
  folders: configuredFolders,
  database,
  pollSeconds = 5,
  forgetHours = 24,
  isAlive = processIsAlive,
  host = hostname(),
  log = console.log,
  now = () => new Date(),
  timeZone,
  onUsageLimit,
}: SessionReaderOptions): SessionReader {
  const folders: readonly SessionFolder[] =
    configuredFolders ??
    (directory
      ? [
          {
            account: null,
            sessions: directory,
            projects: join(dirname(directory), "projects"),
          },
        ]
      : []);
  const limitOf = createLimitReader();
  let connection: SessionConnection | undefined;
  let health: SessionHealth = {
    ...noSessionSource,
    source: "files",
    ok: false,
    error: "the sessions folder has not been read yet",
  };
  let reported: string | null = null;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;

  /** Logs a problem once, until it changes or clears. */
  function report(problem: string | null) {
    if (problem && problem !== reported) log(`sessions: ${problem}`);
    reported = problem;
  }

  function rows(): Map<string, SessionRow> {
    return new Map(
      database
        .select()
        .from(schema.sessionAgents)
        .all()
        .map((row) => [row.agentId, row]),
    );
  }

  /**
   * Moves an agent to a session state. The agent's status changes only when
   * the state changed since the last poll, and then only when its status
   * differs, or when it goes offline under another note.
   */
  function apply(
    agent: Agent,
    row: SessionRow | undefined,
    state: SessionState,
    docked: boolean,
    sessionName: string,
    at: Date,
    live?: LiveSession,
  ) {
    const limit = state === "limited" ? (live?.usageLimit ?? null) : null;
    const target = {
      to: statusFor[state].to,
      text: limit ? usageLimitNote(limit, at, timeZone) : statusFor[state].text,
    };
    // A limited agent keeps its note current: the reset time can move.
    if (
      row &&
      row.lastState === state &&
      row.sessionName === sessionName &&
      (state !== "limited" || agent.note === target.text)
    )
      return;
    const entering = !row || row.lastState !== state;
    const noted = state === "offline" || state === "limited";
    if (
      (entering || state === "limited") &&
      (agent.status !== target.to || (noted && agent.note !== target.text))
    )
      connection?.record({
        type: "status-change",
        agentId: agent.id,
        to: target.to,
        text: target.text,
      });
    if (entering && limit && live) reportLimit(agent, live, limit, target.text);
    const offlineSince =
      state === "offline" ? (row?.offlineSince ?? at.toISOString()) : null;
    database
      .insert(schema.sessionAgents)
      .values({
        agentId: agent.id,
        docked,
        sessionName,
        lastState: state,
        offlineSince,
      })
      .onConflictDoUpdate({
        target: schema.sessionAgents.agentId,
        set: { sessionName, lastState: state, offlineSince },
      })
      .run();
  }

  /** Records the usage-limit signal for an agent's session, then tells the listener. */
  function reportLimit(
    agent: Agent,
    live: LiveSession,
    limit: UsageLimit,
    text: string,
  ) {
    if (!connection) return;
    const client =
      connection.dataset().groups.find((group) => group.id === agent.groupId)
        ?.clientId ?? null;
    const signalKey = `claude:usage-limit:${live.sessionId ?? live.pid}:${limit.at}`;
    const signal: UsageLimitSignalEvent = {
      type: "signal",
      source: "claude",
      key: signalKey,
      kind: "usage-limit",
      event: "limit_reached",
      agentId: agent.id,
      account: live.account,
      limitKind: limit.kind,
      resetsAt: limit.resetsAt,
      client,
      recordIds: [agent.id],
      at: limit.at,
      text,
    };
    connection.record(signal);
    try {
      onUsageLimit?.(
        {
          signalKey,
          agentId: agent.id,
          account: live.account,
          sessionName: live.name ?? agent.name,
          ...(live.sessionId ? { sessionId: live.sessionId } : {}),
          ...(live.cwd ? { cwd: live.cwd } : {}),
          pid: live.pid,
          limit,
        },
        connection,
      );
    } catch {
      log("sessions: the usage-limit listener failed");
    }
  }

  /** Removes a docked agent, and any vessel launched from it. */
  function forget(agentId: string) {
    database.transaction((transaction) => {
      transaction
        .delete(schema.agents)
        .where(eq(schema.agents.parentId, agentId))
        .run();
      transaction
        .delete(schema.agents)
        .where(eq(schema.agents.id, agentId))
        .run();
    });
  }

  /** Adds a docked agent for an unknown session, in the home client's first group. */
  function dock(dataset: Dataset, session: Session, name: string): boolean {
    const home = dataset.clients.find((client) => client.home === true);
    const group = dataset.groups.find((each) => each.clientId === home?.id);
    const account = dataset.accounts[0];
    if (!group || !account) return false;
    const taken = new Set<string>(
      [
        ...dataset.clients,
        ...dataset.accounts,
        ...dataset.groups,
        ...dataset.agents,
        ...dataset.requirements,
        ...dataset.workstreams,
        ...dataset.items,
        ...dataset.questions,
        ...dataset.decisions,
      ].map((record) => record.id),
    );
    const id = dockedAgentId(name, taken);
    database.transaction((transaction) => {
      transaction
        .insert(schema.agents)
        .values({
          id,
          classification: group.classification,
          boundary: group.boundary,
          groupId: group.id,
          name,
          accountId: account.id,
          host,
          reach: "local",
          status: statusFor[stateOf(session)].to,
          workingOn: [],
          note: dockedNote,
        })
        .run();
      transaction
        .insert(schema.sessionAgents)
        .values({
          agentId: id,
          docked: true,
          sessionName: name.toLowerCase(),
          lastState: stateOf(session),
          offlineSince: null,
        })
        .run();
    });
    return true;
  }

  /** Every folder's live sessions, each process once, with its account and usage limit. */
  function readFolders(at: Date) {
    let files = 0;
    let parsed = 0;
    let error: string | null = null;
    const live = new Map<number, LiveSession>();
    for (const folder of folders) {
      const read = readSessionDirectory(folder.sessions, isAlive);
      files += read.files;
      parsed += read.parsed;
      error ??= read.error;
      for (const session of read.live) {
        if (live.has(session.pid)) continue;
        const limit = limitOf(folder.projects, session);
        live.set(session.pid, {
          ...session,
          account: folder.account,
          usageLimit: limit && usageLimitIsActive(limit, at) ? limit : null,
        });
      }
    }
    return { files, parsed, error, live: [...live.values()] };
  }

  function poll() {
    const at = now();
    const read = readFolders(at);
    const base = {
      source: "files" as const,
      files: read.files,
      live: read.live.length,
      limited: read.live.filter((session) => session.usageLimit).length,
      skipped: read.files - read.parsed,
      lastReadAt: at.toISOString(),
    };
    if (read.error) {
      // Without a usable read nothing is known, so no agent is changed.
      health = {
        ...base,
        ok: false,
        matched: 0,
        unknownDocked: 0,
        ambiguous: 0,
        error: read.error,
      };
      report(read.error);
      return;
    }
    if (!connection) {
      health = {
        ...base,
        ok: true,
        matched: 0,
        unknownDocked: 0,
        ambiguous: 0,
        error: null,
      };
      return;
    }
    try {
      const counts = applyRead(read.live, at);
      health = { ...base, ok: true, ...counts, error: counts.error };
      report(counts.error);
    } catch {
      const error = "the sessions could not be applied";
      health = {
        ...base,
        ok: false,
        matched: 0,
        unknownDocked: 0,
        ambiguous: 0,
        error,
      };
      report(error);
    }
  }

  function applyRead(live: readonly LiveSession[], at: Date) {
    if (!connection) throw new Error("not connected");
    let dataset = connection.dataset();
    let stored = rows();
    const dockedIds = new Set(
      [...stored.values()]
        .filter((row) => row.docked)
        .map((row) => row.agentId),
    );
    const roster = dataset.agents.filter(
      (agent) => !isVessel(agent) && !dockedIds.has(agent.id),
    );

    const byAgent = new Map<string, LiveSession>();
    const unknown = new Map<string, { session: LiveSession; name: string }>();
    let matched = 0;
    let ambiguous = 0;
    for (const session of live) {
      if (!session.name) continue;
      const match = matchSession(roster, session.name);
      if (match.ambiguous) {
        ambiguous++;
        continue;
      }
      if (match.agentId) {
        matched++;
        const current = byAgent.get(match.agentId);
        if (!current || moreActive(session, current))
          byAgent.set(match.agentId, session);
        continue;
      }
      const key = session.name.toLowerCase();
      const current = unknown.get(key);
      if (!current || moreActive(session, current.session))
        unknown.set(key, { session, name: session.name });
    }

    // Docked agents whose name now names a roster agent, or that have been
    // offline for the whole forget window, go.
    let changed = false;
    const forgetBefore = at.getTime() - forgetHours * 3_600_000;
    for (const row of stored.values()) {
      if (!row.docked) continue;
      const rosterNow = matchSession(roster, row.sessionName);
      const expired =
        !unknown.has(row.sessionName) &&
        row.offlineSince !== null &&
        Date.parse(row.offlineSince) <= forgetBefore;
      if (rosterNow.agentId || rosterNow.ambiguous || expired) {
        forget(row.agentId);
        changed = true;
      }
    }

    // Unknown sessions with no docked agent yet are docked.
    const dockedByName = new Map(
      [...rows().values()]
        .filter((row) => row.docked)
        .map((row) => [row.sessionName, row]),
    );
    let error: string | null = null;
    for (const [key, { session, name }] of unknown) {
      if (dockedByName.has(key)) continue;
      if (dock(dataset, session, name)) {
        changed = true;
        dataset = connection.dataset();
      } else error = "no home group or account to dock unknown sessions in";
    }
    if (changed) {
      dataset = connection.dataset();
      stored = rows();
    }

    const agents = new Map(dataset.agents.map((agent) => [agent.id, agent]));
    // Roster agents: their best live session, or offline once seen.
    for (const agent of roster) {
      const session = byAgent.get(agent.id);
      const row = stored.get(agent.id);
      if (session)
        apply(
          agent,
          row,
          stateOf(session),
          false,
          (session.name ?? "").toLowerCase(),
          at,
          session,
        );
      else if (row && !row.docked)
        apply(agent, row, "offline", false, row.sessionName, at);
    }
    // Docked agents follow their session by name.
    let unknownDocked = 0;
    for (const row of stored.values()) {
      if (!row.docked) continue;
      const agent = agents.get(row.agentId);
      if (!agent) continue;
      const entry = unknown.get(row.sessionName);
      if (entry) unknownDocked++;
      apply(
        agent,
        row,
        entry ? stateOf(entry.session) : "offline",
        true,
        row.sessionName,
        at,
        entry?.session,
      );
    }

    if (changed) for (const listener of listeners) listener();
    return { matched, unknownDocked, ambiguous, error };
  }

  return {
    connect(next) {
      connection = next;
    },
    poll() {
      try {
        poll();
      } catch {
        // `poll` handles its own failures; this keeps a timer alive regardless.
      }
    },
    health: () => health,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      timer ??= setInterval(() => {
        try {
          poll();
        } catch {
          // Reported through health by `poll`.
        }
      }, pollSeconds * 1000);
    },
    stop() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    },
  };
}
