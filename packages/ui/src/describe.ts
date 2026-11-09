/**
 * Log lines in each world's voice. The event is the same; the sentence is
 * the world's, from its `phrases`.
 */
import {
  externalSourceNames,
  findRecord,
  type AtlasEvent,
  type Dataset,
} from "@atlas/core";
import type { World } from "@atlas/worlds";

/** Who a dispatcher decision comes from, in the log. */
export const dispatcherName = "Dispatcher";

/** Who an account-switch decision comes from, in the log. */
export const accountSwitchName = "Account switch";

/** Who an agent question's answer or delivery comes from, in the log. */
export const questionsName = "Questions";

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
  const { phrases } = world;
  switch (event.type) {
    case "agent-message":
      return phrases.message(
        nameOf(before, event.from),
        nameOf(before, event.to),
        event.text,
      );
    case "external":
      return phrases.external(
        externalSourceNames[event.source],
        nameOf(before, event.recordId),
        event.text,
      );
    case "signal": {
      // A usage limit or an idle agent names its agent. Otherwise the first
      // matched item names the subject, and an unmatched signal names its
      // repository.
      if (event.kind === "usage-limit" || event.kind === "agent")
        return phrases.external(
          externalSourceNames[event.source],
          nameOf(before, event.agentId),
          event.text,
        );
      // A question names its task when it has one, else the asking session.
      if (event.kind === "question") {
        const task = event.recordIds[0];
        return phrases.external(
          externalSourceNames[event.source],
          task ? nameOf(before, task) : event.session,
          event.text,
        );
      }
      const first = event.recordIds[0];
      return phrases.external(
        externalSourceNames[event.source],
        first ? nameOf(before, first) : event.repository,
        event.text,
      );
    }
    case "agent-question": {
      const task = event.recordIds[0];
      return phrases.external(
        questionsName,
        task ? nameOf(before, task) : event.session,
        event.text,
      );
    }
    case "account-switch":
      return phrases.external(
        accountSwitchName,
        nameOf(before, event.agentId),
        event.text,
      );
    case "dispatch":
      if (event.rule === "nudge-idle-with-work")
        return phrases.external(
          dispatcherName,
          nameOf(before, event.agentId),
          event.text,
        );
      return phrases.external(
        dispatcherName,
        event.taskId && findRecord(before, event.taskId)
          ? nameOf(before, event.taskId)
          : event.repository,
        event.text,
      );
    case "status-change": {
      const agent = before.agents.find(
        (candidate) => candidate.id === event.agentId,
      );
      const was = agent ? world.statusNames[agent.status] : "unknown";
      return phrases.status(
        agent?.name ?? event.agentId,
        was,
        world.statusNames[event.to],
        event.text,
      );
    }
    case "question-answered": {
      const client = before.clients.find(
        (candidate) => candidate.id === event.decision.clientId,
      );
      const where = client?.home
        ? world.vocabulary.homeName
        : (client?.name ?? "");
      return phrases.answered(event.decision.title, where);
    }
    case "agent-launched": {
      const task = event.workingOn?.[0];
      return phrases.launched(
        event.name,
        nameOf(before, event.parentId),
        task ? nameOf(before, task) : null,
        event.text,
      );
    }
    case "agent-returned": {
      const vessel = before.agents.find(
        (candidate) => candidate.id === event.agentId,
      );
      return phrases.returned(
        vessel?.name ?? event.agentId,
        vessel?.parentId ? nameOf(before, vessel.parentId) : "",
        event.text,
      );
    }
  }
}
