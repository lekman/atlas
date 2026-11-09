import { describe, expect, it } from "bun:test";

import {
  AtlasEvent,
  type DispatchEvent,
  type IdleWithWorkSignalEvent,
} from "../src";

const signal = {
  type: "signal",
  source: "atlas",
  key: "atlas:idle-with-work:halcyon-builder:2026-11-09T11:26:00.000Z",
  kind: "agent",
  event: "idle_with_work",
  agentId: "halcyon-builder",
  session: "idle",
  minutes: 34,
  taskIds: ["retry-webhooks", "rotate-keys"],
  client: "halcyon",
  recordIds: ["halcyon-builder", "retry-webhooks", "rotate-keys"],
  at: "2026-11-09T12:00:00.000Z",
  text: "Idle 34 min with 2 open tasks",
} satisfies IdleWithWorkSignalEvent;

const nudge = {
  type: "dispatch",
  signalKey: signal.key,
  rule: "nudge-idle-with-work",
  mode: "dry",
  outcome: "wake",
  agentId: "halcyon-builder",
  taskIds: ["retry-webhooks"],
  client: "halcyon",
  needsYou: false,
  text: "Would wake the session to continue Retry the webhooks",
} satisfies DispatchEvent;

describe("idle-with-work signals", () => {
  it("accepts an agent idle with open work, and its clearing", () => {
    expect(AtlasEvent.safeParse(signal).success).toBe(true);
    expect(
      AtlasEvent.safeParse({
        ...signal,
        event: "cleared",
        text: "Working again",
      }).success,
    ).toBe(true);
    expect(
      AtlasEvent.safeParse({ ...signal, session: "gone", client: null })
        .success,
    ).toBe(true);
  });

  it("refuses another source, session state or a negative age", () => {
    expect(AtlasEvent.safeParse({ ...signal, source: "github" }).success).toBe(
      false,
    );
    expect(AtlasEvent.safeParse({ ...signal, session: "busy" }).success).toBe(
      false,
    );
    expect(AtlasEvent.safeParse({ ...signal, minutes: -1 }).success).toBe(
      false,
    );
  });

  it("accepts a nudge decision about an agent, with or without a restart command", () => {
    expect(AtlasEvent.safeParse(nudge).success).toBe(true);
    expect(
      AtlasEvent.safeParse({
        ...nudge,
        mode: "on",
        outcome: "ask",
        needsYou: true,
        command: "cc-restart Builder",
        text: "Needs a restart: cc-restart Builder",
      }).success,
    ).toBe(true);
  });

  it("refuses a nudge decision shaped as a pull request decision, and the reverse", () => {
    expect(AtlasEvent.safeParse({ ...nudge, outcome: "merge" }).success).toBe(
      false,
    );
    const { agentId: _, ...withoutAgent } = nudge;
    expect(AtlasEvent.safeParse(withoutAgent).success).toBe(false);
    expect(
      AtlasEvent.safeParse({ ...nudge, rule: "fix-failed-checks" }).success,
    ).toBe(false);
  });
});
