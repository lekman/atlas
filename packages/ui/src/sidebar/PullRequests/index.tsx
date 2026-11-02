import { formatAgo } from "../format";
import { Icon } from "../Icon";
import { pullFacts, type PullRequest, type PullsDoc } from "../details/pulls";
import { safeUrl } from "../trackers/model";

export interface PullRequestsProps {
  /** The pull requests; null while looking, or when there is nothing to search by. */
  doc: PullsDoc | null;
  /** The stored copy, not a live answer. */
  copy?: boolean;
  /** The task's tracker key, which the search used. */
  trackerKey?: string;
  /** Whether there is anything to search by: a key or linked pull requests. */
  searchable: boolean;
  /** Checks again now; busy while it runs. */
  onRefresh?: () => void;
  busy?: boolean;
  now: Date;
}

const STATE_TEXT = {
  open: "Open",
  draft: "Draft",
  merged: "Merged",
  closed: "Closed",
};

const number = (n: number | undefined) => (n ?? 0).toLocaleString("en-GB");

/** One pull request: state, repository and number, title, size and, while open, its checks and reviews. */
export function PullCard({ pr, now }: { pr: PullRequest; now: Date }) {
  const ended = pr.mergedAt || pr.closedAt;
  const when = ended || pr.updatedAt;
  const facts = pullFacts(pr);
  return (
    <li className="prc">
      <div className="top">
        <span className={`chip ${pr.state}`}>
          <Icon name="pr" />
          {STATE_TEXT[pr.state] ?? pr.state}
        </span>
        <span>
          {pr.repo.split("/").pop()} #{pr.number}
        </span>
        {when && (
          <span className="when" title={new Date(when).toLocaleString("en-GB")}>
            {formatAgo(new Date(when), now)}
          </span>
        )}
      </div>
      <a
        className="tt"
        href={safeUrl(pr.url) ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
      >
        {pr.title}
      </a>
      <div className="meta">
        {pr.author && <span>{pr.author}</span>}
        <span>
          <span className="add">+{number(pr.additions)}</span>{" "}
          <span className="del">−{number(pr.deletions)}</span>
        </span>
        <span>
          {pr.files ?? 0} file{pr.files === 1 ? "" : "s"}
        </span>
      </div>
      {facts.length > 0 && (
        <div className="meta">
          {facts.map((f) => (
            <span key={f.text} className={f.tone ?? undefined}>
              {f.text}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * The task's pull requests in the details: linked to the task, or found by
 * its tracker key, with when they were checked and a button to check again.
 */
export function PullRequests({
  doc,
  copy,
  trackerKey,
  searchable,
  onRefresh,
  busy,
  now,
}: PullRequestsProps) {
  if (!doc) {
    return (
      <>
        <div className="dsec">Pull requests</div>
        <div className="dnote compact">
          {searchable
            ? "Looking for pull requests…"
            : "No tracker key to search by"}
        </div>
      </>
    );
  }
  const checked = doc.fetchedAt
    ? ` · checked ${formatAgo(new Date(doc.fetchedAt), now)}${copy ? " (copy from the Mac)" : ""}`
    : "";
  const foot = !doc.prs.length
    ? `None found${checked}`
    : `${doc.linked ? "Linked to this task" : `Found by searching for ${trackerKey}; none linked to this task yet`}${checked}`;
  return (
    <>
      <div className="dsec">Pull requests</div>
      {doc.prs.length > 0 && (
        <ul className="prs">
          {doc.prs.map((pr) => (
            <PullCard key={`${pr.repo}#${pr.number}`} pr={pr} now={now} />
          ))}
        </ul>
      )}
      <div className="prfoot">
        <span>{foot}</span>
        {onRefresh && (
          <button
            type="button"
            className="rf"
            aria-label="Check the pull requests again"
            title={busy ? "Checking…" : "Check the pull requests again"}
            disabled={busy}
            onClick={onRefresh}
          >
            {busy ? "…" : "↻"}
          </button>
        )}
      </div>
    </>
  );
}
