import type { AgentStatus } from "@atlas/core";

import type { Vocabulary } from "../types";

export const samuraiVocabulary: Vocabulary = {
  homeName: "The Castle",
  home: "home keep",
  client: "clan",
  clients: "clans",
  requirement: "objective",
  workstream: "camp",
  item: "campaign",
  agent: "retainer",
  agents: "retainers",
  vessel: "attendant",
  vessels: "attendants",
  question: "scout's report",
  questions: "scouts' reports",
  decision: "seal",
  agentMessage: "messenger",
  externalEvent: "courier",
  log: "Chronicle",
};

export const samuraiStatusNames: Record<AgentStatus, string> = {
  running: "on campaign",
  watching: "keeping watch",
  waiting: "awaiting your command",
  blocked: "besieged",
  error: "wounded",
  idle: "at rest",
};
