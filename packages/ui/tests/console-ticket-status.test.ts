import { describe, expect, it } from "bun:test";

import { databaseStateOf, ticketStatusOf } from "../src/console";
import type { WorkItem } from "../src/sidebar";

describe("ticketStatusOf", () => {
  const jira = new Map([["A-1", "In Review"]]);

  it("shows Jira's own status when the sync has the issue", () => {
    expect(ticketStatusOf("A-1", "jira", jira, "In progress")).toBe(
      "In Review",
    );
  });

  it("falls back to the Atlas status when the sync lacks the issue", () => {
    expect(ticketStatusOf("A-2", "jira", jira, "In progress")).toBe(
      "In progress",
    );
    expect(ticketStatusOf("A-1", "jira", null, "Planned")).toBe("Planned");
  });

  it("uses the Atlas status for monday.com and GitHub keys", () => {
    expect(ticketStatusOf("A-1", "monday", jira, "Planned")).toBe("Planned");
    expect(ticketStatusOf("o/r#1", "github", jira, "Done")).toBe("Done");
  });
});

describe("databaseStateOf", () => {
  const base: WorkItem = { customer: "c", band: "today", title: "t" };

  it("takes the database's own state when the worklist carries it", () => {
    expect(databaseStateOf({ ...base, state: "review" })).toBe("review");
  });

  it("reads older worklists from the done mark and the flags", () => {
    expect(databaseStateOf({ ...base, done: true })).toBe("done");
    expect(databaseStateOf({ ...base, flags: ["active"] })).toBe("doing");
    expect(databaseStateOf({ ...base, flags: ["merged"] })).toBe("merged");
    expect(databaseStateOf({ ...base })).toBe("todo");
  });

  it("ignores a state it does not know", () => {
    expect(databaseStateOf({ ...base, state: "odd" })).toBe("todo");
  });
});
