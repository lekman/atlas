/**
 * Server settings, read from the environment. Every setting has a default
 * that is safe on the Mac mini: the server listens on the loopback address
 * only, and Tailscale Serve is what puts it on the tailnet.
 */
import { homedir } from "node:os";
import { join } from "node:path";

export interface Configuration {
  /** Where the SQLite file lives. */
  databasePath: string;
  hostname: string;
  port: number;
  /**
   * What to write into an empty database: the invented dataset, a dataset
   * from a JSON file kept outside the repository, or nothing.
   */
  seed: Seed;
  /** Refuse callers without a machine token or a Tailscale Serve identity. */
  requireTokens: boolean;
  /** Where tasks come from, or `undefined` to serve SQLite alone. */
  tasks?: TaskDatabaseConfiguration;
  /**
   * Show invented development tracking (issue, branch, pull request) on
   * items tracked on GitHub, until the real integration exists. Set by
   * `ATLAS_FAKE_DEVELOPMENT=true`; the stored records never change.
   */
  fakeDevelopment: boolean;
}

/**
 * The task database. Set `ATLAS_TASKS_HOST` to turn it on. The password
 * is never set directly: `ATLAS_TASKS_PASSWORD_COMMAND` names a command
 * that prints it, such as a Keychain lookup.
 */
export interface TaskDatabaseConfiguration {
  hostname: string;
  port: number;
  database: string;
  username: string;
  /** A command that prints the password. Absent when the database needs none. */
  passwordCommand?: string;
  /** Seconds between reads. */
  pollSeconds: number;
  /** Only these clients, when set: `ATLAS_TASKS_CLIENTS`, ids joined by commas. */
  clients?: string[];
}

export type Seed =
  { kind: "none" } | { kind: "fixtures" } | { kind: "file"; path: string };

function readSeed(value: string | undefined): Seed {
  if (!value) return { kind: "none" };
  if (value === "fixtures") return { kind: "fixtures" };
  if (value.endsWith(".json")) return { kind: "file", path: value };
  throw new Error("ATLAS_SEED must be fixtures or the path of a .json file");
}

function readTasks(
  environment: Record<string, string | undefined>,
): TaskDatabaseConfiguration | undefined {
  const hostname = environment.ATLAS_TASKS_HOST;
  if (!hostname) return undefined;
  const database = environment.ATLAS_TASKS_DATABASE;
  const username = environment.ATLAS_TASKS_USER;
  if (!database || !username)
    throw new Error(
      "ATLAS_TASKS_HOST needs ATLAS_TASKS_DATABASE and ATLAS_TASKS_USER",
    );
  const port = Number(environment.ATLAS_TASKS_PORT ?? 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error("ATLAS_TASKS_PORT must be a port number");
  const pollSeconds = Number(environment.ATLAS_TASKS_POLL_SECONDS ?? 30);
  if (!Number.isFinite(pollSeconds) || pollSeconds < 1)
    throw new Error("ATLAS_TASKS_POLL_SECONDS must be 1 or more");
  const passwordCommand = environment.ATLAS_TASKS_PASSWORD_COMMAND?.trim();
  const clients = (environment.ATLAS_TASKS_CLIENTS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  for (const id of clients)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id))
      throw new Error(
        "ATLAS_TASKS_CLIENTS must be client ids joined by commas",
      );
  return {
    hostname,
    port,
    database,
    username,
    ...(passwordCommand ? { passwordCommand } : {}),
    pollSeconds,
    ...(clients.length ? { clients } : {}),
  };
}

export function readConfiguration(
  environment: Record<string, string | undefined> = process.env,
): Configuration {
  const port = Number(environment.ATLAS_PORT ?? 7400);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error("ATLAS_PORT must be a port number");
  return {
    databasePath:
      environment.ATLAS_DATABASE ??
      join(homedir(), "Library", "Application Support", "Atlas", "atlas.db"),
    hostname: environment.ATLAS_HOSTNAME ?? "127.0.0.1",
    port,
    seed: readSeed(environment.ATLAS_SEED),
    requireTokens: environment.ATLAS_REQUIRE_TOKENS === "true",
    tasks: readTasks(environment),
    fakeDevelopment: environment.ATLAS_FAKE_DEVELOPMENT === "true",
  };
}
