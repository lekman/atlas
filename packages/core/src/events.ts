/**
 * What happens in Atlas. Every change to the picture comes from one of these,
 * so the same event drives the database write, the animation, the log line
 * and the sound.
 */
import { z } from "zod/v4";

import {
  AgentStatus,
  Decision,
  Identifier,
  isVessel,
  type Agent,
  type Dataset,
} from "./model";
import { SessionAddress } from "./agent-questions";
import { findRecord } from "./records";

export const externalSources = [
  "github",
  "ci",
  "calendar",
  "jira",
  "mail",
  "monday",
  "claude",
  "atlas",
] as const;
export const ExternalSource = z.enum(externalSources);
export type ExternalSource = z.infer<typeof ExternalSource>;

export const externalSourceNames: Record<ExternalSource, string> = {
  github: "GitHub",
  ci: "CI",
  calendar: "Calendar",
  jira: "Jira",
  mail: "Mail",
  monday: "monday.com",
  claude: "Claude Code",
  atlas: "Atlas",
};

/** What a GitHub signal is about: a pull request, an issue, or a security alert. */
export const githubSignalKinds = ["pr", "issue", "alert"] as const;
export const GithubSignalKind = z.enum(githubSignalKinds);
export type GithubSignalKind = z.infer<typeof GithubSignalKind>;

/**
 * What a signal is about: a GitHub subject, a Claude Code session that hit
 * a usage limit, an agent that holds open work and is not working, or a
 * question a session asked the person.
 */
export const signalKinds = [
  ...githubSignalKinds,
  "usage-limit",
  "question",
  "agent",
] as const;
export const SignalKind = z.enum(signalKinds);
export type SignalKind = z.infer<typeof SignalKind>;

/**
 * Which subscription limit a Claude Code session hit: the five-hour
 * "session" limit, the "weekly" limit, or another kind Claude Code adds.
 */
export const usageLimitKinds = ["session", "weekly", "other"] as const;
export const UsageLimitKind = z.enum(usageLimitKinds);
export type UsageLimitKind = z.infer<typeof UsageLimitKind>;

export const alertTypes = [
  "dependabot",
  "code_scanning",
  "secret_scanning",
] as const;
export const AlertType = z.enum(alertTypes);
export type AlertType = z.infer<typeof AlertType>;

export const alertSeverities = ["critical", "high", "medium", "low"] as const;
export const AlertSeverity = z.enum(alertSeverities);
export type AlertSeverity = z.infer<typeof AlertSeverity>;

/** The dispatcher's rules on GitHub signals. */
export const githubDispatchRules = [
  "merge-approved",
  "fix-failed-checks",
  "alert-by-severity",
] as const;
export const GithubDispatchRule = z.enum(githubDispatchRules);
export type GithubDispatchRule = z.infer<typeof GithubDispatchRule>;

/** The dispatcher's rules on agents. */
export const agentDispatchRules = ["nudge-idle-with-work"] as const;
export const AgentDispatchRule = z.enum(agentDispatchRules);
export type AgentDispatchRule = z.infer<typeof AgentDispatchRule>;

/** The dispatcher's rules. Each has its own mode in the server's configuration. */
export const dispatchRules = [
  ...githubDispatchRules,
  ...agentDispatchRules,
] as const;
export const DispatchRule = z.enum(dispatchRules);
export type DispatchRule = z.infer<typeof DispatchRule>;

/**
 * What the dispatcher decided. `merge`, `delegate` and `digest` are acts;
 * with mode `dry` the act is only recorded. `skip` is a rule that applied
 * but whose conditions did not hold; `fail` is an act that was tried and
 * did not work.
 */
export const dispatchOutcomes = [
  "merge",
  "delegate",
  "digest",
  "skip",
  "fail",
] as const;
export const DispatchOutcome = z.enum(dispatchOutcomes);
export type DispatchOutcome = z.infer<typeof DispatchOutcome>;

const HttpsUrl = z.url({ protocol: /^https$/ });

/**
 * One happening on GitHub, matched to a task or not. It holds no text an
 * author wrote: `text` is built by the server from the kind, the event and
 * the number.
 */
