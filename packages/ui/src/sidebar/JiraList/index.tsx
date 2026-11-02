import { formatAgo, formatDay, formatTime } from "../format";
import { GroupHeader } from "../GroupHeader";
import { Note } from "../Note";
import { Panel } from "../Panel";
import { TaskRow } from "../TaskRow";
import {
  JIRA_GROUPS,
  jiraErrorText,
  jiraGroup,
  jiraPriority,
  sortJira,
  type JiraDoc,
} from "../trackers/jira";
import { safeUrl } from "../trackers/model";

export interface JiraListProps {
  title: string;
  /** The stored copy; null before the first sync, undefined before the store answers. */
  doc: JiraDoc | null | undefined;
  /** Folded groups: `indeterminate`, `new`, `other`. */
  folded: ReadonlySet<string>;
  onFold: (group: string) => void;
  /** Today, YYYY-MM-DD, for overdue. */
  today: string;
  now: Date;
}

/**
 * The Jira issues assigned to the operator that aren't done, as the Mac's
 * sync last stored them: in progress, to do, and the rest, each folding.
 */
export function JiraList({
  title,
  doc,
  folded,
  onFold,
  today,
  now,
}: JiraListProps) {
  if (doc === undefined) return <Panel title={title} loading />;
  if (doc === null) {
    return (
      <Panel title={title}>
        <div className="blank">
          No Jira sync yet. The Mac sync fills this in.
        </div>
      </Panel>
    );
  }
  const items = doc.ok ? doc.items : [];
  const synced = doc.syncedAt ? new Date(doc.syncedAt) : null;
  return (
    <Panel
      title={title}
      sub={doc.ok ? `${items.length} not done` : undefined}
      notes={
        doc.ok ? null : (
          <Note tone={doc.error === "not_configured" ? "warn" : "err"}>
            {jiraErrorText(doc.error)}
          </Note>
        )
      }
      fresh={
        synced
          ? `From Jira via the Mac sync · ${formatDay(synced)} ${formatTime(synced)}`
          : undefined
      }
    >
      {doc.ok && !items.length && (
        <div className="blank">Nothing assigned to you that isn't done.</div>
      )}
      {JIRA_GROUPS.map((group) => {
        const rows = items.filter((i) => jiraGroup(i) === group.key);
        if (!rows.length) return null;
        const open = !folded.has(group.key);
        return (
          <div key={group.key} className="group">
            <GroupHeader
              label={group.label}
              count={rows.length}
              colour={group.colour}
              open={open}
              onToggle={() => onFold(group.key)}
            />
            {open && (
              <ul className="rows">
                {sortJira(rows).map((i) => {
                  const overdue = Boolean(i.due && i.due < today);
                  return (
                    <TaskRow
                      key={i.key}
                      priority={jiraPriority(i.priority)}
                      priorityLabel={i.priority ?? "no priority"}
                      title={i.summary || i.key}
                      url={safeUrl(i.url)}
                      meta={
                        <>
                          <span className="key">{i.key}</span>
                          <span
                            className={
                              /block/i.test(i.status ?? "")
                                ? "tag crit"
                                : "tag neutral"
                            }
                          >
                            {i.status || "no status"}
                          </span>
                          {i.type && <span>{i.type}</span>}
                          {i.priority && <span>{i.priority}</span>}
                          {i.due && (
                            <span className={overdue ? "tag crit" : undefined}>
                              {overdue ? "overdue" : "due"}{" "}
                              {formatDay(new Date(`${i.due}T12:00:00`))}
                            </span>
                          )}
                          {i.updated && (
                            <span>
                              updated {formatAgo(new Date(i.updated), now)}
                            </span>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </Panel>
  );
}
