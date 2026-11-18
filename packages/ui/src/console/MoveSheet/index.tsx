import { useEffect, useRef } from "react";

import type { WorkItem } from "../../sidebar/worklist/model";
import { rangeNames, type Range } from "../missions";

export interface MoveSheetProps {
  /** The task being moved. */
  task: WorkItem;
  /** The ranges it can go to, in order. */
  to: readonly Range[];
  /**
   * Whether a move waits for the Mac mini: true when the relay is not live,
   * so the sheet says the move is queued rather than done.
   */
  queued?: boolean;
  /** Called with the range the reader picks. */
  onMove(task: WorkItem, to: Range): void;
  /** Called when the reader closes the sheet without moving. */
  onCancel(): void;
}

/**
 * A sheet along the bottom with the ranges a task can move to, and Cancel.
 * It is a modal dialog: focus moves to the first choice, and Escape closes it.
 */
export function MoveSheet({
  task,
  to,
  queued = false,
  onMove,
  onCancel,
}: MoveSheetProps) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onCancel]);
  return (
    <div className="console-sheet-backdrop" onClick={onCancel}>
      <div
        className="console-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="console-move-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="console-move-title" className="console-sheet-title">
          Move “{task.title}”
        </h2>
        {queued ? (
          <p className="console-sheet-note">
            The relay is not live. The move is queued and the Mac mini applies
            it when it is back.
          </p>
        ) : null}
        {to.map((range, index) => (
          <button
            key={range}
            ref={index === 0 ? first : undefined}
            type="button"
            className="console-sheet-choice"
            onClick={() => onMove(task, range)}
          >
            {rangeNames[range]}
          </button>
        ))}
        <button
          type="button"
          className="console-sheet-cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
