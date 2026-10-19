import type { AgentStatus } from "@atlas/core";

import type { Vocabulary } from "../types";

export const marinerVocabulary: Vocabulary = {
  homeName: "Turtle Bay",
  home: "home port",
  client: "island",
  clients: "islands",
  requirement: "anchorage",
  workstream: "buoy",
  item: "cargo",
  agent: "vessel",
  agents: "vessels",
  question: "fog bank",
  questions: "fog banks",
  decision: "lighthouse",
  agentMessage: "signal flags",
  externalEvent: "telegram",
  log: "Ship's log",
};

export const marinerStatusNames: Record<AgentStatus, string> = {
  running: "under sail",
  watching: "on watch",
  waiting: "at anchor, awaiting orders",
  blocked: "becalmed",
  error: "aground",
  idle: "in port",
};