export const GithubSignalEvent = z.object({
  type: z.literal("signal"),
  source: ExternalSource,
  /** The source's own id for the happening. One signal per key. */
  key: z.string().min(1).max(512),
  kind: GithubSignalKind,
  /** The source's event name, such as `ci_failed` or `opened`. */
  event: z.string().regex(/^[a-z][a-z_]{0,39}$/),
  /** `owner/name`. */
  repository: z.string().min(3).max(140),
  number: z.number().int().positive(),
  /** The client id the source gave, or null when it gave none. */
  client: Identifier.nullable(),
  url: HttpsUrl,
  /** The backlog items the signal matched. Empty when it matched none. */
  recordIds: z.array(Identifier),
  alertType: AlertType.optional(),
  severity: AlertSeverity.nullable().optional(),
  /** When the source saw it, ISO 8601. */
  at: z.iso.datetime(),
  text: z.string().min(1),
});
export type GithubSignalEvent = z.infer<typeof GithubSignalEvent>;

/**
 * A Claude Code session that hit a subscription usage limit. Read from
 * the session's transcript by the server; it holds the limit's kind and
 * reset time only, never the message Claude Code showed. `text` is the
 * fixed note the agent shows.
 */
export const UsageLimitSignalEvent = z.object({
  type: z.literal("signal"),
  source: z.literal("claude"),
  /** One signal per session and limit. */
  key: z.string().min(1).max(512),
  kind: z.literal("usage-limit"),
  event: z.literal("limit_reached"),
  /** The agent the session belongs to. */
  agentId: Identifier,
  /** The configured account the session ran under, or null when none is configured. */
  account: Identifier.nullable(),
  limitKind: UsageLimitKind,
  /** When the limit resets, ISO 8601, or null when Claude Code gave no time. */
  resetsAt: z.iso.datetime().nullable(),
  client: Identifier.nullable(),
  /** The agent's id, so the agent's log shows the signal. */
  recordIds: z.array(Identifier),
  /** When the session hit the limit, ISO 8601. */
  at: z.iso.datetime(),
  text: z.string().min(1),
});
export type UsageLimitSignalEvent = z.infer<typeof UsageLimitSignalEvent>;

/** How an agent's session stands when it holds open work and is not working. */
export const idleSessionStates = ["idle", "gone"] as const;
export const IdleSessionState = z.enum(idleSessionStates);
export type IdleSessionState = z.infer<typeof IdleSessionState>;

/**
 * An agent that holds an open task and whose session has been idle, or
 * gone, for longer than a threshold. The server finds it by joining the
 * task database's claims to the Claude Code sessions. `idle_with_work`
 * opens it; `cleared` closes it, with the same key, once the agent works
 * again or no longer holds open work. `text` is a fixed note built by the
 * server.
 */
export const IdleWithWorkSignalEvent = z.object({
  type: z.literal("signal"),
  source: z.literal("atlas"),
  /** One key per spell of idleness: the agent and when it began. */
  key: z.string().min(1).max(512),
  kind: z.literal("agent"),
  event: z.enum(["idle_with_work", "cleared"]),
  agentId: Identifier,
  /** `idle`: the session is live and idle. `gone`: no live session. */
  session: IdleSessionState,
  /** How long the session has been idle or gone, in whole minutes. */
  minutes: z.number().int().nonnegative(),
  /** The open tasks the agent holds, earliest claim first. */
  taskIds: z.array(Identifier),
  client: Identifier.nullable(),
  /** The agent and its tasks, so their logs show the signal. */
  recordIds: z.array(Identifier),
  at: z.iso.datetime(),
  text: z.string().min(1),
});
export type IdleWithWorkSignalEvent = z.infer<typeof IdleWithWorkSignalEvent>;

/**
 * A Claude Code session asked the person a question. `text` is the
 * question's title; a card's title is written for outside use, and a card
 * carries no question text anywhere.
 */
export const QuestionSignalEvent = z.object({
  type: z.literal("signal"),
  source: z.literal("claude"),
  /** `claude:question:<question id>`. */
  key: z.string().min(1).max(512),
  kind: z.literal("question"),
  event: z.literal("asked"),
  questionId: Identifier,
  /** The asking session's address. */
  session: SessionAddress,
  cardOnly: z.boolean(),
  client: Identifier.nullable(),
  /** The task the question is about, when the session named one. */
  recordIds: z.array(Identifier),
  /** When the session asked, ISO 8601. */
  at: z.iso.datetime(),
  text: z.string().min(1),
});
export type QuestionSignalEvent = z.infer<typeof QuestionSignalEvent>;

/** A happening in an outside system (GitHub, a Claude Code usage limit, an agent's question), or in Atlas itself. */
export const SignalEvent = z.discriminatedUnion("kind", [
  GithubSignalEvent,
  UsageLimitSignalEvent,
  IdleWithWorkSignalEvent,
  QuestionSignalEvent,
]);
export type SignalEvent = z.infer<typeof SignalEvent>;

