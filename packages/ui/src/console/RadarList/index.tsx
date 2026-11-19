import { LOGOS } from "../../sidebar/icons";
import type { AgendaDay, CalendarEvent } from "../../sidebar/calendar/model";
import { TRACKER_NAME } from "../../sidebar/details/model";
import { safeUrl } from "../../sidebar/trackers/model";
import { ConsoleMenu, type MenuItem } from "../ConsoleMenu";
import { SectionHeading } from "../SectionHeading";
import { SegmentedSwitch } from "../SegmentedSwitch";
import { ticketTone } from "../TaskDetail";
import { ticketGroups, type RadarTicket, type RadarView } from "../radar";

export interface RadarListProps {
  view: RadarView;
  onViewChange(view: RadarView): void;
  /** Every ticket assigned to the operator, or null before any tracker answered. */
  tickets: readonly RadarTicket[] | null;
  /** The next seven days, or null before any calendar answered. */
  days: readonly AgendaDay[] | null;
  /** Why a tracker or calendar could not be read, in words. */
  notes?: readonly string[];
  clientOrder: readonly string[];
  systemName(client: string): string;
  /** The system narrowed to, or null for all. */
  scope: string | null;
  onScope?(): void;
  /** Whether tickets that are already tasks show too. */
  showTracked: boolean;
  onShowTracked(show: boolean): void;
  /** Commander's open request about a ticket, in one line, if any. */
  planning?(ticket: RadarTicket): string | null;
  onPlan(ticket: RadarTicket): void;
  onOpenTask(ticket: RadarTicket): void;
}

const VIEWS: ReadonlyArray<{ value: RadarView; name: string }> = [
  { value: "tickets", name: "Tickets" },
  { value: "meetings", name: "Meetings" },
];

const hhmm = (d: Date) =>
  d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const minutesWords = (m: number) =>
  m < 60
    ? `${Math.round(m)} min`
    : `${Math.floor(m / 60)} h${m % 60 ? ` ${Math.round(m % 60)} min` : ""}`;

/**
 * Radar: what is not yet your work. Tickets assigned to you in Jira,
 * monday.com and GitHub, grouped by system, each with its status and a
 * menu to plan it with Commander, open the task it already is, or open it
 * in its tracker; tickets that are already tasks are left out unless asked
 * for. Meetings: the next seven days, by day, in 24-hour time.
 */
