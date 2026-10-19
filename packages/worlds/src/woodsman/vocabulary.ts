import type { AgentStatus } from "@atlas/core";

import type { Vocabulary } from "../types";

export const woodsmanVocabulary: Vocabulary = {
  homeName: "Base Camp",
  home: "home camp",
  client: "clearing",
  clients: "clearings",
  requirement: "waymark",
  workstream: "signpost",
  item: "cairn",
  agent: "scout",
  agents: "scouts",
  question: "unmarked fork",
  questions: "unmarked forks",
  decision: "blazed tree",
  agentMessage: "bird call",
  externalEvent: "runner from the trailhead",
  log: "Field notes",
};

export const woodsmanStatusNames: Record<AgentStatus, string> = {
  running: "on the trail",
  watching: "on lookout",
  waiting: "waiting at the fork for you",
  blocked: "lost",
  error: "turned back",
  idle: "at camp",
};
