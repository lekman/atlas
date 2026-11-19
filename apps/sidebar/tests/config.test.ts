import { describe, expect, it } from "bun:test";

(globalThis as { __SIDEBAR_CONFIG__?: unknown }).__SIDEBAR_CONFIG__ = {
  clients: [],
  trackers: [],
};
const { askClient, clientColour, withoutConnectors } =
  await import("../src/config");

const config = {
  clients: [
    { key: "acme", name: "Acme", slot: 1 },
    { key: "odd", name: "Odd", slot: 9 },
  ],
  trackers: [],
};

describe("clientColour", () => {
  it("uses the client's slot", () => {
    expect(clientColour("acme", config)).toBe("var(--client-1)");
  });

  it("uses the other colour for an unknown client or a bad slot", () => {
    expect(clientColour("nobody", config)).toBe("var(--client-other)");
    expect(clientColour("odd", config)).toBe("var(--client-other)");
  });
});

describe("withoutConnectors", () => {
  const full = {
    operator: "Alex",
    clients: [{ key: "kestrel", name: "Kestrel Freight", slot: 2 }],
    trackers: [
      {
        client: "kestrel",
        source: "Monday",
        logo: "monday" as const,
        monday: {
          boardId: 1,
          personColumn: "people",
          personId: "p",
          columns: { status: "status" },
          keyPrefix: "KF",
        },
      },
      { client: "halcyon", source: "Jira", logo: "jira" as const },
      {
        client: "meridian",
        source: "GitHub",
        logo: "github" as const,
        github: { owner: "meridian-bank", name: "ledger" },
      },
    ],
    calendar: {
      timeZone: "Europe/London",
      google: { client: "ashgrove", label: "Ashgrove calendar" },
      outlook: { client: "ashgrove", label: "Work calendar" },
      mixedFeeds: ["ashgrove"],
    },
    inbox: { server: "Cloudflare", tool: "d1", databaseId: "0" },
  };

  it("keeps only what the Mac's sync and the dashboard server fill", () => {
    const trimmed = withoutConnectors(full);
    expect(trimmed.trackers.map((t) => t.source)).toEqual(["Jira"]);
    expect(trimmed.calendar).toEqual({
      timeZone: "Europe/London",
      mixedFeeds: ["ashgrove"],
    });
    expect(trimmed.inbox).toBeUndefined();
    expect(trimmed.clients).toEqual(full.clients);
    expect(trimmed.operator).toBe("Alex");
  });

  it("leaves the config it was given alone", () => {
    withoutConnectors(full);
    expect(full.trackers).toHaveLength(3);
    expect(full.calendar.google).toBeDefined();
  });
});

describe("askClient", () => {
  const clients = {
    clients: [
      { key: "acme", name: "Acme", slot: 1, keywords: ["roadrunner"] },
      { key: "globex", name: "Globex", slot: 2 },
    ],
    trackers: [],
  };

  it("matches a keyword in the worker, the question or its context", () => {
    expect(askClient({ worker: "Roadrunner" }, clients)).toBe("acme");
    expect(
      askClient(
        { worker: "Commander", ask: "Ship the roadrunner fix?" },
        clients,
      ),
    ).toBe("acme");
    expect(
      askClient(
        { worker: "Commander", ask: "Go?", reason: "roadrunner" },
        clients,
      ),
    ).toBe("acme");
  });

  it("matches a client's own name when it has no keyword", () => {
    expect(
      askClient({ worker: "Commander", ask: "Globex: which day?" }, clients),
    ).toBe("globex");
  });

  it("gives none when nothing matches", () => {
    expect(
      askClient({ worker: "Commander", ask: "Lunch?" }, clients),
    ).toBeNull();
  });
});
