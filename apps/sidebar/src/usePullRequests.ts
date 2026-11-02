import type { Runtime } from "@atlas/runtime";
import {
  detailsKey,
  readPulls,
  type PullsDoc,
  type WorkItem,
} from "@atlas/ui/sidebar";
import { useCallback, useEffect, useRef, useState } from "react";

const linkedOf = (t: WorkItem) => t.pullRequests ?? [];

/** Whether a task has anything to search for pull requests by. */
export const searchable = (t: WorkItem): boolean =>
  Boolean(t.key || linkedOf(t).length);

const storeKey = (t: WorkItem) => `prs/${detailsKey(t.ref ?? "")}`;

/**
 * A task's pull requests: asked of the local server, which searches GitHub
 * for the linked ones or the tracker key, and stored for other devices;
 * or else the stored copy.
 */
export async function loadPulls(
  runtime: Runtime,
  t: WorkItem,
): Promise<{ doc: PullsDoc; copy: boolean } | null> {
  if (!searchable(t) || !t.ref) return null;
  const live = await runtime
    .call(
      "host:dashboard",
      "task_prs",
      { key: t.key ?? "", customer: t.customer, linked: linkedOf(t) },
      { cache: false },
    )
    .then(readPulls)
    .catch(() => null);
  if (live) {
    await runtime
      .write(storeKey(t), {
        ref: t.ref,
        prs: live.prs,
        fetchedAt: live.fetchedAt,
        linked: live.linked,
      })
      .catch(() => undefined);
    return { doc: live, copy: false };
  }
  const copy = await runtime
    .read(storeKey(t))
    .then(readPulls)
    .catch(() => null);
  return copy ? { doc: copy, copy: true } : null;
}

/** The open task's pull requests, and a way to check again now. */
export function usePullRequests(runtime: Runtime, item: WorkItem | null) {
  const [found, setFound] = useState<{
    ref: string;
    doc: PullsDoc;
    copy: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = item?.ref;
  const linked = item ? linkedOf(item).join(",") : "";

  const load = useCallback(async () => {
    if (!item?.ref) return;
    setBusy(true);
    try {
      const got = await loadPulls(runtime, item);
      if (got) setFound({ ref: item.ref, ...got });
    } finally {
      setBusy(false);
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: follows the task's ref and linked list.
  }, [runtime, ref, linked]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const mine = found && found.ref === ref ? found : null;
  return {
    doc: mine?.doc ?? null,
    copy: mine?.copy ?? false,
    busy,
    refresh: load,
  };
}

/**
 * On the Mac, after each live worklist read, keeps today's tasks' pull
 * requests fresh for the phone: each at most every 15 minutes, or at once
 * when its linked list changed, three at a time.
 */
export function usePullsRefresh(
  runtime: Runtime,
  items: readonly WorkItem[] | null,
  liveAt: number | null,
): void {
  const checkedAt = useRef(new Map<string, number>());
  const seen = useRef(new Map<string, string>());
  const busy = useRef(false);
  useEffect(() => {
    if (!items || liveAt === null || busy.current) return;
    const now = Date.now();
    const sig = (t: WorkItem) => linkedOf(t).join(",");
    const due = items
      .filter(
        (t) =>
          t.ref &&
          searchable(t) &&
          !t.done &&
          !t.meeting &&
          t.band === "today" &&
          (now - (checkedAt.current.get(t.ref) ?? 0) > 15 * 60000 ||
            (seen.current.has(t.ref) && seen.current.get(t.ref) !== sig(t))),
      )
      .slice(0, 3);
    if (!due.length) return;
    busy.current = true;
    (async () => {
      try {
        for (const t of due) {
          checkedAt.current.set(t.ref!, Date.now());
          seen.current.set(t.ref!, sig(t));
          await loadPulls(runtime, t);
        }
      } finally {
        busy.current = false;
      }
    })().catch(() => undefined);
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per live read.
  }, [runtime, liveAt]);
}
