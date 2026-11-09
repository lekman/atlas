import { describe, expect, it } from "bun:test";

import {
  applyEvent,
  type DispatchEvent,
  type LaunchEvent,
  type SignalEvent,
} from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";

import { cueFor } from "../src/useAtlasMap";
import { describeEvent } from "../src/describe";
import { isAbout, whoOf } from "../src/recordLog";

describe("log lines", () => {
  const message = {
    type: "agent-message",
    from: "schema",
    to: "gaps-watch",
    text: "Hold releases",
  } as const;

  it("reads like a console in the Astronomer world", () => {
    expect(describeEvent(worlds.astronomer, sampleDataset, message)).toBe(
      "BEAM SCHEMA → GAPS WATCH :: Hold releases",
    );
  });

  it("reads like a log book in the Mariner world", () => {
    expect(describeEvent(worlds.mariner, sampleDataset, message)).toBe(
      "Signal from Schema to Gaps watch: “Hold releases”",
    );
  });

  it("names the status an agent left and the one it entered", () => {
    const line = describeEvent(worlds.mariner, sampleDataset, {
      type: "status-change",
      agentId: "tracking",
      to: "waiting",
      text: "Needs a call",
    });
    expect(line).toBe("Tracking now at anchor, awaiting orders: Needs a call");
    const console = describeEvent(worlds.astronomer, sampleDataset, {
      type: "status-change",
      agentId: "tracking",
      to: "waiting",
      text: "Needs a call",
    });
    expect(console).toBe("TRACKING UNDERWAY → HAILING YOU :: Needs a call");
  });

  it("calls home by the world's name", () => {
    const line = describeEvent(worlds.mariner, sampleDataset, {
      type: "question-answered",
      questionId: "day-rate",
      answer: "Yes",
      decision: {
        id: "rate-up",
        clientId: "ashgrove",
        title: "Raise the day rate",
        state: "made",
        classification: "internal",
        boundary: "home-server",
      },
    });
    expect(line).toContain("Turtle Bay");
  });
});

describe("vessel log lines", () => {
  const launch = {
    type: "agent-launched",
    agentId: "drill-notes",
    parentId: "schema",
    name: "Drill notes",
    workingOn: ["weekend-drill"],
    text: "Writing up the drill steps",
  } satisfies LaunchEvent;

  it("names the vessel, its parent and its task", () => {
    expect(describeEvent(worlds.astronomer, sampleDataset, launch)).toBe(
      "LAUNCH DRILL NOTES FROM SCHEMA → RUN THE DRILL THIS WEEKEND :: Writing up the drill steps",
    );
    expect(describeEvent(worlds.mariner, sampleDataset, launch)).toBe(
      "Schema lowers the tender Drill notes, bound for Run the drill this weekend: Writing up the drill steps",
    );
  });

  it("names the parent a vessel returns to", () => {
    const launched = applyEvent(sampleDataset, launch);
    expect(
      describeEvent(worlds.mariner, launched, {
        type: "agent-returned",
        agentId: "drill-notes",
        text: "Steps written",
      }),
    ).toBe("Tender Drill notes back aboard Schema: Steps written");
  });
});

describe("sound cues", () => {
  it("rings the needs-you cue when an agent starts waiting", () => {
    expect(
      cueFor({ type: "status-change", agentId: "x", to: "waiting", text: "t" }),
    ).toBe("needs");
    expect(
      cueFor({ type: "status-change", agentId: "x", to: "error", text: "t" }),
    ).toBe("blocked");
    expect(
      cueFor({ type: "status-change", agentId: "x", to: "running", text: "t" }),
    ).toBe("status");
    expect(
      cueFor({ type: "agent-message", from: "a", to: "b", text: "t" }),
    ).toBe("message");
    expect(cueFor({ type: "agent-returned", agentId: "x", text: "t" })).toBe(
      "status",
    );
  });
});

