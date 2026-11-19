import { describe, expect, it } from "bun:test";

import { pointTime, pointValue } from "../src/console";
import { HOST_LINES, nearestPoint, sparkPoints } from "../src/sidebar";

const cpu = HOST_LINES.find((l) => l.key === "cpuPct")!;
const disk = HOST_LINES.find((l) => l.key === "diskFreeGb")!;
const now = new Date("2026-11-19T15:00:00");

describe("sparkPoints", () => {
  it("keeps the last day's measured points, oldest first, with their values", () => {
    const { points } = sparkPoints(
      [
        { at: new Date("2026-11-19T14:00:00").toISOString(), cpuPct: 40 },
        { at: new Date("2026-11-19T09:00:00").toISOString(), cpuPct: 10 },
        { at: new Date("2026-11-17T09:00:00").toISOString(), cpuPct: 99 },
        { at: new Date("2026-11-19T10:00:00").toISOString() },
      ],
      cpu,
      now,
    );
    expect(points.map((p) => p.value)).toEqual([10, 40]);
    expect(points[0]!.x).toBeLessThan(points[1]!.x);
  });
});

describe("nearestPoint", () => {
  it("picks the measured point closest along the line", () => {
    const points = [10, 50, 90].map((x) => ({ x, y: 0, at: "", value: x }));
    expect(nearestPoint(points, 62)?.value).toBe(50);
    expect(nearestPoint([], 5)).toBeNull();
  });
});

describe("pointTime and pointValue", () => {
  it("writes the time in 24-hour form, marking yesterday", () => {
    expect(pointTime(new Date("2026-11-19T14:05:00").toISOString(), now)).toBe(
      "14:05",
    );
    expect(pointTime(new Date("2026-11-18T21:40:00").toISOString(), now)).toBe(
      "Yesterday 21:40",
    );
  });

  it("writes the value as the host's facts do", () => {
    expect(pointValue(cpu, 26.4)).toBe("26 %");
    expect(pointValue(disk, 65.12)).toMatch(/^65\.1 GB$/);
  });
});
