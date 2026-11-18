import type { Runtime } from "@atlas/runtime";
import { isHostNetworkDoc, type HostNetworkDoc } from "@atlas/ui/console";

import { useFeed, type Feed } from "../useFeed";

/**
 * Each host's network and Tailscale device, live from the dashboard server
 * every five minutes, with the copy at `board/network` for devices without
 * it. The hosts report every five minutes, so reading more often shows
 * nothing new.
 */
export function useHostNetwork(runtime: Runtime): Feed<HostNetworkDoc> {
  return useFeed<HostNetworkDoc>(
    runtime,
    {
      server: "host:dashboard",
      tool: "host_network",
      path: "board/network",
      accept: (d) => (isHostNetworkDoc(d) ? d : null),
      signature: (d) =>
        d.hosts
          .map((h) => `${h.host}@${h.reportedAt}@${h.tailscale?.online}`)
          .join("|"),
      watch: {
        refetchInterval: 5 * 60000,
        cache: { staleTime: 60000, gcTime: 86400000 },
      },
    },
    "The local dashboard server",
  );
}
