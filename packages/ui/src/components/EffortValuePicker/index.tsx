import {
  effortWeights,
  efforts,
  notWorthIt,
  priorityFrom,
  taskValues,
  type Effort,
  type TaskValue,
} from "@atlas/core";
import { useId, useState } from "react";

import { PriorityMark, priorityNames } from "../DayList";

export interface EffortValuePickerProps {
  /** The effort the task has now, if it has been sized. */
  initialEffort?: Effort;
  /** The value the task has now, if it has been sized. */
  initialValue?: TaskValue;
  /** A size was chosen. Either half may still be missing. */
  onChange(size: { effort?: Effort; value?: TaskValue }): void;
}

const effortWords: Record<Effort, string> = {
  XS: "Extra small",
  S: "Small",
  M: "Medium",
  L: "Large",
  XL: "Extra large",
};

/**
 * Two rows of choices, effort in T-shirt sizes and value from 1 to 13, with
 * the priority they make shown as soon as both are set. Extra large work
 * for a value of 3 or less is flagged "Not worth it" whatever the ratio.
 *
 * Native radio buttons under the drawn segments, so arrow keys move within
 * a row and a screen reader hears "XL, radio button, 5 of 5". Each segment
 * is 32 pixels high, above the 24-pixel target size of WCAG 2.2.
 */
export function EffortValuePicker({
  initialEffort,
  initialValue,
  onChange,
}: EffortValuePickerProps) {
  const name = useId();
  const [effort, setEffort] = useState(initialEffort);
  const [value, setValue] = useState(initialValue);
  const priority =
    effort && value !== undefined ? priorityFrom(value, effort) : undefined;
  const wasted =
    effort !== undefined && value !== undefined && notWorthIt(value, effort);

  return (
    <div className="atlas-picker">
      <fieldset className="atlas-segments">
        <legend className="atlas-section-title">Effort</legend>
        <div className="atlas-segment-row">
          {efforts.map((size) => (
            <label
              key={size}
              className="atlas-segment"
              title={effortWords[size]}
            >
              <input
                type="radio"
                name={`${name}-effort`}
                value={size}
                checked={effort === size}
                onChange={() => {
                  setEffort(size);
                  onChange({ effort: size, value });
                }}
              />
              <span>{size}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="atlas-segments">
        <legend className="atlas-section-title">Value</legend>
        <div className="atlas-segment-row">
          {taskValues.map((points) => (
            <label key={points} className="atlas-segment">
              <input
                type="radio"
                name={`${name}-value`}
                value={points}
                checked={value === points}
                onChange={() => {
                  setValue(points);
                  onChange({ effort, value: points });
                }}
              />
              <span>{points}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="atlas-picker-result" role="status">
        {priority && effort && value !== undefined ? (
          <>
            <p className="atlas-picker-priority">
              <PriorityMark priority={priority} />
              <strong>{priorityNames[priority]}</strong>
              <span className="atlas-mute">
                {" "}
                · value {value} ÷ {effort} weight {effortWeights[effort]} ={" "}
                {formatRatio(value / effortWeights[effort])}
              </span>
            </p>
            {wasted && (
              <p className="atlas-not-worth-it">
                <strong>Not worth it:</strong> extra large effort for a value of{" "}
                {value}. Drop it or split it.
              </p>
            )}
          </>
        ) : (
          <p className="atlas-mute">
            Choose an effort and a value to see the priority.
          </p>
        )}
      </div>
    </div>
  );
}

function formatRatio(ratio: number): string {
  return Number.isInteger(ratio)
    ? String(ratio)
    : ratio.toFixed(2).replace(/0$/, "");
}
