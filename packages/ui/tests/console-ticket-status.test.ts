import { describe, expect, it } from "bun:test";

import { ticketStatusOf } from "../src/console";

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
