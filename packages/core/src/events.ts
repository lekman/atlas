/**
 * What happens in Atlas. Every change to the picture comes from one of these,
 * so the same event drives the database write, the animation, the log line
 * and the sound.
 */
import { z } from "zod/v4";

import { AgentStatus, Decision, Identifier, type Dataset } from "./model";

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
]);
export type AtlasEvent = z.infer<typeof AtlasEvent>;

/**
 * The dataset after an event, as a new value. Messages and external events
 * change nothing stored; they are recorded in the log and drawn. An event
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
    case "agent-message":
    case "external":
      return dataset;
  }
}
