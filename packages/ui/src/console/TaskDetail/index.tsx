import { parseMarkdown, splitFrontMatter } from "@atlas/core/markdown";
import { useMemo } from "react";

import { MarkdownBlocks } from "../../markdown/MarkdownBlocks";
import type { DetailsState } from "../../sidebar/DetailsView";
import {
  field,
  liveStatus,
  trackerSystem,
  TRACKER_NAME,
} from "../../sidebar/details/model";
import type { PullRequest, PullsDoc } from "../../sidebar/details/pulls";
import { formatAgo } from "../../sidebar/format";
import { safeUrl } from "../../sidebar/trackers/model";
import {
  quadrantOf,
  VALUE_TEXT,
  type WorkItem,
} from "../../sidebar/worklist/model";
import { ConsoleMenu } from "../ConsoleMenu";
import { rangeNames, type Range } from "../missions";

export interface TaskDetailProps {
  task: WorkItem;
  /** The system's name, for the task's client key. */
  systemName: string;
  /** The task's details page from the vault, as far as it has been read. */
  details: DetailsState;
  /** The task's pull requests, or null before any answer. */
  pulls: PullsDoc | null;
  /** Whether the pull requests are a stored copy rather than live. */
  pullsCopy?: boolean;
  /** The monday.com key prefix, to tell its keys from Jira's. */
  mondayPrefix?: string;
  /** Jira's status for each synced issue key, from the Jira sync. */
  jiraStatuses?: ReadonlyMap<string, string> | null;
  /** Commander's latest request about the task, in one line, if any. */
  request?: string | null;
  /** Why Commander actions are off, while a request is still open. */
  commanderBusy?: string | null;
  /** The ranges the task can move to. */
  moves: readonly Range[];
  now: Date;
  onDone(task: WorkItem): void;
  onMove(task: WorkItem, to: Range): void;
  onStatus(task: WorkItem): void;
  onExecute(task: WorkItem): void;
  /** Asks Commander for a details page with a test plan. Offered only when there is none. */
  onPlan?(task: WorkItem): void;
  onCopyReference(task: WorkItem): void;
}

const quadrantWords: Record<string, string> = {
  "Q1-do-now": "Q1, do now",
  "Q2-schedule": "Q2, schedule",
  "Q3-minimise": "Q3, minimise",
  "Q4-drop": "Q4, drop",
  unsized: "Ungraded",
};

const pullStateWords: Record<PullRequest["state"], string> = {
  open: "Open",
  draft: "Draft",
  merged: "Merged",
  closed: "Closed",
};

/**
 * The status the ticket line shows: Jira's own status when the Jira sync
 * has the issue, otherwise the task's status in Atlas.
 */
export function ticketStatusOf(
  key: string | undefined,
  system: string | null,
  jiraStatuses: ReadonlyMap<string, string> | null | undefined,
  fallback: string,
): string {
  return (system === "jira" && key && jiraStatuses?.get(key)) || fallback;
}

function pullFacts(pull: PullRequest): string {
  const review =
    pull.review === "approved"
      ? "approved"
      : pull.review === "changes_requested"
        ? "changes requested"
        : pull.review === "review_required"
          ? "review required"
          : null;
  const checks =
    pull.checks === "success"
      ? "checks passing"
      : pull.checks === "failure" || pull.checks === "error"
        ? "checks failing"
        : pull.checks === "pending" || pull.checks === "expected"
          ? "checks running"
          : null;
  return [review, checks, pull.conflicts ? "conflicts" : null]
    .filter(Boolean)
    .join(" · ");
}

const httpsOnly = (href: string) => /^https:\/\//i.test(href);

/**
 * One task in full. The title, with the actions at its top right on a wide
 * pane (they wrap under it on a narrow one): Done, Move, Status, Execute,
 * Plan when there is no page yet, and Copy reference. Then its facts, the
 * tracker ticket and its live status, its pull requests with review and
 * checks, and the details page from the vault. Stacked in that order on a
 * narrow pane; from 820 px wide, the description sits on the left and the
 * pull requests on the right.
 */
