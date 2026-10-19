/**
 * Opens the Atlas database. Only the server process opens the file; agents
 * reach it through the API and MCP. WAL mode lets the API read while a write
 * is in progress, and is what Litestream needs to stream changes off site.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import * as schema from "./schema";

export type AtlasDatabase = BunSQLiteDatabase<typeof schema> & {
  $client: Database;
};

const migrationsFolder = join(import.meta.dir, "..", "drizzle");

/** Opens (or creates) the database at `path` and brings its schema up to date. Use `:memory:` in tests. */
export function openDatabase(path: string): AtlasDatabase {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const client = new Database(path, { create: true, strict: true });
  client.run("PRAGMA journal_mode = WAL");
  client.run("PRAGMA foreign_keys = ON");
  client.run("PRAGMA busy_timeout = 5000");
  const database = drizzle({ client, schema });
  migrate(database, { migrationsFolder });
  return database;
}
