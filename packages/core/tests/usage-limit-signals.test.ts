import { describe, expect, it } from "bun:test";

import {
  applyEvent,
  AtlasEvent,
  Dataset,
  type AccountSwitchEvent,
  type SignalEvent,
} from "../src";

const usageLimit = {
  type: "signal",
  source: "claude",
  key: "claude:usage-limit:halcyon-builder:2026-03-13T18:00:00.000Z",
  kind: "usage-limit",
  event: "limit_reached",
  agentId: "halcyon-builder",
  account: "ultra-a",
  limitKind: "weekly",
  resetsAt: "2026-03-13T18:00:00.000Z",
  client: "halcyon",
  recordIds: ["halcyon-builder"],
  at: "2026-03-12T09:10:00.000Z",
  text: "Weekly usage limit reached, resets 13 Mar 18:00",
} satisfies SignalEvent;

const accountSwitch = {
  type: "account-switch",
  signalKey: usageLimit.key,
  mode: "dry",
  outcome: "switch",
  agentId: "halcyon-builder",
  from: "ultra-a",
  to: "ultra-b",
  needsYou: false,
  text: "Would restart the session under account ultra-b",
} satisfies AccountSwitchEvent;

describe("usage-limit signals", () => {
  it("accepts a usage-limit signal from Claude Code, with or without a reset time or account", () => {
    expect(AtlasEvent.safeParse(usageLimit).success).toBe(true);
    expect(
      AtlasEvent.safeParse({ ...usageLimit, resetsAt: null, account: null })
        .success,
    ).toBe(true);
  });

  it("refuses an unknown limit kind, or a usage limit without an agent", () => {
    expect(
      AtlasEvent.safeParse({ ...usageLimit, limitKind: "monthly" }).success,
    ).toBe(false);
    const { agentId: _agentId, ...withoutAgent } = usageLimit;
    expect(AtlasEvent.safeParse(withoutAgent).success).toBe(false);
  });

  it("does not let a usage limit carry a repository's fields, or a GitHub signal lose them", () => {
    expect(AtlasEvent.safeParse({ ...usageLimit, kind: "pr" }).success).toBe(
      false,
    );
    expect(
      AtlasEvent.safeParse({ ...usageLimit, source: "github" }).success,
    ).toBe(false);
  });

  it("accepts an account-switch decision, and refuses an unknown outcome", () => {
    expect(AtlasEvent.safeParse(accountSwitch).success).toBe(true);
    expect(
      AtlasEvent.safeParse({
        ...accountSwitch,
        outcome: "skip",
        to: null,
        text: "Every other account is limited",
      }).success,
    ).toBe(true);
    expect(
      AtlasEvent.safeParse({ ...accountSwitch, outcome: "merge" }).success,
    ).toBe(false);
  });

  it("changes nothing in the dataset", () => {
    const before = Dataset.parse({
      clients: [],
      accounts: [],
      groups: [],
      agents: [],
      requirements: [],
      items: [],
      questions: [],
      decisions: [],
    });
    expect(applyEvent(before, usageLimit)).toBe(before);
    expect(applyEvent(before, accountSwitch)).toBe(before);
  });
});
