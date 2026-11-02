/**
 * Monday items as the monday.com connector's get_board_items_page sends
 * them, read into the sidebar's rows. Which columns hold the status, the
 * priority and the key differ per board, so they are passed in.
 */
import { safeUrl } from "./model";

export interface MondayColumns {
  status: string;
  priority?: string;
  /** A column holding the item's number, shown as `<prefix>-<number>`. */
  key?: string;
}

export interface MondayItem {
  name: string;
  url: string | null;
  status: string;
  priority: string | null;
  key: string | null;
  group: string | null;
  updated: Date;
}

export interface MondayPage {
  items: MondayItem[];
  /** More than the first page exists. */
  more: boolean;
}

interface RawItem {
  name?: unknown;
  url?: unknown;
  updated_at?: unknown;
  group?: { title?: unknown } | null;
  column_values?: Record<string, unknown> | null;
}

const text = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Items not Done, from a page of the board. Anything unreadable becomes an empty page. */
export function mondayPage(
  payload: unknown,
  columns: MondayColumns,
  keyPrefix: string,
): MondayPage {
  const p = (payload ?? {}) as {
    items?: unknown;
    pagination?: { has_more?: unknown };
  };
  const raw = Array.isArray(p.items) ? (p.items as RawItem[]) : [];
  const items = raw
    .map((i) => {
      const cv = i.column_values ?? {};
      const number = columns.key ? text(cv[columns.key]) : null;
      return {
        name: text(i.name) ?? "(untitled)",
        url: safeUrl(i.url),
        status: text(cv[columns.status]) ?? "No status",
        priority: columns.priority ? text(cv[columns.priority]) : null,
        key: number ? `${keyPrefix}-${number}` : null,
        group: text(i.group?.title),
        updated: new Date(typeof i.updated_at === "string" ? i.updated_at : 0),
      };
    })
    .filter((i) => i.status !== "Done");
  return { items, more: Boolean(p.pagination?.has_more) };
}

/** Monday's default statuses, most urgent first; others follow as met. */
export const MONDAY_STATUS_ORDER = [
  "Stuck",
  "Working on it",
  "In Review",
  "Not started",
  "Postponed",
];

/** The statuses present, in Monday's order, then the board's own. */
export function mondayGroups(items: readonly MondayItem[]): string[] {
  const present = new Set(items.map((i) => i.status));
  return [
    ...MONDAY_STATUS_ORDER.filter((s) => present.has(s)),
    ...[...present].filter((s) => !MONDAY_STATUS_ORDER.includes(s)),
  ];
}

export const mondayStatusColour = (status: string): string =>
  status === "Stuck"
    ? "var(--bad)"
    : status === "Working on it"
      ? "var(--warn)"
      : "var(--muted)";