describe("signals and dispatcher decisions", () => {
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
    rule: "merge-approved",
    mode: "dry",
    outcome: "merge",
    repository,
    number: 12,
    url: signal.url,
    client: "ashgrove",
    needsYou: false,
    mergeMethod: "squash",
    text: "Would merge pull request #12 by squash",
  } satisfies DispatchEvent;

  it("names the repository of an unmatched signal", () => {
    expect(describeEvent(worlds.mariner, sampleDataset, signal)).toBe(
      `Telegram from GitHub, for ${repository}: Pull request #12: checks failed`,
    );
  });

  it("names the matched item of a matched signal", () => {
    expect(
      describeEvent(worlds.mariner, sampleDataset, {
        ...signal,
        recordIds: ["send-invoices"],
      }),
    ).toBe(
      "Telegram from GitHub, for Send October invoices: Pull request #12: checks failed",
    );
  });

  it("reads a decision as the dispatcher's", () => {
    expect(describeEvent(worlds.mariner, sampleDataset, dispatch)).toBe(
      `Telegram from Dispatcher, for ${repository}: Would merge pull request #12 by squash`,
    );
  });

  it("is about the matched items, and the task a decision created", () => {
    const entry = { before: sampleDataset };
    expect(
      isAbout(
        entry.before,
        { ...signal, recordIds: ["send-invoices"] },
        "send-invoices",
      ),
    ).toBe(true);
    expect(isAbout(entry.before, signal, "send-invoices")).toBe(false);
    expect(
      isAbout(
        entry.before,
        { ...dispatch, taskId: "send-invoices" },
        "send-invoices",
      ),
    ).toBe(true);
    expect(whoOf(sampleDataset, signal)).toBe("GitHub");
    expect(whoOf(sampleDataset, dispatch)).toBe("Dispatcher");
  });

  it("stays silent unless a decision needs the reader", () => {
    expect(cueFor(signal)).toBeNull();
    expect(cueFor(dispatch)).toBeNull();
    expect(cueFor({ ...dispatch, needsYou: true })).toBe("needs");
  });
});

describe("an agent idle with open work", () => {
  const signal = {
    type: "signal",
    source: "atlas",
    key: "atlas:idle-with-work:tracking:2026-11-09T11:26:00.000Z",
    kind: "agent",
    event: "idle_with_work",
    agentId: "tracking",
    session: "idle",
    minutes: 34,
    taskIds: ["webhooks", "rate-limits"],
    client: "kestrel",
    recordIds: ["tracking", "webhooks", "rate-limits"],
    at: "2026-11-09T12:00:00.000Z",
    text: "Idle 34 min with 2 open tasks",
  } satisfies SignalEvent;
  const nudge = {
    type: "dispatch",
    signalKey: signal.key,
    rule: "nudge-idle-with-work",
    mode: "on",
    outcome: "ask",
    agentId: "tracking",
    taskIds: ["webhooks", "rate-limits"],
    client: "kestrel",
    needsYou: true,
    command: "cc-restart Tracking",
    text: "Needs a restart: cc-restart Tracking",
  } satisfies DispatchEvent;

  it("names the agent in the signal and the decision", () => {
    expect(describeEvent(worlds.mariner, sampleDataset, signal)).toBe(
      "Telegram from Atlas, for Tracking: Idle 34 min with 2 open tasks",
    );
    expect(describeEvent(worlds.mariner, sampleDataset, nudge)).toBe(
      "Telegram from Dispatcher, for Tracking: Needs a restart: cc-restart Tracking",
    );
  });

  it("is about the agent and its tasks, and asks the reader only when it needs them", () => {
    expect(isAbout(sampleDataset, signal, "tracking")).toBe(true);
    expect(isAbout(sampleDataset, nudge, "tracking")).toBe(true);
    expect(isAbout(sampleDataset, nudge, "rate-limits")).toBe(true);
    expect(isAbout(sampleDataset, nudge, "send-invoices")).toBe(false);
    expect(whoOf(sampleDataset, signal)).toBe("Atlas");
    expect(cueFor(nudge)).toBe("needs");
    expect(cueFor({ ...nudge, needsYou: false })).toBeNull();
  });
});
