/**
 * Host statistics as the local server's `host_stats` tool sends them, and
 * the rules the sidebar draws them by. The limits and breaches are the
 * server's own; the sidebar only shows them.
 */
import { formatAgo, formatDuration, formatTime } from "../format";

export type Level = "warn" | "crit";

export interface HostSample {
  at: string;
  cpuPct?: number | null;
  load1?: number | null;
  memFreePct?: number | null;
  swapUsedMb?: number | null;
  diskFreeGb?: number | null;
  runnersBusy?: number | null;
  runnersMax?: number | null;
}

export interface HostBreach {
  metric: string;
  level: Level;
}

export interface HostStat {
  clientId: string;
  /** The sidebar's client key, where the server maps one. */
  customer?: string;
  host: string;
  lastSeen?: string | null;
  latest?: Omit<HostSample, "at"> | null;
  samples?: HostSample[];
  breaches?: HostBreach[];
}

/** The tool's answer, and the stored copy (`board/hosts`) with `storedAt`. */
export interface HostsDoc {
  hosts: HostStat[];
  storedAt?: string;
}

export function isHostsDoc(value: unknown): value is HostsDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { hosts?: unknown }).hosts)
  );
}

type NumberKey = Exclude<keyof HostSample, "at">;

export const HOST_METRICS: ReadonlyArray<{
  key: NumberKey;
  name: string;
  unit: string;
  format: (v: number) => string;
}> = [
  {
    key: "cpuPct",
    name: "CPU",
    unit: "%",
    format: (v) => String(Math.round(v)),
  },
  { key: "load1", name: "Load", unit: "", format: (v) => v.toFixed(2) },
  {
    key: "memFreePct",
    name: "Memory free",
    unit: "%",
    format: (v) => String(Math.round(v)),
  },
  {
    key: "swapUsedMb",
    name: "Swap",
    unit: "GB",
    format: (v) => (v / 1024).toFixed(1),
  },
  {
    key: "diskFreeGb",
    name: "Disk free",
    unit: "GB",
    format: (v) => v.toFixed(1),
  },
];

export interface HostLine {
  key: NumberKey;
  name: string;
  min: number;
  /** The top of the scale; none scales to the data and the limit. */
  max: number | null;
  /** Drawn as a dashed line. */
  limit: number;
}

export const HOST_LINES: readonly HostLine[] = [
  { key: "cpuPct", name: "CPU %", min: 0, max: 100, limit: 90 },
  { key: "memFreePct", name: "Memory free %", min: 0, max: 100, limit: 20 },
  { key: "diskFreeGb", name: "Disk free GB", min: 0, max: null, limit: 50 },
];

/** The worst breach on a host, or none. */
export function hostLevel(host: HostStat): Level | null {
  const breaches = host.breaches ?? [];
  if (breaches.some((b) => b.level === "crit")) return "crit";
  return breaches.length ? "warn" : null;
}

/** For the tab: how many breaches the shown hosts have, and the worst. */
export function breachSummary(hosts: readonly HostStat[]): {
  count: number;
  level: Level | null;
} {
  const all = hosts.flatMap((h) => h.breaches ?? []);
  return {
    count: all.length,
    level: all.some((b) => b.level === "crit")
      ? "crit"
      : all.length
        ? "warn"
        : null,
  };
}

/** The tab's tooltip and count for the shown hosts; nothing before any data. */
export function hostsTab(hosts: readonly HostStat[] | null): {
  label: string;
  count?: string;
  tone?: Level;
} {
  if (!hosts) return { label: "Host alerts" };
  const { count, level } = breachSummary(hosts);
  if (!count) return { label: "Host alerts: none", count: "✓" };
  return {
    label: `${count} host alert${count > 1 ? "s" : ""}${level === "crit" ? ", critical" : ""}`,
    count: String(count),
    tone: level ?? undefined,
  };
}

/** A host not heard from for this long is stale, in a live answer. */
const STALE_AFTER = 17 * 60000;

/**
 * When a host was last seen. A stored copy is judged against the time it
 * was saved, never against now: its age is the copy's, shown once at the
 * top of the panel.
 */
export function seenText(
  host: HostStat,
  options: { now: Date; storedAt: Date | null; live: boolean },
): { text: string; stale: boolean } {
  const seen = host.lastSeen ? new Date(host.lastSeen) : null;
  if (!seen || Number.isNaN(seen.getTime())) {
    return { text: "never seen", stale: false };
  }
  if (!options.live) {
    return {
      text: options.storedAt
        ? `last seen ${formatDuration(options.storedAt.getTime() - seen.getTime())} before this copy`
        : `last seen at ${formatTime(seen)}`,
      stale: false,
    };
  }
  return {
    text: `last seen ${formatAgo(seen, options.now)}`,
    stale: options.now.getTime() - seen.getTime() > STALE_AFTER,
  };
}

/** The view box of a 24-hour line. */
export const SPARK = { width: 240, height: 40 } as const;

/**
 * A 24-hour line's points and its limit's height, in the view box. Samples
 * older than a day, or without the value, are left out.
 */
export function sparkline(
  samples: readonly HostSample[],
  line: HostLine,
  now: Date,
): { points: string; limitY: number | null } {
  const { width: W, height: H } = SPARK;
  const t1 = now.getTime();
  const t0 = t1 - 86400000;
  const points = samples.filter(
    (s) => typeof s[line.key] === "number" && Date.parse(s.at) >= t0,
  );
  const values = points.map((s) => s[line.key] as number);
  const max = line.max ?? Math.max(line.limit * 1.5, ...values, 1);
  const x = (at: string) => ((Date.parse(at) - t0) / (t1 - t0)) * W;
  const y = (v: number) =>
    H - ((v - line.min) / (max - line.min)) * (H - 4) - 2;
  return {
    points: points
      .map(
        (s) => `${x(s.at).toFixed(1)},${y(s[line.key] as number).toFixed(1)}`,
      )
      .join(" "),
    limitY: line.limit <= max ? y(line.limit) : null,
  };
}

/** The metric's display name, for breach tags. */
export const metricName = (metric: string): string =>
  HOST_METRICS.find((m) => m.key === metric)?.name ?? metric;
