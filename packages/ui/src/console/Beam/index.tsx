import { useId, useState } from "react";

import type { AskAnswer } from "../../sidebar/AskForm";
import { formatAgo } from "../../sidebar/format";
import {
  answerOptions,
  askKey,
  askText,
  waitingSource,
  type WaitingItem,
} from "../../sidebar/waiting/model";
import { ConsoleMenu } from "../ConsoleMenu";
import { SectionHeading } from "../SectionHeading";

/** One ask on the beam, with the client it belongs to, if any. */
export interface BeamRow {
  item: WaitingItem;
  /** The client key, or null when the ask names none. */
  client: string | null;
}

/** An ask's key for selection: its task ref or `ask:<kind>:<id>`, else its words. */
export const beamKey = (item: WaitingItem): string =>
  askKey(item) ?? `ask:${item.kind}:${item.ask ?? ""}`;

const whoAsks = (item: WaitingItem) =>
  (item.kind === "commander" || item.kind === "atlas") && item.worker
    ? item.worker
    : item.kind === "task"
      ? "The task's owner"
      : "Commander";

export interface BeamListProps {
  /** What waits on the operator, or null before the host answered. */
  rows: readonly BeamRow[] | null;
  /** Why the asks could not all be read, in words. */
  notes?: readonly string[];
  operator: string;
  systemName(client: string): string;
  clientOrder: readonly string[];
  scope: string | null;
  onScope?(): void;
  selectedKey: string | null;
  onSelect(item: WaitingItem): void;
  /** What happened to the last answer to an ask, in a few words, if one was sent. */
  answered?(item: WaitingItem): string | null;
  /** The words in the search box. */
  query?: string;
  onQuery?(query: string): void;
  /** Whether asks already answered or dismissed show too. */
  showAnswered?: boolean;
  onShowAnswered?(show: boolean): void;
  now: Date;
}

/** Whether an ask matches the search words: every word in its question, asker, task or system. */
export function matchesAsk(
  row: BeamRow,
  query: string,
  operator: string,
  systemName: string,
): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = [
    askText(row.item, operator).ask,
    row.item.worker,
    row.item.title,
    systemName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
}

/**
 * Beam: the approvals and questions that wait on the operator, from
 * Commander, its workers and the tasks, grouped by system with the oldest
 * first. Asks already answered or dismissed are hidden until the filter
 * shows them; the search matches the question, the asker and the task. Opening one shows the answer form beside the list, or over it on
 * a phone.
 */
