/**
 * Requests to Commander about a task: status, execute, plan, an answer to
 * an ask, and done or move when they go through the phone inbox. The local server forwards
 * them to Commander on the Mac mini; the sidebar keeps its own record of
 * each, and a copy at `board/commander` for other devices.
 */

export type RequestAction =
  "status" | "execute" | "plan" | "done" | "move" | "answer";

export type RequestState =
  | "sending"
  | "queued"
  | "forwarded"
  | "received"
  | "asked"
  | "answered"
  | "dispatched"
  | "waiting"
  | "done"
  | "failed";

export interface CommanderRequest {
  id: string;
  /** The task's reference, or `monday:<key>` for a tracker item. */
  ref: string;
  action: RequestAction;
  title?: string;
  state: RequestState;
  summary?: string;
  worker?: string | null;
  requestedAt: string;
  updatedAt?: string;
  /** Sent through the phone inbox rather than the local server. */
  via?: "inbox";
}

/** States in which a request is still open, and the task's actions wait for it. */
export const OPEN_STATES: ReadonlySet<RequestState> = new Set([
  "sending",
  "queued",
  "forwarded",
  "received",
  "asked",
  "dispatched",
  "waiting",
]);

const KNOWN_STATES: ReadonlySet<string> = new Set([
  "queued",
  "forwarded",
  "received",
  "asked",
  "answered",
  "dispatched",
  "waiting",
  "done",
  "failed",
]);

const ACTIONS: ReadonlySet<string> = new Set([
  "execute",
  "plan",
  "done",
  "move",
  "answer",
]);

/**
 * The parts of an update from Commander or the inbox the sidebar takes:
 * a known state, the action, a summary cut to 300 characters, the worker
 * and the time.
 */
export function pickUpdate(x: {
  state?: unknown;
  action?: unknown;
  summary?: unknown;
  worker?: unknown;
  updatedAt?: unknown;
}): Partial<CommanderRequest> {
  return {
    ...(typeof x.state === "string" && KNOWN_STATES.has(x.state)
      ? { state: x.state as RequestState }
      : {}),
    ...(x.action
      ? {
          action: (typeof x.action === "string" && ACTIONS.has(x.action)
            ? x.action
            : "status") as RequestAction,
        }
      : {}),
    summary: String(x.summary ?? "").slice(0, 300),
    worker: x.worker ? String(x.worker) : null,
    updatedAt:
      typeof x.updatedAt === "string" ? x.updatedAt : new Date().toISOString(),
  };
}

/** A task's newest request. */
export function latestRequest(
  records: Readonly<Record<string, CommanderRequest>>,
  ref: string | undefined,
): CommanderRequest | null {
  if (!ref) return null;
  return (
    Object.values(records)
      .filter((r) => r.ref === ref)
      .sort((a, b) =>
        String(b.requestedAt).localeCompare(String(a.requestedAt)),
      )[0] ?? null
  );
}

/** A task's newest request, if it is still open. */
export function openRequest(
  records: Readonly<Record<string, CommanderRequest>>,
  ref: string | undefined,
): CommanderRequest | null {
  const r = latestRequest(records, ref);
  return r && OPEN_STATES.has(r.state) ? r : null;
}

/** The request line's tag colour: answered and done green, failed red, the rest grey. */
export const requestTone = (
  state: RequestState,
): "active" | "crit" | "neutral" =>
  state === "answered" || state === "done"
    ? "active"
    : state === "failed"
      ? "crit"
      : "neutral";

/**
 * Merges the stored copy into the sidebar's records: a stored request is
 * taken when it is new here or newer than the one held.
 */
export function mergeStored(
  records: Readonly<Record<string, CommanderRequest>>,
  stored: unknown,
): Record<string, CommanderRequest> | null {
  const items = (stored as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return null;
  let changed = false;
  const next = { ...records };
  for (const x of items as CommanderRequest[]) {
    if (!x || typeof x.id !== "string" || typeof x.ref !== "string") continue;
    const held = next[x.id];
    if (!held || String(x.updatedAt ?? "") > String(held.updatedAt ?? "")) {
      next[x.id] = { ...held, ...x };
      changed = true;
    }
  }
  return changed ? next : null;
}

/** What is stored for other devices: the newest 60 requests, none still being sent. */
export function toStore(records: Readonly<Record<string, CommanderRequest>>) {
  return {
    items: Object.values(records)
      .filter((r) => r.state !== "sending")
      .sort((a, b) =>
        String(b.requestedAt).localeCompare(String(a.requestedAt)),
      )
      .slice(0, 60),
    updatedAt: new Date().toISOString(),
  };
}

/** The line a person pastes into an agent's chat and keeps typing after. */
export const referenceText = (title: string, key?: string): string =>
  `Regarding task "${title}"${key ? `, ${key}` : ""}: `;
