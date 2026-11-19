import { describe, expect, it } from "bun:test";

import { parseMarkdown } from "@atlas/core/markdown";

import {
  databaseStateOf,
  dueWords,
  previewBlocks,
  ticketStatusOf,
  ticketTone,
} from "../src/console";
import type { WorkItem } from "../src/sidebar";

describe("ticketStatusOf", () => {
  const jira = new Map([["A-1", "In Review"]]);

  it("gives Jira's own status when the sync has the issue", () => {
    expect(ticketStatusOf("A-1", "jira", jira)).toBe("In Review");
  });

  it("gives none when the sync lacks the issue", () => {
    expect(ticketStatusOf("A-2", "jira", jira)).toBeNull();
    expect(ticketStatusOf("A-1", "jira", null)).toBeNull();
  });

  it("gives none for monday.com and GitHub keys", () => {
    expect(ticketStatusOf("A-1", "monday", jira)).toBeNull();
    expect(ticketStatusOf("o/r#1", "github", jira)).toBeNull();
  });
});

describe("ticketTone", () => {
  it("groups Jira statuses by their words", () => {
    expect(ticketTone("In code review")).toBe("moving");
    expect(ticketTone("Development Completed")).toBe("done");
    expect(ticketTone("Blocked")).toBe("blocked");
    expect(ticketTone("Open")).toBe("waiting");
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

describe("dueWords", () => {
  it("writes a due date as day and short month", () => {
    expect(dueWords("2026-11-20")).toBe("20 Nov");
  });

  it("keeps a value that is not a date", () => {
    expect(dueWords("soon")).toBe("soon");
  });
});

describe("previewBlocks", () => {
  const md = (text: string) => parseMarkdown(text);
  const long = "Word ".repeat(80).trim();

  it("keeps the title and the opening paragraphs, and stops at a heading", () => {
    const blocks = md(
      `# Title\n\nFirst paragraph.\n\nSecond paragraph.\n\n## 1. Services\n\nMore text.`,
    );
    const preview = previewBlocks(blocks);
    expect(preview.blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "paragraph",
    ]);
    expect(preview.more).toBe(true);
  });

  it("stops at a numbered list too", () => {
    const preview = previewBlocks(md("Intro.\n\n1. One\n2. Two"));
    expect(preview.blocks.map((b) => b.type)).toEqual(["paragraph"]);
    expect(preview.more).toBe(true);
  });

  it("stops after the paragraph that passes the budget, never inside it", () => {
    const preview = previewBlocks(md(`${long}\n\n${long}\n\n${long}`), 300);
    expect(preview.blocks).toHaveLength(1);
    expect(preview.more).toBe(true);
  });

  it("has nothing more when the page is short", () => {
    const preview = previewBlocks(md("# Title\n\nOnly this."));
    expect(preview.more).toBe(false);
  });
});
