import { trackerSystem, ticketLabel } from "../../sidebar/details/model";
import { LOGOS } from "../../sidebar/icons";
import { safeUrl } from "../../sidebar/trackers/model";
import { SectionHeading } from "../SectionHeading";
import { SegmentedSwitch } from "../SegmentedSwitch";
import {
  logDays,
  logWeeks,
  pointsOf,
  type LogItem,
  type LogPeriod,
  type LogView,
} from "../log";

export interface LogListProps {
  view: LogView;
  onViewChange(view: LogView): void;
  /** Finished tasks, newest first, or null before the host answered. */
  items: readonly LogItem[] | null;
  /** Why the log could not be read, in words. */
  note?: string | null;
  /** When the shown copy was read, when it is a stored copy. */
  copyFrom?: string | null;
  systemName(client: string): string;
  /** The system narrowed to, or null for all. */
  scope: string | null;
  onScope?(): void;
  /** The monday.com key prefix, to tell its keys from Jira's. */
  mondayPrefix?: string;
  now: Date;
}

const VIEWS: ReadonlyArray<{ value: LogView; name: string }> = [
  { value: "days", name: "Days" },
  { value: "weeks", name: "Weeks" },
];

const tally = (p: Pick<LogPeriod, "items" | "points">) =>
  p.items.length
    ? `${p.items.length} ${p.items.length === 1 ? "mission" : "missions"} · ${p.points} ${p.points === 1 ? "point" : "points"}`
    : "None";

const shortDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/**
 * Log: what was finished. A score panel with today, this week, last week
 * and the four-week average, then the finished missions by day or by week,
 * each with its ticket, effort and points. A task scores by its effort (XS
 * 1, S 2, M 3, L 5, XL 8; ungraded 1).
 */
export function LogList({
  view,
  onViewChange,
  items,
  note = null,
  copyFrom = null,
  systemName,
  scope,
  onScope,
  mondayPrefix,
  now,
}: LogListProps) {
  const scoped = (items ?? []).filter((i) => !scope || i.customer === scope);
  const days = logDays(scoped, now, 7);
  const weeks = logWeeks(scoped, now, 4);
  const average = Math.round(
    weeks.reduce((sum, w) => sum + w.points, 0) / weeks.length,
  );
  const periods = view === "days" ? days : weeks;

  return (
    <div className="console-log">
      <SectionHeading
        title="Log"
        scope={scope ? systemName(scope) : null}
        {...(onScope ? { onScope } : {})}
      />
      <div className="console-toolbar">
        <SegmentedSwitch
          label="Log view"
          options={VIEWS}
          value={view}
          onChange={onViewChange}
        />
      </div>
      {note ? (
        <p className="console-request" role="status">
          {note}
        </p>
      ) : null}

      {items === null ? (
        <p className="console-empty">Reading the log…</p>
      ) : (
        <>
          <section className="console-scope" aria-label="Score">
            <h2 className="console-label">
              Score{copyFrom ? ` · copy from ${copyFrom}` : ""}
            </h2>
            <dl>
              <div>
                <dt>Today</dt>
                <dd>{tally(days[0]!)}</dd>
              </div>
              <div>
                <dt>This week</dt>
                <dd>{tally(weeks[0]!)}</dd>
              </div>
              <div>
                <dt>Last week</dt>
                <dd>{tally(weeks[1]!)}</dd>
              </div>
              <div>
                <dt>4-week average</dt>
                <dd>{average} points a week</dd>
              </div>
            </dl>
          </section>

          {periods.map((period) => (
            <section
              key={period.from}
              className="console-group"
              aria-label={period.label}
            >
              <h2 className="console-group-title">
                <span>{period.label}</span>
                <span className="console-group-count">
                  {period.items.length
                    ? `${period.items.length} · ${period.points} pts`
                    : "None"}
                </span>
              </h2>
              {period.items.length ? (
                <ul className="console-tasks">
                  {period.items.map((item) => (
                    <LogRow
                      key={item.ref}
                      item={item}
                      systemName={systemName}
                      showDay={view === "weeks"}
                      mondayPrefix={mondayPrefix}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function LogRow({
  item,
  systemName,
  showDay,
  mondayPrefix,
}: {
  item: LogItem;
  systemName(client: string): string;
  showDay: boolean;
  mondayPrefix?: string;
}) {
  const logo = item.key ? LOGOS[trackerSystem(item.key, mondayPrefix)] : null;
  const url = safeUrl(item.link ?? undefined);
  const points = pointsOf(item);
  const body = (
    <>
      <span className="console-task-title">{item.title}</span>
      <span className="console-task-meta">
        {item.key ? (
          <span className="console-task-fact">
            {logo ? (
              <svg
                viewBox={logo.viewBox}
                className="console-tracker-logo"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: logo.body }}
              />
            ) : null}
            {ticketLabel(item.key)}
          </span>
        ) : null}
        <span className="console-task-fact">{systemName(item.customer)}</span>
        {showDay ? (
          <span className="console-task-fact">{shortDay(item.doneOn)}</span>
        ) : null}
        <span className="console-task-fact">{item.effort ?? "Ungraded"}</span>
      </span>
    </>
  );
  return (
    <li className="console-task console-log-item">
      {url ? (
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
        <span
          className="console-log-points"
          aria-label={`${points} ${points === 1 ? "point" : "points"}`}
        >
          +{points}
        </span>
      </span>
    </li>
  );
}