export function RadarList({
  view,
  onViewChange,
  tickets,
  days,
  notes = [],
  clientOrder,
  systemName,
  scope,
  onScope,
  showTracked,
  onShowTracked,
  planning = () => null,
  onPlan,
  onOpenTask,
}: RadarListProps) {
  const inScope = (client: string) => !scope || client === scope;
  const scoped = (tickets ?? []).filter((t) => inScope(t.client));
  const tracked = scoped.filter((t) => t.task).length;
  const shown = showTracked ? scoped : scoped.filter((t) => !t.task);

  const actionsFor = (t: RadarTicket): MenuItem[] => {
    const pending = planning(t);
    const url = safeUrl(t.url);
    const items: MenuItem[] = t.task
      ? [{ label: "Open the task", onSelect: () => onOpenTask(t) }]
      : [
          {
            label: "Plan with Commander",
            onSelect: () => onPlan(t),
            disabled: Boolean(pending),
            hint: pending ?? undefined,
          },
        ];
    if (url)
      items.push({
        label: `Open in ${TRACKER_NAME[t.system]}`,
        onSelect: () => window.open(url, "_blank", "noopener,noreferrer"),
      });
    return items;
  };

  return (
    <div className="console-radar">
      <SectionHeading
        title="Radar"
        scope={scope ? systemName(scope) : null}
        {...(onScope ? { onScope } : {})}
      />
      <div className="console-toolbar">
        <SegmentedSwitch
          label="Radar view"
          options={VIEWS}
          value={view}
          onChange={onViewChange}
        />
      </div>
      {notes.map((n) => (
        <p key={n} className="console-request" role="status">
          {n}
        </p>
      ))}

      {view === "tickets" ? (
        tickets === null ? (
          <p className="console-empty">Reading the trackers…</p>
        ) : (
          <>
            {tracked ? (
              <button
                type="button"
                className="console-read-more console-radar-tracked"
                aria-pressed={showTracked}
                onClick={() => onShowTracked(!showTracked)}
              >
                {showTracked
                  ? `Hide the ${tracked} already tasks`
                  : `Show the ${tracked} already tasks`}
              </button>
            ) : null}
            {shown.length ? (
              ticketGroups(shown, clientOrder).map((group) => (
                <section
                  key={group.client}
                  className="console-group"
                  aria-label={systemName(group.client)}
                >
                  <h2 className="console-group-title">
                    <span>{systemName(group.client)}</span>
                    <span className="console-group-count">
                      {group.tickets.length}
                    </span>
                  </h2>
                  <ul className="console-tasks">
                    {group.tickets.map((t) => (
                      <RadarRow
                        key={`${t.system}:${t.key}`}
                        ticket={t}
                        actions={actionsFor(t)}
                        pending={planning(t)}
                        onOpenTask={onOpenTask}
                      />
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <p className="console-empty">
                {scoped.length
                  ? "Every ticket here is already a task."
                  : "No tickets assigned to you."}
              </p>
            )}
          </>
        )
      ) : days === null ? (
        <p className="console-empty">Reading the calendars…</p>
      ) : (
        days.map((day) => {
          const events = day.events.filter((e) => inScope(e.client));
          return (
            <section
              key={day.date.toISOString()}
              className="console-group"
              aria-label={day.label}
            >
              <h2 className="console-group-title">
                <span>{day.label}</span>
                <span className="console-group-count">
                  {events.length
                    ? `${events.length} · ${minutesWords(
                        events
                          .filter((e) => !e.allDay)
                          .reduce(
                            (sum, e) =>
                              sum +
                              Math.max(
                                0,
                                (Math.min(
                                  e.end.getTime(),
                                  day.date.getTime() + 86400000,
                                ) -
                                  Math.max(
                                    e.start.getTime(),
                                    day.date.getTime(),
                                  )) /
                                  60000,
                              ),
                            0,
                          ),
                      )}`
                    : "None"}
                </span>
              </h2>
              {events.length ? (
                <ul className="console-tasks">
                  {events.map((e) => (
                    <MeetingRow
                      key={`${e.start.getTime()}-${e.title}`}
                      event={e}
                      systemName={systemName}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}

function RadarRow({
  ticket: t,
  actions,
  pending,
  onOpenTask,
}: {
  ticket: RadarTicket;
  actions: readonly MenuItem[];
  pending: string | null;
  onOpenTask(ticket: RadarTicket): void;
}) {
  const logo = LOGOS[t.system];
  const url = safeUrl(t.url);
  const body = (
    <>
      <span className="console-task-title">{t.title}</span>
      <span className="console-task-meta">
        <span className="console-task-fact">
          <svg
            viewBox={logo.viewBox}
            className="console-tracker-logo"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: logo.body }}
          />
          {t.key}
        </span>
        {t.status ? (
          <span className="console-badge" data-tone={ticketTone(t.status)}>
            {t.status}
          </span>
        ) : null}
        {t.task ? <span className="console-task-fact">A task</span> : null}
        {pending ? <span className="console-task-fact">{pending}</span> : null}
      </span>
    </>
  );
  return (
    <li className="console-task console-radar-ticket">
      {t.task ? (
        <button
          type="button"
          className="console-task-open"
          onClick={() => onOpenTask(t)}
        >
          {body}
        </button>
      ) : url ? (
        <a
          className="console-task-open"
          href={url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {body}
        </a>
      ) : (
        <div className="console-task-open">{body}</div>
      )}
      <span className="console-task-side">
        <ConsoleMenu
          label="Actions"
          name={`${t.key} ${t.title}`}
          items={actions}
          buttonClassName="console-task-move"
          icon="more"
        />
      </span>
    </li>
  );
}

function MeetingRow({
  event: e,
  systemName,
}: {
  event: CalendarEvent;
  systemName(client: string): string;
}) {
  const join = safeUrl(e.join ?? null) ?? safeUrl(e.link ?? null);
  return (
    <li className="console-task console-radar-meeting">
      <div className="console-task-open">
        <span className="console-task-title">{e.title}</span>
        <span className="console-task-meta">
          <span className="console-task-fact">
            {e.allDay ? "All day" : `${hhmm(e.start)}–${hhmm(e.end)}`}
          </span>
          <span className="console-task-fact">{systemName(e.client)}</span>
          {e.where ? (
            <span className="console-task-fact">{e.where}</span>
          ) : null}
        </span>
      </div>
      {join ? (
        <span className="console-task-side">
          <a
            className="console-secondary console-radar-join"
            href={join}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Open ${e.title}`}
          >
            Open
          </a>
        </span>
      ) : null}
    </li>
  );
}
