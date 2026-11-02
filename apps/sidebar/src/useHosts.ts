import {
  describeError,
  UNAUTHORISED,
  type FeedState,
  type Runtime,
} from "@atlas/runtime";
import { isHostsDoc, type HostsDoc } from "@atlas/ui/sidebar";
import { useEffect, useState } from "react";

export interface Hosts {
  doc: HostsDoc | null;
  live: boolean;
  error: { text: string; tone: "warn" | "err" } | null;
}

const SERVER = "host:dashboard";

/**
 * Host statistics, live from the local server every five minutes, with the
 * copy at `board/hosts` for devices without it. The copy has the previous
 * page's shape, the answer plus `storedAt`, and is rewritten only when a
 * host's last-seen time changes.
 */
export function useHosts(runtime: Runtime): Hosts {
  const [state, setState] = useState<FeedState<HostsDoc> | null>(null);
  useEffect(
    () =>
      runtime.feed<HostsDoc>(
        {
          server: SERVER,
          tool: "host_stats",
          path: "board/hosts",
          accept: (d) => (isHostsDoc(d) ? d : null),
          signature: (d) =>
            d.hosts.map((h) => `${h.host}@${h.lastSeen}`).join("|"),
          toStored: (d, now) => ({ ...d, storedAt: now.toISOString() }),
          watch: {
            refetchInterval: 5 * 60000,
            cache: { staleTime: 60000, gcTime: 86400000 },
          },
        },
        setState,
      ),
    [runtime],
  );
  const error = state?.error;
  return {
    doc: state?.live ?? state?.stored ?? null,
    live: Boolean(state?.live),
    // A connector that isn't usable here is not news on the phone; the copy speaks for itself.
    error:
      error && !UNAUTHORISED.has(error.code)
        ? {
            text: describeError(error, "The local dashboard server"),
            tone: error.code === "server_unavailable" ? "warn" : "err",
          }
        : null,
  };
}
