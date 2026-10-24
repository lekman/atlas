/**
 * Reads gh-events' two files and keeps what they say about pull requests
 * and issues. Set `ATLAS_GITHUB_STATE_DIR` to the folder that holds them;
 * without it the reader is off and the server behaves as before.
 *
 * - `registry.json` is read every 30 seconds, and when the folder changes.
 * - `events.jsonl` is tailed by the contract's rule: whole lines only,
 *   following the file's inode, from offset 0 when a new file appears, and
 *   de-duplicated by `key`. Each new line that matches a backlog item is
 *   recorded as an Atlas `external` event, so it reaches the log, the
 *   animation and the sound once.
 * - The cursor (inode, offset) and the keys already read are kept in
 *   SQLite, so a restart neither replays a line nor skips one.
 *
 * The log holds counts only, never a repository, a number or a client.
 */
import {
  closeSync,
  fstatSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  watch,
  type FSWatcher,
} from "node:fs";
import { join } from "node:path";

import type { AtlasEvent, Dataset } from "@atlas/core";
import { desc, eq, inArray, lte, sql } from "drizzle-orm";

import type { AtlasDatabase } from "./database";
import {
  contractVersion,
  isStale,
  parseEventLine,
  parseRegistry,
  type CiState,
  type EventLine,
  type Registry,
} from "./github-contract";
import {
  eventText,
  itemsForEvent,
  referenceKey,
  resolveGithub,
  withGithubDevelopment,
  type FinishedItem,
  type GithubFacts,
  type PullRequestMemory,
} from "./github-matching";
import * as schema from "./schema";
import { failureName } from "./task-cache";

/** What `GET /api/health` reports about GitHub. Counts only, never a repository or a number. */
export interface GithubHealth {
  source: "gh-events" | "none";
  /** The latest read gave a registry Atlas can use, and every account's latest poll worked. */
  ok: boolean;
  /** The registry's `generatedAt` is older than three poll intervals. */
  stale: boolean;
  /** Why the registry is not in use, such as a version Atlas does not know. */
  error: string | null;
  /** Registry items, matched or not. */
  items: number;
  matched: number;
  unmatched: number;
  unknownClients: number;
  /** Registry items left out in the latest read because a value did not match the contract. */
  skipped: number;
  /** `events.jsonl` lines recorded as Atlas events since the server started. */
  eventsApplied: number;
  /** Lines since the server started that matched no backlog item, or named no Atlas client. */
  eventsUnmatched: number;
  /** Lines since the server started with a value or an event Atlas does not know. */
  eventsSkipped: number;
  /** Lines since the server started with a line version Atlas does not know. */
  eventsRefused: number;
  /** When the poll that saw the latest recorded event ran, or `null`. */
  lastEventAt: string | null;
}

/** The health reported when no GitHub state folder is configured. */
export const noGithubSource: GithubHealth = {
  source: "none",
  ok: true,
  stale: false,
  error: null,
  items: 0,
  matched: 0,
  unmatched: 0,
  unknownClients: 0,
  skipped: 0,
  eventsApplied: 0,
  eventsUnmatched: 0,
  eventsSkipped: 0,
  eventsRefused: 0,
  lastEventAt: null,
};

/** How the reader reaches the rest of the server. */
export interface GithubConnection {
  /** The dataset events are matched against, as the API serves it. */
  dataset(): Dataset;
  /** Records an event the way `POST /api/events` does: stored, then streamed. */
  record(event: AtlasEvent): void;
}

export interface GithubReader {
  /** Gives the reader the dataset and the record path. Events are read only once connected. */
  connect(connection: GithubConnection): void;
  /** Reads the registry, then any new event lines. Never throws. */
  poll(): void;
  /** The dataset with real development tracking on every item the reader matches. */
  overlay(dataset: Dataset): Dataset;
  health(dataset: Dataset): GithubHealth;
  /** Calls `listener` when what the reader knows changed. Returns a way to stop. */
  subscribe(listener: () => void): () => void;
  /** Polls on a timer, and when the folder changes, until `stop`. */
  start(): void;
  stop(): void;
}

export interface GithubReaderOptions {
  /** The folder that holds `registry.json` and `events.jsonl`. */
  directory: string;
  database: AtlasDatabase;
  /** Seconds between reads. 30 unless set. */
  pollSeconds?: number;
  /** How many read keys to keep in SQLite. 5,000 unless set. */
  keptKeys?: number;
  /** Where one-line notices go. `console.log` by default. */
  log?: (line: string) => void;
  now?: () => Date;
}

/** The most of `events.jsonl` read in one go. A poll reads chunks until it is caught up. */
const chunkBytes = 1024 * 1024;
const newline = 0x0a;

interface Cursor {
  inode: string;
  offset: number;
}

