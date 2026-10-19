/**
 * Machine tokens. Each machine that calls Atlas gets one token, bound to its
 * Tailscale node and scoped to the clients it may see. Only a hash of the
 * token is stored, so the database cannot leak a usable token, and a token
 * copied to another machine fails because its node does not match.
 */
import { Identifier } from "@atlas/core";
import { eq } from "drizzle-orm";

import type { AtlasDatabase } from "./database";
import * as schema from "./schema";

/** The scope that lets a machine see every client. */
export const everyClient = "*";

export interface Machine {
  id: string;
  nodeStableId: string;
  clients: string[];
  issuedAt: string;
  revokedAt?: string;
}

const tokenPrefix = "atlas_";

/** A new token: the prefix and 32 random bytes, URL-safe. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `${tokenPrefix}${Buffer.from(bytes).toString("base64url")}`;
}

export function hashToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

function toMachine(row: typeof schema.machines.$inferSelect): Machine {
  return {
    id: row.id,
    nodeStableId: row.nodeStableId,
    clients: row.clients,
    issuedAt: row.issuedAt,
    ...(row.revokedAt ? { revokedAt: row.revokedAt } : {}),
  };
}

export function listMachines(database: AtlasDatabase): Machine[] {
  return database.select().from(schema.machines).all().map(toMachine);
}

/**
 * Registers a machine, or replaces the token of one already registered.
 * Returns the token; it is shown once and never stored.
 */
export function issueMachineToken(
  database: AtlasDatabase,
  input: { id: string; nodeStableId: string; clients: string[] },
  now: Date = new Date(),
): string {
  const id = Identifier.parse(input.id);
  if (!input.nodeStableId)
    throw new Error("a machine needs its node's stable id");
  if (input.clients.length === 0)
    throw new Error(`name the clients the machine may see, or ${everyClient}`);
  const token = newToken();
  const row = {
    id,
    nodeStableId: input.nodeStableId,
    tokenHash: hashToken(token),
    clients: input.clients,
    issuedAt: now.toISOString(),
    revokedAt: null,
  };
  database
    .insert(schema.machines)
    .values(row)
    .onConflictDoUpdate({ target: schema.machines.id, set: row })
    .run();
  return token;
}

export function revokeMachine(
  database: AtlasDatabase,
  id: string,
  now: Date = new Date(),
): boolean {
  return (
    database
      .update(schema.machines)
      .set({ revokedAt: now.toISOString() })
      .where(eq(schema.machines.id, id))
      .returning({ id: schema.machines.id })
      .all().length > 0
  );
}

/** The machine a token belongs to, unless it is unknown or revoked. */
export function machineForToken(
  database: AtlasDatabase,
  token: string,
): Machine | undefined {
  if (!token.startsWith(tokenPrefix)) return undefined;
  const row = database
    .select()
    .from(schema.machines)
    .where(eq(schema.machines.tokenHash, hashToken(token)))
    .get();
  if (!row || row.revokedAt) return undefined;
  return toMachine(row);
}

/** Whether a machine may see a client's records. */
export function canSee(
  machine: Machine | undefined,
  clientId: string,
): boolean {
  return (
    !machine ||
    machine.clients.includes(everyClient) ||
    machine.clients.includes(clientId)
  );
}
