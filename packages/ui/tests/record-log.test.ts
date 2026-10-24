import { describe, expect, it } from "bun:test";

import { applyEvent, type AtlasEvent, type ItemLogEntry } from "@atlas/core";
import { sampleDataset, sampleRecordedEvents } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";

import {
  isAbout,
  recordedEntries,
  recordLogLines,
  whoOf,
} from "../src/recordLog";
import type { LogEntry } from "../src/useAtlasMap";

/** The scripted day replayed, each entry with the dataset just before it. */
function replay(events: readonly AtlasEvent[]): LogEntry[] {
  let dataset = sampleDataset;
  const entries: LogEntry[] = events.map((event, index) => {
    const entry = {
      id: index + 1,
      time: new Date(Date.UTC(2026, 9, 24, 9, index * 4)),
      event,
      before: dataset,
    };
    dataset = applyEvent(dataset, event);
    return entry;
  });
  return entries.reverse();
}

const scripted = sampleRecordedEvents.map((stored) => stored.event);

describe("which events are about a record", () => {
  const about = (recordId: string) =>
    replay(scripted)
      .filter((entry) => isAbout(entry.before, entry.event, recordId))
      .map((entry) => entry.event)
      .reverse();

  it("finds an item's outside events, and what the agents working it said and did", () => {
    expect(about("webhooks")).toEqual([
      scripted[10], // Tracking answers the roll call.
      scripted[11], // CI: build 412 failed a contract test.
      scripted[12], // Tracking waits on you.
      scripted[18], // Tracking retries with the fixed contract.
    ] as AtlasEvent[]);
  });

  it("finds a launch that works an item, and the vessel's return", () => {
    const events = about("rate-limits");
    expect(events.map((event) => event.type)).toEqual([
      "agent-launched",
      "agent-returned",
      "agent-message",
      "status-change",
      "status-change",
    ]);
  });

  it("finds a question answered that blocked an item", () => {
    expect(about("weekend-drill").map((event) => event.type)).toEqual([
      "external",
      "question-answered",
    ]);
  });

  it("judges an agent's work as it was when the event arrived", () => {
    const status: AtlasEvent = {
      type: "status-change",
      agentId: "tracking",
      to: "running",
      text: "Back on it",
    };
    const elsewhere = {
      ...sampleDataset,
      agents: sampleDataset.agents.map((agent) =>
        agent.id === "tracking" ? { ...agent, workingOn: [] } : agent,
      ),
    };
    expect(isAbout(sampleDataset, status, "webhooks")).toBe(true);
    expect(isAbout(elsewhere, status, "webhooks")).toBe(false);
  });

  it("finds an agent's messages both ways, and its status changes", () => {
    expect(about("roll-call").map((event) => event.type)).toEqual([
      "agent-message",
      "agent-message",
      "agent-message",
    ]);
    expect(about("test-runner").map((event) => event.type)).toEqual([
      "status-change",
      "status-change",
    ]);
  });

  it("finds a question's answer", () => {
    expect(about("drill-window").map((event) => event.type)).toEqual([
      "question-answered",
    ]);
  });

  it("names who each event came from", () => {
    const [message, , outside] = scripted;
    expect(whoOf(sampleDataset, message!)).toBe("Schema");
    expect(whoOf(sampleDataset, outside!)).toBe("GitHub");
  });
});

describe("a record's log", () => {
  const itemLog: ItemLogEntry[] = [
    {
      at: "2026-10-24T09:51:00.000Z",
      status: "blocked",
      note: "Contract test 7 rejects the retry header",
      by: "tracking",
    },
    {
      at: "2026-10-24T09:44:00.000Z",
      status: "doing",
      note: "Same minute as the CI event",
      by: "Harbour pilot",
    },
    { at: "2026-10-24T08:15:00.000Z", status: "doing", note: "Claimed" },
  ];

  it("merges events and item log entries, newest first, an event first at the same moment", () => {
    const lines = recordLogLines({
      world: worlds.mariner,
      dataset: sampleDataset,
      recordId: "webhooks",
      entries: replay(scripted),
      itemLog,
    });
    expect(
      lines.map((line) => [line.time.toISOString().slice(11, 16), line.who]),
    ).toEqual([
      ["10:12", "Tracking"],
      ["09:51", "Tracking"],
      ["09:48", "Tracking"],
      ["09:44", "CI"],
      ["09:44", "Harbour pilot"],
      ["09:40", "Tracking"],
      ["08:15", "Task database"],
    ]);
    expect(lines[1]).toMatchObject({
      status: "blocked",
      text: "Contract test 7 rejects the retry header",
    });
    expect(lines[0]?.status).toBeUndefined();
    expect(lines[0]?.text).toContain("Retrying with the fixed contract");
    expect(new Set(lines.map((line) => line.key)).size).toBe(lines.length);
  });

  it("shows only events for a record without an item log", () => {
    const lines = recordLogLines({
      world: worlds.astronomer,
      dataset: sampleDataset,
      recordId: "drill-window",
      entries: replay(scripted),
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.who).toBe("Answer");
  });

  it("turns recorded events into entries, newest first, described against the dataset given", () => {
    const entries = recordedEntries(
      sampleDataset,
      [...sampleRecordedEvents].reverse(),
    );
    expect(entries.map((entry) => entry.id)).toEqual(
      sampleRecordedEvents.map((stored) => -stored.sequence).reverse(),
    );
    expect(entries[0]?.time.toISOString()).toBe(
      sampleRecordedEvents.at(-1)?.receivedAt,
    );
    expect(entries.every((entry) => entry.before === sampleDataset)).toBe(true);
  });
});
