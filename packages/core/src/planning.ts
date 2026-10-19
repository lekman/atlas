/**
 * The day plan's rules: how effort and value make a priority, which band a
 * task falls in, and the order tasks are read in. Pure functions, so the
 * server, the skills and every screen agree.
 */
import type {
  Band,
  BacklogItem,
  Client,
  Effort,
  IsoDate,
  Priority,
  TaskValue,
} from "./model";

/** What each T-shirt size weighs when value is divided by it. */
export const effortWeights: Readonly<Record<Effort, number>> = {
  XS: 1,
  S: 2,
  M: 3,
  L: 5,
  XL: 8,
};

/** At or above this value per unit of effort, a task is high priority. */
export const highPriorityRatio = 2;
/** Below this value per unit of effort, a task is low priority. */
export const lowPriorityRatio = 0.75;

/**
 * Value divided by the effort's weight: 2 or more is high, below 0.75 is
 * low, and anything between is normal.
 */
export function priorityFrom(value: TaskValue, effort: Effort): Priority {
  const ratio = value / effortWeights[effort];
  if (ratio >= highPriorityRatio) return "high";
  if (ratio < lowPriorityRatio) return "low";
  return "normal";
}

/** Extra large effort for a value of 3 or less, whatever the ratio says. */
export function notWorthIt(value: TaskValue, effort: Effort): boolean {
  return effort === "XL" && value <= 3;
}

/** Whether a task has both an effort and a value. */
export function isSized(
  item: BacklogItem,
): item is BacklogItem & { effort: Effort; value: TaskValue } {
  return item.effort !== undefined && item.value !== undefined;
}

/** The priority a task is shown with: from its size once it has one, its own marker until then. */
export function priorityOf(item: BacklogItem): Priority {
  return isSized(item) ? priorityFrom(item.value, item.effort) : item.priority;
}

/** Whether a sized task is extra large for too little value. */
export function isNotWorthIt(item: BacklogItem): boolean {
  return isSized(item) && notWorthIt(item.value, item.effort);
}

/** The day after an ISO date, as an ISO date. */
export function nextDay(day: IsoDate): IsoDate {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Which band a scheduled date falls in. A date already past counts as
 * today: the work did not happen, so it is still today's to do. See
 * `isCarriedOver` for the mark it carries.
 */
export function bandOf(
  scheduledFor: IsoDate | undefined,
  today: IsoDate,
): Band {
  if (scheduledFor === undefined) return "unscheduled";
  if (scheduledFor <= today) return "today";
  if (scheduledFor === nextDay(today)) return "tomorrow";
  return "future";
}

/** Whether a task was scheduled for a day already past and is still open. */
export function isCarriedOver(item: BacklogItem, today: IsoDate): boolean {
  return (
    item.scheduledFor !== undefined &&
    item.scheduledFor < today &&
    item.state !== "done"
  );
}

const priorityRank: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

/**
 * The order tasks are read in within one client's block: open work by
 * priority, then anything not worth doing, then what is done. Done work
 * sinks so the eye lands on what is left; ties keep their given order.
 */
export function orderTasks(items: readonly BacklogItem[]): BacklogItem[] {
  const rank = (item: BacklogItem) => {
    if (item.state === "done") return 4;
    if (isNotWorthIt(item)) return 3;
    return priorityRank[priorityOf(item)];
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => item);
}

/**
 * Whether the map draws an item: work in progress or in review, or work
 * planned for a day and not yet done. Unscheduled backlog and done work stay
 * in the data, for lists and the day plan, but never reach the map.
 */
export function isOnMap(item: BacklogItem): boolean {
  if (item.state === "done") return false;
  if (item.state === "doing" || item.state === "review") return true;
  return item.scheduledFor !== undefined;
}

/**
 * Open work, most urgent first: by the priority a task is shown with (high,
 * normal, low), then by the day it is planned for, earliest first, with
 * unscheduled work last. Done work is left out; ties keep their given
 * order. The map uses it to pick which items a workstream draws.
 */
export function orderByUrgency(items: readonly BacklogItem[]): BacklogItem[] {
  const day = (item: BacklogItem) => item.scheduledFor ?? "9999-12-31";
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.state !== "done")
    .sort(
      (a, b) =>
        priorityRank[priorityOf(a.item)] - priorityRank[priorityOf(b.item)] ||
        day(a.item).localeCompare(day(b.item)) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}

export interface ClientDay {
  clientId: string;
  items: BacklogItem[];
}

export interface BandDay {
  band: Band;
  clients: ClientDay[];
}

/**
 * Tasks grouped by band, then by client with home first and the rest in
 * the order given, each client's tasks in `orderTasks` order. A band or a
 * client with nothing in it is left out.
 */
export function arrangeDay(
  items: readonly BacklogItem[],
  clients: readonly Client[],
  today: IsoDate,
): BandDay[] {
  const clientOrder = [
    ...clients.filter((client) => client.home === true),
    ...clients.filter((client) => client.home !== true),
  ].map((client) => client.id);
  const position = (clientId: string) => {
    const index = clientOrder.indexOf(clientId);
    return index === -1 ? clientOrder.length : index;
  };
  const bandFor = (item: BacklogItem): Band =>
    item.state === "done" && item.doneOn !== undefined
      ? bandOf(item.doneOn, today)
      : bandOf(item.scheduledFor, today);

  const result: BandDay[] = [];
  for (const band of ["today", "tomorrow", "future", "unscheduled"] as const) {
    const inBand = items.filter((item) => bandFor(item) === band);
    if (inBand.length === 0) continue;
    const clientIds = [...new Set(inBand.map((item) => item.clientId))].sort(
      (a, b) => position(a) - position(b),
    );
    result.push({
      band,
      clients: clientIds.map((clientId) => ({
        clientId,
        items: orderTasks(inBand.filter((item) => item.clientId === clientId)),
      })),
    });
  }
  return result;
}
