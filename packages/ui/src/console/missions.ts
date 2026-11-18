/**
 * What the Missions section shows, worked out from the worklist the
 * sidebar already reads. The rules are the sidebar's own: the same bands
 * (`itemsFor`), quadrants (`quadrantOf`) and effort hours (`HOURS`), so the
 * two views never disagree about a task.
 *
 * Tasks have no mission in the task database yet, so they are grouped by
 * system: the client they belong to.
 */
import {
  EFFORTS,
  itemsFor,
  quadrantOf,
  type Band,
  type WorkItem,
} from "../sidebar/worklist/model";

export type Range = Band;
export const ranges: readonly Range[] = ["today", "tomorrow", "backlog"];
export const rangeNames: Record<Range, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  backlog: "Backlog",
};

export type MissionsView = "list" | "grid";

/** A task's state, drawn as a shape so it does not rest on colour alone. */
export type TaskState = "done" | "active" | "queued" | "blocked";

export const taskStateNames: Record<TaskState, string> = {
  done: "Done",
  active: "In progress",
  queued: "Queued",
  blocked: "Blocked",
};

export function taskStateOf(task: WorkItem): TaskState {
  if (task.done) return "done";
  const flags = task.flags ?? [];
  if (flags.includes("blocked")) return "blocked";
  if (task.claimedBy || flags.includes("active")) return "active";
  return "queued";
}

/** The range's tasks, meetings left out: they count as meeting time instead. */
export function tasksIn(
  items: readonly WorkItem[],
  range: Range,
  today: string,
  tomorrow: string,
): WorkItem[] {
  return itemsFor(items, range, today, tomorrow).filter((t) => !t.meeting);
}

export interface SystemGroup {
  system: string;
  tasks: WorkItem[];
}

const STATE_ORDER: TaskState[] = ["blocked", "active", "queued", "done"];

/**
 * Tasks by system, in the order systems first appear, each system's tasks
 * blocked first, then in progress, queued and done, then in the source's
 * order.
 */
export function groupBySystem(tasks: readonly WorkItem[]): SystemGroup[] {
  const groups = new Map<string, WorkItem[]>();
  for (const task of tasks) {
    const list = groups.get(task.customer) ?? [];
    list.push(task);
    groups.set(task.customer, list);
  }
  return [...groups].map(([system, list]) => ({
    system,
    tasks: [...list].sort(
      (a, b) =>
        STATE_ORDER.indexOf(taskStateOf(a)) -
          STATE_ORDER.indexOf(taskStateOf(b)) ||
        (a.order ?? 0) - (b.order ?? 0),
    ),
  }));
}

/** The four quadrants and the ungraded tasks, in the grid's order. */
export const gridCells = [
  { key: "Q1-do-now", short: "Q1", name: "Do now" },
  { key: "Q2-schedule", short: "Q2", name: "Schedule" },
  { key: "Q3-minimise", short: "Q3", name: "Minimise" },
  { key: "Q4-drop", short: "Q4", name: "Drop" },
] as const;

export function byQuadrant(tasks: readonly WorkItem[]): {
  cells: Record<string, WorkItem[]>;
  ungraded: WorkItem[];
} {
  const cells: Record<string, WorkItem[]> = Object.fromEntries(
    gridCells.map((c) => [c.key, [] as WorkItem[]]),
  );
  const ungraded: WorkItem[] = [];
  for (const task of tasks) {
    const quadrant = quadrantOf(task);
    if (quadrant === "unsized") ungraded.push(task);
    else cells[quadrant]?.push(task);
  }
  return { cells, ungraded };
}

/** Minutes between two wall-clock times, "9:30" and "10:15". */
function minutesBetween(start: string, end: string): number {
  const minutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  return Math.max(0, minutes(end) - minutes(start));
}

export interface DayScope {
  /** Open tasks in the range, blocked ones included. */
  count: number;
  /** Open, not blocked tasks per effort size; ungraded ones are counted apart. */
  bySize: Record<(typeof EFFORTS)[number], number>;
  ungraded: number;
  /** Blocked tasks, left out of the effort. */
  blocked: number;
  /** Minutes of meetings on the day; zero for the backlog. */
  meetingMinutes: number;
}

/**
 * What the range holds, as information only: the console sets no limit and
 * gives no warning, because how much fits a day is the reader's judgement.
 */
export function dayScope(
  items: readonly WorkItem[],
  range: Range,
  today: string,
  tomorrow: string,
): DayScope {
  const open = tasksIn(items, range, today, tomorrow).filter((t) => !t.done);
  const blocked = open.filter((t) => taskStateOf(t) === "blocked");
  const workable = open.filter((t) => taskStateOf(t) !== "blocked");
  const bySize = Object.fromEntries(EFFORTS.map((e) => [e, 0])) as Record<
    (typeof EFFORTS)[number],
    number
  >;
  let ungraded = 0;
  for (const task of workable) {
    if (task.effort) bySize[task.effort]++;
    else ungraded++;
  }
  const day =
    range === "today" ? today : range === "tomorrow" ? tomorrow : null;
  const meetingMinutes = day
    ? items
        .filter((t) => t.meeting && t.day === day)
        .reduce(
          (n, t) => n + minutesBetween(t.meeting!.start, t.meeting!.end),
          0,
        )
    : 0;
  return {
    count: open.length,
    bySize,
    ungraded,
    blocked: blocked.length,
    meetingMinutes,
  };
}

/** Minutes in words: "45 min", "2 h", "1 h 30 min". */
export function minutesWords(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The ranges a task can move to: every range but the one it is in. */
export function movesFor(range: Range): Range[] {
  return ranges.filter((r) => r !== range);
}

/** Open tasks without a quadrant, across every range: the Triage button's count. */
export function ungradedCount(items: readonly WorkItem[]): number {
  return items.filter(
    (t) => !t.done && !t.meeting && quadrantOf(t) === "unsized",
  ).length;
}
