import { describe, expect, it } from "bun:test";

(globalThis as { __SIDEBAR_CONFIG__?: unknown }).__SIDEBAR_CONFIG__ = {
  clients: [],
  trackers: [],
};
const { sidebarViews, tabLook } = await import("../src/views");

const config = {
  clients: [
    { key: "acme", name: "Acme", slot: 1 },
    { key: "beta", name: "Beta", slot: 2 },
  ],
  trackers: [
    {
      client: "acme",
      source: "Monday",
      logo: "monday" as const,
      release: true,
    },
    { client: "beta", source: "Jira", logo: "jira" as const },
  ],
};

describe("sidebarViews", () => {
  it("puts shared views first, each client's trackers, and hosts last", () => {
    expect(sidebarViews(config).map((v) => v.id)).toEqual([
      "worklist",
      "agenda",
      "acme",
      "release",
      "beta",
      "hosts",
    ]);
  });

  it("names a tracker tab after its client, or its source with the client chosen", () => {
    const acme = sidebarViews(config).find((v) => v.id === "acme");
    expect(acme?.labels).toEqual(["Acme", "Monday"]);
  });

  it("shows the release tab only with its client chosen", () => {
    const release = sidebarViews(config).find((v) => v.id === "release");
    expect(release).toMatchObject({ client: "acme", focusOnly: true });
  });
});

describe("tabLook", () => {
  it("gives trackers their logo and puts hosts at the end", () => {
    expect(tabLook(config, "beta")).toEqual({ logo: "jira" });
    expect(tabLook(config, "hosts")).toEqual({ icon: "pulse", end: true });
  });
});
