import { sampleDataset } from "@atlas/fixtures";
import { describe, expect, test } from "bun:test";

import { ACTIVITY_FRESH_MS, createAgentActivity } from "../src";

const agentId = sampleDataset.agents[0]!.id;

function clock(start = Date.parse("2026-11-17T12:00:00Z")) {
  let t = start;
  return { now: () => new Date(t), advance: (ms: number) => (t += ms) };
}

describe("agent activity", () => {
  test("a reading is laid over its agent with the time it was read", () => {
    const c = clock();
    const store = createAgentActivity({ now: c.now });
    expect(
      store.set(agentId, { activity: "shell", contextTokens: 120_000 }),
    ).toBe(true);
    const agent = store
      .overlay(sampleDataset)
      .agents.find((a) => a.id === agentId);
    expect(agent).toMatchObject({
      activity: "shell",
      contextTokens: 120_000,
      activityAt: "2026-11-17T12:00:00.000Z",
    });
  });

  test("without readings the dataset is returned as it is", () => {
    const store = createAgentActivity();
    expect(store.overlay(sampleDataset)).toBe(sampleDataset);
  });

  test("a reading older than 30 minutes is dropped", () => {
    const c = clock();
    const store = createAgentActivity({ now: c.now });
    store.set(agentId, { activity: "reading", contextTokens: 10_000 });
    c.advance(ACTIVITY_FRESH_MS);
    const agent = store
      .overlay(sampleDataset)
      .agents.find((a) => a.id === agentId);
    expect(agent).not.toHaveProperty("activity");
    expect(agent).not.toHaveProperty("activityAt");
  });

  test("only a new activity or a tenth's move in context is a change", () => {
    const store = createAgentActivity();
    store.set(agentId, { activity: "editing", contextTokens: 100_000 });
    expect(
      store.set(agentId, { activity: "editing", contextTokens: 109_000 }),
    ).toBe(false);
    expect(
      store.set(agentId, { activity: "editing", contextTokens: 125_000 }),
    ).toBe(true);
    expect(
      store.set(agentId, { activity: "git", contextTokens: 125_000 }),
    ).toBe(true);
    expect(store.set(agentId, { activity: null, contextTokens: 125_000 })).toBe(
      true,
    );
  });

  test("an empty first reading is no change", () => {
    const store = createAgentActivity();
    expect(store.set(agentId, { activity: null, contextTokens: null })).toBe(
      false,
    );
  });
});
