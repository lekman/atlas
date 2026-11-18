import { quadrantOf, type WorkItem } from "../../sidebar/worklist/model";
import { taskStateNames, taskStateOf } from "../missions";

export interface TaskRowProps {
  /** The task the row shows. */
  task: WorkItem;
  /** Whether the task is the one open in the detail. */
  selected?: boolean;
  /** Whether it can be moved: an open task from the task database. */
  canMove?: boolean;
  /** Called when the reader opens the task. */
  onSelect(task: WorkItem): void;
  /** Called when the reader asks to move the task to another range. */
  onMove(task: WorkItem): void;
}

const quadrantShort: Record<string, string> = {
  "Q1-do-now": "Q1",
  "Q2-schedule": "Q2",
  "Q3-minimise": "Q3",
  "Q4-drop": "Q4",
};

/**
 * One task: its state as a shape (filled circle done, ring in progress,
 * dashed ring queued, square blocked), its title, its grade and the move
 * control. The title opens the task; the move control is a separate button
 * so a thumb cannot open one when it means the other.
 */
export function TaskRow({
  task,
  selected = false,
  canMove = true,
  onSelect,
  onMove,
}: TaskRowProps) {
  const state = taskStateOf(task);
  const quadrant = quadrantShort[quadrantOf(task)];
  return (
    <li
      className="console-task"
      data-state={state}
      data-selected={selected || undefined}
    >
      <button
        type="button"
        className="console-task-open"
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(task)}
      >
        <span className="console-task-state" aria-hidden="true" />
        <span className="console-visually-hidden">
          {taskStateNames[state]}:{" "}
        </span>
        <span className="console-task-title">{task.title}</span>
        <span className="console-task-meta">
          {quadrant ? <span className="console-grade">{quadrant}</span> : null}
          {task.effort ? <span>{task.effort}</span> : null}
          {task.due ? <span>due {task.due.slice(5)}</span> : null}
          {task.key ? <span>{task.key}</span> : null}
        </span>
      </button>
      {canMove && !task.done ? (
        <button
          type="button"
          className="console-task-move"
          aria-label={`Move ${task.title}`}
          onClick={() => onMove(task)}
        >
          Move
        </button>
      ) : null}
    </li>
  );
}
