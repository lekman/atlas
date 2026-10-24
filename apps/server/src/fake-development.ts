/**
 * Invented development tracking for items tracked on GitHub, so the
 * Tracking section of the details pane can be tried on a real dataset
 * before the GitHub integration exists.
 *
 * It is opt-in (`ATLAS_FAKE_DEVELOPMENT=true`), it is laid over the
 * dataset the API serves to views and nowhere else, and it never replaces
 * development tracking an item already has. Every value comes from the
 * item's id, tracker key, title and state, so the same item shows the same
 * invented issue, branch and pull request on every read.
 */
import type {
  BacklogItem,
  Dataset,
  DevelopmentTracking,
  TrackedPullRequest,
} from "@atlas/core";

/** FNV-1a, 32 bits: small, stable, and spread enough to pick between a few values. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/** Up to four words of the title, lower case and joined by hyphens. */
export function shortSlug(title: string): string {
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 4);
  return words.length ? words.join("-") : "work";
}

/**
 * The issue number in the tracker key ("#41", "41") or, failing that, at
 * the end of its address. An invented one when neither holds a number.
 */
function issueNumber(item: BacklogItem, seed: number): number {
  const fromKey = item.tracker?.key.match(/(\d+)\s*$/)?.[1];
  if (fromKey) return Number(fromKey);
  const fromUrl = item.tracker?.url.match(/(\d+)\/?$/)?.[1];
  if (fromUrl) return Number(fromUrl);
  return 100 + (seed % 900);
}

/** The repository's address, from an issue address such as `…/owner/name/issues/41`. */
function repositoryUrl(url: string): string {
  const match = url.match(/^(https?:\/\/[^/]+\/[^/]+\/[^/]+)\//);
  return match?.[1] ?? url.replace(/\/+$/, "");
}

/** The repository's name, for the worktree's folder. */
function repositoryName(url: string): string {
  return repositoryUrl(url).split("/").pop() || "repository";
}

const inProgressStates: readonly TrackedPullRequest["state"][] = [
  "draft",
  "open",
];
const inProgressChecks: readonly TrackedPullRequest["checks"][] = [
  "pending",
  "passing",
  "failing",
];

/**
 * The invented development tracking for one item tracked on GitHub:
 *
 * - the issue is the tracker's, closed when the item is done;
 * - work not started has the issue alone;
 * - work in progress or in review is on a branch in its own worktree, and
 *   most of it has a pull request, draft or open, with checks pending,
 *   passing or failing;
 * - done work has a merged pull request with passing checks.
 */
export function inventDevelopment(item: BacklogItem): DevelopmentTracking {
  const tracker = item.tracker;
  if (!tracker) return {};
  const seed = hash(`${item.id}\u0000${tracker.key}`);
  const number = issueNumber(item, seed);
  const development: DevelopmentTracking = {
    issue: {
      key: tracker.key,
      url: tracker.url,
      state: item.state === "done" ? "closed" : "open",
    },
  };
  if (item.state === "todo") return development;

  const slug = shortSlug(item.title);
  const inProgress = item.state === "doing" || item.state === "review";
  development.branch = {
    name: `feature/${number}-${slug}`,
    ...(inProgress
      ? {
          worktree: {
            path: `~/worktrees/${repositoryName(tracker.url)}-${number}`,
          },
        }
      : {}),
  };
  // One in three items still being worked has no pull request yet; an item
  // in review always has one.
  if (item.state === "doing" && seed % 3 === 0) return development;
  const pullNumber = number + 1 + (seed % 7);
  development.pullRequest = {
    number: pullNumber,
    url: `${repositoryUrl(tracker.url)}/pull/${pullNumber}`,
    state:
      item.state === "done"
        ? "merged"
        : item.state === "review"
          ? "open"
          : (inProgressStates[(seed >>> 4) % inProgressStates.length] ??
            "draft"),
    checks:
      item.state === "done"
        ? "passing"
        : (inProgressChecks[(seed >>> 8) % inProgressChecks.length] ??
          "pending"),
  };
  return development;
}

/**
 * The dataset with invented development tracking on every item tracked on
 * GitHub that has none. Other items, and the dataset passed in, are left
 * as they are.
 */
export function withFakeDevelopment(dataset: Dataset): Dataset {
  return {
    ...dataset,
    items: dataset.items.map((item) =>
      item.tracker?.system === "github" && !item.development
        ? { ...item, development: inventDevelopment(item) }
        : item,
    ),
  };
}
