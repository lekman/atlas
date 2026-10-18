/**
 * The Atlas data model.
 *
 * Every record carries two fields beyond its content: a classification (how
 * sensitive it is) and a boundary (where it is allowed to live). The boundary
 * rules in `boundaries.ts` read both before anything moves between places,
 * so a record that is missing either is not a valid record.
 */
import { z } from "zod/v4";

export const classifications = [
  "public",
  "internal",
  "client-confidential",
  "restricted",
] as const;
export const Classification = z.enum(classifications);
export type Classification = z.infer<typeof Classification>;

/** Lower-case words joined by hyphens: stable, readable in a URL and a log. */
export const Identifier = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "use lower-case words joined by hyphens");
export type Identifier = z.infer<typeof Identifier>;

const governed = {
  id: Identifier,
  classification: Classification,
  boundary: Identifier,
};

export const Client = z.object({
  ...governed,
  name: z.string().min(1),
  /**
   * Your own business. Exactly one client is home: the place admin work
   * lives, drawn at the centre of every world (Terra for the Astronomer,
   * the home port for the Mariner).
   */
  home: z.boolean().optional(),
});
export type Client = z.infer<typeof Client>;

export const runtimes = ["claude", "gemini", "n8n", "script"] as const;
export const Runtime = z.enum(runtimes);
export type Runtime = z.infer<typeof Runtime>;

/** A login an agent runs under. Several Claude accounts are normal. */
export const Account = z.object({
  id: Identifier,
  label: z.string().min(1),
  runtime: Runtime,
});
export type Account = z.infer<typeof Account>;

export const agentStatuses = [
  "running",
  "watching",
  "waiting",
  "blocked",
  "error",
  "idle",
] as const;
export const AgentStatus = z.enum(agentStatuses);
export type AgentStatus = z.infer<typeof AgentStatus>;

/** The statuses that put an agent on the reader's "needs you" list. */
export const attentionStatuses: readonly AgentStatus[] = [
  "waiting",
  "blocked",
  "error",
];

/**
 * How a person can reach the session. Remote Control works only for a
 * subscription sign-in, so an agent on an API key is `ssh` or `none`.
 */
export const reaches = ["remote-control", "ssh", "local", "none"] as const;
export const Reach = z.enum(reaches);
export type Reach = z.infer<typeof Reach>;

/** A group of agents, all working for one client (or for home). */
export const AgentGroup = z.object({
  ...governed,
  clientId: Identifier,
  name: z.string().min(1),
});
export type AgentGroup = z.infer<typeof AgentGroup>;

export const Agent = z.object({
  ...governed,
  groupId: Identifier,
  name: z.string().min(1),
  accountId: Identifier,
  host: z.string().min(1),
  reach: Reach,
  status: AgentStatus,
  /** Backlog item ids. The first is the one the agent is drawn beside. */
  workingOn: z.array(Identifier),
  note: z.string(),
});
export type Agent = z.infer<typeof Agent>;

export const Requirement = z.object({
  ...governed,
  clientId: Identifier,
  title: z.string().min(1),
  state: z.enum(["open", "done"]),
});
export type Requirement = z.infer<typeof Requirement>;

export const backlogStates = ["todo", "doing", "review", "done"] as const;
export const BacklogItem = z.object({
  ...governed,
  clientId: Identifier,
  requirementId: Identifier.optional(),
  title: z.string().min(1),
  state: z.enum(backlogStates),
  priority: z.enum(["high", "normal"]),
});
export type BacklogItem = z.infer<typeof BacklogItem>;

export const Question = z.object({
  ...governed,
  clientId: Identifier,
  title: z.string().min(1),
  /** The backlog item or requirement this question holds up. */
  blocks: Identifier,
  /** Who must answer. "You" puts the question on the needs-you list. */
  asks: z.string().min(1),
  state: z.enum(["open", "answered"]),
  answer: z.string().optional(),
});
export type Question = z.infer<typeof Question>;

export const Decision = z.object({
  ...governed,
  clientId: Identifier,
  title: z.string().min(1),
  /** The requirement or backlog item the decision settles. */
  decides: Identifier.optional(),
  /** Set when the decision came from answering a question. */
  fromQuestion: Identifier.optional(),
  state: z.enum(["made", "proposed"]),
});
export type Decision = z.infer<typeof Decision>;

export const Dataset = z.object({
  clients: z.array(Client),
  accounts: z.array(Account),
  groups: z.array(AgentGroup),
  agents: z.array(Agent),
  requirements: z.array(Requirement),
  items: z.array(BacklogItem),
  questions: z.array(Question),
  decisions: z.array(Decision),
});
export type Dataset = z.infer<typeof Dataset>;

/** The answerer who means "the person reading Atlas". */
export const YOU = "You";

/** The one client marked as home. */
export function homeOf(dataset: Dataset): Client {
  const home = dataset.clients.find((client) => client.home === true);
  if (!home) throw new Error("the dataset has no home client");
  return home;
}
