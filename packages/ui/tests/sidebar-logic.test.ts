import { describe, expect, it } from "bun:test";

import {
  formatAgo,
  formatDuration,
  syncLabel,
  visibleViews,
  type SidebarView,
} from "../src/sidebar";

const views: SidebarView[] = [
  { id: "worklist", labels: ["Worklist", "Worklist"] },
  { id: "acme", client: "acme", labels: ["Acme", "Jira"] },
  {
    id: "release",
    client: "acme",
    focusOnly: true,
    labels: ["Release", "Release"],
  },
  { id: "beta", client: "beta", labels: ["Beta", "GitHub"] },
  { id: "hosts", labels: ["Hosts", "Hosts"] },
];
const ids = (r: ReturnType<typeof visibleViews>) => r.views.map((v) => v.id);

describe("visibleViews", () => {
  it("shows every client's tab and no focus-only tab for all clients", () => {
    const r = visibleViews(views, "all", "worklist");
    expect(ids(r)).toEqual(["worklist", "acme", "beta", "hosts"]);
    expect(r.views.find((v) => v.id === "acme")?.label).toBe("Acme");
  });

  it("keeps only the chosen client's tabs, named after their source", () => {
    const r = visibleViews(views, "acme", "worklist");
    expect(ids(r)).toEqual(["worklist", "acme", "release", "hosts"]);
    expect(r.views.find((v) => v.id === "acme")?.label).toBe("Jira");
  });

  it("opens the chosen client's tab when the open tab is hidden", () => {
    expect(visibleViews(views, "acme", "beta").selected).toBe("acme");
  });

  it("opens the client's main tab when a focus-only tab is hidden", () => {
    expect(visibleViews(views, "all", "release").selected).toBe("acme");
  });

  it("opens the first tab when the focused client has no tab", () => {
    expect(visibleViews(views, "gamma", "beta").selected).toBe("worklist");
  });
});

describe("syncLabel", () => {
  const now = new Date("2026-03-12T09:40:00");

  it("is live for three minutes after a live read", () => {
    expect(
      syncLabel({ liveAt: now.getTime() - 179000, syncedAt: null }, now).text,
    ).toBe("Live");
    expect(
      syncLabel({ liveAt: now.getTime() - 181000, syncedAt: null }, now).text,
    ).toBe("Not synced yet");
  });

  it("gives the sync time, with the day when it was not today", () => {
    expect(
      syncLabel({ liveAt: null, syncedAt: "2026-03-12T08:15:00" }, now).text,
    ).toBe("Synced 08:15");
    expect(
      syncLabel({ liveAt: null, syncedAt: "2026-03-11T17:02:00" }, now).text,
    ).toBe("Synced Wed 11 Mar 17:02");
  });

  it("marks a failed sync and gives the reason", () => {
    const label = syncLabel(
      { liveAt: null, syncedAt: null, error: "jira: no answer" },
      now,
    );
    expect(label.tone).toBe("err");
    expect(label.title).toContain("jira: no answer");
  });
});

describe("formats", () => {
  it("writes durations as the sidebar does", () => {
    expect(formatDuration(45 * 60000)).toBe("45 min");
    expect(formatDuration(125 * 60000)).toBe("2 h 5 min");
    expect(formatDuration(120 * 60000)).toBe("2 h");
    expect(formatDuration(49 * 3600000)).toBe("2 days");
  });

  it("writes how long ago as a phrase", () => {
    const now = new Date("2026-03-12T09:40:00");
    expect(formatAgo(new Date("2026-03-12T09:39:50"), now)).toBe("just now");
    expect(formatAgo(new Date("2026-03-12T09:35:00"), now)).toBe("5m ago");
    expect(formatAgo(new Date("2026-03-10T09:40:00"), now)).toBe("2d ago");
    expect(formatAgo(new Date("2026-02-18T09:40:00"), now)).toBe("on 18 Feb");
  });
});
