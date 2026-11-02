import type { Runtime } from "@atlas/runtime";
import { isWaitingDoc, type WaitingDoc } from "@atlas/ui/sidebar";

import { useFeed, type Feed } from "./useFeed";

/**
 * What waits on the operator, live from the local server every five
 * minutes, with the copy at `board/waiting` in the previous page's shape
 * (the answer plus `storedAt`), rewritten only when the items change.
 */
export function useWaiting(runtime: Runtime): Feed<WaitingDoc> {
  return useFeed<WaitingDoc>(
    runtime,
    {
      server: "host:dashboard",
      tool: "waiting_on_you",
      path: "board/waiting",
      accept: (d) => (isWaitingDoc(d) ? d : null),
      signature: (d) => JSON.stringify(d.items),
      toStored: (d, now) => ({ ...d, storedAt: now.toISOString() }),
      watch: {
        refetchInterval: 5 * 60000,
        cache: { staleTime: 60000, gcTime: 86400000 },
      },
    },
    "The local dashboard server",
  );
}
