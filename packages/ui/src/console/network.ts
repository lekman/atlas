/**
 * Each host's network as the Atlas server serves it (`host_network` on the
 * dashboard server, `GET /api/hosts/network` on the Atlas server): the
 * host's own latest report and its Tailscale device.
 */

export interface NetworkReport {
  collectedAt: string;
  localAddresses: Array<{ interface: string; address: string }>;
  externalAddress: string | null;
  dns: string[];
  /** The Wi-Fi network's name, or null on a cable or when the system hides it. */
  wifi: string | null;
  services: Array<{
    label: string;
    running: boolean;
    lastExit?: number | null;
  }>;
  ports: Array<{ port: number; address: string; process: string }>;
}

export interface TailscaleDevice {
  id: string;
  name: string;
  dnsName: string;
  addresses: string[];
  os: string;
  online: boolean;
  lastSeen: string | null;
  self: boolean;
  serveUrls: string[];
}

export interface HostNetwork {
  host: string;
  reportedAt: string | null;
  report: NetworkReport | null;
  tailscale: TailscaleDevice | null;
}

export interface HostNetworkDoc {
  hosts: HostNetwork[];
}

export function isHostNetworkDoc(value: unknown): value is HostNetworkDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { hosts?: unknown }).hosts)
  );
}

/** A host's network entry by name, ignoring case. */
export function networkFor(
  doc: HostNetworkDoc | null | undefined,
  host: string,
): HostNetwork | undefined {
  const key = host.toLowerCase();
  return doc?.hosts.find((entry) => entry.host.toLowerCase() === key);
}
