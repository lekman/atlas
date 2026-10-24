/**
 * The task database as a task source: Postgres, read with Bun's built-in
 * SQL client. Atlas only reads it. Dates are read as `YYYY-MM-DD` text, so
 * the server's time zone can never move a day.
 */
import { SQL } from "bun";

import {
  mapItemLogRows,
  mapTaskRows,
  type ClientRow,
  type HistoryRow,
  type ItemLogRow,
  type ItemRow,
  type TaskRows,
  type TaskSource,
  type WorkstreamRow,
} from "./task-source";

export interface TaskDatabaseSettings {
  hostname: string;
  port: number;
  database: string;
  username: string;
  /** The password, from `ATLAS_TASKS_PASSWORD_COMMAND`. Never logged. */
  password?: () => Promise<string>;
}

/** Seconds to wait for a connection before a read counts as failed. */
const connectionTimeoutSeconds = 5;

/**
 * Reads every row Atlas needs in one read-only transaction, so an item never
 * names a workstream from a later moment than its own. The order is fixed,
 * so two equal reads hash the same.
 */
export function readTaskRows(sql: SQL): Promise<TaskRows> {
  return sql.begin(async (transaction) => {
    await transaction`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`;
    const clients = await transaction<ClientRow[]>`
      SELECT id, classification::text, boundary, name, home
      FROM client
      ORDER BY "order" NULLS LAST, id`;
    const workstreams = await transaction<WorkstreamRow[]>`
      SELECT id, classification::text, boundary, client_id, title, summary, "order"
      FROM workstream
      ORDER BY client_id, "order" NULLS LAST, id`;
    const items = await transaction<ItemRow[]>`
      SELECT id, classification::text, boundary, client_id, requirement_id,
        workstream_id, title, summary, state::text, priority::text, tracker,
        effort::text, scheduled_for::text, blocked, done_on::text, details_id,
        claim_by, claim_at
      FROM dashboard_item
      WHERE state <> 'dropped'
      ORDER BY id`;
    const history = await transaction<HistoryRow[]>`
      SELECT h.item_id, h.kind::text, h."on"::text, h."from"
      FROM item_history h
      JOIN dashboard_item i ON i.id = h.item_id AND i.state <> 'dropped'
      WHERE h.kind IN ('added', 'moved')
      ORDER BY h.item_id, h."on", h.at NULLS FIRST, h.id`;
    return {
      clients: [...clients],
      workstreams: [...workstreams],
      items: [...items],
      history: [...history],
    };
  });
}

/**
 * One item's log, newest first, in a read-only transaction. `by` is a
 * keyword in SQL, so the column is quoted.
 */
export function readItemLogRows(
  sql: SQL,
  itemId: string,
  limit: number,
): Promise<ItemLogRow[]> {
  return sql.begin(async (transaction) => {
    await transaction`SET TRANSACTION READ ONLY`;
    const rows = await transaction<ItemLogRow[]>`
      SELECT at, status::text, note, "by"
      FROM item_log
      WHERE item_id = ${itemId}
      ORDER BY at DESC
      LIMIT ${limit}`;
    return [...rows];
  });
}

/**
 * A task source that reads Postgres. One connection, closed when idle, so
 * a poll every half minute holds nothing open between reads.
 */
export function postgresTaskSource(settings: TaskDatabaseSettings): TaskSource {
  let sql: SQL | undefined;
  async function connection(): Promise<SQL> {
    if (!sql) {
      const password = settings.password ? await settings.password() : "";
      sql = new SQL({
        adapter: "postgres",
        hostname: settings.hostname,
        port: settings.port,
        database: settings.database,
        username: settings.username,
        password,
        max: 1,
        idleTimeout: 10,
        connectionTimeout: connectionTimeoutSeconds,
      });
    }
    return sql;
  }
  return {
    async read() {
      return mapTaskRows(await readTaskRows(await connection()));
    },
    async readItemLog(itemId, limit) {
      return mapItemLogRows(
        await readItemLogRows(await connection(), itemId, limit),
      );
    },
  };
}

/**
 * Splits a command into its arguments without a shell: on spaces, with
 * single or double quotes holding an argument together. Nothing is
 * expanded, so the value cannot run anything but the one program it names.
 */
export function splitCommand(command: string): string[] {
  const parts: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of command.matchAll(pattern))
    parts.push(match[1] ?? match[2] ?? match[3] ?? "");
  return parts;
}

/** Why the password command gave no password. Holds no output. */
export class PasswordCommandFailed extends Error {
  readonly code = "PASSWORD_COMMAND_FAILED";
  constructor(exitCode: number | null) {
    super(`the password command exited with ${exitCode}`);
    this.name = "PasswordCommandFailed";
  }
}

/**
 * The password from a command, such as `security find-generic-password -s
 * <service> -w`. The command runs once; if it fails, it runs again on the
 * next read, so a Keychain that was locked at start is picked up later.
 * Its output is trimmed and never logged.
 */
export function passwordFromCommand(command: string): () => Promise<string> {
  const argumentsList = splitCommand(command);
  let password: string | undefined;
  return async () => {
    if (password !== undefined) return password;
    const child = Bun.spawn(argumentsList, {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
    });
    const [output, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      child.exited,
    ]);
    if (exitCode !== 0) throw new PasswordCommandFailed(exitCode);
    password = output.trim();
    return password;
  };
}
