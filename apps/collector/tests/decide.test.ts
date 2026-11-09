import { describe, expect, it } from "bun:test";

import { decide } from "../src/decide";

const report = (
  status: "running" | "idle" | "waiting" | "blocked",
  note: string,
) => ({
  name: "Halcyon",
  status,
  note,
  activity: null,
  contextTokens: null,
  usageLimit: null,
});
const agent = (
  status: "running" | "idle" | "waiting" | "blocked",
  note = "",
) => ({
  id: "halcyon",
  name: "Halcyon",
  status,
  note,
});

describe("decide", () => {
  it("always reports a session stuck on approval, once", () => {
    const r = report("waiting", "Waiting for approval in its session");
    expect(decide(r, agent("running", "Deploying"), 0)).toEqual({
      status: "waiting",
      note: r.note,
    });
    expect(decide(r, agent("waiting", r.note), 0)).toBeNull();
  });
  it("clears its own waiting once the prompt is gone, not the agent's", () => {
    const r = report("running", "Editing files");
    expect(
      decide(r, agent("waiting", "Waiting for approval in its session"), 0),
    ).toEqual({
      status: "running",
      note: "Editing files",
    });
    expect(
      decide(r, agent("waiting", "Needs Tobias to pick a client"), 0),
    ).toBeNull();
  });
  it("wakes an idle agent that is working, and leaves a self-reported one alone", () => {
    expect(
      decide(report("running", "Running commands"), agent("idle"), 0)?.status,
    ).toBe("running");
    expect(
      decide(
        report("running", "Running commands"),
        agent("running", "Deploying staging"),
        0,
      ),
    ).toBeNull();
    expect(
      decide(
        report("running", "Running commands"),
        agent("blocked", "Waiting on CI"),
        0,
      ),
    ).toBeNull();
  });
  it("calls a running agent idle only after thirty quiet minutes", () => {
    expect(
      decide(report("idle", "Idle"), agent("running"), 10 * 60_000),
    ).toBeNull();
    expect(
      decide(report("idle", "Idle"), agent("running"), 31 * 60_000),
    ).toEqual({ status: "idle", note: "Idle" });
  });
  it("reports a usage limit as blocked, once, over any other status", () => {
    const r = report(
      "blocked",
      "Weekly usage limit reached, resets 13 Mar 18:00",
    );
    expect(decide(r, agent("running", "Deploying"), 0)).toEqual({
      status: "blocked",
      note: r.note,
    });
    expect(decide(r, agent("blocked", r.note), 0)).toBeNull();
  });
  it("clears its own usage-limit block once the limit is gone, not the agent's", () => {
    const r = report("idle", "Idle");
    expect(
      decide(
        r,
        agent("blocked", "Session usage limit reached, resets 14:00"),
        0,
      ),
    ).toEqual({ status: "idle", note: "Idle" });
    expect(
      decide(r, agent("blocked", "Waits on a risk sign-off"), 0),
    ).toBeNull();
  });
});
