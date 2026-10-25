import { describe, expect, it } from "bun:test";

import {
  logClock,
  logWindowMilliseconds,
  withinLogWindow,
} from "../src/logWindow";

const now = new Date("2026-10-24T12:00:00.000Z");
const minute = 60 * 1000;
const before = (minutes: number) => ({
  time: new Date(now.getTime() - minutes * minute),
});

describe("the log window", () => {
  it("reaches back 24 hours", () => {
    expect(logWindowMilliseconds).toBe(24 * 60 * minute);
  });

  it("keeps a line 23 hours 59 minutes old", () => {
    expect(withinLogWindow([before(24 * 60 - 1)], now)).toHaveLength(1);
  });

  it("drops a line 24 hours 1 minute old", () => {
    expect(withinLogWindow([before(24 * 60 + 1)], now)).toHaveLength(0);
  });

  it("keeps a line stamped after now, from a clock running ahead", () => {
    expect(withinLogWindow([before(-5)], now)).toHaveLength(1);
  });

  it("keeps the order it was given", () => {
    const lines = [before(1), before(30 * 60), before(90), before(5)];
    expect(withinLogWindow(lines, now)).toEqual([
      lines[0]!,
      lines[2]!,
      lines[3]!,
    ]);
  });
});

describe("the log clock", () => {
  // Built in local time, as the clock reads it, so the test holds in any zone.
  const afternoon = new Date(2026, 9, 24, 15, 55, 50);
  const morning = new Date(2026, 9, 23, 7, 4, 9);

  it("shows hours, minutes and seconds, and no date", () => {
    expect(logClock(afternoon)).toBe("15:55:50");
    expect(logClock(morning)).toBe("07:04:09");
  });

  it("drops the seconds when asked", () => {
    expect(logClock(afternoon, false)).toBe("15:55");
  });

  it("reads midnight as 00", () => {
    expect(logClock(new Date(2026, 9, 24, 0, 0, 0))).toBe("00:00:00");
  });
});
