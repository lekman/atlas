import type { Runtime } from "@atlas/runtime";
import {
  isWorklistDoc,
  uniqueItems,
  type WorklistDoc,
} from "@atlas/ui/sidebar";

import { useCallback, useState } from "react";

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
  /** Shows a worklist an action answered with, and stores it for other devices. */
  apply: (doc: WorklistDoc) => void;
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
      accept: (d) => (isWorklistDoc(d) ? deduplicated(d) : null),
      signature: (d) => JSON.stringify(d.items),
      watch: {
        refetchInterval: 60000,
        cache: { staleTime: 30000, gcTime: 86400000 },
      },
    },
    "The local dashboard server",
  );
  // A worklist an action answered with counts until a newer live answer.
  const [applied, setApplied] = useState<{
    doc: WorklistDoc;
    at: number;
  } | null>(null);
  const apply = useCallback(
    (doc: WorklistDoc) => {
      setApplied({ doc: deduplicated(doc), at: Date.now() });
      runtime.write("board/tasks", doc).catch(() => undefined);
    },
    [runtime],
  );
  const fresh =
    feed.liveAt !== null &&
    feed.liveAt !== undefined &&
    now.getTime() - feed.liveAt < LIVE_FOR;
  const newer = applied && applied.at > (feed.liveAt ?? 0) ? applied.doc : null;
  return {
    apply,
    doc: newer ?? (fresh ? feed.data : (feed.stored ?? feed.data)),
    liveAt: fresh ? (feed.liveAt ?? null) : null,
    error: feed.error,
    pending: feed.data === null && feed.failure === null,
  };
}

/** The document with one item per ref, so no two rows share a key. */
function deduplicated(doc: WorklistDoc): WorklistDoc {
  const items = uniqueItems(doc.items);
  return items === doc.items ? doc : { ...doc, items };
}
