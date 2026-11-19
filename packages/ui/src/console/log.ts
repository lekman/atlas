/** One finished task, as the dashboard host's `task_log` reads it. */
export interface LogItem {
  ref: string;
  title: string;
  /** The client key it belongs to. */
  customer: string;
  /** The day it was done, YYYY-MM-DD. */
  doneOn: string;
  key?: string | null;
  link?: string | null;
  effort?: "XS" | "S" | "M" | "L" | "XL" | null;
  value?: string | null;
  quadrant?: string | null;
}

export interface LogDoc {
  items: LogItem[];
  days?: number;
  since?: string;
  fetchedAt?: string;
}

export type LogView = "days" | "weeks";

/**
 * Points for a finished task, by its effort: XS 1, S 2, M 3, L 5, XL 8. An
 * ungraded task scores 1, so finishing it still counts.
 */
export const EFFORT_POINTS: Record<string, number> = {
  XS: 1,
  S: 2,
  M: 3,
  L: 5,
  XL: 8,
};

export const pointsOf = (item: Pick<LogItem, "effort">): number =>
  (item.effort && EFFORT_POINTS[item.effort]) || 1;

/** The host's answer, or null when it isn't one. Items without a done day are left out. */
export function readLog(value: unknown): LogDoc | null {
  if (typeof value !== "object" || value === null) return null;
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const v = value as LogDoc;
  return {
    ...v,
    items: (items as LogItem[]).filter(
      (i) =>
        i &&
        typeof i.title === "string" &&
        typeof i.doneOn === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(i.doneOn),
    ),
  };
}

export interface LogPeriod {
  /** "Today", "Yesterday", a weekday; "This week", "Last week", "Week 45". */
  label: string;
  /** The first day of the period, YYYY-MM-DD. */
  from: string;
  items: LogItem[];
  points: number;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return x;
};

/** Monday of the week a day is in. */
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

/** ISO 8601 week number. */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

const summed = (items: LogItem[]) =>
  items.reduce((sum, i) => sum + pointsOf(i), 0);

/** The last `count` days, newest first, each with what was finished that day. */
export function logDays(
  items: readonly LogItem[],
  now: Date,
  count = 7,
): LogPeriod[] {
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(now, -i);
    const from = ymd(day);
    const done = items.filter((x) => x.doneOn === from);
    return {
      label:
        i === 0
          ? "Today"
          : i === 1
            ? "Yesterday"
            : day.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "short",
              }),
      from,
      items: done,
      points: summed(done),
    };
  });
}

/** The last `count` weeks, Monday to Sunday, newest first. */
export function logWeeks(
  items: readonly LogItem[],
  now: Date,
  count = 4,
): LogPeriod[] {
  const thisMonday = mondayOf(now);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(thisMonday, -7 * i);
    const from = ymd(start);
    const to = ymd(addDays(start, 6));
    const done = items.filter((x) => x.doneOn >= from && x.doneOn <= to);
    return {
      label:
        i === 0
          ? "This week"
          : i === 1
            ? "Last week"
            : `Week ${isoWeek(start)}`,
      from,
      items: done,
      points: summed(done),
    };
  });
}
