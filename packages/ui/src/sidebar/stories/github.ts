/** An invented GitHub issues page for the stories. */
import { githubPage } from "../trackers/github";
import { STORY_NOW } from "./examples";

const hoursAgo = (h: number) =>
  new Date(STORY_NOW.getTime() - h * 3600000).toISOString();

export const githubPayload = {
  totalCount: 6,
  pageInfo: { hasNextPage: false },
  issues: [
    {
      number: 412,
      title: "Statement export drops the last row",
      labels: [{ name: "bug" }],
      assignees: [{ login: "alex-a" }],
      updated_at: hoursAgo(1),
    },
    {
      number: 409,
      title: "Rotate the signing key on staging",
      labels: ["security", "p1"],
      assignees: [{ login: "sam-k" }],
      updated_at: hoursAgo(6),
    },
    {
      number: 401,
      title: "Audit log shows UTC, users expect local time",
      labels: ["bug", "ux"],
      assignees: [],
      updated_at: hoursAgo(26),
    },
    {
      number: 398,
      title: "Document the reconciliation job",
      labels: ["docs"],
      assignees: [{ login: "alex-a" }],
      updated_at: hoursAgo(50),
    },
    {
      number: 390,
      title: "Pin the base image digest",
      labels: ["security"],
      assignees: [{ login: "alex-a" }],
      updated_at: hoursAgo(80),
    },
    {
      number: 377,
      title: "Tidy the README badges",
      labels: [],
      assignees: [],
      updated_at: hoursAgo(200),
    },
  ],
};

export const githubRepo = { owner: "meridian-bank", name: "ledger" };

export const githubExample = githubPage(githubPayload, githubRepo);
