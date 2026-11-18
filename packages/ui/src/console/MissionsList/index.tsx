import type { ReactNode } from "react";

import { isWaiting, type WorkItem } from "../../sidebar/worklist/model";
import { ConsoleMenu, type MenuItem } from "../ConsoleMenu";
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

/** What the filter menu shows or hides. Both start off, as in the sidebar. */
export interface MissionsFilter {
  /** Show done tasks. */
  done: boolean;
  /** Show tasks waiting on a merge or a release (approved or merged). */
  waiting: boolean;
}

export interface MissionsListProps {
  /** Every worklist item; the range picks from them. */
  items: readonly WorkItem[];
  /** Today and tomorrow as YYYY-MM-DD in the reader's time zone. */
  today: string;
  tomorrow: string;
  range: Range;
  view: MissionsView;
  /** The system the list is narrowed to, or null for all. */
  scope: string | null;
  /** The words in the search box. */
  query?: string;
  filter?: MissionsFilter;
  /** Systems whose group is folded in the list. */
  folded?: ReadonlySet<string>;
  /** The task open in the detail, by ref or title. */
  selectedKey?: string | null;
  systemName(system: string): string;
  /** A task's Actions menu; none shows no menu. */
  actionsFor?(task: WorkItem): readonly MenuItem[];
  /** A line under a task's actions, such as why Commander actions are off. */
  actionsFooterFor?(task: WorkItem): string | undefined;
  onRangeChange(range: Range): void;
  onViewChange(view: MissionsView): void;
  onScope(): void;
  onTriage(): void;
  onSelect(task: WorkItem): void;
  onQuery?(query: string): void;
  onFilter?(filter: MissionsFilter): void;
  /** Called with the systems to fold: all of them, or none to expand all. */
  onFold?(folded: ReadonlySet<string>): void;
}

/** A task's key for selection and React: its ref, else its title. */
export const taskKey = (task: WorkItem): string => task.ref ?? task.title;

/** Whether a task matches the search words: every word in its title, ticket or system. */
export function matchesQuery(
  task: WorkItem,
  query: string,
  systemName: string,
): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = `${task.title} ${task.key ?? ""} ${systemName}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

/**
 * The Missions list: range, view, today's scope and the Triage button,
 * then a search box and the filter menu, then the range's tasks by system
 * (each group can fold) or in the four Covey quadrants.
 */
export function MissionsList({
  items,
  today,
  tomorrow,
  range,
  view,
  scope,
  query = "",
  filter = { done: false, waiting: false },
  folded = new Set(),
  selectedKey = null,
  systemName,
  actionsFor = () => [],
  actionsFooterFor = () => undefined,
  onRangeChange,
  onViewChange,
  onScope,
  onTriage,
  onSelect,
  onQuery = () => {},
  onFilter = () => {},
  onFold = () => {},
}: MissionsListProps) {
  const inScope = scope ? items.filter((t) => t.customer === scope) : items;
  const inRange = tasksIn(inScope, range, today, tomorrow);
  const doneCount = inRange.filter((t) => t.done).length;
  const waitingCount = inRange.filter((t) => !t.done && isWaiting(t)).length;
  const tasks = inRange.filter(
    (t) =>
      (filter.done || !t.done) &&
      (filter.waiting || t.done || !isWaiting(t)) &&
      matchesQuery(t, query, systemName(t.customer)),
  );
  const ungraded = ungradedCount(inScope);
  const groups = groupBySystem(tasks);
  const row = (task: WorkItem) => (
    <TaskRow
      key={taskKey(task)}
      task={task}
      selected={taskKey(task) === selectedKey}
      actions={actionsFor(task)}
      actionsFooter={actionsFooterFor(task)}
      onSelect={onSelect}
    />
  );
  const scopeTitle =
    range === "today"
      ? "Today's scope"
      : range === "tomorrow"
        ? "Tomorrow's scope"
        : "Backlog";
  const filterItems: MenuItem[] = [
    {
      label: `Show done (${doneCount})`,
      checked: filter.done,
      onSelect: () => onFilter({ ...filter, done: !filter.done }),
    },
    {
      label: `Show approved and merged (${waitingCount})`,
      checked: filter.waiting,
      hint: "Pull requests waiting for a merge or a release",
      onSelect: () => onFilter({ ...filter, waiting: !filter.waiting }),
    },
    {
      label: "Collapse to systems",
      divider: true,
      disabled: view === "grid",
      hint: view === "grid" ? "The grid has no system groups" : undefined,
      onSelect: () => onFold(new Set(groups.map((g) => g.system))),
    },
    {
      label: "Expand all",
      disabled: view === "grid",
      onSelect: () => onFold(new Set()),
    },
  ];
  const hidden = inRange.length - tasks.length;

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
      <div className="console-search">
        <input
          type="search"
          className="console-search-input"
          aria-label="Search tasks"
          placeholder="Search tasks"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
        <ConsoleMenu label="Filter" name="the task list" items={filterItems} />
      </div>
      {hidden > 0 ? (
        <p className="console-hidden-note">
          {hidden} hidden by the search or the filter
        </p>
      ) : null}
      {tasks.length === 0 ? (
        <p className="console-empty">
          {inRange.length
            ? "No task matches."
            : `Nothing in ${rangeNames[range].toLowerCase()}.`}
        </p>
      ) : view === "list" ? (
        groups.map((group) => {
          const isFolded = folded.has(group.system);
          return (
            <section
              key={group.system}
              className="console-group"
              aria-label={systemName(group.system)}
            >
              <h2 className="console-group-title">
                <button
                  type="button"
                  className="console-group-toggle"
                  aria-expanded={!isFolded}
                  onClick={() => {
                    const next = new Set(folded);
                    if (isFolded) next.delete(group.system);
                    else next.add(group.system);
                    onFold(next);
                  }}
                >
                  <span className="console-group-chevron" aria-hidden="true">
                    {isFolded ? "▸" : "▾"}
                  </span>
                  {systemName(group.system)}
                </button>
                <span className="console-group-count">
                  {group.tasks.length}
                </span>
              </h2>
              {isFolded ? null : (
                <ul className="console-tasks">{group.tasks.map(row)}</ul>
              )}
            </section>
          );
        })
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
