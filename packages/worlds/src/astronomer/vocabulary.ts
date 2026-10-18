import type { AgentStatus } from "@atlas/core";

import type { Vocabulary } from "../types";

export const astronomerVocabulary: Vocabulary = {
  homeName: "Terra",
  home: "home planet",
  client: "star system",
  clients: "star systems",
  requirement: "planet",
  item: "moon",
  agent: "probe",
  agents: "probes",
  question: "comet",
  questions: "comets",
  decision: "charted star",
  agentMessage: "tight beam",
  externalEvent: "inbound transmission",
  log: "Comms log",
};

export const astronomerStatusNames: Record<AgentStatus, string> = {
  running: "underway",
  watching: "scanning",
  waiting: "hailing you",
  blocked: "adrift",
  error: "hull fault",
  idle: "docked",
};
