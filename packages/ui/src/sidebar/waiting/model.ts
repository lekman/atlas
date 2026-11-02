/**
 * What waits on the operator, as the local server's `waiting_on_you` tool
 * sends it: blocked tasks whose waitingFor starts with the operator's name,
 * Commander requests that ask the operator, and Commander's own questions.
 */
import { formatDay } from "../format";

/** One answer the asker offers, as AskUserQuestion offers its options. */
export interface AskOption {
  label: string;
  /** What choosing it does. */
  description?: string;
  /** The asker's recommendation; listed first. */
  recommended?: boolean;
  /** The answer stands for all future asks like this one, not only this time. */
  always?: boolean;
}

export interface WaitingItem {
  kind: "task" | "commander" | "question";
  /** A task's reference, to open its details. */
  ref?: string;
  /** A Commander request's or question's id. */
  id?: string;
  /** The answers the asker offers, when it offered any. */
  options?: AskOption[];
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

/** At most four options the asker offered, trimmed, the recommended one first. */
export function askOptions(item: WaitingItem): AskOption[] {
  const seen = new Set<string>();
  const valid = (item.options ?? []).flatMap((o) => {
    const label =
      typeof o?.label === "string" ? o.label.trim().slice(0, 80) : "";
    if (!label || seen.has(label.toLowerCase())) return [];
    seen.add(label.toLowerCase());
    const description =
      typeof o.description === "string"
        ? o.description.trim().slice(0, 300)
        : "";
    return [
      {
        label,
        ...(description ? { description } : {}),
        ...(o.recommended === true ? { recommended: true } : {}),
      },
    ];
  });
  return [
    ...valid.filter((o) => o.recommended),
    ...valid.filter((o) => !o.recommended),
  ].slice(0, 4);
}

/** The key an answer to this ask is kept under: the task's ref, or the ask's own id. */
export function askKey(item: WaitingItem): string | null {
  if (item.kind === "task") return item.ref ?? null;
  return item.id ? `ask:${item.kind}:${item.id}` : null;
}

/**
 * The yes and no answers for a closed question the asker gave no options
 * for: once, or for all future asks like it.
 */
export const YES_NO_OPTIONS: readonly AskOption[] = [
  { label: "Yes, and for all future requests", always: true },
  { label: "Yes, once" },
  { label: "No, and for all future requests", always: true },
  { label: "No, once" },
];

const OPEN_QUESTION = /^\s*(which|what|who|whom|whose|when|where|why|how)\b/i;

/**
 * The options the answer form offers: the asker's own, or the yes and no
 * answers when it asked a closed question ("Restart the waiter?") without
 * any. An open question ("Which client…?") or a request for a name gets
 * none, so it is answered in your own words.
 */
export function answerOptions(item: WaitingItem, ask: string): AskOption[] {
  const own = askOptions(item);
  if (own.length) return own;
  const text = ask.trim();
  return text.endsWith("?") && !OPEN_QUESTION.test(text)
    ? [...YES_NO_OPTIONS]
    : [];
}
