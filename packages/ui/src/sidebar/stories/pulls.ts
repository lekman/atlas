/** Invented pull requests for the stories: open, draft, merged and closed. */
import type { PullsDoc } from "../details/pulls";
import { STORY_NOW } from "./examples";

const hoursAgo = (h: number) =>
  new Date(STORY_NOW.getTime() - h * 3600000).toISOString();

export const pullsDoc: PullsDoc = {
  ref: "db:42",
  linked: true,
  fetchedAt: hoursAgo(0.1),
  prs: [
    {
      repo: "kestrel-freight/depot-api",
      number: 118,
      title: "Switch the depot scanners to the v2 endpoint",
      url: "https://github.com/kestrel-freight/depot-api/pull/118",
      state: "open",
      author: "sam-k",
      additions: 412,
      deletions: 97,
      files: 14,
      updatedAt: hoursAgo(1),
      checks: "success",
      conflicts: false,
      awaiting: 1,
      review: "review_required",
    },
    {
      repo: "kestrel-freight/scanner-gateway",
      number: 57,
      title: "Queue scans while a depot is offline",
      url: "https://github.com/kestrel-freight/scanner-gateway/pull/57",
      state: "draft",
      author: "alex-a",
      additions: 88,
      deletions: 3,
      files: 1,
      updatedAt: hoursAgo(5),
      checks: "pending",
      conflicts: true,
      unresolved: 2,
    },
    {
      repo: "kestrel-freight/depot-api",
      number: 110,
      title: "Accept pallets over 1,000 kg",
      url: "https://github.com/kestrel-freight/depot-api/pull/110",
      state: "merged",
      author: "sam-k",
      additions: 20,
      deletions: 4,
      files: 2,
      mergedAt: hoursAgo(30),
    },
    {
      repo: "kestrel-freight/depot-api",
      number: 104,
      title: "Try the old scanner SDK",
      url: "https://github.com/kestrel-freight/depot-api/pull/104",
      state: "closed",
      closedAt: hoursAgo(120),
    },
  ],
};
