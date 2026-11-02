import { describe, expect, it } from "bun:test";

import {
  byWhenThenPriority,
  isWaiting,
  isWorklistDoc,
  itemsFor,
  openCount,
  quadrantOf,
  todaySummary,
  whenOf,
  type WorkItem,
} from "../src/sidebar";

const T = "2026-03-12";
const M = "2026-03-13";
const w = (title: string, more: Partial<WorkItem>): WorkItem => ({
  title,
  customer: "acme",
  ...more,
});

const items: WorkItem[] = [
  w("today", { band: "today", day: T }),
  w("today no day", { band: "today" }),
  w("overdue", { band: "today", day: "2026-03-10" }),
  w("dated today, listed later", { band: "future", day: T }),
  w("tomorrow", { band: "tomorrow", day: M }),
  w("tomorrow by day", { band: "future", day: M }),
  w("later", { band: "future", day: "2026-03-20" }),
  w("unplanned", { band: "unscheduled" }),
  w("unplanned done", { band: "unscheduled", done: true }),
  w("meeting", {
    band: "today",
    day: T,
    meeting: { start: "9:00", end: "9:30" },
  }),
];
const titles = (list: WorkItem[]) => list.map((t) => t.title);

describe("itemsFor", () => {
  it("puts today's, undated today's and overdue tasks in Today", () => {
    expect(titles(itemsFor(items, "today", T, M))).toEqual([
      "today",
      "today no day",
      "overdue",
      "dated today, listed later",
    ]);
  });

  it("puts tomorrow's in Tomorrow, by band or by day", () => {
    expect(titles(itemsFor(items, "tomorrow", T, M))).toEqual([
      "tomorrow",
      "tomorrow by day",
    ]);
  });

  it("puts later and unplanned open tasks in the backlog, and never meetings", () => {
    // A task the source lists for a later day but dates today shows in
    // Today and here too, as on the previous page.
    expect(titles(itemsFor(items, "backlog", T, M))).toEqual([
      "dated today, listed later",
      "later",
      "unplanned",
    ]);
  });
});

describe("whenOf and quadrants", () => {
  it("says when a task is planned", () => {
    expect(whenOf(w("", { band: "unscheduled", day: T }), T)).toBe("backlog");
    expect(whenOf(w("", { band: "future", day: "2026-03-01" }), T)).toBe(
      "today",
    );
    expect(whenOf(w("", { band: "tomorrow", day: M }), T)).toBe("tomorrow");
    expect(whenOf(w("", { band: "future", day: "2026-03-20" }), T)).toBe(
      "later",
    );
  });

  it("calls a task without a known quadrant ungraded", () => {
    expect(quadrantOf(w("", { quadrant: "Q2-schedule" }))).toBe("Q2-schedule");
    expect(quadrantOf(w("", { quadrant: "Q9" }))).toBe("unsized");
  });

  it("sorts by when, then priority", () => {
    const sorted = [
      w("later high", { band: "future", day: "2026-03-20", priority: "high" }),
      w("today low", { band: "today", day: T, priority: "low" }),
      w("today high", { band: "today", day: T, priority: "high" }),
    ].sort(byWhenThenPriority(T));
    expect(titles(sorted)).toEqual(["today high", "today low", "later high"]);
  });
});

describe("todaySummary", () => {
  it("adds the graded hours of today's tasks that aren't blocked", () => {
    expect(
      todaySummary(
        [
          w("a", { band: "today", day: T, quadrant: "Q1-do-now", effort: "M" }),
          w("b", {
            band: "today",
            day: T,
            quadrant: "Q2-schedule",
            effort: "XS",
          }),
          w("c", {
            band: "today",
            day: T,
            quadrant: "Q1-do-now",
            effort: "L",
            flags: ["blocked"],
          }),
          w("d", { band: "today", day: T }),
          w("e", {
            band: "tomorrow",
            day: M,
            quadrant: "Q1-do-now",
            effort: "XL",
          }),
        ],
        T,
      ),
    ).toEqual({ count: 4, hours: 4.5, ungraded: 1, blocked: 1 });
  });
});

describe("isWaiting, openCount and isWorklistDoc", () => {
  it("treats approved and merged as waiting", () => {
    expect(isWaiting(w("", { flags: ["approved"] }))).toBe(true);
    expect(isWaiting(w("", { flags: ["active"] }))).toBe(false);
  });

  it("counts a band's open tasks in focus", () => {
    const list = [
      ...items,
      w("other client", { customer: "beta", band: "today", day: T }),
    ];
    expect(openCount(list, "today", T, M, () => true)).toBe(5);
    expect(openCount(list, "today", T, M, (c) => c === "beta")).toBe(1);
  });

  it("accepts the answer and the stored copy", () => {
    expect(isWorklistDoc({ items: [], syncedAt: "x" })).toBe(true);
    expect(isWorklistDoc({ hosts: [] })).toBe(false);
  });
});
