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
}

/** The safe report for one session. */
export interface SessionReport {
  name: string;
  status: AgentStatus;
  /** One line for the map, from a fixed set: never author text. */
  note: string;
  activity: Activity | null;
  contextTokens: number | null;
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

/** The newest tool use, write and context size in a transcript's last lines. */
export function readTail(lines: readonly string[]): TranscriptTail {
  const tail: TranscriptTail = {
    lastToolAt: null,
    lastActivity: null,
    lastWriteAt: null,
    contextTokens: null,
  };
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
    if (d.type !== "assistant") continue;
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
        if (!tail.lastToolAt || at >= tail.lastToolAt) {
          tail.lastToolAt = at;
          tail.lastActivity = activityOf(part.name, part.input);
        }
      }
    }
  }
  return tail;
}

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
 * The Atlas status and note for a session. A session waiting on a
 * permission prompt or a question in its own window is waiting on the
 * person, so it shows amber and lands in Waiting on you.
 */
export function reportFor(
  record: SessionRecord,
  tail: TranscriptTail,
  now: Date,
): SessionReport | null {
  const name = record.name;
  if (!name) return null;
  const base = {
    name,
    activity: tail.lastActivity,
    contextTokens: tail.contextTokens,
  };
  if (record.state === "requires_action")
    return {
      ...base,
      status: "waiting",
      note: "Waiting for approval in its session",
    };
  const toolAge = tail.lastToolAt
    ? now.getTime() - Date.parse(tail.lastToolAt)
    : Infinity;
  if (record.state === "running" || toolAge < IDLE_AFTER_MS) {
    return {
      ...base,
      status: "running",
      note: tail.lastActivity ? NOTES[tail.lastActivity] : "Working",
    };
  }
  return { ...base, status: "idle", note: "Idle" };
}
