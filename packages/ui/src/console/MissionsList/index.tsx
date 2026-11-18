import type { ReactNode } from "react";

import type { WorkItem } from "../../sidebar/worklist/model";
import { DayScopePanel } from "../DayScopePanel";
import {
  byQuadrant,
  dayScope,
  gridCells,
  groupBySystem,
  rangeNames,
  ranges,
  tasksIn,
  ungradedCount,
  type MissionsView,
  type Range,
} from "../missions";
import { SectionHeading } from "../SectionHeading";
import { SegmentedSwitch } from "../SegmentedSwitch";
import { TaskRow } from "../TaskRow";

export interface MissionsListProps {
  /** Every worklist item; the range picks from them. */
  items: readonly WorkItem[];
  /** Today and tomorrow as YYYY-MM-DD in the reader's time zone. */
  today: string;
  tomorrow: string;
  /** Which range is shown. */
  range: Range;
  /** List by system, or the quadrant grid. */
  view: MissionsView;
  /** The system the list is narrowed to, or null for all. */
  scope: string | null;
  /** The task open in the detail, by ref or title. */
  selectedKey?: string | null;
  /** The name a system is shown by, from its client key. */
  systemName(system: string): string;
  /** Whether a task can be moved from here. */
  canMove?(task: WorkItem): boolean;
  onRangeChange(range: Range): void;
  onViewChange(view: MissionsView): void;
  onScope(): void;
  onTriage(): void;
  onSelect(task: WorkItem): void;
  onMove(task: WorkItem): void;
}

/** A task's key for selection and React: its ref, else its title. */
export const taskKey = (task: WorkItem): string => task.ref ?? task.title;

/**
 * The Missions list: range, view, today's scope and the Triage button,
 * then the range's tasks by system, or in the four Covey quadrants with
 * the ungraded ones under them.
 */
export function MissionsList({
  items,
  today,
  tomorrow,
  range,
  view,
  scope,
  selectedKey = null,
  systemName,
  canMove = () => true,
  onRangeChange,
  onViewChange,
  onScope,
  onTriage,
  onSelect,
  onMove,
}: MissionsListProps) {
  const inScope = scope ? items.filter((t) => t.customer === scope) : items;
  const tasks = tasksIn(inScope, range, today, tomorrow);
  const ungraded = ungradedCount(inScope);
  const row = (task: WorkItem) => (
    <TaskRow
      key={taskKey(task)}
      task={task}
      selected={taskKey(task) === selectedKey}
      canMove={canMove(task)}
      onSelect={onSelect}
      onMove={onMove}
    />
  );
  const scopeTitle =
    range === "today"
      ? "Today's scope"
      : range === "tomorrow"
        ? "Tomorrow's scope"
        : "Backlog";

  return (
    <div className="console-missions">
      <SectionHeading
        title="Missions"
        scope={scope ? systemName(scope) : null}
        onScope={onScope}
      >
        <button
          type="button"
          className="console-chip console-chip-strong"
          onClick={onTriage}
        >
          Triage{ungraded ? ` ${ungraded}` : ""}
          {ungraded ? (
            <span className="console-visually-hidden"> ungraded</span>
          ) : null}
        </button>
      </SectionHeading>
      <div className="console-toolbar">
        <SegmentedSwitch
          label="Range"
          options={ranges.map((value) => ({ value, name: rangeNames[value] }))}
          value={range}
          onChange={onRangeChange}
        />
        <SegmentedSwitch
          label="View"
          options={[
            { value: "list", name: "List" },
            { value: "grid", name: "Grid" },
          ]}
          value={view}
          onChange={onViewChange}
        />
      </div>
      <DayScopePanel
        scope={dayScope(inScope, range, today, tomorrow)}
        title={scopeTitle}
      />
      {tasks.length === 0 ? (
        <p className="console-empty">
          Nothing in {rangeNames[range].toLowerCase()}.
        </p>
      ) : view === "list" ? (
        groupBySystem(tasks).map((group) => (
          <section
            key={group.system}
            className="console-group"
            aria-label={systemName(group.system)}
          >
            <h2 className="console-group-title">
              {systemName(group.system)}
              <span className="console-group-count">{group.tasks.length}</span>
            </h2>
            <ul className="console-tasks">{group.tasks.map(row)}</ul>
          </section>
        ))
      ) : (
        <GridView tasks={tasks} row={row} />
      )}
    </div>
  );
}

function GridView({
  tasks,
  row,
}: {
  tasks: readonly WorkItem[];
  row: (task: WorkItem) => ReactNode;
}) {
  const { cells, ungraded } = byQuadrant(tasks);
  return (
    <>
      <div className="console-grid">
        {gridCells.map((cell) => (
          <section
            key={cell.key}
            className="console-cell"
            data-quadrant={cell.short}
            aria-label={`${cell.short}, ${cell.name}`}
          >
            <h2 className="console-group-title">
              <span className="console-grade">{cell.short}</span> {cell.name}
              <span className="console-group-count">
                {cells[cell.key]!.length}
              </span>
            </h2>
            <ul className="console-tasks">{cells[cell.key]!.map(row)}</ul>
          </section>
        ))}
      </div>
      {ungraded.length ? (
        <section className="console-group" aria-label="Ungraded">
          <h2 className="console-group-title">
            Ungraded{" "}
            <span className="console-group-count">{ungraded.length}</span>
          </h2>
          <ul className="console-tasks">{ungraded.map(row)}</ul>
        </section>
      ) : null}
    </>
  );
}
