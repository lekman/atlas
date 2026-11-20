import { useId, useState } from "react";

import { VALUE_TEXT, type WorkItem } from "../../sidebar/worklist/model";
import { EFFORT_CHOICES, VALUE_CHOICES } from "../TaskDetail";

/** One task to grade, with Commander's suggestion for it. */
export interface TriageRow {
  task: WorkItem;
  value: string;
  effort: string;
  why?: string;
}

/** A grade to save: the task's ref, its value and its effort. */
export interface TriageGrade {
  ref: string;
  value: string;
  effort: string;
}

export interface TriagePanelProps {
  rows: readonly TriageRow[];
  systemName(system: string): string;
  /** Saves the ticked grades; the pane closes once they are saved. */
  onSave(grades: TriageGrade[]): void;
  onCancel(): void;
  /** The grades are on their way: everything waits. */
  saving?: boolean;
  /** Why the last save failed, in words. */
  failed?: string | null;
}

const valueWords = (v: string) =>
  `${VALUE_TEXT[v] ?? v} value`.replace(/^./, (c) => c.toUpperCase());

/**
 * Triage: Commander's suggested value and effort for each ungraded task,
 * with the reason it gave. Each row can be changed or left out; Save
 * grades the ticked rows in one call and the pane closes.
 */
export function TriagePanel({
  rows,
  systemName,
  onSave,
  onCancel,
  saving = false,
  failed = null,
}: TriagePanelProps) {
  const name = useId();
  const [choices, setChoices] = useState<
    Record<string, { value: string; effort: string; on: boolean }>
  >(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.task.ref!,
        { value: r.value, effort: r.effort, on: true },
      ]),
    ),
  );
  const choiceOf = (ref: string) =>
    choices[ref] ?? { value: "", effort: "", on: false };
  const change = (
    ref: string,
    part: Partial<{ value: string; effort: string; on: boolean }>,
  ) => setChoices({ ...choices, [ref]: { ...choiceOf(ref), ...part } });
  const ticked = rows.filter((r) => {
    const c = choiceOf(r.task.ref!);
    return c.on && c.value && c.effort;
  });

  return (
    <article
      className="console-detail console-triage-panel"
      aria-labelledby={`${name}-title`}
      aria-busy={saving || undefined}
    >
      <header className="console-detail-head">
        <h2 id={`${name}-title`}>Triage</h2>
      </header>
      <div className="console-detail-section">
        <p className="console-note">
          Commander suggested a value and an effort for{" "}
          {rows.length === 1 ? "one task" : `${rows.length} tasks`}. Change any,
          untick those to leave ungraded, then save.
        </p>
        <ul className="console-triage-rows">
          {rows.map((r) => {
            const ref = r.task.ref!;
            const c = choiceOf(ref);
            return (
              <li
                key={ref}
                className="console-triage-row"
                data-off={!c.on || undefined}
              >
                <label className="console-triage-title">
                  <input
                    type="checkbox"
                    checked={c.on}
                    disabled={saving}
                    onChange={(e) => change(ref, { on: e.target.checked })}
                  />
                  <span>{r.task.title}</span>
                </label>
                <span className="console-task-meta">
                  <span className="console-task-fact">
                    {systemName(r.task.customer)}
                  </span>
                  {r.task.key ? (
                    <span className="console-task-fact">{r.task.key}</span>
                  ) : null}
                </span>
                <span className="console-grade-picks">
                  <select
                    className="console-state"
                    aria-label={`Value for ${r.task.title}`}
                    data-state="set"
                    value={c.value}
                    disabled={saving || !c.on}
                    onChange={(e) => change(ref, { value: e.target.value })}
                  >
                    {VALUE_CHOICES.map((v) => (
                      <option key={v} value={v}>
                        {valueWords(v)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="console-state"
                    aria-label={`Effort for ${r.task.title}`}
                    data-state="set"
                    value={c.effort}
                    disabled={saving || !c.on}
                    onChange={(e) => change(ref, { effort: e.target.value })}
                  >
                    {EFFORT_CHOICES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </span>
                {r.why ? <p className="console-triage-why">{r.why}</p> : null}
              </li>
            );
          })}
        </ul>
        <div
          className="console-detail-actions console-beam-actions"
          role="group"
          aria-label="Triage actions"
        >
          <button
            type="button"
            className="console-primary"
            aria-disabled={saving || !ticked.length || undefined}
            onClick={() =>
              !saving &&
              ticked.length &&
              onSave(
                ticked.map((r) => ({
                  ref: r.task.ref!,
                  value: choiceOf(r.task.ref!).value,
                  effort: choiceOf(r.task.ref!).effort,
                })),
              )
            }
          >
            {saving ? "Saving…" : `Save ${ticked.length}`}
          </button>
          <button
            type="button"
            className="console-secondary"
            aria-disabled={saving || undefined}
            onClick={() => !saving && onCancel()}
          >
            Cancel
          </button>
        </div>
        {failed ? (
          <p className="console-beam-status" data-tone="bad" role="status">
            {failed}
          </p>
        ) : null}
      </div>
    </article>
  );
}
