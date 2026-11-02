/** An invented Monday board page for the stories. */
import { mondayPage, type MondayColumns } from "../trackers/monday";
import { STORY_NOW } from "./examples";

export const mondayColumns: MondayColumns = {
  status: "status",
  priority: "priority",
  key: "number",
};

const hoursAgo = (h: number) =>
  new Date(STORY_NOW.getTime() - h * 3600000).toISOString();

const item = (
  n: number,
  name: string,
  status: string,
  priority: string | null,
  updated: number,
) => ({
  name,
  url: `https://example.monday.com/boards/1/pulses/${n}`,
  updated_at: hoursAgo(updated),
  group: { title: "Sprint 12" },
  column_values: { status, priority, number: String(n) },
});

export const mondayPayload = {
  items: [
    item(
      301,
      "Scanner API rejects pallets over 1,000 kg",
      "Stuck",
      "Critical",
      2,
    ),
    item(
      296,
      "Route planner times out for the northern depots",
      "Working on it",
      "High",
      5,
    ),
    item(
      288,
      "Driver app: show the next three drops",
      "Working on it",
      "Medium",
      30,
    ),
    item(310, "Review the depot onboarding checklist", "In Review", "Low", 8),
    item(275, "Archive last year's delivery notes", "Not started", null, 72),
    item(
      312,
      "Customs export for the new partner",
      "Waiting for partner",
      "Medium",
      20,
    ),
    item(250, "Old pallet labels", "Done", "Low", 200),
  ],
  pagination: { has_more: false },
};

export const mondayExample = mondayPage(mondayPayload, mondayColumns, "KF");
