import {
  clientOfAgent,
  findRecord,
  isOnMap,
  orderByUrgency,
  type Dataset,
} from "@atlas/core";
import { workstreamTerm, type World } from "@atlas/worlds";
import { useId, type ReactNode } from "react";

export type InspectorAction =
  | "open-session"
  | "ask-status"
  | "pause"
  | "answer"
  | "dispatch"
  | "open-record"
  | "details";

export interface InspectorProps {
  /** Where the record and everything it links to are looked up. */
  dataset: Dataset;
  /** Whose words name the record; the real term is shown beneath. */
  world: World;
  /** The record to show: an agent, group, requirement, workstream, item, question or decision. */
  id: string;
  /** The close button was pressed. */
  onClose(): void;
  /** A linked record was picked, to show next. */
  onSelect(id: string): void;
  /** A button was pressed. The parent carries it out; the inspector only reports it. */
  onAction(action: InspectorAction, id: string): void;
  /**
   * A card on its own, or embedded in the HUD: tighter, with its title one
   * heading level down, under the HUD's own sections.
   */
  variant?: "card" | "embedded";
}

/** The real name of each kind of record, shown under the world's word. */
export const realTerm = {
  agent: "Agent",
  group: "Agent group",
  requirement: "Requirement",
  workstream: "Workstream",
  item: "Backlog item",
  question: "Open question",
  decision: "Decision",
} as const;

/**
 * One record, in the world's words with the real term beneath, its links,
 * and the actions that apply. Every record has Details, which the parent
 * opens as a pane with everything known about it. Buttons keep plain words
 * in every world.
 */
