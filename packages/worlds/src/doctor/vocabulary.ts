import type { AgentStatus } from "@atlas/core";

import type { Vocabulary } from "../types";

/**
 * A medical district at night, for work, not for patients. Every word here
 * is a metaphor for agents and their tasks, and none of it should read as a
 * clinical alert or as anything about a real person.
 */
export const doctorVocabulary: Vocabulary = {
  homeName: "The Practice",
  home: "home clinic",
  client: "hospital",
  clients: "hospitals",
  requirement: "department",
  item: "admission",
  agent: "staff member",
  agents: "staff",
  question: "pending test result",
  questions: "pending test results",
  decision: "recorded diagnosis",
  agentMessage: "ambulance run",
  externalEvent: "air ambulance",
  log: "Dispatch log",
};

export const doctorStatusNames: Record<AgentStatus, string> = {
  running: "on rounds",
  watching: "monitoring",
  waiting: "needs your sign-off",
  blocked: "on hold",
  error: "escalated",
  idle: "in the staff room",
};
