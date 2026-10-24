/**
 * The log for one record: the map events about it, and for a backlog item
 * the entries agents wrote in the task database's item log, merged newest
 * first. Pure functions, so the filter and the order are tested without a
 * browser.
 */
import {
  externalSourceNames,
  findRecord,
  type AtlasEvent,
  type Dataset,
  type ItemLogEntry,
  type ItemLogStatus,
} from "@atlas/core";
import type { World } from "@atlas/worlds";

import { describeEvent } from "./describe";
import type { LogEntry } from "./useAtlasMap";

/** An event from the server's log, as `GET /api/events` returns it. */
export interface RecordedEvent {
  sequence: number;
  /** When the server received it, ISO 8601. */
  receivedAt: string;
  event: AtlasEvent;
}

/** One line of a record's log. */
export interface LogLine {
  /** Unique within the log, for React. */
  key: string;
  time: Date;
  /** Who it came from: an agent, an outside system, or the item log's writer. */
  who: string;
  /** The item's state an item log entry records. Absent for a map event. */
  status?: ItemLogStatus;
  text: string;
}

/**
 * Events the server logged before this page opened, as log entries, newest
 * first. The page has no dataset from before each of them, so each is
 * described against `dataset`: a status change then names the agent's
 * status as it is now, not as it was before the change.
 */
export function recordedEntries(
  dataset: Dataset,
  recorded: readonly RecordedEvent[],
): LogEntry[] {
  return [...recorded]
    .sort((left, right) => right.sequence - left.sequence)
    .map((stored) => ({
      // Negative, so an id never meets one the live log hands out.
      id: -stored.sequence,
      time: new Date(stored.receivedAt),
      event: stored.event,
      before: dataset,
    }));
}

/** The items an agent was working on, in `dataset`. */
function workOf(dataset: Dataset, agentId: string): readonly string[] {
  return dataset.agents.find((agent) => agent.id === agentId)?.workingOn ?? [];
}

/**
 * Whether an event is about a record, judged against `before`, the dataset
 * as it was when the event arrived.
 *
 * For a backlog item: an outside event about it, a launch that works it, a
 * status change or a message from an agent working it, a vessel working it
 * coming back, and a question answered that blocked it. For an agent: its
 * messages, status changes, launches and returns. For a question: its
 * answer. For any record: an outside event that names it.
 */
export function isAbout(
  before: Dataset,
  event: AtlasEvent,
  recordId: string,
): boolean {
  if (event.type === "external") return event.recordId === recordId;
  const kind = findRecord(before, recordId)?.kind;
  switch (event.type) {
    case "agent-message":
      return kind === "agent"
        ? event.from === recordId || event.to === recordId
        : workOf(before, event.from).includes(recordId);
    case "status-change":
      return kind === "agent"
        ? event.agentId === recordId
        : workOf(before, event.agentId).includes(recordId);
    case "agent-launched":
      return (
        event.agentId === recordId ||
        event.parentId === recordId ||
        (event.workingOn ?? []).includes(recordId)
      );
    case "agent-returned": {
      if (event.agentId === recordId) return true;
      const vessel = before.agents.find((agent) => agent.id === event.agentId);
      return (
        vessel?.parentId === recordId ||
        (vessel?.workingOn ?? []).includes(recordId)
      );
    }
    case "question-answered": {
      const question = before.questions.find(
        (candidate) => candidate.id === event.questionId,
      );
      return (
        event.questionId === recordId ||
        question?.blocks === recordId ||
        event.decision.decides === recordId ||
        event.decision.id === recordId
      );
    }
  }
}

function agentName(dataset: Dataset, id: string): string {
  return dataset.agents.find((agent) => agent.id === id)?.name ?? id;
}

/** Who an event came from, in plain words. */
export function whoOf(before: Dataset, event: AtlasEvent): string {
  switch (event.type) {
    case "agent-message":
      return agentName(before, event.from);
    case "external":
      return externalSourceNames[event.source];
    case "status-change":
    case "agent-returned":
      return agentName(before, event.agentId);
    case "agent-launched":
      return agentName(before, event.parentId);
    case "question-answered":
      return "Answer";
  }
}

/**
 * The agent an item log entry's writer names, matched on id or name without
 * regard to case, or the name as written when no agent matches.
 */
function writerName(dataset: Dataset, by: string | undefined): string {
  if (!by) return "Task database";
  const key = by.trim().toLowerCase();
  const agent = dataset.agents.find(
    (candidate) =>
      candidate.id === key || candidate.name.trim().toLowerCase() === key,
  );
  return agent?.name ?? by;
}

export interface RecordLogInput {
  world: World;
  /** The dataset as it is now, to name an item log entry's writer. */
  dataset: Dataset;
  /** The record whose log this is. */
  recordId: string;
  /** Every map event the page has, live and recorded, newest first. */
  entries: readonly LogEntry[];
  /** The item's log from the task database, for a backlog item. */
  itemLog?: readonly ItemLogEntry[];
}

/**
 * A record's log, newest first: the map events about it, described in the
 * world's voice, and its item log entries. At the same moment a map event
 * comes before an item log entry.
 */
export function recordLogLines({
  world,
  dataset,
  recordId,
  entries,
  itemLog = [],
}: RecordLogInput): LogLine[] {
  const events: LogLine[] = entries
    .filter((entry) => isAbout(entry.before, entry.event, recordId))
    .map((entry) => ({
      key: `event-${entry.id}`,
      time: entry.time,
      who: whoOf(entry.before, entry.event),
      text: describeEvent(world, entry.before, entry.event),
    }));
  const notes: LogLine[] = itemLog.map((entry, index) => ({
    key: `item-log-${index}-${entry.at}`,
    time: new Date(entry.at),
    who: writerName(dataset, entry.by),
    status: entry.status,
    text: entry.note,
  }));
  return [...events, ...notes].sort(
    (left, right) => right.time.getTime() - left.time.getTime(),
  );
}
