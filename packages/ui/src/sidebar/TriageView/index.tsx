import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { Icon } from "../Icon";
import {
  byPriority,
  EFFORTS,
  VALUES,
  VALUE_TEXT,
  whenOf,
  type Sizing,
  type WorkItem,
} from "../worklist/model";

export interface TriageGrade {
  ref: string;
  value: string;
  effort: string;
}

export interface TriageViewProps {
  /** The ungraded database tasks to grade. */
  items: readonly WorkItem[];
  /** Suggested grades, by task id without `db:`. */
  sizing: Readonly<Record<string, Sizing>>;
  clientOf: (key: string) => { name: string; colour: string };
  /** Clients in the order their tasks list. */
  clientOrder: readonly string[];
  today: string;
  onSave: (grades: TriageGrade[]) => void;
  /** Saving now. */
  busy: boolean;
  /** What happened last, in words. */
  note?: string | null;
  onClose: () => void;
}

interface Choice {
  value: string;
  effort: string;
  checked: boolean;
  /** The operator ticked or unticked it, so a full grade no longer ticks it. */
  touched: boolean;
}

/**
 * Grade ungraded tasks: business value and effort for each, from Claude's
 * suggestions where there are any. Suggested tasks come first and start
 * ticked unless flagged; choosing both value and effort ticks a task. Only
 * ticked tasks with both are saved.
 */
export function TriageView({
  items,
  sizing,
  clientOf,
  clientOrder,
  today,
  onSave,
  busy,
  note,
  onClose,
}: TriageViewProps) {
  const title = useId();
  const back = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      from?.focus?.();
    };
  }, []);

  const suggest = (t: WorkItem) => sizing[String(t.ref).slice(3)] ?? null;
  const rows = [...items].sort(
    (a, b) =>
      Number(Boolean(suggest(b))) - Number(Boolean(suggest(a))) ||
      clientOrder.indexOf(a.customer) - clientOrder.indexOf(b.customer) ||
      byPriority(a, b),
  );
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const choiceOf = (t: WorkItem): Choice => {
    const s = suggest(t);
    return (
      choices[t.ref!] ?? {
        value: s?.value ?? "",
        effort: s?.effort ?? "",
        checked: Boolean(s && !s.flag),
        touched: false,
      }
    );
  };
  const change = (t: WorkItem, part: Partial<Choice>) => {
    const was = choiceOf(t);
    const next = { ...was, ...part };
    if (!next.touched && next.value && next.effort) next.checked = true;
    setChoices({ ...choices, [t.ref!]: next });
  };
  const ready = rows.filter((t) => {
    const c = choiceOf(t);
    return c.checked && c.value && c.effort;
  });
  const incomplete = rows.filter((t) => {
    const c = choiceOf(t);
    return c.checked && !(c.value && c.effort);
  }).length;

  return (
    <div
      className="detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title}
    >
      <div className="inner">
        <div className="dbar">
          <button
            ref={back}
            type="button"
            className="dback"
            aria-label="Back to Atlas"
            onClick={onClose}
          >
            <Icon name="back" />
            <span aria-hidden="true">Back</span>
          </button>
          <div className="dt">
            <h2 id={title}>Triage {items.length} ungraded</h2>
            <div className="sub">
              Business value against effort decides each task's quadrant.
            </div>
          </div>
        </div>
        <div className="triage">
          {note && (
            <div className="note" role="status">
              {note}
            </div>
          )}
          {!rows.length && (
            <div className="blank">Nothing left to grade here.</div>
          )}
          {rows.map((t) => {
            const s = suggest(t);
            const c = choiceOf(t);
            const client = clientOf(t.customer);
            return (
              <div key={t.ref} className="tr1">
                <input
                  type="checkbox"
                  aria-label={`Save the grade for ${t.title}`}
                  checked={c.checked}
                  onChange={(e) =>
                    change(t, { checked: e.target.checked, touched: true })
                  }
                />
                <div>
                  <div className="ti">{t.title}</div>
                  <div className="sub">
                    <span
                      className="cust"
                      style={{ "--c": client.colour } as CSSProperties}
                    >
                      {client.name}
                    </span>
                    {t.key && <span className="key">{t.key}</span>}
                    <span className="tag when">{whenOf(t, today)}</span>
                    {s?.flag && (
                      <span
                        className="tag crit"
                        title="Suggested to check before grading"
                      >
                        {s.flag}
                      </span>
                    )}
                    {!s && <span>no suggestion</span>}
                  </div>
                  <div className="sel">
                    <select
                      aria-label={`Business value for ${t.title}`}
                      value={c.value}
                      onChange={(e) => change(t, { value: e.target.value })}
                    >
                      <option value="">–</option>
                      {VALUES.map((v) => (
                        <option key={v} value={v}>
                          {VALUE_TEXT[v]} value
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Effort for ${t.title}`}
                      value={c.effort}
                      onChange={(e) => change(t, { effort: e.target.value })}
                    >
                      <option value="">–</option>
                      {EFFORTS.map((e) => (
                        <option key={e} value={e}>
                          {e} effort
                        </option>
                      ))}
                    </select>
                  </div>
                  {s?.reason && <div className="why">{s.reason}</div>}
                </div>
              </div>
            );
          })}
          {rows.length > 0 && (
            <div className="tbar">
              <button
                type="button"
                className="pri-btn"
                disabled={!ready.length || busy}
                onClick={() => {
                  onSave(
                    ready.map((t) => ({
                      ref: t.ref!,
                      value: choiceOf(t).value,
                      effort: choiceOf(t).effort,
                    })),
                  );
                  setChoices(
                    Object.fromEntries(
                      Object.entries(choices).filter(
                        ([ref]) => !ready.some((t) => t.ref === ref),
                      ),
                    ),
                  );
                }}
              >
                Save {ready.length} grade{ready.length === 1 ? "" : "s"}
              </button>
              <span className="sub">
                {incomplete || "No"} checked without both value and effort
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
