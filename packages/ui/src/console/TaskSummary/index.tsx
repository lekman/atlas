import {
  quadrantOf,
  VALUE_TEXT,
  type WorkItem,
} from "../../sidebar/worklist/model";
import { taskStateNames, taskStateOf } from "../missions";

export interface TaskSummaryProps {
  /** The task shown. */
  task: WorkItem;
  /** The system's name, for the task's client key. */
  systemName: string;
  /** Called when the reader marks the task done. */
  onDone(task: WorkItem): void;
  /** Called when the reader asks to move it. */
  onMove(task: WorkItem): void;
}

const quadrantWords: Record<string, string> = {
  "Q1-do-now": "Q1, do now",
  "Q2-schedule": "Q2, schedule",
  "Q3-minimise": "Q3, minimise",
  "Q4-drop": "Q4, drop",
  unsized: "Ungraded",
};

/**
 * A task's facts and its two everyday actions, Done and Move. The full
 * detail, with the writeup, pull requests and Commander actions, replaces
 * it in a later step.
 */
export function TaskSummary({
  task,
  systemName,
  onDone,
  onMove,
}: TaskSummaryProps) {
  const rows: Array<[string, string]> = [
    ["Status", taskStateNames[taskStateOf(task)]],
    ["Quadrant", quadrantWords[quadrantOf(task)] ?? "Ungraded"],
    ["System", systemName],
    [
      "Grade",
      [
        task.value ? `${VALUE_TEXT[task.value] ?? task.value} value` : null,
        task.effort ?? null,
      ]
        .filter(Boolean)
        .join(" · ") || "Not graded",
    ],
  ];
  if (task.due) rows.push(["Due", task.due]);
  if (task.day) rows.push(["Planned", task.day]);
  if (task.key) rows.push(["Ticket", task.key]);
  if (task.claimedBy) rows.push(["Agent", task.claimedBy]);
  return (
    <article
      className="console-summary"
      aria-labelledby="console-summary-title"
    >
      <h2 id="console-summary-title">{task.title}</h2>
      <dl>
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {task.done ? null : (
        <div className="console-actions">
          <button
            type="button"
            className="console-primary"
            onClick={() => onDone(task)}
          >
            Done
          </button>
          <button
            type="button"
            className="console-secondary"
            onClick={() => onMove(task)}
          >
            Move
          </button>
        </div>
      )}
    </article>
  );
}
