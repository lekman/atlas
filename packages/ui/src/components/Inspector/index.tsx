import { clientOfAgent, findRecord, type Dataset } from "@atlas/core";
import type { World } from "@atlas/worlds";
import type { ReactNode } from "react";

export type InspectorAction =
  | "open-session"
  | "ask-status"
  | "pause"
  | "answer"
  | "dispatch"
  | "open-record";

export interface InspectorProps {
  /** Where the record and everything it links to are looked up. */
  dataset: Dataset;
  /** Whose words name the record; the real term is shown beneath. */
  world: World;
  /** The record to show: an agent, group, requirement, item, question or decision. */
  id: string;
  /** The close button was pressed. */
  onClose(): void;
  /** A linked record was picked, to show next. */
  onSelect(id: string): void;
  /** A button was pressed. The parent carries it out; the inspector only reports it. */
  onAction(action: InspectorAction, id: string): void;
}

const realTerm = {
  agent: "Agent",
  group: "Agent group",
  requirement: "Requirement",
  item: "Backlog item",
  question: "Open question",
  decision: "Decision",
} as const;

/**
 * One record, in the world's words with the real term beneath, its links,
 * and the actions that apply. Buttons keep plain words in every world.
 */
export function Inspector({
  dataset,
  world,
  id,
  onClose,
  onSelect,
  onAction,
}: InspectorProps) {
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
    case "item": {
      const item = found.record;
      themed = vocabulary.item;
      title = item.title;
      client = clientName(item.clientId);
      subtitle = `${realTerm.item} · ${item.state}${item.priority === "high" ? " · high priority" : ""}`;
      if (item.requirementId) rows.push(["For", link(item.requirementId)]);
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

  return (
    <aside className="atlas-inspector" aria-labelledby="atlas-inspector-title">
      <button
        type="button"
        className="atlas-button atlas-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <p className="atlas-eyebrow">
        {themed} · {client}
      </p>
      <h2 id="atlas-inspector-title">{title}</h2>
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
      {actions.length > 0 && (
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
      )}
    </aside>
  );
}
