import { formatAgo, formatTime } from "../format";
import { GroupHeader } from "../GroupHeader";
import { Note } from "../Note";
import { Panel } from "../Panel";
import { TaskRow } from "../TaskRow";
import { githubGroups, isHot, type GitHubPage } from "../trackers/github";

export interface GitHubListProps {
  title: string;
  /** `owner/name`, for the freshness line. */
  repo: string;
  page: GitHubPage | null;
  error?: { text: string; tone: "warn" | "err" } | null;
  /** The operator's GitHub login, once known. */
  me: string | null;
  /** Assigned to me, or all open issues. */
  mine: boolean;
  onMine: (mine: boolean) => void;
  /** Folded groups, by label ("" for no label). */
  folded: ReadonlySet<string>;
  onFold: (label: string) => void;
  /** The group labels' colour: the client's. */
  colour: string;
  updatedAt: Date | null;
  now: Date;
}

/**
 * Open issues, grouped by first label, newest first in each group. Groups
 * fold, and the list narrows to the operator's issues.
 */
export function GitHubList({
  title,
  repo,
  page,
  error,
  me,
  mine,
  onMine,
  folded,
  onFold,
  colour,
  updatedAt,
  now,
}: GitHubListProps) {
  const narrowed = mine && Boolean(me);
  const controls = (
    <div className="seg" role="group" aria-label="Which issues">
      <button type="button" aria-pressed={mine} onClick={() => onMine(true)}>
        Assigned to me
      </button>
      <button type="button" aria-pressed={!mine} onClick={() => onMine(false)}>
        All open
      </button>
    </div>
  );
  const notes = (
    <>
      {error && <Note tone={error.tone}>{error.text}</Note>}
      {page && mine && !me && (
        <Note tone="warn">
          Couldn't tell which GitHub user you are yet, so this shows all open
          issues.
        </Note>
      )}
    </>
  );
  if (!page) {
    return (
      <Panel title={title} controls={controls} notes={notes} loading={!error} />
    );
  }

  const items = page.items.filter(
    (i) => !narrowed || i.assignees.includes(me!),
  );
  const groups = githubGroups(items);
  const single = groups.length === 1 && groups[0] === "";
  return (
    <Panel
      title={title}
      controls={controls}
      notes={notes}
      fresh={
        updatedAt
          ? `Live from GitHub (${repo}) · updated ${formatTime(updatedAt)} · refreshes every 5 min`
          : undefined
      }
    >
      {items.length === 0 && (
        <div className="blank">
          {narrowed ? "No open issues assigned to you." : "No open issues."}
        </div>
      )}
      {groups.map((label) => {
        const rows = items
          .filter((i) => (i.labels[0] ?? "") === label)
          .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
        const open = single || !folded.has(label);
        return (
          <div key={label || "-"} className="group">
            {!single && (
              <GroupHeader
                label={label || "No label"}
                count={rows.length}
                colour={colour}
                open={open}
                onToggle={() => onFold(label)}
              />
            )}
            {open && (
              <ul className="rows">
                {rows.map((i) => (
                  <TaskRow
                    key={i.number}
                    priority={isHot(i) ? "high" : ""}
                    title={i.title}
                    url={i.url}
                    meta={
                      <>
                        <span className="key">#{i.number}</span>
                        {i.labels.slice(single ? 0 : 1).map((l) => (
                          <span key={l} className="tag neutral">
                            {l}
                          </span>
                        ))}
                        <span>
                          {i.assignees.length
                            ? i.assignees.join(", ")
                            : "unassigned"}
                        </span>
                        {i.updated && (
                          <span>
                            updated {formatAgo(new Date(i.updated), now)}
                          </span>
                        )}
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {page.more && (
        <div className="blank">
          Showing the 100 most recently updated of {page.total} open issues.
        </div>
      )}
    </Panel>
  );
}
