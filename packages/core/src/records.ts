/**
 * Looking records up across the dataset, and checking that every reference
 * points at something that exists.
 */
import type {
  Agent,
  AgentGroup,
  BacklogItem,
  Dataset,
  Decision,
  Question,
  Requirement,
} from "./model";
import { attentionStatuses, YOU } from "./model";

export type RecordKind =
  | "agent"
  | "group"
  | "requirement"
  | "item"
  | "question"
  | "decision";

export type AnyRecord =
  | { kind: "agent"; record: Agent }
  | { kind: "group"; record: AgentGroup }
  | { kind: "requirement"; record: Requirement }
  | { kind: "item"; record: BacklogItem }
  | { kind: "question"; record: Question }
  | { kind: "decision"; record: Decision };

export function findRecord(dataset: Dataset, id: string): AnyRecord | null {
  const agent = dataset.agents.find((record) => record.id === id);
  if (agent) return { kind: "agent", record: agent };
  const group = dataset.groups.find((record) => record.id === id);
  if (group) return { kind: "group", record: group };
  const requirement = dataset.requirements.find((record) => record.id === id);
  if (requirement) return { kind: "requirement", record: requirement };
  const item = dataset.items.find((record) => record.id === id);
  if (item) return { kind: "item", record: item };
  const question = dataset.questions.find((record) => record.id === id);
  if (question) return { kind: "question", record: question };
  const decision = dataset.decisions.find((record) => record.id === id);
  if (decision) return { kind: "decision", record: decision };
  return null;
}

/** The client an agent works for, through its group. */
export function clientOfAgent(dataset: Dataset, agent: Agent): string {
  const group = dataset.groups.find(
    (candidate) => candidate.id === agent.groupId,
  );
  if (!group)
    throw new Error(`agent ${agent.id} names unknown group ${agent.groupId}`);
  return group.clientId;
}

export function agentsOfClient(dataset: Dataset, clientId: string): Agent[] {
  return dataset.agents.filter(
    (agent) => clientOfAgent(dataset, agent) === clientId,
  );
}

/** Every reference in the dataset that names a record that does not exist. */
export function findBrokenReferences(dataset: Dataset): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const all = [
    ...dataset.clients,
    ...dataset.accounts,
    ...dataset.groups,
    ...dataset.agents,
    ...dataset.requirements,
    ...dataset.items,
    ...dataset.questions,
    ...dataset.decisions,
  ];
  const homes = dataset.clients.filter((client) => client.home === true).length;
  if (homes !== 1)
    problems.push(`expected exactly one home client, found ${homes}`);
  for (const record of all) {
    if (ids.has(record.id)) problems.push(`duplicate id ${record.id}`);
    ids.add(record.id);
  }
  const clientIds = new Set(dataset.clients.map((client) => client.id));
  const need = (
    owner: string,
    field: string,
    id: string | undefined,
    pool: Set<string>,
  ) => {
    if (id !== undefined && !pool.has(id))
      problems.push(`${owner}.${field} names unknown ${id}`);
  };
  const groupIds = new Set(dataset.groups.map((group) => group.id));
  const accountIds = new Set(dataset.accounts.map((account) => account.id));
  const requirementIds = new Set(
    dataset.requirements.map((requirement) => requirement.id),
  );
  const itemIds = new Set(dataset.items.map((item) => item.id));
  const workIds = new Set([...requirementIds, ...itemIds]);

  for (const group of dataset.groups)
    need(group.id, "clientId", group.clientId, clientIds);
  for (const agent of dataset.agents) {
    need(agent.id, "groupId", agent.groupId, groupIds);
    need(agent.id, "accountId", agent.accountId, accountIds);
    for (const id of agent.workingOn) need(agent.id, "workingOn", id, itemIds);
  }
  for (const requirement of dataset.requirements)
    need(requirement.id, "clientId", requirement.clientId, clientIds);
  for (const item of dataset.items) {
    need(item.id, "clientId", item.clientId, clientIds);
    need(item.id, "requirementId", item.requirementId, requirementIds);
  }
  for (const question of dataset.questions) {
    need(question.id, "clientId", question.clientId, clientIds);
    need(question.id, "blocks", question.blocks, workIds);
  }
  for (const decision of dataset.decisions) {
    need(decision.id, "clientId", decision.clientId, clientIds);
    need(decision.id, "decides", decision.decides, workIds);
  }
  return problems;
}

export interface NeedsYouEntry {
  id: string;
  kind: "question" | "agent";
  title: string;
  detail: string;
  clientId: string;
  /** For an agent, its status; for a question, always `waiting`. */
  status: Agent["status"];
}

/**
 * What the reader has to act on: questions only they can answer first, then
 * agents waiting on them, blocked or failed.
 */
export function needsYou(dataset: Dataset): NeedsYouEntry[] {
  const titleOf = (id: string) => {
    const found = findRecord(dataset, id);
    return found && "title" in found.record ? found.record.title : id;
  };
  const questions: NeedsYouEntry[] = dataset.questions
    .filter((question) => question.state === "open" && question.asks === YOU)
    .map((question) => ({
      id: question.id,
      kind: "question",
      title: question.title,
      detail: `Blocks ${titleOf(question.blocks)}`,
      clientId: question.clientId,
      status: "waiting",
    }));
  const agents: NeedsYouEntry[] = dataset.agents
    .filter((agent) => attentionStatuses.includes(agent.status))
    .map((agent) => ({
      id: agent.id,
      kind: "agent",
      title: agent.name,
      detail: agent.note,
      clientId: clientOfAgent(dataset, agent),
      status: agent.status,
    }));
  return [...questions, ...agents];
}
