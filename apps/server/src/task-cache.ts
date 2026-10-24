/**
 * Keeps the task source's last read in memory and reads it again on a
 * timer. Pages and tools read the cache, never the task database itself,
 * so a slow or missing database never holds up a request.
 *
 * When a read fails, the cache keeps the last good read and says so in its
 * health. Before the first good read there is nothing to keep, and the
 * server serves SQLite alone. The log holds counts and error codes only,
 * never a task's text or a password.
 */
import type { TaskRecords, TaskSource } from "./task-source";

/** What `GET /api/health` reports about the task source. Counts only. */
export interface TaskHealth {
  source: "postgres" | "none";
  clients: number;
  items: number;
  /** Rows the last read left out because they did not match the core model. */
  skipped: number;
  /** When the last good read finished, or `null` before the first. */
  lastRefresh: string | null;
  /** Whether the last read succeeded. */
  ok: boolean;
}

export interface TaskCache {
  /** The last good read, or `undefined` before the first. */
  current(): TaskRecords | undefined;
  /** Reads the source now. Resolves to whether the records changed. Never throws. */
  refresh(): Promise<boolean>;
  /** Calls `listener` after each read that changed the records. Returns a way to stop. */
  subscribe(listener: () => void): () => void;
  health(): TaskHealth;
  /** Reads on a timer until `stop`. */
  start(): void;
  stop(): void;
}

export interface TaskCacheOptions {
  source: TaskSource;
  /** Seconds between reads. */
  pollSeconds: number;
  /** Where one-line notices go. `console.log` by default. */
  log?: (line: string) => void;
  now?: () => Date;
}

/** A short, secret-free name for a failure: its code or its class. */
export function failureName(error: unknown): string {
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && /^[\w.-]{1,64}$/.test(code)) return code;
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string" && /^[\w.-]{1,64}$/.test(name)) return name;
  }
  return "unknown error";
}

/** A fingerprint of the records, to tell a changed read from the same one again. */
function fingerprint(records: TaskRecords): string {
  return String(
    Bun.hash(
      JSON.stringify([records.clients, records.workstreams, records.items]),
    ),
  );
}

export function createTaskCache({
  source,
  pollSeconds,
  log = console.log,
  now = () => new Date(),
}: TaskCacheOptions): TaskCache {
  let records: TaskRecords | undefined;
  let hash: string | undefined;
  let lastRefresh: string | null = null;
  let ok = false;
  let failing = false;
  let reading: Promise<boolean> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();

  async function read(): Promise<boolean> {
    try {
      const next = await source.read();
      const nextHash = fingerprint(next);
      const changed = nextHash !== hash;
      records = next;
      hash = nextHash;
      lastRefresh = now().toISOString();
      ok = true;
      if (failing || changed)
        log(
          `task source: ${next.clients.length} clients, ${next.workstreams.length} workstreams, ${next.items.length} items, ${next.skipped} rows skipped`,
        );
      failing = false;
      if (changed) for (const listener of listeners) listener();
      return changed;
    } catch (error) {
      ok = false;
      if (!failing)
        log(
          `task source unreachable (${failureName(error)}); ${records ? "keeping the last read" : "serving SQLite only"}, retrying every ${pollSeconds} s`,
        );
      failing = true;
      return false;
    }
  }

  function refresh(): Promise<boolean> {
    // One read at a time; a poll that comes during a slow read waits for it.
    reading ??= read().finally(() => {
      reading = undefined;
    });
    return reading;
  }

  return {
    current: () => records,
    refresh,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    health: () => ({
      source: "postgres",
      clients: records?.clients.length ?? 0,
      items: records?.items.length ?? 0,
      skipped: records?.skipped ?? 0,
      lastRefresh,
      ok,
    }),
    start() {
      timer ??= setInterval(() => void refresh(), pollSeconds * 1000);
    },
    stop() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    },
  };
}

/** The health reported when no task source is configured. */
export const noTaskSource: TaskHealth = {
  source: "none",
  clients: 0,
  items: 0,
  skipped: 0,
  lastRefresh: null,
  ok: true,
};
