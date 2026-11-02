/** Invented hosts for the stories: a build server, a runner pool, a laptop. */
import type { HostSample, HostStat, HostsDoc } from "../hosts/model";
import { exampleClients, STORY_NOW } from "./examples";

/** A day of samples every 30 minutes, shaped by `at(hoursAgo)`. */
function day(at: (hoursAgo: number) => Omit<HostSample, "at">): HostSample[] {
  return Array.from({ length: 48 }, (_, i) => {
    const hoursAgo = (47 - i) / 2;
    return {
      at: new Date(STORY_NOW.getTime() - hoursAgo * 3600000).toISOString(),
      ...at(hoursAgo),
    };
  });
}

const wave = (h: number, base: number, swing: number) =>
  Math.round((base + swing * Math.sin(h / 2.3)) * 10) / 10;

const minutesAgo = (m: number) =>
  new Date(STORY_NOW.getTime() - m * 60000).toISOString();

export const buildServer: HostStat = {
  clientId: "ashgrove",
  host: "build-01",
  lastSeen: minutesAgo(3),
  latest: {
    cpuPct: 22,
    load1: 2.96,
    memFreePct: 63,
    swapUsedMb: 6570,
    diskFreeGb: 58.8,
    runnersBusy: 1,
    runnersMax: 4,
  },
  samples: day((h) => ({
    cpuPct: wave(h, 30, 18),
    memFreePct: wave(h, 60, 6),
    diskFreeGb: wave(h, 59, 0.8),
  })),
  breaches: [],
};

export const runnerPool: HostStat = {
  clientId: "kestrel",
  host: "runner",
  lastSeen: minutesAgo(2),
  latest: {
    cpuPct: 18.7,
    load1: 1.46,
    memFreePct: 76,
    swapUsedMb: 1447,
    diskFreeGb: 335.2,
    runnersBusy: 5,
    runnersMax: 6,
  },
  samples: day((h) => ({
    cpuPct: wave(h, 40, 35),
    memFreePct: wave(h, 62, 10),
    diskFreeGb: wave(h, 333, 2),
  })),
  breaches: [],
};

export const laptopWarning: HostStat = {
  clientId: "halcyon",
  host: "laptop",
  lastSeen: minutesAgo(4),
  latest: {
    cpuPct: 12.3,
    load1: 3.26,
    memFreePct: 72,
    swapUsedMb: 94,
    diskFreeGb: 41.2,
  },
  samples: day((h) => ({
    cpuPct: wave(h, 12, 6),
    memFreePct: wave(h, 72, 2),
    diskFreeGb: 52 - (24 - h) / 2,
  })),
  breaches: [{ metric: "diskFreeGb", level: "warn" }],
};

export const serverCritical: HostStat = {
  ...buildServer,
  latest: { ...buildServer.latest, memFreePct: 6, cpuPct: 97 },
  breaches: [
    { metric: "memFreePct", level: "crit" },
    { metric: "cpuPct", level: "warn" },
  ],
};

export const quietHost: HostStat = {
  clientId: "meridian",
  host: "edge",
  lastSeen: minutesAgo(52),
  latest: { cpuPct: 4, load1: 0.2, memFreePct: 81, diskFreeGb: 120 },
  samples: [],
  breaches: [],
};

export const hostsDoc: HostsDoc = {
  hosts: [buildServer, runnerPool, laptopWarning],
};

export function clientOfHost(host: HostStat) {
  const c = exampleClients.find(
    (x) => x.key === (host.customer ?? host.clientId),
  );
  return c
    ? { name: c.name, colour: c.colour }
    : { name: "Other", colour: "var(--client-other)" };
}
