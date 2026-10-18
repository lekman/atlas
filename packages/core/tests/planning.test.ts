import { describe, expect, it } from "bun:test";

import {
  arrangeDay,
  BacklogItem,
  bandOf,
  DayNote,
  effortWeights,
  ImportReport,
  isCarriedOver,
  isNotWorthIt,
  nextDay,
  notWorthIt,
  orderTasks,
  priorityFrom,
  priorityOf,
  type Client,
} from "../src";

const governed = {
  classification: "internal",
  boundary: "home-server",
} as const;

function task(id: string, fields: Partial<BacklogItem> = {}): BacklogItem {
  return BacklogItem.parse({
    id,
    clientId: "acme",
    title: `Task ${id}`,
    state: "todo",
    priority: "normal",
    ...governed,
    ...fields,
  });
}

describe("effort and value", () => {
  it("weighs the T-shirt sizes", () => {
    expect(effortWeights).toEqual({ XS: 1, S: 2, M: 3, L: 5, XL: 8 });
  });

  it("makes value per unit of effort into a priority", () => {
    expect(priorityFrom(5, "S")).toBe("high"); // 2.5
    expect(priorityFrom(2, "XS")).toBe("high"); // exactly 2
    expect(priorityFrom(3, "M")).toBe("normal"); // 1
    expect(priorityFrom(3, "L")).toBe("low"); // 0.6
    expect(priorityFrom(8, "XL")).toBe("normal"); // exactly 1
    expect(priorityFrom(5, "XL")).toBe("low"); // 0.625
    expect(priorityFrom(13, "L")).toBe("high"); // 2.6
  });

  it("calls extra large work for little value not worth it, whatever the ratio", () => {
    expect(notWorthIt(3, "XL")).toBe(true);
    expect(notWorthIt(1, "XL")).toBe(true);
    expect(notWorthIt(5, "XL")).toBe(false);
    expect(notWorthIt(1, "L")).toBe(false);
  });

  it("keeps the imported marker until a task is sized", () => {
    expect(priorityOf(task("a", { priority: "high" }))).toBe("high");
    expect(priorityOf(task("b", { priority: "high", effort: "L" }))).toBe(
      "high",
    );
    expect(
      priorityOf(task("c", { priority: "high", effort: "L", value: 2 })),
    ).toBe("low");
    expect(isNotWorthIt(task("d", { effort: "XL", value: 2 }))).toBe(true);
    expect(isNotWorthIt(task("e", { effort: "XL" }))).toBe(false);
  });

  it("refuses a value off the scale", () => {
    expect(BacklogItem.safeParse({ ...task("f"), value: 4 }).success).toBe(
      false,
    );
  });
});

describe("bands", () => {
  const today = "2026-10-19";

  it("finds the day after, across a month end", () => {
    expect(nextDay("2026-10-31")).toBe("2026-11-01");
  });

  it("places a date in its band", () => {
    expect(bandOf(undefined, today)).toBe("unscheduled");
    expect(bandOf("2026-10-19", today)).toBe("today");
    expect(bandOf("2026-10-20", today)).toBe("tomorrow");
    expect(bandOf("2026-10-27", today)).toBe("future");
  });

  it("counts a past date as today, marked carried over", () => {
    expect(bandOf("2026-10-16", today)).toBe("today");
    expect(
      isCarriedOver(task("a", { scheduledFor: "2026-10-16" }), today),
    ).toBe(true);
    expect(isCarriedOver(task("b", { scheduledFor: today }), today)).toBe(
      false,
    );
    expect(
      isCarriedOver(
        task("c", { scheduledFor: "2026-10-16", state: "done" }),
        today,
      ),
    ).toBe(false);
  });
});

describe("arranging a day", () => {
  const today = "2026-10-19";
  const clients: Client[] = [
    { id: "acme", name: "Acme", ...governed },
    { id: "home", name: "Home Office", home: true, ...governed },
  ];

  it("orders open work by priority, then not worth it, then done", () => {
    const ordered = orderTasks([
      task("done", { state: "done" }),
      task("waste", { effort: "XL", value: 2 }),
      task("low", { priority: "low" }),
      task("high", { effort: "S", value: 8 }),
      task("normal"),
    ]);
    expect(ordered.map((item) => item.id)).toEqual([
      "high",
      "normal",
      "low",
      "waste",
      "done",
    ]);
  });

  it("groups by band, then client with home first", () => {
    const arranged = arrangeDay(
      [
        task("a", { scheduledFor: today }),
        task("b", { clientId: "home", scheduledFor: "2026-10-15" }),
        task("c", { scheduledFor: "2026-10-20" }),
        task("d"),
        task("e", { state: "done", doneOn: today, scheduledFor: "2026-10-23" }),
      ],
      clients,
      today,
    );
    expect(arranged.map((band) => band.band)).toEqual([
      "today",
      "tomorrow",
      "unscheduled",
    ]);
    expect(arranged[0]?.clients.map((client) => client.clientId)).toEqual([
      "home",
      "acme",
    ]);
    expect(arranged[0]?.clients[1]?.items.map((item) => item.id)).toEqual([
      "a",
      "e",
    ]);
  });
});

describe("planning records", () => {
  it("keeps a day note's watch line", () => {
    const note = DayNote.parse({
      clientId: "acme",
      on: "2026-10-19",
      kind: "overview",
      text: "Cut-over rehearsal day.",
      watch: "Staging alarms",
    });
    expect(note.watch).toBe("Staging alarms");
  });

  it("names held-back lines by number only", () => {
    const report = ImportReport.parse({
      sourcePath: "Dashboard.md",
      readOn: "2026-10-19",
      counts: [],
      unplaced: [],
      heldBack: [12, 40],
      waitingForSize: [],
    });
    expect(report.heldBack).toEqual([12, 40]);
    expect(
      ImportReport.safeParse({ ...report, heldBack: ["line text"] }).success,
    ).toBe(false);
  });
});
