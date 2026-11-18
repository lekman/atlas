/** Invented Shields data for the stories, timed against the sidebar's story clock. */
import { STORY_NOW } from "../../sidebar/stories/examples";
import { hostsDoc } from "../../sidebar/stories/hosts";
import type { IntegrationInput } from "../shields";

const minutesAgo = (m: number) =>
  new Date(STORY_NOW.getTime() - m * 60000).toISOString();

export const storyHosts = hostsDoc.hosts;

export const storyIntegrations: IntegrationInput[] = [
  { id: "tasks", name: "Task database", syncedAt: minutesAgo(1) },
  { id: "worklist", name: "Worklist", syncedAt: minutesAgo(1) },
  { id: "jira", name: "Jira", syncedAt: minutesAgo(95) },
  {
    id: "calendar",
    name: "Calendars",
    syncedAt: null,
    error: "Asked to slow down; retrying in 15 minutes",
  },
];
