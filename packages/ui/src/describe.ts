/**
 * Log lines in each world's voice. The event is the same; the sentence is
 * the world's. Astronomer writes like a ship's console, Mariner like a log
 * book.
 */
import {
  externalSourceNames,
  findRecord,
  type AtlasEvent,
  type Dataset,
} from "@atlas/core";
import type { World } from "@atlas/worlds";

function nameOf(dataset: Dataset, id: string): string {
  const found = findRecord(dataset, id);
  if (!found) return id;
  return "title" in found.record ? found.record.title : found.record.name;
}

/** `before` is the dataset as it was when the event arrived, for "from" states. */
export function describeEvent(
  world: World,
  before: Dataset,
  event: AtlasEvent,
): string {
  const console = world.id === "astronomer";
  switch (event.type) {
    case "agent-message": {
      const from = nameOf(before, event.from);
      const to = nameOf(before, event.to);
      return console
        ? `BEAM ${from.toUpperCase()} → ${to.toUpperCase()} :: ${event.text}`
        : `Signal from ${from} to ${to}: “${event.text}”`;
    }
    case "external": {
      const source = externalSourceNames[event.source];
      const record = nameOf(before, event.recordId);
      return console
        ? `INBOUND // ${source.toUpperCase()} → ${record.toUpperCase()} :: ${event.text}`
        : `Telegram from ${source}, for ${record}: ${event.text}`;
    }
    case "status-change": {
      const agent = before.agents.find(
        (candidate) => candidate.id === event.agentId,
      );
      const name = agent?.name ?? event.agentId;
      const was = agent ? world.statusNames[agent.status] : "unknown";
      const now = world.statusNames[event.to];
      return console
        ? `${name.toUpperCase()} ${was.toUpperCase()} → ${now.toUpperCase()} :: ${event.text}`
        : `${name} now ${now}: ${event.text}`;
    }
    case "question-answered": {
      const client = before.clients.find(
        (candidate) => candidate.id === event.decision.clientId,
      );
      const where = client?.home
        ? world.vocabulary.homeName
        : (client?.name ?? "");
      return console
        ? `COMET RESOLVED :: CHARTED “${event.decision.title.toUpperCase()}”`
        : `Fog lifts over ${where}. Lighthouse lit: ${event.decision.title}`;
    }
  }
}
