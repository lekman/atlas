import { useId, useState } from "react";

import { EFFORTS, VALUES, VALUE_TEXT, type WorkItem } from "../worklist/model";

export interface AssessChange {
  value?: string | null;
  effort?: string | null;
  due?: string | null;
}

export interface AssessFormProps {
  item: WorkItem;
  /** Saves what changed; nothing when nothing did. */
  onSave: (change: AssessChange) => void;
  onCancel: () => void;
  /** Saving needs the local server; without it the form says so and can't save. */
  canSave: boolean;
}

/**
 * A task's business value, effort and due date. Value against effort is
 * its quadrant; a due date within seven days makes it urgent.
 */
export function AssessForm({
  item,
  onSave,
  onCancel,
  canSave,
}: AssessFormProps) {
  const [value, setValue] = useState(item.value ?? "");
  const [effort, setEffort] = useState<string>(item.effort ?? "");
  const [due, setDue] = useState(item.due ?? "");
  const id = useId();

  const save = () => {
    const change: AssessChange = {};
    if ((value || null) !== (item.value ?? null)) change.value = value || null;
    if ((effort || null) !== (item.effort ?? null))
      change.effort = effort || null;
    if ((due || null) !== (item.due ?? null)) change.due = due || null;
    if (Object.keys(change).length) onSave(change);
    else onCancel();
  };

  return (
    <div
      className="assess"
      role="group"
      aria-label="Value, effort and due date"
    >
      <div className="arow">
        <select
          aria-label="Business value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">not set</option>
          {VALUES.map((v) => (
            <option key={v} value={v}>
              {VALUE_TEXT[v]} value
            </option>
          ))}
        </select>
        <select
          aria-label="Effort"
          value={effort}
          onChange={(e) => setEffort(e.target.value)}
        >
          <option value="">not set</option>
          {EFFORTS.map((e) => (
            <option key={e} value={e}>
              {e} effort
            </option>
          ))}
        </select>
      </div>
      <div className="arow">
        <label htmlFor={`${id}-due`}>Due</label>
        <input
          id={`${id}-due`}
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <button type="button" className="lnk" onClick={() => setDue("")}>
          No due date
        </button>
      </div>
      <div className="sub">
        Medium value or more is important. Due within 7 days is urgent. Both
        together is Q1.
      </div>
      {!canSave && (
        <div className="sub">
          Changing this needs the Claude desktop app on your Mac.
        </div>
      )}
      <div className="arow">
        <button
          type="button"
          className="pri-btn"
          disabled={!canSave}
          onClick={save}
        >
          Save
        </button>
        <button type="button" className="lnk" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