const finishedEvents = new Set<EventLine["event"]>([
  "merged",
  "closed",
  "issue_closed",
]);

export function createGithubReader({
  directory,
  database,
  pollSeconds = 30,
  keptKeys = 5000,
  log = console.log,
  now = () => new Date(),
}: GithubReaderOptions): GithubReader {
  const registryPath = join(directory, "registry.json");
  const eventsPath = join(directory, "events.jsonl");

  let connection: GithubConnection | undefined;
  let registry: Registry | undefined;
  let registryHash: string | undefined;
  let registryError: string | null = "registry.json has not been read yet";
  let registryProblem: string | undefined;
  let eventsProblem: string | undefined;
  const merged = new Map<string, FinishedItem>();
  const closedPullRequests = new Map<string, FinishedItem>();
  const closedIssues = new Map<string, FinishedItem>();
  const pullRequests = new Map<string, PullRequestMemory>();
  const counts = { applied: 0, unmatched: 0, skipped: 0, refused: 0 };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let watcher: FSWatcher | undefined;
  let soon: ReturnType<typeof setTimeout> | undefined;

  // The open events file, kept between polls so a rotated file is finished
  // before the new one is read.
  let file: { descriptor: number; inode: string } | undefined;
  let cursor: Cursor | undefined;
  let discarding = false;

  // What earlier runs left in SQLite.
  const stored = database.select().from(schema.githubCursor).get();
  if (stored) cursor = { inode: stored.inode, offset: stored.offset };
  for (const row of database
    .select()
    .from(schema.githubEvents)
    .where(inArray(schema.githubEvents.event, [...finishedEvents]))
    .all())
    remember(row);
  for (const row of database.select().from(schema.githubPullRequests).all())
    pullRequests.set(referenceKey(row.repository, row.number), {
      closes: row.closes,
      ci: row.ci as CiState | null,
    });

  function remember(row: {
    event: string;
    repository: string;
    number: number;
    client: string | null;
  }) {
    const finished = {
      repository: row.repository,
      number: row.number,
      client: row.client,
    };
    const key = referenceKey(row.repository, row.number);
    if (row.event === "merged") merged.set(key, finished);
    if (row.event === "closed") closedPullRequests.set(key, finished);
    if (row.event === "issue_closed") closedIssues.set(key, finished);
  }

  function facts(): GithubFacts {
    return {
      registry: registry?.items ?? [],
      merged,
      closedPullRequests,
      closedIssues,
      pullRequests,
    };
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  /** Logs a problem once, until it changes or clears. */
  function report(kind: "registry" | "events", problem: string | undefined) {
    const before = kind === "registry" ? registryProblem : eventsProblem;
    if (problem && problem !== before) log(`GitHub ${kind}: ${problem}`);
    if (kind === "registry") registryProblem = problem;
    else eventsProblem = problem;
  }

  /** Keeps each pull request's closed issues and checks, writing only what changed. */
  function rememberPullRequests(current: Registry) {
    const seenAt = now().toISOString();
    const changed = current.items.filter((item) => {
      if (item.kind !== "pr") return false;
      const before = pullRequests.get(referenceKey(item.repo, item.number));
      return (
        !before ||
        before.ci !== item.ci ||
        before.closes.join(",") !== item.closes.join(",")
      );
    });
    if (!changed.length) return;
    database.transaction((transaction) => {
      for (const item of changed) {
        const row = {
          repository: item.repo.toLowerCase(),
          number: item.number,
          closes: item.closes,
          ci: item.ci,
          seenAt,
        };
        transaction
          .insert(schema.githubPullRequests)
          .values(row)
          .onConflictDoUpdate({
            target: [
              schema.githubPullRequests.repository,
              schema.githubPullRequests.number,
            ],
            set: { closes: row.closes, ci: row.ci, seenAt },
          })
          .run();
        pullRequests.set(referenceKey(item.repo, item.number), {
          closes: item.closes,
          ci: item.ci,
        });
      }
      // Keep the most recently seen pull requests only.
      const oldest = transaction
        .select({ seenAt: schema.githubPullRequests.seenAt })
        .from(schema.githubPullRequests)
        .orderBy(desc(schema.githubPullRequests.seenAt))
        .limit(1)
        .offset(keptKeys)
        .get();
      if (oldest)
        transaction
          .delete(schema.githubPullRequests)
          .where(lte(schema.githubPullRequests.seenAt, oldest.seenAt))
          .run();
    });
  }

  /** Reads `registry.json`. Returns whether what it says changed. */
  function readRegistry(): boolean {
    let text: string;
    try {
      text = readFileSync(registryPath, "utf8");
    } catch (error) {
      registryError =
        failureName(error) === "ENOENT"
          ? "registry.json is missing"
          : `registry.json could not be read (${failureName(error)})`;
      report("registry", registryError);
      return false;
    }
    const read = parseRegistry(text, now());
    if (read.kind === "refused") {
      registryError = `registry.json version ${typeof read.version === "number" ? read.version : "unknown"} is not supported; Atlas reads version ${contractVersion}`;
      report("registry", registryError);
      // A version Atlas does not know is not guessed at.
      const changed = registry !== undefined;
      registry = undefined;
      registryHash = undefined;
      return changed;
    }
    if (read.kind === "invalid") {
      registryError = "registry.json does not match the contract";
      report("registry", registryError);
      return false;
    }
    registryError = null;
    report("registry", undefined);
    const hash = String(Bun.hash(JSON.stringify(read.registry.items)));
    const changed = hash !== registryHash;
    if (changed)
      log(
        `GitHub registry: ${read.registry.items.length} items, ${read.registry.skipped} skipped`,
      );
    registry = read.registry;
    registryHash = hash;
    rememberPullRequests(read.registry);
    return changed;
  }

  function saveCursor(next: Cursor, lastKey: string | undefined) {
    cursor = next;
    database
      .insert(schema.githubCursor)
      .values({ id: 1, ...next, lastKey: lastKey ?? null })
      .onConflictDoUpdate({
        target: schema.githubCursor.id,
        set: {
          inode: next.inode,
          offset: next.offset,
          ...(lastKey ? { lastKey } : {}),
        },
      })
      .run();
  }

  /**
   * Handles one whole line. Returns the line when it was new, so the
   * caller can tell whether a merge or a close changed what the reader knows.
   */
  function readLine(text: string, dataset: Dataset): EventLine | undefined {
    if (!text.trim()) return undefined;
    const read = parseEventLine(text);
    if (read.kind === "refused") {
      counts.refused += 1;
      return undefined;
    }
    if (read.kind === "skipped") {
      counts.skipped += 1;
      return undefined;
    }
    const { line } = read;
    const known = database
      .select({ key: schema.githubEvents.key })
      .from(schema.githubEvents)
      .where(eq(schema.githubEvents.key, line.key))
      .get();
    if (known) return undefined;
    const items = itemsForEvent(dataset, line, facts());
    const row = {
      key: line.key,
      event: line.event,
      kind: line.kind,
      repository: line.repo,
      number: line.number,
      client: line.client,
      at: line.at,
      applied: items.length > 0,
    };
    // The key and the events it becomes are stored together, so a line is
    // never half applied.
    database.transaction((transaction) => {
      transaction.insert(schema.githubEvents).values(row).run();
      for (const recordId of items)
        connection?.record({
          type: "external",
          source: "github",
          recordId,
          text: eventText(line),
        });
    });
    if (items.length) counts.applied += 1;
    else counts.unmatched += 1;
    if (finishedEvents.has(line.event)) remember(row);
    return line;
  }

  /** Reads whole lines from the open file, from the cursor to the end. */
  function drain(dataset: Dataset): boolean {
    if (!file || !cursor) return false;
    let changed = false;
    let lastKey: string | undefined;
    const buffer = Buffer.alloc(chunkBytes);
    for (;;) {
      const length = readSync(
        file.descriptor,
        buffer,
        0,
        chunkBytes,
        cursor.offset,
      );
      if (length === 0) break;
      const end = buffer.subarray(0, length).lastIndexOf(newline);
      if (end === -1) {
        // A partial last line waits for the next read, unless it is longer
        // than a chunk, which no line of the contract is.
        if (length < chunkBytes) break;
        counts.skipped += 1;
        discarding = true;
        saveCursor(
          { inode: cursor.inode, offset: cursor.offset + length },
          lastKey,
        );
        continue;
      }
      let start = 0;
      for (let index = 0; index <= end; index += 1) {
        if (buffer[index] !== newline) continue;
        const text = buffer.toString("utf8", start, index);
        start = index + 1;
        if (discarding) {
          discarding = false;
          continue;
        }
        const line = readLine(text, dataset);
        if (!line) continue;
        lastKey = line.key;
        if (finishedEvents.has(line.event)) changed = true;
      }
      saveCursor(
        { inode: cursor.inode, offset: cursor.offset + end + 1 },
        lastKey,
      );
    }
    return changed;
  }

  function closeFile() {
    if (!file) return;
    try {
      closeSync(file.descriptor);
    } catch {
      // Already closed.
    }
    file = undefined;
  }

  /**
   * The rotated events file with this inode, opened, if there is one.
   * gh-events rotates to `events.<YYYYMMDDTHHMMSSZ>.jsonl` in the same folder
   * and never writes to it again.
   */
  function openRotated(
    inode: string,
  ): { descriptor: number; inode: string } | undefined {
    let names: string[];
    try {
      names = readdirSync(directory);
    } catch {
      return undefined;
    }
    for (const name of names) {
      if (!/^events\.\d{8}T\d{6}Z\.jsonl$/.test(name)) continue;
      let descriptor: number | undefined;
      try {
        descriptor = openSync(join(directory, name), "r");
        const found = String(fstatSync(descriptor, { bigint: true }).ino);
        if (found === inode) return { descriptor, inode: found };
        closeSync(descriptor);
      } catch {
        if (descriptor !== undefined) closeSync(descriptor);
      }
    }
    return undefined;
  }

  /** Reads new lines of `events.jsonl`. Returns whether what the reader knows changed. */
  function readEvents(): boolean {
    if (!connection) return false;
    const dataset = connection.dataset();
    let changed = false;
    // Open the path and identify the file by its descriptor, so the file
    // read is the file checked.
    let opened: { descriptor: number; inode: string } | undefined;
    try {
      const descriptor = openSync(eventsPath, "r");
      opened = {
        descriptor,
        inode: String(fstatSync(descriptor, { bigint: true }).ino),
      };
    } catch (error) {
      // A missing file means no events yet.
      if (failureName(error) !== "ENOENT")
        report(
          "events",
          `events.jsonl could not be opened (${failureName(error)})`,
        );
    }
    // After a restart nothing is open, so a file rotated since the last read
    // is found by its stored inode among the rotated names and finished first.
    if (!file && cursor && opened && cursor.inode !== opened.inode) {
      const rotated = openRotated(cursor.inode);
      if (rotated) {
        file = rotated;
        changed = drain(dataset) || changed;
        closeFile();
      }
    }
    if (file && file.inode === opened?.inode) closeSync(opened.descriptor);
    else {
      // A different file at the path, or none: finish the one still open first.
      if (file) {
        changed = drain(dataset) || changed;
        closeFile();
      }
      file = opened;
    }
    if (!file) return changed;
    report("events", undefined);
    if (!cursor || cursor.inode !== file.inode) {
      discarding = false;
      saveCursor({ inode: file.inode, offset: 0 }, undefined);
    }
    // The contract never truncates the file. If it shrank anyway, read it
    // again from the start; the keys keep a line from counting twice.
    if (cursor && Number(fstatSync(file.descriptor).size) < cursor.offset)
      saveCursor({ inode: file.inode, offset: 0 }, undefined);
    changed = drain(dataset) || changed;
    pruneKeys();
    return changed;
  }

  /** Keeps the newest `keptKeys` keys. */
  function pruneKeys() {
    const boundary = database
      .select({ sequence: schema.githubEvents.sequence })
      .from(schema.githubEvents)
      .orderBy(desc(schema.githubEvents.sequence))
      .limit(1)
      .offset(keptKeys)
      .get();
    if (boundary)
      database
        .delete(schema.githubEvents)
        .where(lte(schema.githubEvents.sequence, boundary.sequence))
        .run();
  }

  function lastEventAt(): string | null {
    const row = database
      .select({ at: sql<string>`max(${schema.githubEvents.at})` })
      .from(schema.githubEvents)
      .where(eq(schema.githubEvents.applied, true))
      .get();
    return row?.at ?? null;
  }

  function poll() {
    let changed = false;
    try {
      changed = readRegistry();
      changed = readEvents() || changed;
    } catch (error) {
      log(
        `GitHub reader failed (${failureName(error)}); trying again on the next poll`,
      );
    }
    if (changed) notify();
  }

  return {
    connect(next) {
      connection = next;
    },
    poll,
    overlay(dataset) {
      return withGithubDevelopment(
        dataset,
        resolveGithub(dataset, facts()).development,
      );
    },
    health(dataset) {
      const { counts: matches } = resolveGithub(dataset, facts());
      const current = now();
      return {
        source: "gh-events",
        ok:
          registry !== undefined &&
          registryError === null &&
          registry.accountsStale === 0,
        stale: registry ? isStale(registry, current) : false,
        error: registryError,
        ...matches,
        skipped: registry?.skipped ?? 0,
        eventsApplied: counts.applied,
        eventsUnmatched: counts.unmatched,
        eventsSkipped: counts.skipped,
        eventsRefused: counts.refused,
        lastEventAt: lastEventAt(),
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      timer ??= setInterval(poll, pollSeconds * 1000);
      if (watcher) return;
      try {
        // A change in the folder reads it soon after, rather than on the
        // next tick of the timer. The timer still runs if watching fails.
        watcher = watch(directory, () => {
          if (soon !== undefined) return;
          soon = setTimeout(() => {
            soon = undefined;
            poll();
          }, 250);
        });
        watcher.on("error", () => {
          watcher?.close();
          watcher = undefined;
        });
      } catch {
        watcher = undefined;
      }
    },
    stop() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      if (soon !== undefined) clearTimeout(soon);
      soon = undefined;
      watcher?.close();
      watcher = undefined;
      closeFile();
    },
  };
}
