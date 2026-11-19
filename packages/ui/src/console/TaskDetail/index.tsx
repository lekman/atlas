import { parseMarkdown, splitFrontMatter } from "@atlas/core/markdown";
import { useMemo, type ReactNode } from "react";

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
  /** Marks a task from Dashboard.md done; database tasks use `onState`. */
  onDone(task: WorkItem): void;
  /** Sets a database task's state, from the Status dropdown. */
  onState?(task: WorkItem, state: DatabaseState): void;
  onMove(task: WorkItem, to: Range): void;
  onStatus(task: WorkItem): void;
  onExecute(task: WorkItem): void;
  /** Sets or clears (null) a database task's business value or effort, from the Grade selectors. */
  onAssess?(task: WorkItem, change: GradeChange): void;
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

export const VALUE_CHOICES = [
  "veryHigh",
  "high",
  "medium",
  "low",
  "none",
  "negative",
] as const;
export const EFFORT_CHOICES = ["XS", "S", "M", "L", "XL"] as const;

export type GradeChange = {
  value?: (typeof VALUE_CHOICES)[number] | null;
  effort?: (typeof EFFORT_CHOICES)[number] | null;
};

export type DatabaseState =
  "todo" | "doing" | "review" | "approved" | "merged" | "done" | "dropped";

export const DATABASE_STATE_WORDS: Record<DatabaseState, string> = {
  todo: "To do",
  doing: "Doing",
  review: "In review",
  approved: "Approved",
  merged: "Merged",
  done: "Done",
  dropped: "Dropped",
};

/**
 * The task's state in the task database. Older worklists carry only the
 * done mark and the `active` flag, which stands for doing or review; that
 * reads as doing.
 */
export function databaseStateOf(task: WorkItem): DatabaseState {
  if (task.state && task.state in DATABASE_STATE_WORDS)
    return task.state as DatabaseState;
  if (task.done) return "done";
  const flags = task.flags ?? [];
  if (flags.includes("merged")) return "merged";
  if (flags.includes("approved")) return "approved";
  return flags.includes("active") ? "doing" : "todo";
}

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
 * pane (they wrap under it on a narrow one): Move, Status, Execute and Copy
 * reference. Then its facts, where the status, value and effort are
 * dropdowns that set them on the task (Done is a status), the
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
  onState,
  onMove,
  onStatus,
  onExecute,
  onPlan,
  onAssess,
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

  const fromDatabase = Boolean(task.ref?.startsWith("db:"));
  const state = databaseStateOf(task);
  const statusValue: ReactNode =
    fromDatabase && onState ? (
      <select
        className="console-state"
        aria-label="Status"
        data-state={state}
        value={state}
        onChange={(e) => onState(task, e.target.value as DatabaseState)}
      >
        {(Object.keys(DATABASE_STATE_WORDS) as DatabaseState[]).map((s) => (
          <option key={s} value={s}>
            {DATABASE_STATE_WORDS[s]}
          </option>
        ))}
      </select>
    ) : task.done || fromDatabase ? (
      statusWord
    ) : (
      <select
        className="console-state"
        aria-label="Status"
        data-state="todo"
        value="open"
        onChange={(e) => e.target.value === "done" && onDone(task)}
      >
        <option value="open">{statusWord}</option>
        <option value="done">Done</option>
      </select>
    );

  const gradeValue: ReactNode =
    fromDatabase && onAssess ? (
      <span className="console-grade-picks">
        <select
          className="console-state"
          aria-label="Value"
          data-state={task.value ? "set" : "none"}
          value={task.value ?? ""}
          onChange={(e) =>
            onAssess(task, {
              value: (e.target.value || null) as GradeChange["value"],
            })
          }
        >
          <option value="">Value not set</option>
          {VALUE_CHOICES.map((v) => (
            <option key={v} value={v}>
              {`${VALUE_TEXT[v]} value`.replace(/^./, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
        <select
          className="console-state"
          aria-label="Effort"
          data-state={task.effort ? "set" : "none"}
          value={task.effort ?? ""}
          onChange={(e) =>
            onAssess(task, {
              effort: (e.target.value || null) as GradeChange["effort"],
            })
          }
        >
          <option value="">Effort not set</option>
          {EFFORT_CHOICES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </span>
    ) : (
      [
        task.value ? `${VALUE_TEXT[task.value] ?? task.value} value` : null,
        task.effort ?? null,
      ]
        .filter(Boolean)
        .join(" · ") || "Not graded"
    );

  const facts: Array<[string, ReactNode]> = [
    ["Status", statusValue],
    ["Grade", gradeValue],
    [
      "Quadrant",
      <span title="Follows from the value and the due date">
        {quadrantWords[quadrantOf(task)] ?? "Ungraded"}
      </span>,
    ],
    ["System", systemName],
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
            <ConsoleMenu
              label="Move"
              name={task.title}
              buttonClassName="console-secondary"
              items={moves.map((to) => ({
                label: rangeNames[to],
                onSelect: () => onMove(task, to),
              }))}
            />
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
          aria-label="Details"
        >
          <h3 className="console-label">
            Details
            {details.state === "ready" && details.copiedAt
              ? ` · copy from ${formatAgo(new Date(details.copiedAt), now)}`
              : ""}
          </h3>
          {details.state === "loading" ? (
            <p className="console-note">Reading the page…</p>
          ) : null}
          {details.state === "none" ? (
            <p className="console-note">No details recorded.</p>
          ) : null}
          {details.state === "none" && onPlan && !task.done ? (
            <button
              type="button"
              className="console-secondary console-plan"
              aria-disabled={busy || undefined}
              title={
                commanderBusy ??
                "Ask Commander for a details page with a test plan"
              }
              onClick={() => !busy && onPlan(task)}
            >
              Plan
            </button>
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
