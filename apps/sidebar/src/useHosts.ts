import type { Runtime } from "@atlas/runtime";
import { isHostsDoc, type HostsDoc } from "@atlas/ui/sidebar";

import { useFeed, type Feed } from "./useFeed";

/**
 * Host statistics, live from the local server every five minutes, with the
 * copy at `board/hosts` for devices without it. The copy has the previous
 * page's shape, the answer plus `storedAt`, and is rewritten only when a
 * host's last-seen time changes.
 */
export function useHosts(runtime: Runtime): Feed<HostsDoc> {
  return useFeed<HostsDoc>(
    runtime,
    {
      server: "host:dashboard",
      tool: "host_stats",
      path: "board/hosts",
      accept: (d) => (isHostsDoc(d) ? d : null),
      signature: (d) => d.hosts.map((h) => `${h.host}@${h.lastSeen}`).join("|"),
      toStored: (d, now) => ({ ...d, storedAt: now.toISOString() }),
      watch: {
        refetchInterval: 5 * 60000,
        cache: { staleTime: 60000, gcTime: 86400000 },
      },
    },
    "The local dashboard server",
  );
}
