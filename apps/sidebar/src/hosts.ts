import type { HostStat } from "@atlas/ui/sidebar";

import type { HostFilter, SidebarConfig } from "./config";

const clientOf = (host: HostStat) => host.customer ?? host.clientId;

const nameMatches = (pattern: string, name: string) =>
  pattern.endsWith("*")
    ? name.startsWith(pattern.slice(0, -1))
    : name === pattern;

function passes(filter: HostFilter, host: HostStat): boolean {
  const client = clientOf(host);
  if (filter.clients?.includes(client)) return true;
  if (filter.notClients && !filter.notClients.includes(client)) return true;
  return (filter.hosts ?? []).some((p) => nameMatches(p, host.host));
}

/** The hosts a client focus shows; every host for `"all"`. */
export function hostsFor(
  hosts: readonly HostStat[],
  focus: string,
  config: SidebarConfig,
): HostStat[] {
  if (focus === "all") return [...hosts];
  const filter = config.hostFilters?.[focus] ?? { clients: [focus] };
  return hosts.filter((h) => passes(filter, h));
}
