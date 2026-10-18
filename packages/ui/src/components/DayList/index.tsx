import {
  arrangeDay,
  isCarriedOver,
  isNotWorthIt,
  isSized,
  nextDay,
  priorityOf,
  type BacklogItem,
  type Band,
  type Client,
  type DayPlan,
  type Priority,
} from "@atlas/core";
import { useId } from "react";

import { longDay, shortDay } from "../../dates";

export interface DayListProps {
  /** The tasks, notes and meetings to show. */
  plan: DayPlan;
  /** Who the work is for, home first whatever the order here. */
  clients: Client[];
  /** The task open beside the list, marked as current. */
  selectedId?: string;
  /** A task was picked, to open next. */
  onSelect(id: string): void;
}

const bandTitles: Record<Band, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  future: "Future",
  unscheduled: "Unscheduled",
};

export const priorityNames: Record<Priority, string> = {
  high: "High priority",
  normal: "Normal priority",
  low: "Low priority",
};

/**
 * A priority as a shape and a colour, never a colour alone: high points
 * up, normal is round, low points down. The colours are the status hues
 * (amber, blue, grey), which every palette holds to 4.5:1 on its ground.
 */
export function PriorityMark({ priority }: { priority: Priority }) {
  return (
    <span
      className="atlas-priority"
      data-priority={priority}
      role="img"
      aria-label={priorityNames[priority]}
    />
  );
}

/**
 * The day plan, read top to bottom: Today, Tomorrow, Future and
 * Unscheduled, each split by client with home first. A client's block
 * opens with its day note and its meetings, then its tasks: open work by
 * priority, anything not worth doing below it, and done work last, struck
 * through. Status words are written out ("Blocked", "Carried over"), so
 * nothing depends on colour. Picking a task only reports it.
 */
export function DayList({ plan, clients, selectedId, onSelect }: DayListProps) {
  const baseId = useId();
  const arranged = arrangeDay(plan.items, clients, plan.today);
  const tomorrow = nextDay(plan.today);
  const dayOf: Partial<Record<Band, string>> = {
    today: plan.today,
    tomorrow,
  };
  const clientName = (id: string) =>
    clients.find((client) => client.id === id)?.name ?? id;
  const isHome = (id: string) =>
    clients.some((client) => client.id === id && client.home === true);

  return (
    <div className="atlas-day-list">
      {arranged.map(({ band, clients: clientDays }) => {
        const day = dayOf[band];
        const bandId = `${baseId}-${band}`;
        return (
          <section key={band} className="atlas-band" aria-labelledby={bandId}>
            <h2 className="atlas-band-title" id={bandId}>
              <span>{bandTitles[band]}</span>
              {day && <span className="atlas-band-day">{longDay(day)}</span>}
            </h2>
            {clientDays.map(({ clientId, items }) => {
              const headingId = `${bandId}-${clientId}`;
              const notes = day
                ? plan.notes.filter(
                    (note) => note.clientId === clientId && note.on === day,
                  )
                : [];
              const meetings = day
                ? plan.calendar
                    .filter(
                      (entry) =>
                        entry.clientId === clientId && entry.on === day,
                    )
                    .sort((a, b) => a.start.localeCompare(b.start))
                : [];
              return (
                <section
                  key={clientId}
                  className="atlas-client-day"
                  aria-labelledby={headingId}
                >
                  <h3 id={headingId}>
                    {clientName(clientId)}
                    {isHome(clientId) && (
                      <span className="atlas-tag"> · home</span>
                    )}
                  </h3>
                  {notes.map((note) => (
                    <div key={note.kind} className="atlas-day-note">
                      <p>
                        <span className="atlas-note-kind">
                          {note.kind === "overview" ? "Overview" : "Intention"}
                        </span>{" "}
                        {note.text}
                      </p>
                      {note.watch && (
                        <p className="atlas-watch">
                          <strong>Watch:</strong> {note.watch}
                        </p>
                      )}
                    </div>
                  ))}
                  {meetings.length > 0 && (
                    <ul className="atlas-calendar" aria-label="Calendar">
                      {meetings.map((entry) => (
                        <li key={`${entry.start}-${entry.title}`}>
                          <time>
                            {entry.start}–{entry.end}
                          </time>
                          <span>{entry.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ul className="atlas-tasks" aria-label="Tasks">
                    {items.map((item) => (
                      <TaskRow
                        key={item.id}
                        item={item}
                        today={plan.today}
                        selected={item.id === selectedId}
                        onSelect={onSelect}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function TaskRow({
  item,
  today,
  selected,
  onSelect,
}: {
  item: BacklogItem;
  today: string;
  selected: boolean;
  onSelect(id: string): void;
}) {
  const done = item.state === "done";
  const wasted = !done && isNotWorthIt(item);
  const carried = isCarriedOver(item, today);
  const sized = isSized(item);
  return (
    <li
      className="atlas-task"
      data-done={done || undefined}
      data-not-worth-it={wasted || undefined}
      aria-current={selected || undefined}
    >
      <PriorityMark priority={priorityOf(item)} />
      <div className="atlas-task-body">
        <button
          type="button"
          className="atlas-task-title"
          onClick={() => onSelect(item.id)}
        >
          {done && <span className="atlas-visually-hidden">Done: </span>}
          {item.title}
        </button>
        {item.summary && !done && (
          <p className="atlas-task-summary">{item.summary}</p>
        )}
        <p className="atlas-task-meta">
          {sized ? (
            <>
              <span className="atlas-chip">
                <span className="atlas-chip-label">Effort</span> {item.effort}
              </span>
              <span className="atlas-chip">
                <span className="atlas-chip-label">Value</span> {item.value}
              </span>
            </>
          ) : (
            !done && (
              <span className="atlas-chip" data-tone="dashed">
                Needs a size
              </span>
            )
          )}
          {item.blocked && !done && (
            <span className="atlas-chip" data-tone="blocked">
              Blocked
            </span>
          )}
          {carried && item.scheduledFor && (
            <span className="atlas-chip" data-tone="waiting">
              Carried over from {shortDay(item.scheduledFor)}
            </span>
          )}
          {done && (
            <span className="atlas-chip" data-tone="running">
              Done{item.doneOn ? ` ${shortDay(item.doneOn)}` : ""}
            </span>
          )}
        </p>
        {wasted && (
          <p className="atlas-not-worth-it">
            <strong>Not worth it:</strong> extra large effort for a value of{" "}
            {item.value}. Drop it or split it.
          </p>
        )}
      </div>
      {item.tracker && (
        <a
          className="atlas-tracker-key"
          href={item.tracker.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${item.tracker.key}, open in ${trackerName(item.tracker.system)}`}
        >
          {item.tracker.key}
        </a>
      )}
    </li>
  );
}

function trackerName(system: string): string {
  switch (system) {
    case "jira":
      return "Jira";
    case "monday":
      return "monday.com";
    case "github":
      return "GitHub";
    default:
      return "the tracker";
  }
}
