import {
  type AgentStatus,
  clientOfAgent,
  findRecord,
  isOnMap,
  orderByUrgency,
  type Dataset,
  type DetailsDocument,
  type DevelopmentTracking,
  type TrackedIssue,
  type TrackedPullRequest,
} from "@atlas/core";
import { workstreamTerm, type World } from "@atlas/worlds";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { longDay } from "../../dates";
import { DetailsReader } from "../DetailsReader";
import { realTerm } from "../Inspector";

export interface DetailsPaneProps {
  /** Where the record and everything it links to are looked up. */
  dataset: Dataset;
  /** Whose words name the record; the real term is shown beside them. */
  world: World;
  /** The record to show. Another id shows another record in the same pane. */
  id: string;
  /** The record's details document, when one has been imported. */
  document?: DetailsDocument;
  /** The day it is read on, to say how fresh the document is. */
  today: string;
  /** Close was pressed. */
  onClose(): void;
  /** A linked record was picked, to show next. */
  onSelect(id: string): void;
  /** Open in Obsidian was pressed in the document, with its path in the vault. */
  onOpenInObsidian(sourcePath: string): void;
}

/**
 * Everything known about one record, in a pane over the map: its fields,
 * its development tracking, its history, the records it links to, and its
 * details document when there is one.
 *
 * The pane is often wide, so the sections sit side by side in columns that
 * fill it: the fields, then Tracking, then History and Links. The columns
 * wrap to two and then one as the pane narrows, and are one on a phone. The
 * reading order is the same at every width, because the columns are in
 * source order.
 *
 * The pane is blue glass so it reads as a layer over the chart rather than
 * part of it: the world's watching blue, 18% into its panel colour, at 88%
 * opacity, with the map blurred behind. Text is the world's ink, and the
 * field labels are ink too rather than the muted colour, because the muted
 * colour on a light world's tinted panel falls close to 4.5 : 1.
 */
