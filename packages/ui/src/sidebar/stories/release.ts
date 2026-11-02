/** An invented release check for the stories. */
import type { ReleaseDoc } from "../release/model";
import { STORY_NOW } from "./examples";

export const releaseDrifted: ReleaseDoc = {
  branch: "release/2026.03",
  total: 14,
  checkedAt: new Date(STORY_NOW.getTime() - 12 * 60000).toISOString(),
  drifted: [
    {
      repo: "depot-api",
      envs: { development: "ok", staging: "behind", production: "behind" },
    },
    {
      repo: "scanner-gateway",
      envs: { development: "ok", staging: "ok", production: "failed" },
    },
    {
      repo: "route-planner",
      envs: { development: "deploying", staging: "ok", production: "ok" },
    },
    {
      repo: "billing-export",
      reasons: ["release branch missing"],
    },
  ],
};

export const releaseSynced: ReleaseDoc = {
  ...releaseDrifted,
  drifted: [],
};

/** A gap but no failure: yellow. */
export const releaseGapOnly: ReleaseDoc = {
  ...releaseDrifted,
  drifted: [releaseDrifted.drifted[0]!, releaseDrifted.drifted[2]!],
};
