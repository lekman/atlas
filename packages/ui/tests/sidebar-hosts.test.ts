import { describe, expect, it } from "bun:test";

import {
  hostLevel,
  hostsTab,
  isHostsDoc,
  seenText,
  sparkline,
  HOST_LINES,
  type HostStat,
} from "../src/sidebar";

const now = new Date("2026-03-12T09:40:00Z");
const host = (over: Partial<HostStat> = {}): HostStat => ({
  clientId: "acme",
  host: "build",
  lastSeen: "2026-03-12T09:37:00Z",
  ...over,
});

describe("hostLevel and hostsTab", () => {
  it("takes the worst breach", () => {
    expect(hostLevel(host())).toBeNull();
    expect(
      hostLevel(host({ breaches: [{ metric: "cpuPct", level: "warn" }] })),
    ).toBe("warn");
    expect(
      hostLevel(
        host({
          breaches: [
            { metric: "cpuPct", level: "warn" },
            { metric: "memFreePct", level: "crit" },
          ],
        }),
      ),
    ).toBe("crit");
  });

  it("counts the breaches of the hosts shown, and ticks when there are none", () => {
    expect(hostsTab(null)).toEqual({ label: "Host alerts" });
    expect(hostsTab([host()])).toEqual({
      label: "Host alerts: none",
      count: "✓",
    });
    expect(
      hostsTab([
        host({ breaches: [{ metric: "cpuPct", level: "warn" }] }),
        host({ breaches: [{ metric: "diskFreeGb", level: "crit" }] }),
      ]),
    ).toEqual({ label: "2 host alerts, critical", count: "2", tone: "crit" });
  });
});

describe("seenText", () => {
  it("is relative to now when live, and stale after 17 minutes", () => {
    expect(seenText(host(), { now, live: true, storedAt: null })).toEqual({
      text: "last seen 3m ago",
      stale: false,
    });
    expect(
      seenText(host({ lastSeen: "2026-03-12T09:20:00Z" }), {
        now,
        live: true,
        storedAt: null,
      }).stale,
    ).toBe(true);
  });

  it("is relative to the copy for a stored copy, and never stale", () => {
    const storedAt = new Date("2026-03-12T09:57:00Z");
    expect(seenText(host(), { now, live: false, storedAt })).toEqual({
      text: "last seen 20 min before this copy",
      stale: false,
    });
  });

  it("says never seen without a time", () => {
    expect(
      seenText(host({ lastSeen: null }), { now, live: true, storedAt: null })
        .text,
    ).toBe("never seen");
  });
});

describe("sparkline", () => {
  const cpu = HOST_LINES[0]!;

  it("draws only the last 24 hours and places the limit", () => {
    const line = sparkline(
      [
        { at: "2026-03-11T08:00:00Z", cpuPct: 50 },
        { at: "2026-03-11T21:40:00Z", cpuPct: 0 },
        { at: "2026-03-12T09:40:00Z", cpuPct: 100 },
      ],
      cpu,
      now,
    );
    expect(line.points).toBe("120.0,38.0 240.0,2.0");
    expect(line.limitY).toBeCloseTo(5.6, 1);
  });

  it("scales a line without a top to its values and limit", () => {
    const disk = HOST_LINES[2]!;
    const line = sparkline(
      [{ at: "2026-03-12T09:40:00Z", diskFreeGb: 300 }],
      disk,
      now,
    );
    expect(line.points).toBe("240.0,2.0");
  });
});

describe("isHostsDoc", () => {
  it("accepts the tool's answer and the stored copy of the previous page", () => {
    expect(isHostsDoc({ hosts: [] })).toBe(true);
    expect(
      isHostsDoc({ hosts: [host()], storedAt: "2026-03-12T09:00:00Z" }),
    ).toBe(true);
    expect(isHostsDoc({ items: [] })).toBe(false);
    expect(isHostsDoc(null)).toBe(false);
  });
});
