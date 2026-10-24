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
import { findRecord } from "./records";

export const externalSources = [
  "github",
  "ci",
  "calendar",
  "jira",
  "mail",
  "monday",
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
};

export const AtlasEvent = z.discriminatedUnion("type", [
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
 * The dataset after an event, as a new value. Messages and external events
 * change nothing stored; they are recorded in the log and drawn. A launch
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
      return dataset;
  }
}
