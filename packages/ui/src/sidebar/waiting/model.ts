/**
 * What waits on the operator, as the local server's `waiting_on_you` tool
 * sends it: blocked tasks whose waitingFor starts with the operator's name,
 * Commander requests that ask the operator, and Commander's own questions.
 */
import { formatDay } from "../format";

export interface WaitingItem {
  kind: "task" | "commander" | "question";
  /** A task's reference, to open its details. */
  ref?: string;
  /** A task's client key. */
  customer?: string;
  /** The Commander worker that asks. */
  worker?: string;
  /** What is asked, as the source wrote it. */
  ask?: string;
  /** Context, shown as the tooltip. */
  reason?: string;
  /** A task's title. */
  title?: string;
  /** When it started waiting, ISO 8601. */
  since?: string;
}

/** The tool's answer, and the stored copy (`board/waiting`) with `storedAt`. */
export interface WaitingDoc {
  items: WaitingItem[];
  /** Sources that couldn't be read, each "<source>: <message>". */
  errors?: string[];
  storedAt?: string;
}

/** The sources that failed, by name, from `errors`. */
export function failedSources(errors: readonly string[] | undefined): string[] {
  return [
    ...new Set(
      (errors ?? []).map((e) => e.split(":")[0]!.trim()).filter(Boolean),
    ),
  ];
}

export function isWaitingDoc(value: unknown): value is WaitingDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { items?: unknown }).items)
  );
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The ask itself, and the tooltip. A task's waitingFor loses the leading
 * name ("Tobias: approve the budget" → "Approve the budget"). A Commander
 * summary keeps what follows "<name> to" or "<name>:", and the whole
 * summary moves to the tooltip.
 */
export function askText(
  item: WaitingItem,
  operator: string,
): { ask: string; tooltip: string } {
  const raw = String(item.ask ?? "");
  const name = escape(operator);
  const fromCommander =
    item.kind === "commander"
      ? new RegExp(`\\b${name}\\s*(?:to\\b|:)\\s*(.+)$`, "i").exec(raw)
      : null;
  const said = fromCommander
    ? fromCommander[1]!
    : raw.replace(new RegExp(`^\\s*(${name}|you)\\s*[:,–-]?\\s*`, "i"), "");
  return {
    ask: said.charAt(0).toUpperCase() + said.slice(1),
    tooltip: item.reason ?? (fromCommander ? raw : ""),
  };
}

/** The line under the ask: who asks, the task's title, since when. */
export function waitingSource(item: WaitingItem, clientName: string): string[] {
  const who =
    item.kind === "task"
      ? clientName
      : item.kind === "question"
        ? "Commander asks"
        : `Commander · ${item.worker || "worker"}`;
  const since = item.since ? new Date(item.since) : null;
  return [
    who,
    ...(item.kind === "task" && item.title ? [item.title] : []),
    ...(since && !Number.isNaN(since.getTime())
      ? [`since ${formatDay(since)}`]
      : []),
  ];
}
