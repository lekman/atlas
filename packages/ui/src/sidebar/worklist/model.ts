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