export function DetailsPane({
  dataset,
  world,
  id,
  document,
  today,
  onClose,
  onSelect,
  onOpenInObsidian,
}: DetailsPaneProps) {
  const titleId = useId();
  const paneRef = useRef<HTMLElement>(null);
  // Opening the pane takes the keyboard to it; another record keeps it there.
  useEffect(() => paneRef.current?.focus(), []);
  const found = findRecord(dataset, id);
  if (!found) return null;
  const { vocabulary, statusNames } = world;
  const clientName = (clientId: string) => {
    const client = dataset.clients.find(
      (candidate) => candidate.id === clientId,
    );
    return client?.home ? vocabulary.homeName : (client?.name ?? clientId);
  };
  const link = (linkId: string) => {
    const target = findRecord(dataset, linkId);
    if (!target) return null;
    const text =
      "title" in target.record ? target.record.title : target.record.name;
    return (
      <li key={linkId}>
        <button
          type="button"
          className="atlas-link"
          onClick={() => onSelect(linkId)}
        >
          {text}
        </button>
      </li>
    );
  };
  const links = (ids: readonly string[]) =>
    ids.length ? (
      <ul className="atlas-details-links">{ids.map(link)}</ul>
    ) : null;

  const fields: Array<[string, ReactNode]> = [];
  const linked: Array<[string, ReactNode]> = [];
  let themed = "";
  let real = "";
  let title = "";
  let client = "";
  let summary: string | undefined;
  let history: ReactNode = null;
  let development: DevelopmentTracking | undefined;

  switch (found.kind) {
    case "agent": {
      const agent = found.record;
      const account = dataset.accounts.find(
        (candidate) => candidate.id === agent.accountId,
      );
      themed = vocabulary.agent;
      real = realTerm.agent;
      title = agent.name;
      client = clientName(clientOfAgent(dataset, agent));
      fields.push(["Status", `${statusNames[agent.status]} (${agent.status})`]);
      fields.push(["Now", agent.note]);
      fields.push(["Account", account?.label ?? agent.accountId]);
      fields.push(["Host", agent.host]);
      fields.push(["Reach", agent.reach.replace("-", " ")]);
      linked.push(["Works on", links(agent.workingOn)]);
      break;
    }
    case "group": {
      const group = found.record;
      themed = "group";
      real = realTerm.group;
      title = group.name;
      client = clientName(group.clientId);
      linked.push([
        vocabulary.agents,
        links(
          dataset.agents
            .filter((agent) => agent.groupId === group.id)
            .map((agent) => agent.id),
        ),
      ]);
      break;
    }
    case "requirement": {
      const requirement = found.record;
      themed = vocabulary.requirement;
      real = realTerm.requirement;
      title = requirement.title;
      client = clientName(requirement.clientId);
      fields.push(["State", requirement.state]);
      linked.push([
        "Work",
        links(
          dataset.items
            .filter((item) => item.requirementId === requirement.id)
            .map((item) => item.id),
        ),
      ]);
      linked.push([
        "Decided",
        links(
          dataset.decisions
            .filter((decision) => decision.decides === requirement.id)
            .map((decision) => decision.id),
        ),
      ]);
      break;
    }
    case "workstream": {
      const workstream = found.record;
      const work = dataset.items.filter(
        (item) => item.workstreamId === workstream.id,
      );
      themed = workstreamTerm(vocabulary, dataset, workstream.clientId);
      real = realTerm.workstream;
      title = workstream.title;
      client = clientName(workstream.clientId);
      summary = workstream.summary;
      fields.push(["Items", String(work.length)]);
      linked.push([
        "Most urgent",
        links(orderByUrgency(work.filter(isOnMap)).map((item) => item.id)),
      ]);
      break;
    }
    case "item": {
      const item = found.record;
      themed = vocabulary.item;
      real = realTerm.item;
      title = item.title;
      client = clientName(item.clientId);
      summary = item.summary;
      const blockers = dataset.questions.filter(
        (question) => question.blocks === item.id && question.state === "open",
      );
      fields.push(["State", item.state]);
      fields.push(["Priority", item.priority]);
      fields.push([
        "Scheduled",
        item.scheduledFor ? longDay(item.scheduledFor) : "Not scheduled",
      ]);
      if (item.doneOn) fields.push(["Done", longDay(item.doneOn)]);
      fields.push(["Blocked", item.blocked || blockers.length ? "Yes" : "No"]);
      if (item.tracker)
        fields.push([
          "Tracker",
          <a href={item.tracker.url} target="_blank" rel="noopener noreferrer">
            {item.tracker.key}
          </a>,
        ]);
      if (item.effort) fields.push(["Effort", item.effort]);
      if (item.value) fields.push(["Value", String(item.value)]);
      if (item.history?.length)
        history = (
          <ul className="atlas-details-history">
            {item.history.map((entry, index) => (
              <li key={index}>
                {entry.kind === "added" ? "Added" : "Moved"} {longDay(entry.on)}
                {entry.from ? `, from ${longDay(entry.from)}` : ""}
              </li>
            ))}
          </ul>
        );
      development = item.development;
      if (item.requirementId) linked.push(["For", links([item.requirementId])]);
      if (item.workstreamId)
        linked.push([
          workstreamTerm(vocabulary, dataset, item.clientId),
          links([item.workstreamId]),
        ]);
      linked.push([
        "Blocked by",
        links(blockers.map((question) => question.id)),
      ]);
      linked.push([
        vocabulary.agents,
        links(
          dataset.agents
            .filter((agent) => agent.workingOn.includes(item.id))
            .map((agent) => agent.id),
        ),
      ]);
      linked.push([
        "Decided",
        links(
          dataset.decisions
            .filter((decision) => decision.decides === item.id)
            .map((decision) => decision.id),
        ),
      ]);
      break;
    }
    case "question": {
      const question = found.record;
      themed = vocabulary.question;
      real = realTerm.question;
      title = question.title;
      client = clientName(question.clientId);
      fields.push(["State", question.state]);
      fields.push(["Who answers", question.asks]);
      if (question.answer) fields.push(["Answer", question.answer]);
      linked.push(["Blocks", links([question.blocks])]);
      break;
    }
    case "decision": {
      const decision = found.record;
      themed = vocabulary.decision;
      real = realTerm.decision;
      title = decision.title;
      client = clientName(decision.clientId);
      fields.push(["State", decision.state]);
      if (decision.decides) linked.push(["Decides", links([decision.decides])]);
      if (decision.fromQuestion)
        linked.push(["From", links([decision.fromQuestion])]);
      break;
    }
  }
  const shownLinks = linked.filter(([, value]) => value !== null);
  const tracking = development && trackingRows(development);

  return (
    <aside
      className="atlas-details-pane"
      aria-label={`Details of ${title}`}
      ref={paneRef}
      tabIndex={-1}
    >
      <header className="atlas-details-pane-header">
        <p className="atlas-eyebrow">
          {themed} · {client}
        </p>
        <h2 id={titleId}>{title}</h2>
        <p className="atlas-real-term">{real} · Details</p>
        <button
          type="button"
          className="atlas-button atlas-close"
          onClick={onClose}
          aria-label="Close details"
        >
          Close
        </button>
      </header>
      <div
        className="atlas-details-pane-body"
        // A scrolling region has to be reachable from the keyboard.
        tabIndex={0}
        role="region"
        aria-labelledby={titleId}
      >
        {summary && <p className="atlas-details-summary">{summary}</p>}
        <div className="atlas-details-columns">
          <dl className="atlas-details-fields">
            <div>
              <dt>{world.name}</dt>
              <dd>{themed}</dd>
            </div>
            <div>
              <dt>Real term</dt>
              <dd>{real}</dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>{client}</dd>
            </div>
            {fields.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {tracking && tracking.length > 0 && (
            <section aria-labelledby={`${titleId}-tracking`}>
              <h3 id={`${titleId}-tracking`}>Tracking</h3>
              <dl className="atlas-details-fields">
                {tracking.map(([term, value]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {(history || shownLinks.length > 0) && (
            <div className="atlas-details-column">
              {history && (
                <section aria-labelledby={`${titleId}-history`}>
                  <h3 id={`${titleId}-history`}>History</h3>
                  {history}
                </section>
              )}
              {shownLinks.length > 0 && (
                <section aria-labelledby={`${titleId}-links`}>
                  <h3 id={`${titleId}-links`}>Links</h3>
                  <dl className="atlas-details-fields">
                    {shownLinks.map(([term, value]) => (
                      <div key={term}>
                        <dt>{term}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </div>
          )}
        </div>
        {document && (
          <DetailsReader
            document={document}
            world={world}
            clientName={client}
            today={today}
            onClose={onClose}
            onOpenInObsidian={onOpenInObsidian}
            onOpenTicket={(url) =>
              window.open(url, "_blank", "noopener,noreferrer")
            }
          />
        )}
      </div>
    </aside>
  );
}

/** A link to GitHub, opened in a new tab that cannot reach back to Atlas. */
function outside(url: string, text: string) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  );
}

/**
 * The Tracking rows: the issue, the branch and the pull request, each only
 * when the record has it.
 */
function trackingRows({
  issue,
  branch,
  pullRequest,
}: DevelopmentTracking): Array<[string, ReactNode]> {
  const rows: Array<[string, ReactNode]> = [];
  if (issue)
    rows.push([
      "Issue",
      <span className="atlas-details-tracking">
        {outside(issue.url, issue.key)}
        <StatusLabel tone={toneOf.issue[issue.state]}>
          {issue.state}
        </StatusLabel>
      </span>,
    ]);
  if (branch)
    rows.push([
      "Branch",
      <span className="atlas-details-tracking">
        <code>{branch.name}</code>
        {branch.worktree && (
          <span className="atlas-details-worktree">
            on a worktree, <code>{branch.worktree.path}</code>
          </span>
        )}
      </span>,
    ]);
  if (pullRequest)
    rows.push([
      "Pull request",
      <span className="atlas-details-tracking">
        {outside(pullRequest.url, `#${pullRequest.number}`)}
        <StatusLabel tone={toneOf.pullRequest[pullRequest.state]}>
          {pullRequest.state}
        </StatusLabel>
        <StatusLabel tone={toneOf.checks[pullRequest.checks]}>
          {pullRequest.checks === "none"
            ? "no checks"
            : `checks ${pullRequest.checks}`}
        </StatusLabel>
      </span>,
    ]);
  return rows;
}

/**
 * Which status colour each tracking state takes: green for work moving or
 * landed, blue for a pull request waiting on review or checks still
 * running, red for failing checks, grey for draft, closed and nothing.
 */
const toneOf: {
  issue: Record<TrackedIssue["state"], AgentStatus>;
  pullRequest: Record<TrackedPullRequest["state"], AgentStatus>;
  checks: Record<TrackedPullRequest["checks"], AgentStatus>;
} = {
  issue: { open: "running", closed: "idle" },
  pullRequest: {
    draft: "idle",
    open: "watching",
    merged: "running",
    closed: "idle",
  },
  checks: {
    passing: "running",
    pending: "watching",
    failing: "error",
    none: "idle",
  },
};

/**
 * A state as a small label: the word in ink, with a border and a square in
 * the status colour. The word carries the meaning, so the colour is never
 * the only sign. The text is ink because status colours as text fall under
 * 4.5 : 1 on the Mariner's blue glass (green about 4.2 : 1, grey about
 * 4.0 : 1), where ink is about 10.9 : 1.
 */
function StatusLabel({
  tone,
  children,
}: {
  tone: AgentStatus;
  children: ReactNode;
}) {
  return (
    <span className="atlas-status-label" data-tone={tone}>
      {children}
    </span>
  );
}