/** What a GitHub rule decided about one signal, linked to it by `signalKey`. */
export const GithubDispatchEvent = z.object({
  type: z.literal("dispatch"),
  signalKey: z.string().min(1).max(512),
  rule: GithubDispatchRule,
  /** `dry` records the act without doing it. */
  mode: z.enum(["dry", "on"]),
  outcome: DispatchOutcome,
  repository: z.string().min(3).max(140),
  number: z.number().int().positive(),
  url: HttpsUrl,
  client: Identifier.nullable(),
  /** The decision also asks the reader to look. */
  needsYou: z.boolean(),
  /** The task a delegation created. */
  taskId: Identifier.optional(),
  /** Whether an agent was asked to start on the task. */
  woken: z.boolean().optional(),
  mergeMethod: z.enum(["squash", "merge", "rebase"]).optional(),
  text: z.string().min(1),
});
export type GithubDispatchEvent = z.infer<typeof GithubDispatchEvent>;

/**
 * What the nudge rule decided about an agent idle with open work. `wake`
 * asks the agent's session to continue a task; `ask` asks you to restart
 * a session that is gone; `fail` is a wake that was tried and did not work.
 */
export const agentDispatchOutcomes = ["wake", "ask", "skip", "fail"] as const;
export const AgentDispatchOutcome = z.enum(agentDispatchOutcomes);
export type AgentDispatchOutcome = z.infer<typeof AgentDispatchOutcome>;

export const AgentDispatchEvent = z.object({
  type: z.literal("dispatch"),
  signalKey: z.string().min(1).max(512),
  rule: AgentDispatchRule,
  /** `dry` records the act without doing it. */
  mode: z.enum(["dry", "on"]),
  outcome: AgentDispatchOutcome,
  agentId: Identifier,
  /** The task the agent is asked to continue first, then the rest it holds. */
  taskIds: z.array(Identifier),
  client: Identifier.nullable(),
  /** The decision also asks the reader to look. */
  needsYou: z.boolean(),
  /** Whether the session was asked to continue. */
  woken: z.boolean().optional(),
  /** The command that restarts a gone session, for you to run. */
  command: z.string().min(1).max(200).optional(),
  text: z.string().min(1),
});
export type AgentDispatchEvent = z.infer<typeof AgentDispatchEvent>;

/** What the dispatcher decided, linked to its signal by `signalKey`. */
export const DispatchEvent = z.discriminatedUnion("rule", [
  GithubDispatchEvent,
  AgentDispatchEvent,
]);
export type DispatchEvent = z.infer<typeof DispatchEvent>;

/**
 * What the account-switch rule decided about a usage-limit signal. `switch`
 * restarts the session under another account (with mode `dry` it is only
 * recorded); `skip` is a signal the rule did not act on, with the reason;
 * `fail` is a restart that was tried and did not work.
 */
export const accountSwitchOutcomes = ["switch", "skip", "fail"] as const;
export const AccountSwitchOutcome = z.enum(accountSwitchOutcomes);
export type AccountSwitchOutcome = z.infer<typeof AccountSwitchOutcome>;

export const AccountSwitchEvent = z.object({
  type: z.literal("account-switch"),
  signalKey: z.string().min(1).max(512),
  /** `dry` records the restart without doing it. */
  mode: z.enum(["dry", "on"]),
  outcome: AccountSwitchOutcome,
  agentId: Identifier,
  /** The account the session ran under. */
  from: Identifier.nullable(),
  /** The account it moves to; null when it does not move. */
  to: Identifier.nullable(),
  /** The decision also asks the reader to look. */
  needsYou: z.boolean(),
  text: z.string().min(1),
});
export type AccountSwitchEvent = z.infer<typeof AccountSwitchEvent>;

/**
 * An agent question moved on: `answered` (answered, closed as answered in
 * the client's own tools, or withdrawn) or `delivered` (the asking session
 * has the answer). Its text never holds a card's content.
 */
export const agentQuestionPhases = ["answered", "delivered"] as const;
export const AgentQuestionEvent = z.object({
  type: z.literal("agent-question"),
  questionId: Identifier,
  phase: z.enum(agentQuestionPhases),
  session: SessionAddress,
  client: Identifier.nullable(),
  /** The task the question is about, when the session named one. */
  recordIds: z.array(Identifier),
  text: z.string().min(1),
});
export type AgentQuestionEvent = z.infer<typeof AgentQuestionEvent>;

