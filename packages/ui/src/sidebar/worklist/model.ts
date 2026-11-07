/**
 * The worklist as the local server's `worklist` tool sends it, and stores
 * at `board/tasks`: Dashboard.md and the task database merged, one item
 * per task or meeting.
 */

export type Band = "today" | "tomorrow" | "backlog";

export interface WorkItem {
  /** `db:<id>` for the task database, otherwise a Dashboard.md reference. */
  ref?: string;
  title: string;
  /** The client key. */
  customer: string;
  /** Where the source put it: today, tomorrow, a later day, or no day. */
  band?: "today" | "tomorrow" | "future" | "unscheduled";
  /** The day it is planned for, YYYY-MM-DD. */
  day?: string;
  done?: boolean;
  priority?: "high" | "medium" | "low";
  /** The source's own order. */
  order?: number;
  /** A tracker key, as PROJ-123. */
  key?: string;
  /** `blocked`, `active`, `approved`, `merged` and others, shown as tags. */
  flags?: string[];
  value?: string;
  effort?: "XS" | "S" | "M" | "L" | "XL";
  /** The Covey quadrant the database computed. */
  quadrant?: string;
  claimedBy?: string;
  /** A meeting entry: its wall-clock start and end, "9:30". */
  meeting?: { start: string; end: string };
  /** The details page's path in the vault, and when it last changed. */
  details?: string;
  detailsAt?: string;
  /** The tracker's address for the item. */
  link?: string;
  /** A real deadline, YYYY-MM-DD. */
  due?: string;
  /** The item's own pull requests, `owner/repo#12`. */
  pullRequests?: string[];
  /** The task database's revision; higher is newer. */
  revision?: number;
}

export interface WorklistDoc {
  items: WorkItem[];
  syncedAt?: string;
  sourceModifiedAt?: string;
  /** Whether the task database answered when the list was built. */
  database?: { ok?: boolean; error?: string };
}

export function isWorklistDoc(value: unknown): value is WorklistDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { items?: unknown }).items)
  );
}

/**
 * One item per ref. The rows are keyed by ref, and React can leave a stale
 * row on screen after two siblings share a key, with menus that no longer
 * answer. A repeated ref keeps the copy with the higher revision, or the
 * later copy when neither has one, in the place the ref first appeared.
 * Items without a ref are kept as they are.
 *
 * @param items - The items as the source sent them.
 * @returns The same array when no ref repeats, otherwise a new one.
 */
export function uniqueItems(items: readonly WorkItem[]): WorkItem[] {
  const at = new Map<string, number>();
  const out: WorkItem[] = [];
  for (const item of items) {
    const seen = item.ref === undefined ? undefined : at.get(item.ref);
    if (seen === undefined) {
      if (item.ref !== undefined) at.set(item.ref, out.length);
      out.push(item);
    } else if ((item.revision ?? 0) >= (out[seen]!.revision ?? 0)) {
      out[seen] = item;
    }
  }
  return out.length === items.length ? (items as WorkItem[]) : out;
}

/** Tasks only; meetings belong to the calendar. */
const tasks = (items: readonly WorkItem[]) => items.filter((t) => !t.meeting);

/**
 * A band's tasks. Today holds what is planned for today or before, and
 * what the source put in today without a day. Tomorrow holds tomorrow's.
 * The backlog holds open tasks for later days and without a day.
 */
export function itemsFor(
  items: readonly WorkItem[],
  band: Band,
  today: string,
  tomorrow: string,
): WorkItem[] {
  return tasks(items).filter((t) =>
    band === "today"
      ? (t.band === "today" || t.day === today) &&
        (t.day ? t.day <= today : true)
      : band === "tomorrow"
        ? t.day === tomorrow || (t.band === "tomorrow" && t.day !== today)
        : (t.band === "unscheduled" ||
            (t.band === "future" && t.day !== tomorrow)) &&
          !t.done,
  );
}

/** Approved and not merged, or merged and not released: waiting on a merge or a release. */
export const isWaiting = (t: WorkItem): boolean =>
  (t.flags ?? []).some((f) => f === "approved" || f === "merged");

const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export const byPriority = (a: WorkItem, b: WorkItem): number =>
  (RANK[a.priority ?? ""] ?? 3) - (RANK[b.priority ?? ""] ?? 3) ||
  (a.order ?? 0) - (b.order ?? 0);

/** Open before done, then by priority and the source's order. */
export const byDoneThenPriority = (a: WorkItem, b: WorkItem): number =>
  Number(Boolean(a.done)) - Number(Boolean(b.done)) || byPriority(a, b);

export const QUADRANTS = [
  {
    key: "Q1-do-now",
    short: "Q1",
    about:
      "Do now. Important and urgent: medium value or more, and due within 7 days.",
    colour: "var(--bad)",
  },
  {
    key: "Q2-schedule",
    short: "Q2",
    about:
      "Schedule. Important, not urgent: medium value or more, with no near due date. Plan these in before they turn urgent.",
    colour: "var(--accent)",
  },
  {
    key: "Q3-minimise",
    short: "Q3",
    about: "Minimise. Urgent but low value: keep them short, or hand them on.",
    colour: "var(--warn)",
  },
  {
    key: "Q4-drop",
    short: "Q4",
    about: "Drop. Low value and not urgent: consider dropping them.",
    colour: "var(--muted)",
  },
  {
    key: "unsized",
    short: "Ungraded",
    about:
      "No business value or effort yet, so no quadrant. Use Triage in the menu to grade them.",
    colour: "var(--muted)",
  },
] as const;

export const quadrantOf = (t: WorkItem): string =>
  QUADRANTS.some((q) => q.key === t.quadrant)
    ? (t.quadrant as string)
    : "unsized";

