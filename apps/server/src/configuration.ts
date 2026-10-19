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
}

export type Seed =
  { kind: "none" } | { kind: "fixtures" } | { kind: "file"; path: string };

function readSeed(value: string | undefined): Seed {
  if (!value) return { kind: "none" };
  if (value === "fixtures") return { kind: "fixtures" };
  if (value.endsWith(".json")) return { kind: "file", path: value };
  throw new Error("ATLAS_SEED must be fixtures or the path of a .json file");
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
  };
}
