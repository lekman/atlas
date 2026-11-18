/**
 * Each host's network, for the Shields section: what the host reports about
 * itself (local addresses, external address, DNS servers, Wi-Fi network,
 * its own background jobs and the ports it listens on), and what this
 * machine's Tailscale knows about every device on the tailnet.
 *
 * A host reports with `POST /api/hosts/network`. The host is named by the
 * Tailscale node the request comes from, never by the body, so one machine
 * cannot report for another. Only the latest report per host is kept, as
 * the `board/network` document; there is no history.
 *
 * `GET /api/hosts/network` gives every host with its latest report and its
 * Tailscale device. Tailscale exit nodes that are not the reader's own
 * devices (they report no operating system) are left out.
 *
 * Reports hold addresses and network names. They stay on this server and
 * the tailnet; they are never logged and never reach the repository.
 */
import { eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { AtlasDatabase } from "./database";
import { sidebarDocuments } from "./schema";

const short = (max: number) => z.string().trim().min(1).max(max);

export const NetworkReport = z.object({
  /** When the host collected it, ISO 8601. */
  collectedAt: z.string().max(40),
  localAddresses: z
    .array(z.object({ interface: short(32), address: short(64) }))
    .max(32),
  externalAddress: short(64).nullable(),
  dns: z.array(short(64)).max(16),
  /** The Wi-Fi network's name, or null on a cable or when the system hides it. */
  wifi: short(64).nullable(),
  services: z
    .array(
      z.object({
        label: short(128),
        running: z.boolean(),
        /** The last exit status, when the job is not running. */
        lastExit: z.number().int().nullable().optional(),
      }),
    )
    .max(200),
  ports: z
    .array(
      z.object({
        port: z.number().int().min(1).max(65535),
        address: short(64),
        process: short(64),
      }),
    )
    .max(200),
});
export type NetworkReport = z.infer<typeof NetworkReport>;

/** One device as Tailscale knows it. */
export interface TailscaleDevice {
  id: string;
  name: string;
  /** The MagicDNS name, without the final dot. */
  dnsName: string;
  addresses: string[];
  os: string;
  online: boolean;
  /** When the tailnet last saw it, ISO 8601, or null while online. */
  lastSeen: string | null;
  /** Whether it is the machine this server runs on. */
  self: boolean;
  /** What this machine serves on the tailnet, for itself only. */
  serveUrls: string[];
}

export interface HostNetwork {
  host: string;
  reportedAt: string | null;
  report: NetworkReport | null;
  tailscale: TailscaleDevice | null;
}

const PATH = "board/network";

interface Stored {
  hosts: Record<string, { reportedAt: string; report: NetworkReport }>;
}

/** The first label of a MagicDNS name, lower case: `server.tailnet.ts.net.` is `server`. */
export const shortName = (name: string) => name.split(".")[0]!.toLowerCase();

interface StatusPeer {
  ID?: string;
  HostName?: string;
  DNSName?: string;
  TailscaleIPs?: string[];
  OS?: string;
  Online?: boolean;
  LastSeen?: string;
}

/** The devices in `tailscale status --json`, the reader's own only. */
export function devicesFromStatus(
  status: unknown,
  serveUrls: string[] = [],
): TailscaleDevice[] {
  const s = status as {
    Self?: StatusPeer;
    Peer?: Record<string, StatusPeer>;
  } | null;
  if (!s?.Self) return [];
  const device = (peer: StatusPeer, self: boolean): TailscaleDevice => ({
    id: String(peer.ID ?? ""),
    name: shortName(String(peer.DNSName || peer.HostName || "")),
    dnsName: String(peer.DNSName ?? "").replace(/\.$/, ""),
    addresses: (peer.TailscaleIPs ?? []).map(String),
    os: String(peer.OS ?? ""),
    online: self ? true : Boolean(peer.Online),
    lastSeen:
      self || peer.Online || !peer.LastSeen || peer.LastSeen.startsWith("0001")
        ? null
        : String(peer.LastSeen),
    self,
    serveUrls: self ? serveUrls : [],
  });
  return [
    device(s.Self, true),
    ...Object.values(s.Peer ?? {})
      .filter((peer) => peer.OS)
      .map((peer) => device(peer, false)),
  ];
}

/** The https addresses in `tailscale serve status --json`, with their paths. */
export function serveUrlsFromStatus(status: unknown): string[] {
  const web = (
    status as {
      Web?: Record<string, { Handlers?: Record<string, unknown> }>;
    } | null
  )?.Web;
  if (!web) return [];
  const urls: string[] = [];
  for (const [hostPort, site] of Object.entries(web)) {
    const base = `https://${hostPort.replace(/:443$/, "")}`;
    for (const path of Object.keys(site.Handlers ?? {}))
      urls.push(path === "/" ? base : `${base}${path}`);
  }
  return urls.sort();
}

async function runJson(command: string[]): Promise<unknown> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "ignore" });
  const text = await new Response(child.stdout).text();
  if ((await child.exited) !== 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** This machine's Tailscale devices, read at most once a minute. */
export function tailscaleDevices(command = "tailscale", rememberFor = 60_000) {
  let cached: { at: number; devices: TailscaleDevice[] } | null = null;
  return async (): Promise<TailscaleDevice[]> => {
    if (cached && Date.now() - cached.at < rememberFor) return cached.devices;
    const [status, serve] = await Promise.all([
      runJson([command, "status", "--json"]),
      runJson([command, "serve", "status", "--json"]),
    ]);
    const devices = devicesFromStatus(status, serveUrlsFromStatus(serve));
    cached = { at: Date.now(), devices };
    return devices;
  };
}

export interface HostNetworkStore {
  /** Keeps a host's latest report. */
  record(host: string, report: NetworkReport, now?: Date): void;
  /** Every host with its latest report and Tailscale device, by name. */
  list(): Promise<HostNetwork[]>;
}

export function createHostNetwork({
  database,
  devices,
}: {
  database: AtlasDatabase;
  devices: () => Promise<TailscaleDevice[]>;
}): HostNetworkStore {
  const read = (): Stored => {
    const row = database
      .select()
      .from(sidebarDocuments)
      .where(eq(sidebarDocuments.path, PATH))
      .get();
    try {
      const parsed = row?.data ? (JSON.parse(row.data) as Stored) : null;
      return parsed?.hosts ? parsed : { hosts: {} };
    } catch {
      return { hosts: {} };
    }
  };

  return {
    record(host, report, now = new Date()) {
      const stored = read();
      stored.hosts[host] = { reportedAt: now.toISOString(), report };
      const text = JSON.stringify(stored);
      const updatedAt = now.toISOString();
      database
        .insert(sidebarDocuments)
        .values({ path: PATH, data: text, version: 1, updatedAt })
        .onConflictDoUpdate({
          target: sidebarDocuments.path,
          set: {
            data: text,
            updatedAt,
            version: sql`${sidebarDocuments.version} + 1`,
          },
        })
        .run();
    },
    async list() {
      const stored = read();
      const tailnet = await devices().catch(() => []);
      const names = new Set([
        ...Object.keys(stored.hosts),
        ...tailnet.map((d) => d.name),
      ]);
      return [...names].sort().map((host) => ({
        host,
        reportedAt: stored.hosts[host]?.reportedAt ?? null,
        report: stored.hosts[host]?.report ?? null,
        tailscale: tailnet.find((d) => d.name === host) ?? null,
      }));
    },
  };
}
