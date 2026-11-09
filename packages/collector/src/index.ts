/**
 * The collector's pure half: what a Claude Code session on this machine is
 * doing, read from its session record and the tail of its transcript, as
 * fields that are safe to send to Atlas. Nothing an author wrote leaves:
 * no message text, no tool input, no file paths. Tool input is read only to
 * tell a git command from other shell work, and is then dropped.
 *
 * The approach follows Agent-Quest (github.com/FulAppiOS/Agent-Quest, MIT):
 * read the local logs instead of asking agents to report.
 */
import type { AgentStatus } from "@atlas/core";

/** What a session is doing, from the last tool it used. */
export const activities = [
  "reading",
  "editing",
  "shell",
  "git",
  "web",
  "delegating",
  "asking",
  "other",
] as const;
export type Activity = (typeof activities)[number];

/** The session record fields the collector keeps, from ~/.claude/sessions/<pid>.json. */
export interface SessionRecord {
  pid: number;
  sessionId: string;
  name: string | null;
  /** Claude's own state: "running", "idle", "requires_action", "shell"… */
  state: string | null;
  cwd: string | null;
}

/** What the transcript's tail says. */
export interface TranscriptTail {
  /** When the session last used a tool, ISO 8601. */
  lastToolAt: string | null;
  lastActivity: Activity | null;
  /** When anything was last written, ISO 8601. */
  lastWriteAt: string | null;
  /** Tokens in the context at the last assistant turn. */
  contextTokens: number | null;
  /**
   * When the newest tool call that has no result yet was made, ISO 8601.
   * A call left open for minutes is a permission prompt or a long command.
   */
  openToolSince: string | null;
  /** The usage limit the newest turn hit, or null when a later reply cleared it. */
  usageLimit: UsageLimit | null;
}

/**
 * Which subscription limit a session hit. Claude Code writes `five_hour`
 * ("session limit") or `seven_day` ("weekly limit"); anything else is other.
 */
export const usageLimitKinds = ["session", "weekly", "other"] as const;
export type UsageLimitKind = (typeof usageLimitKinds)[number];

/** A usage limit as read from a transcript: no text, only the kind and times. */
export interface UsageLimit {
  kind: UsageLimitKind;
  /** When the limit resets, ISO 8601, or null when Claude Code gave no time. */
  resetsAt: string | null;
  /** When the session hit it, ISO 8601. */
  at: string;
}

/** The safe report for one session. */
export interface SessionReport {
  name: string;
  status: AgentStatus;
  /** One line for the map, from a fixed set: never author text. */
  note: string;
  activity: Activity | null;
  contextTokens: number | null;
  /** The active usage limit, or null. */
  usageLimit: UsageLimit | null;
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;

/** A session name safe to send: letters, digits, spaces, dots, hyphens, underscores. */
export function safeName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const n = name.trim();
  return NAME.test(n) ? n : null;
}

/** The fields kept from a session record, or null when it is not one. */
export function readSessionRecord(json: unknown): SessionRecord | null {
  const d = json as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return null;
  if (typeof d.sessionId !== "string" || typeof d.pid !== "number") return null;
  return {
    pid: d.pid,
    sessionId: d.sessionId,
    name: safeName(d.name),
    state: typeof d.status === "string" ? d.status : null,
    cwd: typeof d.cwd === "string" ? d.cwd : null,
  };
}

/**
 * The session name a claude command line gives with `--name` or
 * `--remote-control`, for sessions started in screen without a record.
 */
