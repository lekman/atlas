import { describe, expect, it } from "bun:test";

import {
  hostState,
  hostSummary,
  integrationRow,
  integrationState,
  relayRow,
  shieldAlerts,
} from "../src/console/shields";
import type { HostStat } from "../src/sidebar/hosts/model";

const now = new Date("2026-03-12T09:40:00Z");
const minutesAgo = (m: number) =>
  new Date(now.getTime() - m * 60000).toISOString();
const host = (more: Partial<HostStat> = {}): HostStat => ({
  clientId: "ashgrove",
  host: "build-01",
  lastSeen: minutesAgo(2),
  latest: {
    cpuPct: 22.4,
    memFreePct: 63,
    diskFreeGb: 58.8,
    runnersBusy: 1,
    runnersMax: 4,
  },
  breaches: [],
  ...more,
});
const live = { now, storedAt: null, live: true };

describe("host state", () => {
  it("is an alert on a critical breach and needs a look on a warning", () => {
    expect(
      hostState(
        host({ breaches: [{ metric: "memFreePct", level: "crit" }] }),
        live,
      ),
    ).toBe("alert");
    expect(
      hostState(
        host({ breaches: [{ metric: "diskFreeGb", level: "warn" }] }),
        live,
      ),
    ).toBe("warn");
  });

  it("needs a look when a live host has gone quiet, and is unknown when never seen", () => {
    expect(hostState(host({ lastSeen: minutesAgo(52) }), live)).toBe("warn");
    expect(hostState(host({ lastSeen: null }), live)).toBe("unknown");
    expect(hostState(host(), live)).toBe("ok");
  });

  it("does not call a stored copy's host quiet", () => {
    expect(
      hostState(host({ lastSeen: minutesAgo(52) }), {
        now,
        storedAt: new Date(minutesAgo(50)),
        live: false,
      }),
    ).toBe("ok");
  });

  it("sums up what the host reports", () => {
    expect(hostSummary(host())).toBe(
      "CPU 22% · memory free 63% · disk free 59 GB · runners 1 of 4",
    );
    expect(hostSummary(host({ latest: null }))).toBe("No figures yet");
  });
});

describe("relay", () => {
  it("is healthy live, needs a look with changes queued, and is unknown on the stored copy", () => {
    expect(relayRow({ kind: "live" }).state).toBe("ok");
    expect(relayRow({ kind: "queued", count: 2 })).toMatchObject({
      state: "warn",
      summary: "2 changes waiting for the Mac mini",
    });
    expect(relayRow({ kind: "stored" }).state).toBe("unknown");
  });
});

describe("integrations", () => {
  it("judges a sync by its error and its age", () => {
    const base = { id: "jira", name: "Jira" };
    expect(integrationState({ ...base, syncedAt: minutesAgo(10) }, now)).toBe(
      "ok",
    );
    expect(integrationState({ ...base, syncedAt: minutesAgo(90) }, now)).toBe(
      "warn",
    );
    expect(
      integrationState({ ...base, syncedAt: minutesAgo(25 * 60) }, now),
    ).toBe("alert");
    expect(integrationState({ ...base, syncedAt: null }, now)).toBe("unknown");
    expect(
      integrationState(
        { ...base, syncedAt: minutesAgo(1), error: "refused" },
        now,
      ),
    ).toBe("alert");
  });

  it("says when it synced, or why it failed", () => {
    expect(
      integrationRow(
        { id: "jira", name: "Jira", syncedAt: minutesAgo(10) },
        now,
      ).summary,
    ).toBe("Synced 10m ago");
    expect(
      integrationRow(
        {
          id: "jira",
          name: "Jira",
          syncedAt: null,
          error: "asked to slow down",
        },
        now,
      ).summary,
    ).toBe("asked to slow down");
  });

  it("counts the rows that need the reader", () => {
    expect(
      shieldAlerts([
        relayRow({ kind: "live" }),
        relayRow({ kind: "queued", count: 1 }),
        integrationRow(
          { id: "x", name: "X", syncedAt: null, error: "down" },
          now,
        ),
        integrationRow({ id: "y", name: "Y", syncedAt: null }, now),
      ]),
    ).toBe(2);
  });
});
