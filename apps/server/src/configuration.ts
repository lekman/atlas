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
  /** Seed the invented dataset when the database is empty. */
  seedFixtures: boolean;
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
    seedFixtures: environment.ATLAS_SEED === "fixtures",
  };
}
