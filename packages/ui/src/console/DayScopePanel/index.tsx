import { EFFORTS } from "../../sidebar/worklist/model";
import { minutesWords, type DayScope } from "../missions";

export interface DayScopePanelProps {
  /** What the range holds. */
  scope: DayScope;
  /** "Today's scope", "Tomorrow's scope" or "Backlog". */
  title: string;
}

/**
 * What the day holds: tasks, effort by size, meeting time and the blocked
 * tasks left out. Information only: it sets no limit and gives no warning,
 * since what fits a day is the reader's call.
 */
export function DayScopePanel({ scope, title }: DayScopePanelProps) {
  const sizes = EFFORTS.filter((size) => scope.bySize[size] > 0);
  return (
    <section className="console-scope" aria-label={title}>
      <h2 className="console-label">{title}</h2>
      <dl>
        <div>
          <dt>Tasks</dt>
          <dd>{scope.count}</dd>
        </div>
        <div>
          <dt>Effort</dt>
          <dd>
            {[
              ...sizes.map((size) => `${scope.bySize[size]} ${size}`),
              ...(scope.ungraded ? [`${scope.ungraded} ungraded`] : []),
            ].join(" · ") || "–"}
          </dd>
        </div>
        <div>
          <dt>Meetings</dt>
          <dd>
            {scope.meetingMinutes ? minutesWords(scope.meetingMinutes) : "None"}
          </dd>
        </div>
        {scope.blocked ? (
          <div>
            <dt>Blocked</dt>
            <dd>{scope.blocked} left out</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