export function nameFromArgs(args: string): string | null {
  const flag = (f: string) =>
    new RegExp(`(?:^|\\s)--${f}\\s+(.+?)(?=\\s--|$)`).exec(args)?.[1];
  const raw = flag("name") ?? flag("remote-control");
  return safeName(raw?.replace(/^['"]|['"]$/g, ""));
}

const GIT = /^\s*(git|gh)\s/;

/** What a tool call means, from its name. Shell input is read only to spot git. */
export function activityOf(tool: string, input?: unknown): Activity {
  if (/^(Read|Grep|Glob|LS|NotebookRead)$/.test(tool)) return "reading";
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return "editing";
  if (tool === "Bash") {
    const cmd = (input as { command?: unknown } | undefined)?.command;
    return typeof cmd === "string" && GIT.test(cmd) ? "git" : "shell";
  }
  if (/^(WebFetch|WebSearch)$/.test(tool)) return "web";
  if (/^(Agent|Task|Workflow)$/.test(tool)) return "delegating";
  if (tool === "AskUserQuestion") return "asking";
  return "other";
}

function kindOf(rateLimitType: unknown): UsageLimitKind {
  if (rateLimitType === "five_hour") return "session";
  if (
    typeof rateLimitType === "string" &&
    rateLimitType.startsWith("seven_day")
  )
    return "weekly";
  return "other";
}

/**
 * The usage limit a transcript line reports, or null. Claude Code writes a
 * synthetic assistant line with `isApiErrorMessage` instead of a reply.
 * Since 2.1.295 it carries `apiError: "usage_limit_reached"`; older
 * versions carry only `error: "rate_limit"` with `quotaLimits.status`
 * `rejected`. The text is never read.
 */
export function usageLimitOf(
  line: Record<string, unknown>,
  at: string,
): UsageLimit | null {
  if (line.isApiErrorMessage !== true) return null;
  const quota = (line.quotaLimits ?? null) as Record<string, unknown> | null;
  const info = ((line.apiErrorParams as Record<string, unknown> | undefined)
    ?.rate_limit_info ?? null) as Record<string, unknown> | null;
  const limited =
    line.apiError === "usage_limit_reached" ||
    (line.error === "rate_limit" && quota?.status === "rejected");
  if (!limited) return null;
  const resets = quota?.resetsAt ?? info?.resetsAt;
  const resetsAt =
    typeof resets === "number" && Number.isFinite(resets) && resets > 0
      ? new Date(resets * 1000).toISOString()
      : null;
  return {
    kind: kindOf(quota?.rateLimitType ?? info?.rateLimitType),
    resetsAt,
    at,
  };
}

/** Whether a usage limit still holds: until its reset time, or until a reply clears it. */
export function usageLimitIsActive(limit: UsageLimit, now: Date): boolean {
  return limit.resetsAt === null || Date.parse(limit.resetsAt) > now.getTime();
}

const LIMIT_NAMES: Record<UsageLimitKind, string> = {
  session: "Session usage limit reached",
  weekly: "Weekly usage limit reached",
  other: "Usage limit reached",
};

/**
 * The fixed note for a usage limit: the kind and the reset time in
 * `timeZone` (the machine's own unless set), with the day only when the
 * reset is not on the same day.
 */
export function usageLimitNote(
  limit: UsageLimit,
  now: Date,
  timeZone?: string,
): string {
  const name = LIMIT_NAMES[limit.kind];
  if (!limit.resetsAt) return name;
  const resets = new Date(limit.resetsAt);
  const zone = timeZone ? { timeZone } : {};
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      ...zone,
      day: "numeric",
      month: "short",
    }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    ...zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(resets);
  const sameDay =
    new Intl.DateTimeFormat("en-CA", { ...zone }).format(resets) ===
    new Intl.DateTimeFormat("en-CA", { ...zone }).format(now);
  return `${name}, resets ${sameDay ? time : `${day(resets)} ${time}`}`;
}

/** The newest tool use, write, context size and usage limit in a transcript's last lines. */
export function readTail(lines: readonly string[]): TranscriptTail {
  const tail: TranscriptTail = {
    lastToolAt: null,
    lastActivity: null,
    lastWriteAt: null,
    contextTokens: null,
    openToolSince: null,
    usageLimit: null,
  };
  const open = new Map<string, string>();
  for (const line of lines) {
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(line);
    } catch {
      continue; // a line being written, or not JSON
    }
    const at = typeof d.timestamp === "string" ? d.timestamp : null;
    if (at && (!tail.lastWriteAt || at > tail.lastWriteAt))
      tail.lastWriteAt = at;
    if (d.type === "user") {
      const content = (d.message as { content?: unknown } | undefined)?.content;
      if (Array.isArray(content))
        for (const part of content as Array<Record<string, unknown>>)
          if (
            part?.type === "tool_result" &&
            typeof part.tool_use_id === "string"
          )
            open.delete(part.tool_use_id);
      continue;
    }
    if (d.type !== "assistant") continue;
    // A limit line sets the limit; any other assistant line is a reply and clears it.
    if (at) {
      const limit = usageLimitOf(d, at);
      if (limit) tail.usageLimit = limit;
      else if (d.isApiErrorMessage !== true) tail.usageLimit = null;
    }
    const m = d.message as
      { content?: unknown; usage?: Record<string, unknown> } | undefined;
    const u = m?.usage;
    if (u) {
      const n = [
        "input_tokens",
        "cache_read_input_tokens",
        "cache_creation_input_tokens",
      ]
        .map((k) => (typeof u[k] === "number" ? (u[k] as number) : 0))
        .reduce((a, b) => a + b, 0);
      if (n > 0) tail.contextTokens = n;
    }
    if (!Array.isArray(m?.content) || !at) continue;
    for (const part of m.content as Array<Record<string, unknown>>) {
      if (part?.type === "tool_use" && typeof part.name === "string") {
        if (typeof part.id === "string") open.set(part.id, at);
        if (!tail.lastToolAt || at >= tail.lastToolAt) {
          tail.lastToolAt = at;
          tail.lastActivity = activityOf(part.name, part.input);
        }
      }
    }
  }
  tail.openToolSince = [...open.values()].sort()[0] ?? null;
  return tail;
}

/** Ten minutes with a tool call left open reads as possibly waiting for approval. */
export const OPEN_TOOL_AFTER_MS = 10 * 60_000;

/** Five minutes without a tool call makes a session idle, as in Agent-Quest. */
export const IDLE_AFTER_MS = 5 * 60_000;

const NOTES: Record<Activity, string> = {
  reading: "Reading code",
  editing: "Editing files",
  shell: "Running commands",
  git: "Working with git",
  web: "Reading the web",
  delegating: "Running subagents",
  asking: "Asking a question",
  other: "Working",
};

/**
 * The Atlas status and note for a session. A session that hit a usage
 * limit can do nothing until it resets, so it shows blocked whatever else
 * is open. A session waiting on a permission prompt or a question in its
 * own window is waiting on the person, so it shows amber and lands in
 * Waiting on you. `timeZone` sets the zone of the reset time in the note.
 */
export function reportFor(
  record: SessionRecord,
  tail: TranscriptTail,
  now: Date,
  timeZone?: string,
): SessionReport | null {
  const name = record.name;
  if (!name) return null;
  const limit =
    tail.usageLimit && usageLimitIsActive(tail.usageLimit, now)
      ? tail.usageLimit
      : null;
  const base = {
    name,
    activity: tail.lastActivity,
    contextTokens: tail.contextTokens,
    usageLimit: limit,
  };
  if (limit)
    return {
      ...base,
      status: "blocked",
      note: usageLimitNote(limit, now, timeZone),
    };
  if (record.state === "requires_action")
    return {
      ...base,
      status: "waiting",
      note: "Waiting for approval in its session",
    };
  // Without a record's state, a tool call open for ten minutes is most often a
  // permission prompt; a long command looks the same, so the note says possibly.
  const openAge = tail.openToolSince
    ? now.getTime() - Date.parse(tail.openToolSince)
    : 0;
  if (record.state === null && openAge >= OPEN_TOOL_AFTER_MS)
    return {
      ...base,
      status: "waiting",
      note: "Possibly waiting for approval in its session",
    };
  const toolAge = tail.lastToolAt
    ? now.getTime() - Date.parse(tail.lastToolAt)
    : Infinity;
  if (
    record.state === "running" ||
    tail.openToolSince !== null ||
    toolAge < IDLE_AFTER_MS
  ) {
    return {
      ...base,
      status: "running",
      note: tail.lastActivity ? NOTES[tail.lastActivity] : "Working",
    };
  }
  return { ...base, status: "idle", note: "Idle" };
}

/**
 * The Atlas agent a session name belongs to: the same name, without case,
 * or a name the session's name starts with ("Halcyon" for "halcyon-69").
 */
export function matchAgent<A extends { id: string; name: string }>(
  session: string,
  agents: readonly A[],
): A | undefined {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
  const s = norm(session);
  return (
    agents.find((a) => norm(a.name) === s) ??
    agents.find((a) => s.startsWith(`${norm(a.name)}-`))
  );
}