export const AtlasEvent = z.discriminatedUnion("type", [
  SignalEvent,
  DispatchEvent,
  AccountSwitchEvent,
  AgentQuestionEvent,
  z.object({
    type: z.literal("agent-message"),
    from: Identifier,
    to: Identifier,
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("external"),
    source: ExternalSource,
    recordId: Identifier,
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("status-change"),
    agentId: Identifier,
    to: AgentStatus,
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("question-answered"),
    questionId: Identifier,
    answer: z.string().min(1),
    decision: Decision,
  }),
  z.object({
    type: z.literal("agent-launched"),
    /** The new vessel's id. */
    agentId: Identifier,
    /** The agent it is launched from. */
    parentId: Identifier,
    name: z.string().min(1),
    /** Backlog item ids the vessel works. Absent means it stays by its parent. */
    workingOn: z.array(Identifier).optional(),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("agent-returned"),
    /** The vessel that has finished and goes back to its parent. */
    agentId: Identifier,
    text: z.string().min(1),
  }),
]);
export type AtlasEvent = z.infer<typeof AtlasEvent>;

export type LaunchEvent = Extract<AtlasEvent, { type: "agent-launched" }>;

/** Why an event was refused: it names something missing, or clashes. */
export interface Refusal {
  reason: "missing" | "conflict";
  message: string;
}

/**
 * The vessel a launch adds, or why it cannot. The parent must exist and
 * must not itself be a vessel; the new id must be free across every
 * record; every item the vessel works must exist.
 *
 * The vessel joins its parent's group, under its parent's account and on
 * its parent's host, running, and out of reach: a person opens the
 * parent's session, never a subagent's.
 */
export function planLaunch(
  dataset: Dataset,
  event: LaunchEvent,
): { vessel: Agent } | { refusal: Refusal } {
  const parent = dataset.agents.find((agent) => agent.id === event.parentId);
  if (!parent)
    return {
      refusal: { reason: "missing", message: `no agent ${event.parentId}` },
    };
  if (isVessel(parent))
    return {
      refusal: {
        reason: "conflict",
        message: `${event.parentId} is a launched vessel and cannot launch another`,
      },
    };
  if (findRecord(dataset, event.agentId))
    return {
      refusal: {
        reason: "conflict",
        message: `${event.agentId} already exists`,
      },
    };
  for (const itemId of event.workingOn ?? [])
    if (!dataset.items.some((item) => item.id === itemId))
      return { refusal: { reason: "missing", message: `no item ${itemId}` } };
  return {
    vessel: {
      id: event.agentId,
      classification: parent.classification,
      boundary: parent.boundary,
      groupId: parent.groupId,
      name: event.name,
      accountId: parent.accountId,
      host: parent.host,
      reach: "none",
      status: "running",
      workingOn: event.workingOn ?? [],
      note: event.text,
      parentId: parent.id,
    },
  };
}

/**
 * The dataset after an event, as a new value. Messages, external events,
 * signals, dispatcher and account-switch decisions change nothing stored; they are recorded in the log and drawn. A launch
 * adds a vessel and a return removes it. An event
 * that names something missing is returned unchanged rather than thrown, so
 * a late event about a deleted record cannot stop the stream.
 */
export function applyEvent(dataset: Dataset, event: AtlasEvent): Dataset {
  switch (event.type) {
    case "status-change":
      return {
        ...dataset,
        agents: dataset.agents.map((agent) =>
          agent.id === event.agentId
            ? { ...agent, status: event.to, note: event.text }
            : agent,
        ),
      };
    case "question-answered": {
      const question = dataset.questions.find(
        (record) => record.id === event.questionId,
      );
      if (!question || question.state === "answered") return dataset;
      return {
        ...dataset,
        questions: dataset.questions.map((record) =>
          record.id === event.questionId
            ? { ...record, state: "answered", answer: event.answer }
            : record,
        ),
        decisions: [
          ...dataset.decisions,
          { ...event.decision, fromQuestion: question.id },
        ],
      };
    }
    case "agent-launched": {
      const launch = planLaunch(dataset, event);
      if ("refusal" in launch) return dataset;
      return { ...dataset, agents: [...dataset.agents, launch.vessel] };
    }
    case "agent-returned": {
      const vessel = dataset.agents.find((agent) => agent.id === event.agentId);
      if (!vessel || !isVessel(vessel)) return dataset;
      return {
        ...dataset,
        agents: dataset.agents.filter((agent) => agent !== vessel),
      };
    }
    case "agent-message":
    case "external":
    case "signal":
    case "dispatch":
    case "account-switch":
    case "agent-question":
      return dataset;
  }
}