export type When = "today" | "tomorrow" | "later" | "backlog";

/** When a task is planned, in the plan view's words. */
export function whenOf(t: WorkItem, today: string): When {
  if (t.band === "unscheduled" || !t.day) return "backlog";
  if (t.band === "today" || t.day <= today) return "today";
  if (t.band === "tomorrow") return "tomorrow";
  return "later";
}

const WHEN_ORDER: When[] = ["today", "tomorrow", "later", "backlog"];

export const byWhenThenPriority =
  (today: string) =>
  (a: WorkItem, b: WorkItem): number =>
    WHEN_ORDER.indexOf(whenOf(a, today)) -
      WHEN_ORDER.indexOf(whenOf(b, today)) || byPriority(a, b);

/** Hours each effort size stands for, and the hours in a working day. */
export const HOURS: Record<string, number> = {
  XS: 0.5,
  S: 2,
  M: 4,
  L: 8,
  XL: 16,
};
export const DAY_HOURS = 8;

export const hoursOf = (items: readonly WorkItem[]): number =>
  items.reduce((n, t) => n + (HOURS[t.effort ?? ""] ?? 0), 0);

export const formatHours = (n: number): string => `${Math.round(n * 10) / 10}h`;

export const VALUE_TEXT: Record<string, string> = {
  negative: "negative",
  none: "no",
  low: "low",
  medium: "medium",
  high: "high",
  veryHigh: "very high",
};

/**
 * What the plan view's bar says about today: how many tasks, the graded
 * hours of those not blocked against a day, and how many are ungraded or
 * blocked.
 */
export function todaySummary(open: readonly WorkItem[], today: string) {
  const todays = open.filter((t) => whenOf(t, today) === "today");
  const blocked = (t: WorkItem) => (t.flags ?? []).includes("blocked");
  const graded = todays.filter(
    (t) => quadrantOf(t) !== "unsized" && !blocked(t),
  );
  return {
    count: todays.length,
    hours: hoursOf(graded),
    ungraded: todays.filter((t) => quadrantOf(t) === "unsized" && !blocked(t))
      .length,
    blocked: todays.filter(blocked).length,
  };
}

/** The flag's tag: its words and its colour group. */
export function flagTag(flag: string): {
  text: string;
  tone: "crit" | "active" | "neutral";
} {
  if (flag === "blocked") return { text: "blocked", tone: "crit" };
  if (flag === "active") return { text: "in progress", tone: "active" };
  return { text: flag, tone: "neutral" };
}

/** Fold keys, as the previous page saved them in `db.collapsed`. */
export const foldKeys = {
  client: (client: string) => client,
  quadrant: (quadrant: string) => `q:${quadrant}`,
  quadrantClient: (quadrant: string, client: string) => `${quadrant}|${client}`,
};

/** The worklist tab's count: the band's open tasks in focus. */
export function openCount(
  items: readonly WorkItem[],
  band: Band,
  today: string,
  tomorrow: string,
  inFocus: (client: string) => boolean,
): number {
  return itemsFor(items, band, today, tomorrow).filter(
    (t) => !t.done && inFocus(t.customer),
  ).length;
}

/** Business values and effort sizes, as the task database takes them. */
export const VALUES = [
  "veryHigh",
  "high",
  "medium",
  "low",
  "none",
  "negative",
] as const;
export const EFFORTS = ["XS", "S", "M", "L", "XL"] as const;

/**
 * Whether a bulk move may move a task: a database task, open, not claimed,
 * not in progress or blocked, and not waiting on a merge or a release.
 */
export const movable = (t: WorkItem): boolean =>
  String(t.ref ?? "").startsWith("db:") &&
  !t.done &&
  !t.claimedBy &&
  !(t.flags ?? []).some((f) => f === "active" || f === "blocked") &&
  !isWaiting(t);

/**
 * Trim today to one day: keep Q1, then the highest Q2 that fits eight
 * hours; give the references of today's other graded tasks that may move.
 * Ungraded tasks stay; blocked ones don't count against the hours.
 */
export function trimPlan(todays: readonly WorkItem[]): string[] {
  const blocked = (t: WorkItem) => (t.flags ?? []).includes("blocked");
  const keep = new Set(
    todays.filter((t) => quadrantOf(t) === "Q1-do-now").map((t) => t.ref),
  );
  let used = hoursOf(todays.filter((t) => keep.has(t.ref) && !blocked(t)));
  for (const t of todays
    .filter((x) => quadrantOf(x) === "Q2-schedule")
    .sort(byPriority)) {
    const need = HOURS[t.effort ?? ""] ?? 0;
    if (!movable(t) || used + need <= DAY_HOURS) {
      keep.add(t.ref);
      used += blocked(t) ? 0 : need;
    }
  }
  return todays
    .filter(
      (t) => quadrantOf(t) !== "unsized" && !keep.has(t.ref) && movable(t),
    )
    .map((t) => t.ref!);
}

/** "; 2 skipped (claimed; done)", from a bulk change's skipped list, or nothing. */
export function skippedText(skipped: ReadonlyArray<{ why?: string }>): string {
  if (!skipped.length) return "";
  const reasons = [...new Set(skipped.map((x) => x.why ?? "no reason"))]
    .slice(0, 3)
    .join("; ");
  return `; ${skipped.length} skipped (${reasons})`;
}

/** A suggested grade for a task, from `board/sizing`, keyed by the task's id without `db:`. */
export interface Sizing {
  value?: string;
  effort?: string;
  /** Check this before grading, in words. */
  flag?: string;
  reason?: string;
}
