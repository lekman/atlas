import type { Runtime } from "@atlas/runtime";
import { isWorklistDoc, type WorklistDoc } from "@atlas/ui/sidebar";

import { useFeed } from "./useFeed";

/** A live answer is trusted over the stored copy for this long. */
const LIVE_FOR = 3 * 60000;

export interface Worklist {
  doc: WorklistDoc | null;
  /** When the worklist was last read live, in epoch milliseconds. */
  liveAt: number | null;
  error: { text: string; tone: "warn" | "err" } | null;
  /** Neither a live answer nor the stored copy has come yet. */
  pending: boolean;
}

/**
 * The worklist, live from the local server every minute, with the copy at
 * `board/tasks` for other devices. The copy is the answer unchanged,
 * rewritten when the items change. A live answer older than three minutes
 * gives way to the stored copy, which another device may have refreshed.
 */
export function useWorklist(runtime: Runtime, now: Date): Worklist {
  const feed = useFeed<WorklistDoc>(
    runtime,
    {
      server: "host:dashboard",
      tool: "worklist",
      path: "board/tasks",
      accept: (d) => (isWorklistDoc(d) ? d : null),
      signature: (d) => JSON.stringify(d.items),
      watch: {
        refetchInterval: 60000,
        cache: { staleTime: 30000, gcTime: 86400000 },
      },
    },
    "The local dashboard server",
  );
  const fresh =
    feed.liveAt !== null &&
    feed.liveAt !== undefined &&
    now.getTime() - feed.liveAt < LIVE_FOR;
  return {
    doc: fresh ? feed.data : (feed.stored ?? feed.data),
    liveAt: fresh ? (feed.liveAt ?? null) : null,
    error: feed.error,
    pending: feed.data === null && feed.failure === null,
  };
}
