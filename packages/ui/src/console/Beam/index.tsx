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
  item.kind === "commander" && item.worker
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
  now: Date;
}

/**
 * Beam: the approvals and questions that wait on the operator, from
 * Commander, its workers and the tasks, grouped by system with the oldest
 * first. Opening one shows the answer form beside the list, or over it on
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
  now,
}: BeamListProps) {
  const shown = (rows ?? []).filter(
    (r) => !scope || r.client === scope || r.client === null,
  );
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
      {rows === null ? (
        <p className="console-empty">Reading what waits on you…</p>
      ) : shown.length === 0 ? (
        <p className="console-empty">Nothing waits on you.</p>
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
  /** What happened to the last answer sent, if one was. */
  status?: { text: string; tone: "ok" | "warn" | "bad" } | null;
  /** The last answer sent: when, and what. */
  sent?: { at: string; answer: AskAnswer } | null;
  busy?: boolean;
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
 * note. The answer goes to whoever asked; it approves nothing by itself.
 * Dismiss removes an ask that no longer matters, after a confirm.
 */
export function BeamDetail({
  item,
  clientName,
  operator,
  status = null,
  sent = null,
  busy = false,
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
  const [confirming, setConfirming] = useState(false);
  const other = choice === OTHER;
  const ready = other ? Boolean(text.trim()) : choice !== null;
  const from = whoAsks(item);
  const source = waitingSource(item, clientName).filter(
    (part) => part !== "Commander asks",
  );

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

      {sent ? (
        <section
          className="console-scope console-beam-sent"
          aria-label="Your last answer"
        >
          <h3 className="console-label">
            You answered {formatAgo(new Date(sent.at), now)}
          </h3>
          {sent.answer.choice ? <strong>{sent.answer.choice}</strong> : null}
          {sent.answer.text ? <p>{sent.answer.text}</p> : null}
          {status ? (
            <p
              className="console-beam-status"
              data-tone={status.tone}
              role="status"
            >
              {status.text}
            </p>
          ) : null}
        </section>
      ) : null}

      <form
        className="console-beam-form"
        aria-label={`Answer ${from}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready || busy) return;
          const picked = options.find((o) => o.label === choice);
          onSend({
            ...(other ? {} : { choice: choice! }),
            ...(picked?.always ? { always: true } : {}),
            ...(text.trim() ? { text: text.trim().slice(0, 2000) } : {}),
          });
        }}
      >
        <fieldset className="console-settings-group">
          <legend className="console-label">Your answer</legend>
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
        </fieldset>
        <label className="console-beam-note">
          <span className="console-label">
            {other ? "Your answer" : "Add a note (optional)"}
          </span>
          <textarea
            rows={3}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="console-beam-actions">
          <button
            type="submit"
            className="console-primary"
            disabled={!ready || busy}
          >
            {busy
              ? "Sending…"
              : sent
                ? `Send again to ${from}`
                : `Send to ${from}`}
          </button>
          {status && !sent ? (
            <span
              className="console-beam-status"
              data-tone={status.tone}
              role="status"
            >
              {status.text}
            </span>
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
          {onDismiss ? (
            confirming ? (
              <>
                <button
                  type="button"
                  className="console-secondary console-beam-dismiss"
                  onClick={() => {
                    setConfirming(false);
                    onDismiss();
                  }}
                >
                  Yes, dismiss it
                </button>
                <button
                  type="button"
                  className="console-secondary"
                  onClick={() => setConfirming(false)}
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                className="console-secondary"
                onClick={() => setConfirming(true)}
              >
                Dismiss as redundant
              </button>
            )
          ) : null}
        </div>
      </form>
    </article>
  );
}