export function TaskDetail({
  task,
  systemName,
  details,
  pulls,
  pullsCopy = false,
  mondayPrefix,
  jiraStatuses,
  request,
  commanderBusy,
  moves,
  now,
  onDone,
  onMove,
  onStatus,
  onExecute,
  onPlan,
  onCopyReference,
}: TaskDetailProps) {
  const page = details.state === "ready" ? details.page : null;
  const { fields, blocks } = useMemo(() => {
    if (!page) return { fields: [] as Array<[string, string]>, blocks: [] };
    const split = splitFrontMatter(page.md);
    return { fields: split.fields, blocks: parseMarkdown(split.body) };
  }, [page]);
  const prs = pulls?.prs ?? [];
  const status = liveStatus(task, {
    pageStatus: field(fields, "status"),
    openPullRequests: prs.filter((p) => p.state === "open").length,
    draftPullRequests: prs.filter((p) => p.state === "draft").length,
  });
  const key = field(fields, "tracker") ?? task.key;
  const system = key ? trackerSystem(key, mondayPrefix) : null;
  const trackerUrl = safeUrl(field(fields, "url")) ?? safeUrl(task.link);
  const busy = Boolean(commanderBusy);
  const statusWord = `${status.label[0]!.toUpperCase()}${status.label.slice(1)}`;
  const ticketStatus = ticketStatusOf(key, system, jiraStatuses, statusWord);

  const facts: Array<[string, string]> = [
    ["Status", statusWord],
    ["Quadrant", quadrantWords[quadrantOf(task)] ?? "Ungraded"],
    ["System", systemName],
    [
      "Grade",
      [
        task.value ? `${VALUE_TEXT[task.value] ?? task.value} value` : null,
        task.effort ?? null,
      ]
        .filter(Boolean)
        .join(" · ") || "Not graded",
    ],
  ];
  if (task.due) facts.push(["Due", task.due]);
  if (task.day) facts.push(["Planned", task.day]);
  if (task.claimedBy) facts.push(["Agent", task.claimedBy]);

  return (
    <article className="console-detail" aria-labelledby="console-detail-title">
      <header className="console-detail-head">
        <h2 id="console-detail-title">{task.title}</h2>
        {task.done ? (
          <span className="console-done-tag">Done</span>
        ) : (
          <div
            className="console-detail-actions"
            role="group"
            aria-label="Task actions"
          >
            <button
              type="button"
              className="console-primary"
              onClick={() => onDone(task)}
            >
              Done
            </button>
            <ConsoleMenu
              label="Move"
              name={task.title}
              buttonClassName="console-secondary"
              items={moves.map((to) => ({
                label: rangeNames[to],
                onSelect: () => onMove(task, to),
              }))}
            />
            {onPlan && !task.details ? (
              <button
                type="button"
                className="console-secondary"
                aria-disabled={busy || undefined}
                title={
                  commanderBusy ??
                  "Plan with Commander: a details page with a test plan"
                }
                onClick={() => !busy && onPlan(task)}
              >
                Plan
              </button>
            ) : null}
            <button
              type="button"
              className="console-secondary"
              aria-disabled={busy || undefined}
              title={commanderBusy ?? "Ask the owner where this stands"}
              onClick={() => !busy && onStatus(task)}
            >
              Status
            </button>
            <button
              type="button"
              className="console-secondary"
              aria-disabled={busy || undefined}
              title={commanderBusy ?? "Dispatch to the owner"}
              onClick={() => !busy && onExecute(task)}
            >
              Execute
            </button>
            <button
              type="button"
              className="console-secondary"
              onClick={() => onCopyReference(task)}
            >
              Copy reference
            </button>
          </div>
        )}
      </header>
      {request ? (
        <p className="console-request" role="status">
          {request}
        </p>
      ) : null}
      <div className="console-detail-body">
        <dl className="console-facts">
          {facts.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {key && system ? (
          <section
            className="console-detail-section console-detail-ticket"
            aria-label="Ticket"
          >
            <h3 className="console-label">Ticket</h3>
            <p className="console-ticket">
              <span className="console-ticket-system">
                {TRACKER_NAME[system]}
              </span>{" "}
              {trackerUrl ? (
                <a href={trackerUrl} target="_blank" rel="noreferrer noopener">
                  {key}
                </a>
              ) : (
                <span>{key}</span>
              )}
              <span className="console-ticket-status"> · {ticketStatus}</span>
            </p>
          </section>
        ) : null}

        {prs.length ? (
          <section
            className="console-detail-section console-detail-pulls"
            aria-label="Pull requests"
          >
            <h3 className="console-label">
              Pull requests
              {pullsCopy && pulls?.fetchedAt
                ? ` · copy from ${formatAgo(new Date(pulls.fetchedAt), now)}`
                : ""}
            </h3>
            <ul className="console-pulls">
              {prs.map((pull) => (
                <li
                  key={`${pull.repo}#${pull.number}`}
                  className="console-pull"
                  data-state={pull.state}
                >
                  <span className="console-pull-state">
                    {pullStateWords[pull.state]}
                  </span>
                  <span className="console-pull-main">
                    {safeUrl(pull.url) ? (
                      <a
                        href={safeUrl(pull.url)!}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {pull.repo}#{pull.number}
                      </a>
                    ) : (
                      `${pull.repo}#${pull.number}`
                    )}{" "}
                    {pull.title}
                    {pullFacts(pull) ? (
                      <span className="console-pull-facts">
                        {pullFacts(pull)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          className="console-detail-section console-detail-page"
          aria-label="Details page"
        >
          <h3 className="console-label">
            Details page
            {details.state === "ready" && details.copiedAt
              ? ` · copy from ${formatAgo(new Date(details.copiedAt), now)}`
              : ""}
          </h3>
          {details.state === "loading" ? (
            <p className="console-note">Reading the page…</p>
          ) : null}
          {details.state === "none" ? (
            <p className="console-note">
              No details page yet. Plan asks Commander to write one with a test
              plan.
            </p>
          ) : null}
          {details.state === "missing" ? (
            <p className="console-note">
              The page is in the vault, but this device cannot read it and has
              no copy yet.
            </p>
          ) : null}
          {details.state === "ready" ? (
            <div className="console-md">
              <MarkdownBlocks blocks={blocks} allowLink={httpsOnly} />
              {details.page.truncated ? (
                <p className="console-note">
                  Only the start of a long page is shown.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </article>
  );
}
