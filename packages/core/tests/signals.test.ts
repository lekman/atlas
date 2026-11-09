import { describe, expect, it } from "bun:test";

import {
  applyEvent,
  AtlasEvent,
  Dataset,
  type DispatchEvent,
  type SignalEvent,
} from "../src";

const repository = "example-org/sample-app";

const signal = {
  type: "signal",
  source: "github",
  key: `${repository}#12:ci_failed:0123456789abcdef0123456789abcdef01234567`,
  kind: "pr",
  event: "ci_failed",
  repository,
  number: 12,
  client: "ashgrove",
  url: `https://github.com/${repository}/pull/12`,
  recordIds: [],
  at: "2026-11-09T10:00:00.000Z",
  text: "Pull request #12: checks failed",
} satisfies SignalEvent;

const dispatch = {
  type: "dispatch",
  signalKey: signal.key,
  rule: "fix-failed-checks",
  mode: "on",
  outcome: "delegate",
  repository,
  number: 12,
  url: signal.url,
  client: "ashgrove",
  needsYou: false,
  taskId: "01m6zt2bnmky7vw4syps58am30",
  woken: true,
  text: "Delegated a fix for the failing checks",
} satisfies DispatchEvent;

describe("signals", () => {
  it("accepts a GitHub signal, matched or not", () => {
    expect(AtlasEvent.safeParse(signal).success).toBe(true);
    expect(
      AtlasEvent.safeParse({ ...signal, recordIds: ["retry-webhooks"] })
        .success,
    ).toBe(true);
    expect(AtlasEvent.safeParse({ ...signal, client: null }).success).toBe(
      true,
    );
  });

  it("accepts an alert signal with its type and severity", () => {
    expect(
      AtlasEvent.safeParse({
        ...signal,
        kind: "alert",
        event: "opened",
        alertType: "dependabot",
        severity: "high",
        url: `https://github.com/${repository}/security/dependabot/3`,
      }).success,
    ).toBe(true);
  });

  it("refuses a signal from an unknown source, or with no key", () => {
    expect(AtlasEvent.safeParse({ ...signal, source: "fax" }).success).toBe(
      false,
    );
    expect(AtlasEvent.safeParse({ ...signal, key: "" }).success).toBe(false);
  });

  it("refuses a signal whose address is not https", () => {
    expect(
      AtlasEvent.safeParse({ ...signal, url: "http://example.test/12" })
        .success,
    ).toBe(false);
  });

  it("accepts a dispatcher decision, and refuses an unknown rule", () => {
    expect(AtlasEvent.safeParse(dispatch).success).toBe(true);
    expect(
      AtlasEvent.safeParse({ ...dispatch, mode: "dry", outcome: "merge" })
        .success,
    ).toBe(true);
    expect(
      AtlasEvent.safeParse({ ...dispatch, rule: "anything" }).success,
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
    expect(applyEvent(before, signal)).toBe(before);
    expect(applyEvent(before, dispatch)).toBe(before);
  });
});
