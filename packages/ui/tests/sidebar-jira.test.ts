import { describe, expect, it } from "bun:test";

import {
  jiraErrorText,
  jiraGroup,
  jiraPriority,
  readJira,
  sortJira,
} from "../src/sidebar";

describe("readJira", () => {
  it("keeps stories, bugs, tasks, sub-tasks and spikes, and untyped issues", () => {
    const doc = readJira({
      ok: true,
      items: [
        { key: "A", type: "Story" },
        { key: "B", type: "Sub-task" },
        { key: "C", type: "Test Execution" },
        { key: "D", type: "Epic" },
        { key: "E" },
        { summary: "no key" },
      ],
    });
    expect(doc?.items.map((i) => i.key)).toEqual(["A", "B", "E"]);
  });

  it("keeps the error of a failed sync, and refuses what isn't a copy", () => {
    expect(readJira({ ok: false, error: "http_401" })).toEqual({
      ok: false,
      error: "http_401",
      syncedAt: undefined,
      items: [],
    });
    expect(readJira(null)).toBeNull();
  });
});

describe("grouping and order", () => {
  it("groups by status category", () => {
    expect(jiraGroup({ key: "a", category: "indeterminate" })).toBe(
      "indeterminate",
    );
    expect(jiraGroup({ key: "a", category: "done" })).toBe("other");
  });

  it("puts blocked first, then progress, review and test, newest first", () => {
    const sorted = sortJira([
      { key: "r", status: "In Review" },
      { key: "b", status: "Blocked" },
      { key: "p1", status: "In Progress", updated: "2026-03-01" },
      { key: "p2", status: "In Progress", updated: "2026-03-05" },
    ]);
    expect(sorted.map((i) => i.key)).toEqual(["b", "p2", "p1", "r"]);
  });

  it("treats highest and blocker as high", () => {
    expect(jiraPriority("Highest")).toBe("high");
    expect(jiraPriority("Blocker")).toBe("high");
    expect(jiraPriority("Lowest")).toBe("low");
  });
});

describe("jiraErrorText", () => {
  it("explains known failures and names unknown ones", () => {
    expect(jiraErrorText("http_429")).toContain("slow down");
    expect(jiraErrorText("boom")).toContain("(boom)");
    expect(jiraErrorText(null)).toContain("(unknown error)");
  });
});
