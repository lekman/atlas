import { describe, expect, it } from "bun:test";

(globalThis as { __SIDEBAR_CONFIG__?: unknown }).__SIDEBAR_CONFIG__ = {
  clients: [],
  trackers: [],
};
const { foldAll, planFolds, worklistMeetings } =
  await import("../src/worklist");

describe("foldAll", () => {
  it("closes every client group in every view, keeping quadrants open", () => {
    const next = foldAll(new Set(["q:Q1-do-now", "keep-me"]), ["acme"], true);
    expect(next.has("acme")).toBe(true);
    expect(next.has("other")).toBe(true);
    expect(next.has("Q2-schedule|acme")).toBe(true);
    expect(next.has("unsized|other")).toBe(true);
    expect(next.has("q:Q1-do-now")).toBe(false);
    expect(next.has("keep-me")).toBe(true);
  });

  it("opens everything", () => {
    const next = foldAll(
      new Set(["acme", "Q1-do-now|acme", "q:Q4-drop", "keep-me"]),
      ["acme"],
      false,
    );
    expect([...next]).toEqual(["keep-me"]);
  });
});

describe("planFolds", () => {
  it("opens the quadrants and closes each client inside them", () => {
    const next = planFolds(new Set(["q:Q1-do-now", "acme"]), ["acme"]);
    expect(next.has("q:Q1-do-now")).toBe(false);
    expect(next.has("acme")).toBe(true);
    expect(next.has("Q1-do-now|acme")).toBe(true);
    expect(next.has("Q4-drop|other")).toBe(true);
  });
});

describe("worklistMeetings", () => {
  it("reads a meeting's wall-clock times in the home zone", () => {
    const [event] = worklistMeetings(
      [
        {
          title: "Stand-up",
          customer: "acme",
          day: "2026-07-15",
          meeting: { start: "9:30", end: "9:45" },
        },
        { title: "Task", customer: "acme", day: "2026-07-15" },
      ],
      "Europe/London",
    );
    expect(event?.start.toISOString()).toBe("2026-07-15T08:30:00.000Z");
    expect(event?.end.toISOString()).toBe("2026-07-15T08:45:00.000Z");
    expect(event?.via).toBe("Dashboard.md");
  });
});
