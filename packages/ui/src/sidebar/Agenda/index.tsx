import type { CSSProperties, ReactNode } from "react";

import type { AgendaDay } from "../calendar/model";
import { formatDay, formatDuration, formatTime } from "../format";
import { Panel } from "../Panel";

export interface AgendaProps {
  days: readonly AgendaDay[] | null;
  /** "All customers", or the chosen client's name and "only". */
  scope: string;
  notes?: ReactNode;
  clientOf: (key: string) => { name: string; colour: string };
  now: Date;
}

/**
 * The next seven days: each day's events with their times, the client in
 * its colour, where, how many people, a join link and the source. The
 * meeting under way is highlighted; past ones fade.
 */
export function Agenda({ days, scope, notes, clientOf, now }: AgendaProps) {
  if (!days)
    return <Panel title="Calendar" sub={scope} notes={notes} loading={3} />;
  return (
    <Panel title="Calendar" sub={scope} notes={notes}>
      {days.map((day) => (
        <div key={day.date.getTime()} className="day">
          <div className="dayh">
            <span>
              <b>{day.label}</b> · {formatDay(day.date)}
            </span>
            <span>
              {day.timed
                ? `${day.timed} event${day.timed > 1 ? "s" : ""} · ${formatDuration(day.minutes * 60000)}`
                : ""}
            </span>
          </div>
          {day.events.length === 0 ? (
            <div className="empty">Nothing scheduled</div>
          ) : (
            <ul className="evs">
              {day.events.map((e) => {
                const client = clientOf(e.client);
                const live = !e.allDay && e.start <= now && e.end > now;
                const past = !e.allDay && e.end <= now;
                const className = [
                  "ev",
                  live && "live",
                  past && "past",
                  e.sample && "sample",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li
                    key={`${e.start.getTime()}-${e.title}`}
                    className={className}
                    style={{ "--c": client.colour } as CSSProperties}
                  >
                    <div className="t">
                      {e.allDay
                        ? "All day"
                        : `${formatTime(e.start)}–${formatTime(e.end)}`}
                    </div>
                    <div className="bar" aria-hidden="true" />
                    <div className="body">
                      <div className="name">
                        {e.link ? (
                          <a
                            href={e.link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {e.title}
                          </a>
                        ) : (
                          e.title
                        )}
                      </div>
                      <div className="sub">
                        <span className="cust">{client.name}</span>
                        {e.sample && <span className="tag sample">sample</span>}
                        {live && <span className="tag now">now</span>}
                        {e.where && <span>{e.where}</span>}
                        {(e.who ?? 0) > 1 && <span>{e.who} people</span>}
                        {e.join && (
                          <a
                            href={e.join}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Join call
                          </a>
                        )}
                        {!e.sample && <span>{e.via}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </Panel>
  );
}
