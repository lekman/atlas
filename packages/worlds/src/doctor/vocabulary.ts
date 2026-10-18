import type { AgentStatus } from "@atlas/core";

import type { Vocabulary } from "../types";

/**
 * A ward board for work, not for patients. Every word here is a metaphor for
 * agents and their tasks, and none of it should read as a clinical alert.
 */
export const doctorVocabulary: Vocabulary = {
  homeName: "The Nurses’ Station",
  home: "central desk",
  client: "ward",
  clients: "wards",
  requirement: "care goal",
  item: "treatment step",
  agent: "staff member",
  agents: "staff",
  question: "pending lab result",
  questions: "pending lab results",
  decision: "recorded diagnosis",
  agentMessage: "page",
  externalEvent: "lab feed",
  log: "Ward log",
};

export const doctorStatusNames: Record<AgentStatus, string> = {
  running: "on rounds",
  watching: "monitoring",
  waiting: "needs your sign-off",
  blocked: "on hold",
  error: "escalated",
  idle: "in the staff room",
};
