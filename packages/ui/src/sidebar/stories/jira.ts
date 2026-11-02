/** An invented Jira sync for the stories. */
import { readJira } from "../trackers/jira";
import { STORY_NOW } from "./examples";

const hoursAgo = (h: number) =>
  new Date(STORY_NOW.getTime() - h * 3600000).toISOString();

export const jiraStored = {
  ok: true,
  syncedAt: hoursAgo(0.25),
  items: [
    {
      key: "HAL-214",
      summary: "Consent screen fails for returning users",
      url: "https://example.atlassian.net/browse/HAL-214",
      status: "Blocked",
      category: "indeterminate",
      type: "Bug",
      priority: "Highest",
      due: "2026-03-10",
      updated: hoursAgo(3),
    },
    {
      key: "HAL-209",
      summary: "Export the visit schedule as CSV",
      url: "https://example.atlassian.net/browse/HAL-209",
      status: "In Progress",
      category: "indeterminate",
      type: "Story",
      priority: "Medium",
      due: "2026-03-20",
      updated: hoursAgo(20),
    },
    {
      key: "HAL-205",
      summary: "Review the data retention wording",
      url: "https://example.atlassian.net/browse/HAL-205",
      status: "In Review",
      category: "indeterminate",
      type: "Task",
      priority: "Low",
      updated: hoursAgo(30),
    },
    {
      key: "HAL-198",
      summary: "Spike: offline mode for site visits",
      url: "https://example.atlassian.net/browse/HAL-198",
      status: "To Do",
      category: "new",
      type: "Spike",
      updated: hoursAgo(90),
    },
    {
      key: "HAL-150",
      summary: "Regression suite for the scheduler",
      status: "To Do",
      category: "new",
      type: "Test Plan",
      updated: hoursAgo(90),
    },
  ],
};

export const jiraExample = readJira(jiraStored)!;
