import { describe, expect, it } from "bun:test";

import { mondayGroups, mondayPage, priorityOf, safeUrl } from "../src/sidebar";

const columns = { status: "s", priority: "p", key: "k" };

describe("mondayPage", () => {
  it("reads items, drops Done and builds the key", () => {
    const page = mondayPage(
      {
        items: [
          {
            name: "A",
            url: "https://x.monday.com/1",
            updated_at: "2026-03-12T09:00:00Z",
            column_values: { s: "Stuck", p: "High", k: "7" },
          },
          { name: "B", column_values: { s: "Done" } },
        ],
        pagination: { has_more: true },
      },
      columns,
      "KF",
    );
    expect(page.more).toBe(true);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      name: "A",
      status: "Stuck",
      priority: "High",
      key: "KF-7",
    });
  });

  it("fills gaps and refuses a link that isn't https", () => {
    const page = mondayPage(
      { items: [{ url: "javascript:alert(1)", column_values: {} }] },
      columns,
      "KF",
    );
    expect(page.items[0]).toMatchObject({
      name: "(untitled)",
      status: "No status",
      url: null,
      key: null,
    });
  });

  it("is empty for an answer it cannot read", () => {
    expect(mondayPage(null, columns, "KF")).toEqual({ items: [], more: false });
  });
});

describe("mondayGroups", () => {
  it("puts Monday's statuses first in their order, then the board's own", () => {
    const at = new Date(0);
    const items = ["Custom", "Not started", "Stuck"].map((status) => ({
      name: status,
      url: null,
      status,
      priority: null,
      key: null,
      group: null,
      updated: at,
    }));
    expect(mondayGroups(items)).toEqual(["Stuck", "Not started", "Custom"]);
  });
});

describe("priorityOf and safeUrl", () => {
  it("maps words to dots", () => {
    expect(priorityOf("Critical")).toBe("high");
    expect(priorityOf("Medium")).toBe("medium");
    expect(priorityOf("Low")).toBe("low");
    expect(priorityOf(null)).toBe("");
  });

  it("keeps only https links", () => {
    expect(safeUrl("https://a.b")).toBe("https://a.b");
    expect(safeUrl("http://a.b")).toBeNull();
    expect(safeUrl(7)).toBeNull();
  });
});
