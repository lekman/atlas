import type { Runtime } from "@atlas/runtime";
import { useEffect, useRef, useState } from "react";

/** The documents the Mac's sync fills, by store name. */
const SYNCED = ["events", "jira"] as const;

type Synced = (typeof SYNCED)[number];

interface SyncAnswer {
  ok?: boolean;
  doc?: { syncedAt?: string };
  error?: string;
}

/** The last sync's outcome: when it finished, or what failed. */
export type SyncOutcome = { done: number } | { error: string } | null;

/**
 * Runs the Mac's sync of calendar feeds and Jira through the local server
 * every 15 minutes, and stores each document for other devices when it is
 * newer than the stored one. Where the local server isn't, nothing runs
 * and the stored copies stay.
 */
export function useSync(
  runtime: Runtime,
  stored: Partial<Record<Synced, string | undefined>>,
): SyncOutcome {
  const [outcome, setOutcome] = useState<SyncOutcome>(null);
  const latest = useRef(stored);
  latest.current = stored;
  useEffect(
    () =>
      runtime.watch(
        "host:dashboard",
        "sync_now",
        null,
        {
          onData: (data) => {
            const answer = (data ?? {}) as Partial<Record<Synced, SyncAnswer>>;
            const failed: string[] = [];
            for (const name of SYNCED) {
              const part = answer[name];
              if (part?.ok && part.doc) {
                const current = latest.current[name];
                if (!current || String(part.doc.syncedAt ?? "") > current) {
                  runtime
                    .write(`board/${name}`, part.doc)
                    .catch(() => undefined);
                }
              } else {
                failed.push(`${name}: ${part?.error ?? "no answer"}`);
              }
            }
            setOutcome(
              failed.length
                ? { error: failed.join("; ") }
                : { done: Date.now() },
            );
          },
          // The Mac asleep, or another device: the stored copies stay.
          onError: () => undefined,
        },
        {
          refetchInterval: 15 * 60000,
          cache: { staleTime: 10 * 60000, gcTime: 86400000 },
        },
      ),
    [runtime],
  );
  return outcome;
}
