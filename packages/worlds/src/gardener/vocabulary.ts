import type { AgentStatus } from "@atlas/core";

import type { Vocabulary } from "../types";

export const gardenerVocabulary: Vocabulary = {
  homeName: "The Homestead",
  home: "home garden",
  client: "bed",
  clients: "beds",
  requirement: "seed row",
  workstream: "cold frame",
  item: "plant",
  agent: "bee",
  agents: "bees",
  question: "dandelion clock",
  questions: "dandelion clocks",
  decision: "trellis",
  agentMessage: "pollen drift",
  externalEvent: "weather",
  log: "Garden diary",
};

export const gardenerStatusNames: Record<AgentStatus, string> = {
  running: "tending",
  watching: "keeping watch",
  waiting: "waiting for you",
  blocked: "parched",
  error: "blighted",
  idle: "resting in the hive",
};

/** What a plant looks like at each backlog state, for the legend and the drawing. */
export const growthStages = {
  todo: "seed",
  doing: "sprout",
  review: "bud",
  done: "bloom",
} as const;
