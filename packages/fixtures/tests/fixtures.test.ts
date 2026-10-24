import { describe, expect, it } from "bun:test";

import {
  applyEvent,
  AtlasEvent,
  bandOf,
  findBrokenReferences,
  findRecord,
  homeOf,
  isCarriedOver,
  isNotWorthIt,
  isOnMap,
  isSized,
  needsYou,
} from "@atlas/core";

import {
  busyClientId,
  busyDataset,
  sampleDataset,
  sampleDayPlan,
  sampleImportReport,
  sampleScript,
  sampleToday,
} from "../src";

describe("sample dataset", () => {
  it("has no broken references", () => {
    expect(findBrokenReferences(sampleDataset)).toEqual([]);
  });

  it("has a home and four clients", () => {
    expect(homeOf(sampleDataset).name).toBe("Ashgrove Consulting");
    expect(sampleDataset.clients).toHaveLength(5);
  });

  it("gives every client two to four workstreams", () => {
    for (const client of sampleDataset.clients) {
      const count = sampleDataset.workstreams.filter(
        (workstream) => workstream.clientId === client.id,
      ).length;
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it("puts every item on the map, one of them unsorted", () => {
    for (const item of sampleDataset.items) expect(isOnMap(item)).toBe(true);
    expect(
      sampleDataset.items.filter((item) => item.workstreamId === undefined),
    ).toHaveLength(1);
  });

  it("starts with something that needs you", () => {
    expect(needsYou(sampleDataset).length).toBeGreaterThan(3);
  });
});

describe("busy dataset", () => {
  const items = busyDataset.items.filter(
    (item) => item.clientId === busyClientId,
  );

  it("has no broken references", () => {
    expect(findBrokenReferences(busyDataset)).toEqual([]);
  });

  it("gives one client about a hundred items over six workstreams", () => {
    expect(items).toHaveLength(100);
    expect(
      busyDataset.workstreams.filter(
        (workstream) => workstream.clientId === busyClientId,
      ),
    ).toHaveLength(6);
    expect(items.some((item) => item.workstreamId === undefined)).toBe(true);
  });

  it("mixes states, priorities and days, with backlog left unscheduled", () => {
    for (const state of ["todo", "doing", "review", "done"])
      expect(items.some((item) => item.state === state)).toBe(true);
    for (const priority of ["high", "normal", "low"])
      expect(items.some((item) => item.priority === priority)).toBe(true);
    const unscheduled = items.filter(
      (item) => item.state === "todo" && item.scheduledFor === undefined,
    );
    expect(unscheduled.length).toBeGreaterThan(20);
    expect(items.filter((item) => !isOnMap(item)).length).toBeGreaterThan(40);
  });

  it("is the same every time", async () => {
    const again = await import(`../src/busy.ts?again=${Date.now()}`);
    expect(again.busyDataset).toEqual(busyDataset);
  });
});

describe("sample script", () => {
  it("only names records that exist when each step happens", () => {
    let dataset = sampleDataset;
    for (const step of sampleScript) {
      if (step.type === "reset") continue;
      expect(AtlasEvent.safeParse(step).success).toBe(true);
      const ids =
        step.type === "agent-message"
          ? [step.from, step.to]
          : step.type === "external"
            ? [step.recordId]
            : step.type === "status-change" || step.type === "agent-returned"
              ? [step.agentId]
              : step.type === "agent-launched"
                ? [step.parentId, ...(step.workingOn ?? [])]
                : [step.questionId];
      for (const id of ids) expect(findRecord(dataset, id)).not.toBeNull();
      if (step.type === "agent-launched")
        expect(findRecord(dataset, step.agentId)).toBeNull();
      dataset = applyEvent(dataset, step);
    }
  });

  it("launches two vessels from one agent and returns one of them", () => {
    let dataset = sampleDataset;
    for (const step of sampleScript)
      if (step.type !== "reset") dataset = applyEvent(dataset, step);
    const launched = sampleScript.filter(
      (step) => step.type === "agent-launched",
    );
    expect(launched.map((step) => step.parentId)).toEqual([
      "tracking",
      "tracking",
    ]);
    expect(
      dataset.agents.filter((agent) => agent.parentId === "tracking"),
    ).toHaveLength(1);
  });

  it("can be replayed end to end", () => {
    let dataset = sampleDataset;
    for (const step of sampleScript) {
      if (step.type !== "reset") dataset = applyEvent(dataset, step);
    }
    expect(findBrokenReferences(dataset)).toEqual([]);
    expect(
      dataset.decisions.some(
        (decision) => decision.fromQuestion === "drill-window",
      ),
    ).toBe(true);
  });

  it("ends with a reset so a story can loop it", () => {
    expect(sampleScript.at(-1)).toEqual({ type: "reset" });
  });
});

describe("sample day plan", () => {
  const clientIds = new Set(sampleDataset.clients.map((client) => client.id));
  const documentIds = new Set(
    sampleDayPlan.documents.map((document) => document.id),
  );

  it("names only clients and documents that exist", () => {
    for (const item of sampleDayPlan.items) {
      expect(clientIds.has(item.clientId)).toBe(true);
      if (item.detailsId) expect(documentIds.has(item.detailsId)).toBe(true);
    }
    for (const record of [
      ...sampleDayPlan.notes,
      ...sampleDayPlan.calendar,
      ...sampleDayPlan.documents,
      ...sampleImportReport.counts,
      ...sampleImportReport.waitingForSize,
    ]) {
      expect(clientIds.has(record.clientId)).toBe(true);
    }
  });

  it("covers every band and the states the day list draws", () => {
    const bands = new Set(
      sampleDayPlan.items.map((item) => bandOf(item.scheduledFor, sampleToday)),
    );
    expect([...bands].sort()).toEqual([
      "future",
      "today",
      "tomorrow",
      "unscheduled",
    ]);
    const items = sampleDayPlan.items;
    expect(items.some((item) => item.blocked)).toBe(true);
    expect(items.some((item) => item.state === "done")).toBe(true);
    expect(items.some(isNotWorthIt)).toBe(true);
    expect(items.some((item) => !isSized(item))).toBe(true);
    expect(items.some((item) => isCarriedOver(item, sampleToday))).toBe(true);
  });

  it("uses addresses that cannot lead anywhere", () => {
    for (const item of sampleDayPlan.items) {
      if (item.tracker)
        expect(new URL(item.tracker.url).hostname).toMatch(/\.example$/);
    }
  });
});
