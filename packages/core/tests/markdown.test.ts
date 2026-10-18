import { describe, expect, it } from "bun:test";

import { inlineText, isSafeHref, parseInline, parseMarkdown } from "../src";

describe("blocks", () => {
  it("reads headings and paragraphs, joining wrapped lines", () => {
    expect(parseMarkdown("# Title\n\nFirst line\nsecond line.")).toEqual([
      {
        type: "heading",
        level: 1,
        children: [{ type: "text", text: "Title" }],
      },
      {
        type: "paragraph",
        children: [{ type: "text", text: "First line second line." }],
      },
    ]);
  });

  it("drops front matter", () => {
    const blocks = parseMarkdown("---\ntags: [plan]\n---\nBody");
    expect(blocks).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "Body" }] },
    ]);
  });

  it("reads bullet and numbered lists with one level of nesting", () => {
    const [list] = parseMarkdown("- one\n  - one a\n  - one b\n- two");
    expect(list?.type).toBe("list");
    if (list?.type !== "list") return;
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
    expect(
      list.items[0]?.list?.items.map((item) => inlineText(item.children)),
    ).toEqual(["one a", "one b"]);
    const [numbered] = parseMarkdown("1. first\n2. second");
    expect(numbered?.type === "list" && numbered.ordered).toBe(true);
  });

  it("reads task list items as ticked or not", () => {
    const [list] = parseMarkdown("- [x] done\n- [ ] open");
    if (list?.type !== "list") throw new Error("expected a list");
    expect(list.items.map((item) => item.checked)).toEqual([true, false]);
  });

  it("reads a table with its alignment", () => {
    const [table] = parseMarkdown(
      "| Step | Owner |\n| :--- | ---: |\n| Rehearse | Schema |\n| Sign off | You |",
    );
    if (table?.type !== "table") throw new Error("expected a table");
    expect(table.align).toEqual(["left", "right"]);
    expect(table.header.map(inlineText)).toEqual(["Step", "Owner"]);
    expect(table.rows.map((row) => row.map(inlineText))).toEqual([
      ["Rehearse", "Schema"],
      ["Sign off", "You"],
    ]);
  });

  it("keeps fenced code exactly as written", () => {
    const [code] = parseMarkdown(
      "```sql\nselect * from t;\n  -- **not bold**\n```",
    );
    expect(code).toEqual({
      type: "codeBlock",
      language: "sql",
      text: "select * from t;\n  -- **not bold**",
    });
  });

  it("reads block quotes and Obsidian callouts", () => {
    const [quote] = parseMarkdown("> Quoted *words*");
    expect(quote?.type).toBe("quote");
    const [callout] = parseMarkdown(
      "> [!warning] Before Friday\n> Freeze the schema.",
    );
    if (callout?.type !== "callout") throw new Error("expected a callout");
    expect(callout.kind).toBe("warning");
    expect(inlineText(callout.title)).toBe("Before Friday");
    expect(callout.children).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", text: "Freeze the schema." }],
      },
    ]);
    const [untitled] = parseMarkdown("> [!note]\n> Body");
    if (untitled?.type !== "callout") throw new Error("expected a callout");
    expect(inlineText(untitled.title)).toBe("Note");
  });

  it("reads a rule", () => {
    expect(parseMarkdown("---")).toEqual([{ type: "rule" }]);
  });
});

describe("inline", () => {
  it("reads bold, italic and code", () => {
    expect(parseInline("a **b** *c* `d`")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "emphasis", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "code", text: "d" },
    ]);
  });

  it("leaves underscores inside words alone", () => {
    expect(parseInline("snake_case_name")).toEqual([
      { type: "text", text: "snake_case_name" },
    ]);
  });

  it("reads links and wiki-links", () => {
    expect(parseInline("[Plan](https://example.test/plan)")).toEqual([
      {
        type: "link",
        href: "https://example.test/plan",
        children: [{ type: "text", text: "Plan" }],
      },
    ]);
    expect(parseInline("[[Cut-over runbook]]")).toEqual([
      {
        type: "wikiLink",
        target: "Cut-over runbook",
        label: "Cut-over runbook",
      },
    ]);
    expect(parseInline("[[Runbook#Rollback|the rollback]]")).toEqual([
      { type: "wikiLink", target: "Runbook#Rollback", label: "the rollback" },
    ]);
  });

  it("lists embeds rather than drawing them", () => {
    expect(parseInline("![[diagram.png]]")).toEqual([
      { type: "embed", target: "diagram.png" },
    ]);
    expect(parseInline("![Map](https://example.test/map.png)")).toEqual([
      { type: "embed", target: "Map" },
    ]);
  });

  it("keeps the words of a link that is not safe to follow, and drops the address", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("obsidian://open?vault=Work")).toBe(true);
    expect(parseInline("[click](javascript:alert(1))")).toEqual([
      { type: "text", text: "click" },
      { type: "text", text: ")" },
    ]);
  });

  it("leaves an unmatched marker as text", () => {
    expect(parseInline("2 * 3 and **open")).toEqual([
      { type: "text", text: "2 * 3 and **open" },
    ]);
  });
});

describe("raw HTML stays text", () => {
  it("never produces an HTML node", () => {
    const blocks = parseMarkdown(
      '<script>alert("x")</script>\n\n<img src=x onerror=alert(1)>\n\n# <b>Bold</b>',
    );
    expect(blocks).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", text: '<script>alert("x")</script>' }],
      },
      {
        type: "paragraph",
        children: [{ type: "text", text: "<img src=x onerror=alert(1)>" }],
      },
      {
        type: "heading",
        level: 1,
        children: [{ type: "text", text: "<b>Bold</b>" }],
      },
    ]);
  });

  it("has no node type that could carry HTML", () => {
    const types = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.type === "string") types.add(record.type);
        Object.values(record).forEach(walk);
      }
    };
    walk(
      parseMarkdown(
        "# H\n\n<div>x</div>\n\n- a\n\n| a |\n| - |\n| b |\n\n> [!tip] t\n> <iframe>\n\n```\n<script>\n```",
      ),
    );
    for (const type of types) expect(type).not.toMatch(/html/i);
  });
});