export function Inspector({
  dataset,
  world,
  id,
  onClose,
  onSelect,
  onAction,
  variant = "card",
}: InspectorProps) {
  const titleId = useId();
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
      <button
        type="button"
        className="atlas-link"
        key={linkId}
        onClick={() => onSelect(linkId)}
      >
        {text}
      </button>
    );
  };
  const rows: Array<[string, ReactNode]> = [];
  let themed = "";
  let title = "";
  let client = "";
  let subtitle = "";
  let actions: Array<[InspectorAction, string]> = [];

  switch (found.kind) {
    case "agent": {
      const agent = found.record;
      const account = dataset.accounts.find(
        (candidate) => candidate.id === agent.accountId,
      );
      themed = vocabulary.agent;
      title = agent.name;
      client = clientName(clientOfAgent(dataset, agent));
      subtitle = `${realTerm.agent} on ${account?.label ?? agent.accountId} · ${agent.host}`;
      rows.push([
        "Status",
        <span style={{ color: `var(--atlas-${agent.status})` }}>
          {statusNames[agent.status]}{" "}
          <span className="atlas-mute">({agent.status})</span>
        </span>,
      ]);
      rows.push(["Now", agent.note]);
      rows.push([
        "Works on",
        agent.workingOn.length ? agent.workingOn.map(link) : "Nothing assigned",
      ]);
      rows.push(["Reach", agent.reach.replace("-", " ")]);
      actions = [
        ["open-session", "Open session"],
        ["ask-status", "Ask status"],
        ["pause", "Pause"],
      ];
      break;
    }
    case "requirement": {
      const requirement = found.record;
      themed = vocabulary.requirement;
      title = requirement.title;
      client = clientName(requirement.clientId);
      subtitle = `${realTerm.requirement} · ${requirement.state}`;
      const work = dataset.items
        .filter((item) => item.requirementId === requirement.id)
        .map((item) => item.id);
      const decided = dataset.decisions
        .filter((decision) => decision.decides === requirement.id)
        .map((decision) => decision.id);
      if (work.length) rows.push(["Work", work.map(link)]);
      if (decided.length) rows.push(["Decided", decided.map(link)]);
      actions = [["open-record", "Open record"]];
      break;
    }
    case "workstream": {
      const workstream = found.record;
      const work = dataset.items.filter(
        (item) => item.workstreamId === workstream.id,
      );
      const onMap = orderByUrgency(work.filter(isOnMap));
      const offMap = work.filter((item) => !isOnMap(item));
      themed = workstreamTerm(vocabulary, dataset, workstream.clientId);
      title = workstream.title;
      client = clientName(workstream.clientId);
      subtitle = `${realTerm.workstream} · ${onMap.length} on the map`;
      if (workstream.summary) rows.push(["About", workstream.summary]);
      if (onMap.length)
        rows.push(["Most urgent", onMap.map((item) => link(item.id))]);
      if (offMap.length)
        rows.push([
          "Not drawn",
          `${offMap.length} done or not yet planned for a day`,
        ]);
      break;
    }
    case "item": {
      const item = found.record;
      themed = vocabulary.item;
      title = item.title;
      client = clientName(item.clientId);
      subtitle = `${realTerm.item} · ${item.state}${item.priority === "high" ? " · high priority" : ""}`;
      if (item.requirementId) rows.push(["For", link(item.requirementId)]);
      if (item.workstreamId)
        rows.push([
          workstreamTerm(vocabulary, dataset, item.clientId),
          link(item.workstreamId),
        ]);
      const blockers = dataset.questions.filter(
        (question) => question.blocks === item.id && question.state === "open",
      );
      if (blockers.length)
        rows.push([
          "Blocked by",
          blockers.map((question) => link(question.id)),
        ]);
      const agents = dataset.agents.filter((agent) =>
        agent.workingOn.includes(item.id),
      );
      if (agents.length)
        rows.push([vocabulary.agents, agents.map((agent) => link(agent.id))]);
      // One compact line; the Details pane has the issue, branch and links.
      const pullRequest = item.development?.pullRequest;
      if (pullRequest)
        rows.push([
          "Pull request",
          `#${pullRequest.number} · ${pullRequest.state} · ${pullRequest.checks === "none" ? "no checks" : `checks ${pullRequest.checks}`}`,
        ]);
      actions = [
        ["dispatch", "Dispatch"],
        ["ask-status", "Ask status"],
      ];
      break;
    }
    case "question": {
      const question = found.record;
      themed = vocabulary.question;
      title = question.title;
      client = clientName(question.clientId);
      subtitle = `${realTerm.question} · ${question.state} · waiting on ${question.asks}`;
      rows.push(["Blocks", link(question.blocks)]);
      if (question.answer) rows.push(["Answer", question.answer]);
      actions = question.state === "open" ? [["answer", "Answer"]] : [];
      break;
    }
    case "decision": {
      const decision = found.record;
      themed = vocabulary.decision;
      title = decision.title;
      client = clientName(decision.clientId);
      subtitle = `${realTerm.decision} · ${decision.state}`;
      if (decision.decides) rows.push(["Decides", link(decision.decides)]);
      if (decision.fromQuestion)
        rows.push(["From", link(decision.fromQuestion)]);
      actions = [["open-record", "Open record"]];
      break;
    }
    case "group": {
      const group = found.record;
      themed = "group";
      title = group.name;
      client = clientName(group.clientId);
      subtitle = realTerm.group;
      break;
    }
  }

  actions.push(["details", "Details"]);
  const embedded = variant === "embedded";
  const Frame = embedded ? "article" : "aside";
  const Title = embedded ? "h3" : "h2";

  return (
    <Frame
      className="atlas-inspector"
      data-variant={variant}
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="atlas-button atlas-close"
        onClick={onClose}
        // Embedded, the name carries the title, so it never matches another
        // Close on the same screen.
        aria-label={embedded ? `Close ${title}` : "Close"}
      >
        ×
      </button>
      <p className="atlas-eyebrow">
        {themed} · {client}
      </p>
      <Title id={titleId}>{title}</Title>
      <p className="atlas-real-term">{subtitle}</p>
      {rows.length > 0 && (
        <dl>
          {rows.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="atlas-actions">
        {actions.map(([action, text]) => (
          <button
            type="button"
            className="atlas-button"
            key={action}
            onClick={() => onAction(action, id)}
          >
            {text}
          </button>
        ))}
      </div>
    </Frame>
  );
}
