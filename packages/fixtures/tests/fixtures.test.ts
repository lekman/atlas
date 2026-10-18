import { describe, expect, it } from "bun:test";

import {
  applyEvent,
  AtlasEvent,
  findBrokenReferences,
  findRecord,
  homeOf,
  needsYou,
} from "@atlas/core";

import { sampleDataset, sampleScript } from "../src";

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