export function BeamList({
  rows,
  notes = [],
  operator,
  systemName,
  clientOrder,
  scope,
  onScope,
  selectedKey,
  onSelect,
  answered = () => null,
  query = "",
  onQuery = () => {},
  showAnswered = false,
  onShowAnswered = () => {},
  now,
}: BeamListProps) {
  const inScope = (rows ?? []).filter(
    (r) => !scope || r.client === scope || r.client === null,
  );
  const answeredCount = inScope.filter((r) => answered(r.item)).length;
  const shown = inScope.filter(
    (r) =>
      (showAnswered || !answered(r.item)) &&
      matchesAsk(r, query, operator, r.client ? systemName(r.client) : "Other"),
  );
  const hidden = inScope.length - shown.length;
  const groups = new Map<string, BeamRow[]>();
  for (const r of shown) {
    const key = r.client ?? "";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const rank = (c: string) => {
    const i = clientOrder.indexOf(c);
    return c === "" ? clientOrder.length + 1 : i < 0 ? clientOrder.length : i;
  };
  const ordered = [...groups.entries()].sort(
    ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b),
  );
  const since = (r: BeamRow) => Date.parse(r.item.since ?? "") || 0;

  return (
    <div className="console-beam">
      <SectionHeading
        title="Beam"
        scope={scope ? systemName(scope) : null}
        {...(onScope ? { onScope } : {})}
      />
      {notes.map((n) => (
        <p key={n} className="console-request" role="status">
          {n}
        </p>
      ))}
      <div className="console-search">
        <input
          type="search"
          className="console-search-input"
          aria-label="Search asks"
          placeholder="Search asks"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
        <ConsoleMenu
          label="Filter"
          name="the asks"
          items={[
            {
              label: `Show answered (${answeredCount})`,
              checked: showAnswered,
              hint: "Asks you answered or dismissed, until Commander closes them",
              onSelect: () => onShowAnswered(!showAnswered),
            },
          ]}
        />
      </div>
      {hidden > 0 && rows !== null ? (
        <p className="console-hidden-note">
          {hidden} hidden by the search or the filter
        </p>
      ) : null}
      {rows === null ? (
        <p className="console-empty">Reading what waits on you…</p>
      ) : shown.length === 0 ? (
        <p className="console-empty">
          {inScope.length ? "No ask matches." : "Nothing waits on you."}
        </p>
      ) : (
        ordered.map(([client, list]) => (
          <section
            key={client || "other"}
            className="console-group"
            aria-label={client ? systemName(client) : "Other"}
          >
            <h2 className="console-group-title">
              <span>{client ? systemName(client) : "Other"}</span>
              <span className="console-group-count">{list.length}</span>
            </h2>
            <ul className="console-tasks">
              {[...list]
                .sort((a, b) => since(a) - since(b))
                .map((r) => {
                  const key = beamKey(r.item);
                  const sent = answered(r.item);
                  return (
                    <li
                      key={key}
                      className="console-task console-beam-ask"
                      data-selected={key === selectedKey || undefined}
                    >
                      <button
                        type="button"
                        className="console-task-open"
                        aria-current={key === selectedKey ? "true" : undefined}
                        onClick={() => onSelect(r.item)}
                      >
                        <span className="console-task-title">
                          {askText(r.item, operator).ask}
                        </span>
                        <span className="console-task-meta">
                          <span className="console-task-fact">
                            {whoAsks(r.item)}
                          </span>
                          {r.item.since ? (
                            <span className="console-task-fact">
                              waiting {formatAgo(new Date(r.item.since), now)}
                            </span>
                          ) : null}
                          {r.item.kind === "task" && r.item.title ? (
                            <span
                              className="console-task-fact console-clip"
                              title={r.item.title}
                            >
                              {r.item.title}
                            </span>
                          ) : null}
                          {sent ? (
                            <span className="console-badge" data-tone="moving">
                              {sent}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

export interface BeamDetailProps {
  item: WaitingItem;
  /** The client's name, or "Other". */
  clientName: string;
  operator: string;
  /** An answer is on its way: the buttons wait, and nothing else changes. */
  pending?: boolean;
  /** Why the last answer could not be sent, in words. */
  failed?: string | null;
  onSend(answer: AskAnswer): void;
  onDismiss?(): void;
  onCopy?(): void;
  /** Opens the task the ask is about, for a task's ask. */
  onOpenTask?(): void;
  now: Date;
}

const OTHER = "\u0000other";

/**
 * One ask in full, and its answer form: the asker's options (the
 * recommended one marked), or Other in your own words, with an optional
 * note. Send, Dismiss and Copy reference sit in one row, as the task
 * detail's actions do. Sending or dismissing changes nothing on screen but
 * the buttons, which wait until Commander has the answer; the list then
 * comes back. The answer goes to whoever asked; it approves nothing by
 * itself.
 */
export function BeamDetail({
  item,
  clientName,
  operator,
  pending = false,
  failed = null,
  onSend,
  onDismiss,
  onCopy,
  onOpenTask,
  now,
}: BeamDetailProps) {
  const name = useId();
  const ask = askText(item, operator).ask;
  const options = answerOptions(item, ask);
  const [choice, setChoice] = useState<string | null>(
    options.length ? null : OTHER,
  );
  const [text, setText] = useState("");
  const parts = item.parts && item.parts.length > 1 ? item.parts : null;
  // A question of several parts: one choice (or own words) per part, by its question text.
  const [partChoice, setPartChoice] = useState<Record<string, string>>({});
  const [partWords, setPartWords] = useState<Record<string, string>>({});
  const partAnswer = (question: string) =>
    partChoice[question] === OTHER
      ? (partWords[question] ?? "").trim()
      : (partChoice[question] ?? "");
  const other = choice === OTHER;
  const ready = parts
    ? parts.every((p) => Boolean(partAnswer(p.question)))
    : other
      ? Boolean(text.trim())
      : choice !== null;
  const from = whoAsks(item);
  const source = waitingSource(item, clientName).filter(
    (part) => part !== "Commander asks",
  );
  const send = () => {
    if (!ready || pending) return;
    if (parts) {
      onSend({
        answers: Object.fromEntries(
          parts.map((p) => [p.question, partAnswer(p.question).slice(0, 1000)]),
        ),
        ...(text.trim() ? { text: text.trim().slice(0, 2000) } : {}),
      });
      return;
    }
    const picked = options.find((o) => o.label === choice);
    onSend({
      ...(other ? {} : { choice: choice! }),
      ...(picked?.always ? { always: true } : {}),
      ...(text.trim() ? { text: text.trim().slice(0, 2000) } : {}),
    });
  };

  return (
    <article
      className="console-detail console-beam-detail"
      aria-labelledby={`${name}-title`}
    >
      <header className="console-detail-head">
        <h2 id={`${name}-title`}>{from} asks</h2>
      </header>
      <p className="console-beam-source">
        {[
          ...source,
          ...(item.since
            ? [`waiting ${formatAgo(new Date(item.since), now)}`]
            : []),
        ].join(" · ")}
      </p>
      <p className="console-beam-ask-text">{ask}</p>
      {item.detail ? (
        <p className="console-beam-context">{item.detail}</p>
      ) : null}
      {item.reason ? (
        <p className="console-beam-context">{item.reason}</p>
      ) : null}
      {item.kind === "task" && onOpenTask ? (
        <button
          type="button"
          className="console-read-more"
          onClick={onOpenTask}
        >
          Open the task
        </button>
      ) : null}

      <form
        className="console-beam-form"
        aria-label={`Answer ${from}`}
        aria-busy={pending || undefined}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {parts
          ? parts.map((p, n) => (
              <fieldset
                key={p.question}
                className="console-beam-choices"
                disabled={pending}
              >
                <legend className="console-label">
                  {`${n + 1} of ${parts.length}${p.header ? ` · ${p.header}` : ""}`}
                </legend>
                <p className="console-beam-part">{p.question}</p>
                <div className="console-choices">
                  {[...p.options, { label: OTHER }].map((o) => {
                    const own = o.label === OTHER;
                    return (
                      <label key={o.label} className="console-choice">
                        <input
                          type="radio"
                          name={`${name}-${n}`}
                          checked={partChoice[p.question] === o.label}
                          onChange={() =>
                            setPartChoice({
                              ...partChoice,
                              [p.question]: o.label,
                            })
                          }
                        />
                        <span>
                          <strong>
                            {own ? "Other" : o.label}
                            {"recommended" in o && o.recommended
                              ? " (Recommended)"
                              : ""}
                          </strong>
                          {own ? (
                            partChoice[p.question] === OTHER ? (
                              <input
                                type="text"
                                className="console-beam-own"
                                aria-label={`Your words for part ${n + 1}`}
                                maxLength={1000}
                                value={partWords[p.question] ?? ""}
                                onChange={(e) =>
                                  setPartWords({
                                    ...partWords,
                                    [p.question]: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <em>Answer in your own words.</em>
                            )
                          ) : "description" in o && o.description ? (
                            <em>{o.description}</em>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))
          : null}
        <fieldset className="console-beam-choices" disabled={pending}>
          {parts ? null : (
            <legend className="console-label">Your answer</legend>
          )}
          {parts ? null : (
            <div className="console-choices">
              {options.map((o) => (
                <label key={o.label} className="console-choice">
                  <input
                    type="radio"
                    name={name}
                    checked={choice === o.label}
                    onChange={() => setChoice(o.label)}
                  />
                  <span>
                    <strong>
                      {o.label}
                      {o.recommended ? " (Recommended)" : ""}
                    </strong>
                    {o.description ? <em>{o.description}</em> : null}
                  </span>
                </label>
              ))}
              {options.length ? (
                <label className="console-choice">
                  <input
                    type="radio"
                    name={name}
                    checked={other}
                    onChange={() => setChoice(OTHER)}
                  />
                  <span>
                    <strong>Other</strong>
                    <em>Answer in your own words.</em>
                  </span>
                </label>
              ) : null}
            </div>
          )}
          <label className="console-beam-note">
            <span className="console-visually-hidden">
              {other ? "Your words" : "A note with your answer"}
            </span>
            <textarea
              rows={3}
              value={text}
              maxLength={2000}
              placeholder={
                other ? "In your own words" : "Add a note (optional)"
              }
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        </fieldset>
        <div
          className="console-detail-actions console-beam-actions"
          role="group"
          aria-label="Answer actions"
        >
          <button
            type="submit"
            className="console-primary"
            aria-disabled={!ready || pending || undefined}
          >
            Send
          </button>
          {onDismiss ? (
            <button
              type="button"
              className="console-secondary"
              aria-disabled={pending || undefined}
              title="Remove the ask as redundant"
              onClick={() => !pending && onDismiss()}
            >
              Dismiss
            </button>
          ) : null}
          {onCopy ? (
            <button
              type="button"
              className="console-secondary"
              onClick={onCopy}
            >
              Copy reference
            </button>
          ) : null}
        </div>
        {failed ? (
          <p className="console-beam-status" data-tone="bad" role="alert">
            {failed}
          </p>
        ) : null}
      </form>
    </article>
  );
}
