import { describe, expect, it } from "bun:test";

import {
  isoWeek,
  logDays,
  logWeeks,
  pointsOf,
  readLog,
  type LogItem,
} from "../src/console";

const item = (doneOn: string, effort?: LogItem["effort"]): LogItem => ({
  ref: `db:${doneOn}`,
  title: `Done ${doneOn}`,
  customer: "acme",
  doneOn,
  effort: effort ?? null,
});

// Thursday 19 November 2026.
const now = new Date(2026, 10, 19, 15, 0);

describe("pointsOf", () => {
  it("scores by effort, and an ungraded task as 1", () => {
    expect(
      ["XS", "S", "M", "L", "XL"].map((e) =>
        pointsOf({ effort: e as LogItem["effort"] }),
      ),
    ).toEqual([1, 2, 3, 5, 8]);
    expect(pointsOf({ effort: null })).toBe(1);
  });
});

describe("logDays", () => {
  it("lists the last days newest first, with each day's points", () => {
    const days = logDays(
      [item("2026-11-19", "M"), item("2026-11-19"), item("2026-11-18", "XL")],
      now,
      3,
    );
    expect(days.map((d) => d.label)).toEqual([
      "Today",
      "Yesterday",
      "Tuesday 17 Nov",
    ]);
    expect(days.map((d) => [d.items.length, d.points])).toEqual([
      [2, 4],
      [1, 8],
      [0, 0],
    ]);
  });
});

describe("logWeeks", () => {
  it("groups Monday to Sunday, this week first", () => {
    const weeks = logWeeks(
      [
        item("2026-11-16", "S"),
        item("2026-11-15", "L"),
        item("2026-11-09", "XS"),
        item("2026-11-02"),
      ],
      now,
      3,
    );
    expect(weeks.map((w) => w.label)).toEqual([
      "This week",
      "Last week",
      "Week 45",
    ]);
    expect(weeks.map((w) => w.from)).toEqual([
      "2026-11-16",
      "2026-11-09",
      "2026-11-02",
    ]);
    expect(weeks.map((w) => w.points)).toEqual([2, 6, 1]);
  });

  it("numbers weeks as ISO 8601 does", () => {
    expect(isoWeek(new Date(2026, 10, 19))).toBe(47);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
  });
});

describe("readLog", () => {
  it("keeps items with a done day and refuses what isn't a log", () => {
    expect(
      readLog({ items: [item("2026-11-19"), { title: "x" }] })?.items,
    ).toHaveLength(1);
    expect(readLog(null)).toBeNull();
    expect(readLog({})).toBeNull();
  });
});
