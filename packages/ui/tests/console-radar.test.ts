import { describe, expect, it } from "bun:test";

import { radarTickets, ticketGroups } from "../src/console";
import type { WorkItem } from "../src/sidebar";

const task: WorkItem = {
  customer: "acme",
  band: "today",
  title: "Already a task",
  key: "PROJ-2",
  ref: "db:1",
};

describe("radarTickets", () => {
  const tickets = radarTickets({
    jira: {
      client: "acme",
      doc: {
        ok: true,
        items: [
          {
            key: "PROJ-1",
            summary: "New one",
            status: "Open",
            updated: "2026-11-18",
          },
          {
            key: "PROJ-2",
            summary: "Tracked",
            status: "In Progress",
            updated: "2026-11-19",
          },
        ],
      },
    },
    monday: {
      client: "globex",
      page: {
        more: false,
        items: [
          {
            name: "Board item",
            url: null,
            status: "Working on it",
            priority: "High",
            key: "MON-9",
            group: null,
            updated: new Date("2026-11-17T10:00:00Z"),
          },
          {
            name: "No key",
            url: null,
            status: "",
            priority: null,
            key: null,
            group: null,
            updated: new Date(),
          },
        ],
      },
    },
    github: {
      client: "initech",
      me: "me",
      page: {
        total: 2,
        more: false,
        items: [
          {
            number: 7,
            title: "Mine",
            url: "https://github.com/o/r/issues/7",
            labels: ["bug"],
            assignees: ["me"],
            updated: "2026-11-19",
          },
          {
            number: 8,
            title: "Theirs",
            url: "https://github.com/o/r/issues/8",
            labels: [],
            assignees: ["them"],
            updated: "2026-11-19",
          },
        ],
      },
    },
    items: [task],
  });

  it("brings every tracker's assigned tickets together, newest first per client", () => {
    expect(tickets.map((t) => t.key)).toEqual([
      "PROJ-2",
      "PROJ-1",
      "MON-9",
      "#7",
    ]);
  });

  it("marks the tickets that are already tasks", () => {
    expect(tickets.find((t) => t.key === "PROJ-2")?.task?.ref).toBe("db:1");
    expect(tickets.find((t) => t.key === "PROJ-1")?.task).toBeNull();
  });

  it("leaves out monday.com items without a key and GitHub issues assigned to others", () => {
    expect(tickets.some((t) => t.title === "No key")).toBe(false);
    expect(tickets.some((t) => t.key === "#8")).toBe(false);
  });

  it("groups by client in the config's order", () => {
    expect(
      ticketGroups(tickets, ["initech", "acme"]).map((g) => g.client),
    ).toEqual(["initech", "acme", "globex"]);
  });

  it("shows nothing from a failed Jira sync", () => {
    expect(
      radarTickets({
        jira: { client: "acme", doc: { ok: false, items: [] } },
        items: [],
      }),
    ).toEqual([]);
  });
});
