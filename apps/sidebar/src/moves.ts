import type { Band, WorkItem } from "@atlas/ui/sidebar";

/** The band a task's worklist band belongs to. */
export const HERE: Record<string, Band> = {
  today: "today",
  tomorrow: "tomorrow",
  future: "backlog",
  unscheduled: "backlog",
};

/** The icon and words for moving a task to each band. */
export const MOVES: Record<
  Band,
  { icon: "today" | "right" | "doorout"; label: string }
> = {
  today: { icon: "today", label: "Move to today" },
  tomorrow: { icon: "right", label: "Move to tomorrow" },
  backlog: { icon: "doorout", label: "Move to the backlog" },
};

/** The bands a task can move to: every band but its own. */
export const otherBands = (t: WorkItem): Band[] =>
  (["today", "tomorrow", "backlog"] as Band[]).filter(
    (b) => b !== (HERE[t.band ?? ""] ?? "today"),
  );

/** Why Commander actions are off while a request is open. */
export const PENDING_NOTE = "A Commander request for this item is still open";
