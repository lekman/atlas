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
  isSized,
  needsYou,
} from "@atlas/core";

import {
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

  it("starts with something that needs you", () => {
    expect(needsYou(sampleDataset).length).toBeGreaterThan(3);
  });
});

describe("sample script", () => {
  it("only names records that exist", () => {
    for (const step of sampleScript) {
      if (step.type === "reset") continue;
      expect(AtlasEvent.safeParse(step).success).toBe(true);
      const ids =
        step.type === "agent-message"
          ? [step.from, step.to]
          : step.type === "external"
            ? [step.recordId]
            : step.type === "status-change"
              ? [step.agentId]
              : [step.questionId];
      for (const id of ids)
        expect(findRecord(sampleDataset, id)).not.toBeNull();
    }
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
