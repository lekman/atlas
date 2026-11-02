import type { Runtime } from "@atlas/runtime";
import {
  detailsKey,
  isDetailsPage,
  type DetailsCopy,
  type DetailsPage,
  type DetailsState,
  type WorkItem,
} from "@atlas/ui/sidebar";
import { useEffect, useRef, useState } from "react";

/** The index of stored copies, `board/details`: each page's key and the change it was copied at. */
export interface DetailsIndex {
  items: Record<string, string>;
  updatedAt?: string;
}

/**
 * Stores a page for devices without the local server, at `details/<key>`,
 * and notes it in the index, unless the index already has this change.
 */
export async function storeDetails(
  runtime: Runtime,
  page: DetailsPage,
  index: Record<string, string>,
): Promise<void> {
  const key = detailsKey(page.path);
  if (page.modifiedAt && index[key] === page.modifiedAt) return;
  const copy: DetailsCopy = {
    path: page.path,
    title: page.title,
    md: page.md,
    truncated: Boolean(page.truncated),
    modifiedAt: page.modifiedAt,
    copiedAt: new Date().toISOString(),
  };
  await runtime.write(`details/${key}`, copy);
  if (page.modifiedAt) index[key] = page.modifiedAt;
  await runtime.write("board/details", {
    items: index,
    updatedAt: copy.copiedAt,
  });
}

const readPage = async (
  runtime: Runtime,
  path: string,
): Promise<DetailsPage | null> => {
  const page = await runtime.call(
    "host:dashboard",
    "details_read",
    { path },
    { cache: false },
  );
  return isDetailsPage(page) ? page : null;
};

/**
 * An item's details page: read live through the local server and stored
 * for other devices, or else the stored copy, with when it was made.
 */
export function useDetails(
  runtime: Runtime,
  item: WorkItem | null,
  index: Record<string, string>,
): DetailsState {
  const [state, setState] = useState<DetailsState>({ state: "loading" });
  const latest = useRef(index);
  latest.current = index;
  const path = item?.details;
  useEffect(() => {
    if (!item) return;
    if (!path) {
      setState({ state: "none" });
      return;
    }
    let gone = false;
    setState({ state: "loading" });
    (async () => {
      const live = await readPage(runtime, path).catch(() => null);
      if (live) {
        if (!gone) setState({ state: "ready", page: live });
        await storeDetails(runtime, live, { ...latest.current }).catch(
          () => undefined,
        );
        return;
      }
      const copy = await runtime
        .read<DetailsCopy>(`details/${detailsKey(path)}`)
        .catch(() => undefined);
      if (gone) return;
      setState(
        copy && isDetailsPage(copy)
          ? { state: "ready", page: copy, copiedAt: copy.copiedAt }
          : { state: "missing" },
      );
    })();
    return () => {
      gone = true;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: the page follows the item's path, not each render of it.
  }, [runtime, item?.ref, path]);
  return item ? state : { state: "loading" };
}

/**
 * On the Mac, after each live worklist read, copies the pages that
 * changed since their stored copy, ten at a time, so the phone has them.
 * Stops at the first failure and tries again on the next read.
 */
export function useDetailsCopies(
  runtime: Runtime,
  items: readonly WorkItem[] | null,
  liveAt: number | null,
  index: DetailsIndex | null | undefined,
): void {
  const busy = useRef(false);
  useEffect(() => {
    if (!items || liveAt === null || index === undefined || busy.current)
      return;
    const known = { ...(index?.items ?? {}) };
    const todo = items
      .filter(
        (i) =>
          i.details &&
          i.detailsAt &&
          known[detailsKey(i.details)] !== i.detailsAt,
      )
      .slice(0, 10);
    if (!todo.length) return;
    busy.current = true;
    (async () => {
      try {
        for (const i of todo) {
          const page = await readPage(runtime, i.details!).catch(() => null);
          if (!page) break;
          await storeDetails(runtime, page, known);
        }
      } finally {
        busy.current = false;
      }
    })().catch(() => undefined);
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per live read.
  }, [runtime, liveAt]);
}
