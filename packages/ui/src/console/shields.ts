/**
 * What the Shields section shows: the health of the reader's machines, the
 * relay to the Atlas server, and each integration that feeds Atlas. It is
 * worked out from data the page already reads (host statistics, the
 * worklist and the stored sync copies), so Shields only reads and never
 * starts a sync.
 *
 * Each row has one of four states, drawn as a shape so it does not rest on
 * colour alone: ok (filled circle), warn (triangle), alert (square) and
 * unknown (dashed ring).
 */
import { formatAgo } from "../sidebar/format";
import { hostLevel, seenText, type HostStat } from "../sidebar/hosts/model";
import { relayWords, type RelayState } from "./layout";

export type ShieldState = "ok" | "warn" | "alert" | "unknown";

export const shieldStateNames: Record<ShieldState, string> = {
  ok: "Healthy",
  warn: "Needs a look",
  alert: "Alert",
  unknown: "Not known",
};

export interface ShieldRow {
  /** Unique across Shields: `host:<name>`, `relay`, `integration:<id>`. */
  id: string;
  kind: "host" | "relay" | "integration";
  name: string;
  state: ShieldState;
  /** One line for the list. */
  summary: string;
}

const percent = (value: number | null | undefined) =>
  typeof value === "number" ? `${Math.round(value)}%` : null;

/** A host's state: its worst breach, or warn when it has gone quiet, or ok. */
export function hostState(
  host: HostStat,
  options: { now: Date; storedAt: Date | null; live: boolean },
): ShieldState {
  const level = hostLevel(host);
  if (level === "crit") return "alert";
  if (level === "warn") return "warn";
  if (!host.lastSeen) return "unknown";
  return seenText(host, options).stale ? "warn" : "ok";
}

/** A host's line: CPU, memory free and disk free, as far as it reports them. */
export function hostSummary(host: HostStat): string {
  const latest = host.latest ?? {};
  const parts = [
    percent(latest.cpuPct) && `CPU ${percent(latest.cpuPct)}`,
    percent(latest.memFreePct) && `memory free ${percent(latest.memFreePct)}`,
    typeof latest.diskFreeGb === "number" &&
      `disk free ${Math.round(latest.diskFreeGb)} GB`,
    typeof latest.runnersMax === "number" &&
      `runners ${latest.runnersBusy ?? 0} of ${latest.runnersMax}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No figures yet";
}

export function relayRow(relay: RelayState): ShieldRow {
  const state: ShieldState =
    relay.kind === "live" ? "ok" : relay.kind === "queued" ? "warn" : "unknown";
  const summary =
    relay.kind === "live"
      ? "Reading the Atlas server now"
      : relay.kind === "queued"
        ? `${relay.count} change${relay.count === 1 ? "" : "s"} waiting for the Mac mini`
        : "Showing the stored copy";
  return {
    id: "relay",
    kind: "relay",
    name: `Relay, ${relayWords(relay)}`,
    state,
    summary,
  };
}

/** How old a sync may be before it needs a look, and before it is an alert. */
export const SYNC_WARN_MS = 60 * 60000;
export const SYNC_ALERT_MS = 24 * 60 * 60000;

export interface IntegrationInput {
  id: string;
  name: string;
  /** When it last synced, ISO 8601, or null when never or not known. */
  syncedAt: string | null;
  /** Why it failed, when the source says so. */
  error?: string | null;
}

/** An integration's state from its error and the age of its last sync. */
export function integrationState(
  input: IntegrationInput,
  now: Date,
): ShieldState {
  if (input.error) return "alert";
  if (!input.syncedAt) return "unknown";
  const age = now.getTime() - Date.parse(input.syncedAt);
  if (Number.isNaN(age)) return "unknown";
  if (age >= SYNC_ALERT_MS) return "alert";
  if (age >= SYNC_WARN_MS) return "warn";
  return "ok";
}

export function integrationRow(input: IntegrationInput, now: Date): ShieldRow {
  const summary = input.error
    ? input.error
    : input.syncedAt
      ? `Synced ${formatAgo(new Date(input.syncedAt), now)}`
      : "No sync seen";
  return {
    id: `integration:${input.id}`,
    kind: "integration",
    name: input.name,
    state: integrationState(input, now),
    summary,
  };
}

/** How many rows need the reader: the rail's count on Shields. */
export function shieldAlerts(rows: readonly ShieldRow[]): number {
  return rows.filter((row) => row.state === "warn" || row.state === "alert")
    .length;
}
