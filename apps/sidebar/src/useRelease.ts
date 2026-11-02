import type { Runtime } from "@atlas/runtime";
import { isReleaseDoc, type ReleaseDoc } from "@atlas/ui/sidebar";

import { useFeed, type Feed } from "./useFeed";

/**
 * Release status, live from the local server every 15 minutes. The answer
 * is stored at `board/release` unchanged, as the previous page stored it,
 * once per new check.
 */
export function useRelease(runtime: Runtime): Feed<ReleaseDoc> {
  return useFeed<ReleaseDoc>(
    runtime,
    {
      server: "host:dashboard",
      tool: "release_status",
      path: "board/release",
      accept: (d) => (isReleaseDoc(d) ? d : null),
      signature: (d) => d.checkedAt,
      watch: {
        refetchInterval: 15 * 60000,
        cache: { staleTime: 60000, gcTime: 86400000 },
      },
    },
    "The local dashboard server",
  );
}
