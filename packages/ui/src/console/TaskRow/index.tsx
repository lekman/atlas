import { ticketLabel, trackerSystem } from "../../sidebar/details/model";
import { LOGOS } from "../../sidebar/icons";
import { quadrantOf, type WorkItem } from "../../sidebar/worklist/model";
import { ConsoleIcon } from "../ConsoleIcon";
import { ConsoleMenu, type MenuItem } from "../ConsoleMenu";
import { taskStateNames, taskStateOf } from "../missions";

export interface TaskRowProps {
  /** The task the row shows. */
  task: WorkItem;
  /** Whether the task is the one open in the detail. */
  selected?: boolean;
  /** The monday.com key prefix, to tell its keys from Jira's. */
  mondayPrefix?: string;
  /** The task's actions: copy reference, Done, moves, Status, Execute. None shows no menu. */
  actions?: readonly MenuItem[];
  /** A line under the actions, such as why some are off. */
  actionsFooter?: string;
  /** Called when the reader opens the task. */
  onSelect(task: WorkItem): void;
}

const quadrantShort: Record<string, string> = {
  "Q1-do-now": "Q1",
  "Q2-schedule": "Q2",
  "Q3-minimise": "Q3",
  "Q4-drop": "Q4",
};

/** A due date as "20 Nov". */
export function dueWords(due: string): string {
  const d = new Date(`${due}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? due
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * One task: its title, then its ticket (the tracker's logo and the key) and
 * due date, and in a narrow column on
 * the right its state as a shape (filled circle done, ring in progress,
 * dashed ring queued, square blocked), its quadrant and its Actions menu,
 * so the title gets the width. The title opens the task; Actions is a separate button so a thumb
 * cannot open one when it means the other.
 */
export function TaskRow({
  task,
  selected = false,
  mondayPrefix,
  actions = [],
  actionsFooter,
  onSelect,
}: TaskRowProps) {
  const state = taskStateOf(task);
  const quadrant = quadrantShort[quadrantOf(task)];
  const logo = task.key ? LOGOS[trackerSystem(task.key, mondayPrefix)] : null;
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
        <span className="console-visually-hidden">
          {taskStateNames[state]}:{" "}
        </span>
        <span className="console-task-title">{task.title}</span>
        <span className="console-task-meta">
          {task.key ? (
            <span className="console-task-fact">
              {logo ? (
                <svg
                  viewBox={logo.viewBox}
                  className="console-tracker-logo"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: logo.body }}
                />
              ) : null}
              {ticketLabel(task.key)}
            </span>
          ) : null}
          {task.due ? (
            <span className="console-task-fact">
              <ConsoleIcon name="calendar" />
              <span className="console-visually-hidden">due </span>
              {dueWords(task.due)}
            </span>
          ) : null}
        </span>
      </button>
      <span className="console-task-side">
        <span className="console-task-state" aria-hidden="true" />
        {quadrant ? <span className="console-grade">{quadrant}</span> : null}
        {actions.length ? (
          <ConsoleMenu
            label="Actions"
            name={task.title}
            items={actions}
            footer={actionsFooter}
            buttonClassName="console-task-move"
            icon="more"
          />
        ) : null}
      </span>
    </li>
  );
}
