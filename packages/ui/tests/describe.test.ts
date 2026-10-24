import { describe, expect, it } from "bun:test";

import { applyEvent, type LaunchEvent } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";

import { cueFor } from "../src/useAtlasMap";
import { describeEvent } from "../src/describe";

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
