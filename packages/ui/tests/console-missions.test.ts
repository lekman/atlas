import { describe, expect, it } from "bun:test";

import {
  byQuadrant,
  dayScope,
  groupBySystem,
  minutesWords,
  scopeChoices,
  movesFor,
  taskStateOf,
  tasksIn,
  ungradedCount,
} from "../src/console/missions";
import type { WorkItem } from "../src/sidebar/worklist/model";

const TODAY = "2026-03-12";
const TOMORROW = "2026-03-13";
let n = 0;
const task = (more: Partial<WorkItem> = {}): WorkItem => ({
  ref: `db:${++n}`,
  customer: "kestrel",
  title: `Task ${n}`,
  order: n,
  band: "today",
  day: TODAY,
  ...more,
});

describe("task state", () => {
  it("is done, blocked, in progress or queued, in that order of precedence", () => {
    expect(taskStateOf(task({ done: true, flags: ["blocked"] }))).toBe("done");
    expect(taskStateOf(task({ flags: ["blocked"], claimedBy: "agent" }))).toBe(
      "blocked",
    );
    expect(taskStateOf(task({ claimedBy: "agent" }))).toBe("active");
    expect(taskStateOf(task({ flags: ["active"] }))).toBe("active");
    expect(taskStateOf(task())).toBe("queued");
  });
});

describe("ranges", () => {
  const items = [
    task({ title: "today" }),
    task({ title: "tomorrow", band: "tomorrow", day: TOMORROW }),
    task({ title: "later", band: "future", day: "2026-03-20" }),
    task({ title: "no day", band: "unscheduled", day: undefined }),
    task({ title: "meeting", meeting: { start: "9:00", end: "9:30" } }),
  ];
  const titles = (list: WorkItem[]) => list.map((t) => t.title);

  it("splits tasks into today, tomorrow and the backlog, leaving meetings out", () => {
    expect(titles(tasksIn(items, "today", TODAY, TOMORROW))).toEqual(["today"]);
    expect(titles(tasksIn(items, "tomorrow", TODAY, TOMORROW))).toEqual([
      "tomorrow",
    ]);
    expect(titles(tasksIn(items, "backlog", TODAY, TOMORROW))).toEqual([
      "later",
      "no day",
    ]);
  });

  it("offers every other range as a move", () => {
    expect(movesFor("today")).toEqual(["tomorrow", "backlog"]);
    expect(movesFor("backlog")).toEqual(["today", "tomorrow"]);
  });
});

describe("grouping", () => {
  it("groups by system in order of first appearance, blocked and in progress first", () => {
    const groups = groupBySystem([
      task({ customer: "halcyon", title: "queued" }),
      task({ customer: "kestrel", title: "k" }),
      task({ customer: "halcyon", title: "blocked", flags: ["blocked"] }),
      task({ customer: "halcyon", title: "done", done: true }),
      task({ customer: "halcyon", title: "active", claimedBy: "agent" }),
    ]);
    expect(groups.map((g) => g.system)).toEqual(["halcyon", "kestrel"]);
    expect(groups[0]!.tasks.map((t) => t.title)).toEqual([
      "blocked",
      "active",
      "queued",
      "done",
    ]);
  });

  it("puts graded tasks in their quadrant and the rest under ungraded", () => {
    const { cells, ungraded } = byQuadrant([
      task({ quadrant: "Q1-do-now" }),
      task({ quadrant: "Q4-drop" }),
      task({ quadrant: "something else" }),
      task(),
    ]);
    expect(cells["Q1-do-now"]).toHaveLength(1);
    expect(cells["Q4-drop"]).toHaveLength(1);
    expect(cells["Q2-schedule"]).toHaveLength(0);
    expect(ungraded).toHaveLength(2);
  });

  it("counts open ungraded tasks for the Triage button", () => {
    expect(
      ungradedCount([
        task(),
        task({ done: true }),
        task({ quadrant: "Q2-schedule" }),
        task({ meeting: { start: "9:00", end: "10:00" } }),
      ]),
    ).toBe(1);
  });
});

describe("day scope", () => {
  it("counts tasks, effort by size, meetings and the blocked ones left out", () => {
    const scope = dayScope(
      [
        task({ effort: "S" }),
        task({ effort: "S" }),
        task({ effort: "L" }),
        task(),
        task({ effort: "XL", flags: ["blocked"] }),
        task({ done: true, effort: "M" }),
        task({ meeting: { start: "9:30", end: "10:15" } }),
        task({ meeting: { start: "14:00", end: "15:00" } }),
        task({
          band: "tomorrow",
          day: TOMORROW,
          meeting: { start: "9:00", end: "17:00" },
        }),
      ],
      "today",
      TODAY,
      TOMORROW,
    );
    expect(scope.count).toBe(5);
    expect(scope.bySize).toEqual({ XS: 0, S: 2, M: 0, L: 1, XL: 0 });
    expect(scope.ungraded).toBe(1);
    expect(scope.blocked).toBe(1);
    expect(scope.meetingMinutes).toBe(105);
  });

  it("has no meeting time in the backlog", () => {
    expect(
      dayScope(
        [task({ meeting: { start: "9:00", end: "10:00" } })],
        "backlog",
        TODAY,
        TOMORROW,
      ).meetingMinutes,
    ).toBe(0);
  });

  it("says minutes in words", () => {
    expect(minutesWords(45)).toBe("45 min");
    expect(minutesWords(120)).toBe("2 h");
    expect(minutesWords(105)).toBe("1 h 45 min");
  });
});

describe("scope choices", () => {
  it("lists configured systems in order, then others with tasks, with open counts", () => {
    const { systems, total } = scopeChoices(
      [
        task({ customer: "kestrel" }),
        task({ customer: "kestrel", done: true }),
        task({ customer: "zephyr" }),
        task({ customer: "halcyon", band: "tomorrow", day: TOMORROW }),
      ],
      [
        { key: "halcyon", name: "Halcyon Labs" },
        { key: "kestrel", name: "Kestrel Freight" },
      ],
      "today",
      TODAY,
      TOMORROW,
    );
    expect(systems).toEqual([
      { system: "halcyon", name: "Halcyon Labs", count: 0 },
      { system: "kestrel", name: "Kestrel Freight", count: 1 },
      { system: "zephyr", name: "zephyr", count: 1 },
    ]);
    expect(total).toBe(2);
  });
});
