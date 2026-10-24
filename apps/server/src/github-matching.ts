/**
 * Matches what gh-events knows about pull requests and issues to Atlas
 * backlog items, and turns it into development tracking and event text.
 * Pure: the reader in `github-reader.ts` gathers the facts and calls these.
 *
 * An item matches a GitHub issue or pull request when its tracker is
 * GitHub and its tracker address names the same repository and number,
 * compared without regard to case. A pull request also belongs to every
 * item whose issue it closes in the same repository. Both sides must name
 * the same Atlas client: a row whose client is unset or is not an Atlas
 * client is counted as unknown and never shown.
 */
import type {
  BacklogItem,
  Dataset,
  DevelopmentTracking,
  TrackedIssue,
  TrackedPullRequest,
} from "@atlas/core";

import {
  RepositoryName,
  type CiState,
  type EventLine,
  type RegistryItem,
} from "./github-contract";

/** A pull request or issue that has left the registry: merged, or closed. */
export interface FinishedItem {
  /** `owner/name`, as gh-events wrote it. */
  repository: string;
  number: number;
  client: string | null;
}

/** What the last pull request read showed: the issues it closes, and its checks. */
export interface PullRequestMemory {
  closes: readonly number[];
  ci: CiState | null;
}

/** Everything the reader knows, from the registry and from the events read. */
export interface GithubFacts {
  /** The open items in the latest registry of a known version. */
  registry: readonly RegistryItem[];
  /** Merged pull requests, by `referenceKey`. */
  merged: ReadonlyMap<string, FinishedItem>;
  /** Pull requests closed without merging, by `referenceKey`. */
  closedPullRequests: ReadonlyMap<string, FinishedItem>;
  /** Closed issues, by `referenceKey`. */
  closedIssues: ReadonlyMap<string, FinishedItem>;
  /** Every pull request seen in a registry, by `referenceKey`. */
  pullRequests: ReadonlyMap<string, PullRequestMemory>;
}

export const noFacts: GithubFacts = {
  registry: [],
  merged: new Map(),
  closedPullRequests: new Map(),
  closedIssues: new Map(),
  pullRequests: new Map(),
};

/** The key a repository and number are compared by: lower case, `owner/name#number`. */
export function referenceKey(repository: string, number: number): string {
  return `${repository.toLowerCase()}#${number}`;
}

export interface GithubReference {
  /** `owner/name`, in lower case. */
  repository: string;
  number: number;
}

/**
 * The repository and number in a GitHub issue or pull request address,
 * `https://github.com/owner/name/issues/7` or `.../pull/12`. Anything else,
 * including another host, gives nothing.
 */
export function parseGithubUrl(url: string): GithubReference | undefined {
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    return undefined;
  }
  if (address.protocol !== "https:") return undefined;
  if (
    address.hostname !== "github.com" &&
    address.hostname !== "www.github.com"
  )
    return undefined;
  const parts = address.pathname.split("/").filter(Boolean);
  const [owner, name, kind, number] = parts;
  if (parts.length !== 4 || !owner || !name || !number) return undefined;
  if (kind !== "issues" && kind !== "pull") return undefined;
  if (!/^[1-9][0-9]{0,9}$/.test(number)) return undefined;
  const repository = `${owner}/${name}`;
  if (!RepositoryName.safeParse(repository).success) return undefined;
  return { repository: repository.toLowerCase(), number: Number(number) };
}

/** The contract builds every address from the repository and number; so does Atlas. */
function issueUrl(repository: string, number: number): string {
  return `https://github.com/${repository}/issues/${number}`;
}

function pullRequestUrl(repository: string, number: number): string {
  return `https://github.com/${repository}/pull/${number}`;
}

/** The contract's own suggestion for a consumer with fewer check states. */
export function checksOf(ci: CiState | null): TrackedPullRequest["checks"] {
  switch (ci) {
    case "SUCCESS":
      return "passing";
    case "FAILURE":
    case "ERROR":
      return "failing";
    case "PENDING":
    case "EXPECTED":
      return "pending";
    case null:
      return "none";
  }
}

/** Items tracked on GitHub, by the `referenceKey` of their tracker address. */
function indexItems(dataset: Dataset): Map<string, BacklogItem[]> {
  const index = new Map<string, BacklogItem[]>();
  for (const item of dataset.items) {
    if (item.tracker?.system !== "github") continue;
    const reference = parseGithubUrl(item.tracker.url);
    if (!reference) continue;
    const key = referenceKey(reference.repository, reference.number);
    index.set(key, [...(index.get(key) ?? []), item]);
  }
  return index;
}

/** A matcher over one dataset: which items a repository and numbers belong to. */
function matcher(dataset: Dataset) {
  const clients = new Set(dataset.clients.map((client) => client.id));
  const index = indexItems(dataset);
  return {
    /** Whether a row's client is an Atlas client. */
    known: (client: string | null): client is string =>
      client !== null && clients.has(client),
    /** The client's items whose tracker names one of the numbers in the repository. */
    items(
      client: string,
      repository: string,
      numbers: readonly number[],
    ): BacklogItem[] {
      const found = new Map<string, BacklogItem>();
      for (const number of numbers)
        for (const item of index.get(referenceKey(repository, number)) ?? [])
          if (item.clientId === client) found.set(item.id, item);
      return [...found.values()];
    },
  };
}

/** What `GET /api/health` reports about the registry's items. Counts only. */
export interface MatchCounts {
  items: number;
  /** Registry items that belong to at least one backlog item. */
  matched: number;
  /** Registry items of an Atlas client that belong to no backlog item. */
  unmatched: number;
  /** Registry items whose client is unset or not an Atlas client. */
  unknownClients: number;
}

export interface Resolution {
  /** The real development tracking of every item the facts match, by item id. */
  development: Map<string, DevelopmentTracking>;
  counts: MatchCounts;
}

interface PullRequestCandidate extends TrackedPullRequest {
  finished: boolean;
}

/**
 * The development tracking the facts give each backlog item, and the
 * registry's counts. An issue in the registry is open, and one with an
 * `issue_closed` event and no longer in the registry is closed. A pull
 * request in the registry is draft or open; one with a `merged` event is
 * merged, and one with a `closed` event and no merge is closed. When
 * several pull requests belong to an item, one still open wins over a
 * finished one, then the highest number. The contract has no
 * branch names, so `branch` is never set.
 */
export function resolveGithub(
  dataset: Dataset,
  facts: GithubFacts,
): Resolution {
  const match = matcher(dataset);
  const issues = new Map<string, TrackedIssue>();
  const pulls = new Map<string, Map<string, PullRequestCandidate>>();
  const addPull = (
    item: BacklogItem,
    key: string,
    pull: PullRequestCandidate,
  ) => pulls.set(item.id, (pulls.get(item.id) ?? new Map()).set(key, pull));
  const counts: MatchCounts = {
    items: facts.registry.length,
    matched: 0,
    unmatched: 0,
    unknownClients: 0,
  };

  for (const row of facts.registry) {
    if (!match.known(row.client)) {
      counts.unknownClients += 1;
      continue;
    }
    const numbers =
      row.kind === "pr" ? [row.number, ...row.closes] : [row.number];
    const items = match.items(row.client, row.repo, numbers);
    if (items.length) counts.matched += 1;
    else counts.unmatched += 1;
    for (const item of items)
      if (row.kind === "issue")
        issues.set(item.id, {
          key: item.tracker?.key ?? `#${row.number}`,
          url: issueUrl(row.repo, row.number),
          state: "open",
        });
      else
        addPull(item, referenceKey(row.repo, row.number), {
          number: row.number,
          url: pullRequestUrl(row.repo, row.number),
          state: row.state === "DRAFT" ? "draft" : "open",
          checks: checksOf(row.ci),
          finished: false,
        });
  }

  for (const closed of facts.closedIssues.values()) {
    if (!match.known(closed.client)) continue;
    for (const item of match.items(closed.client, closed.repository, [
      closed.number,
    ]))
      if (!issues.has(item.id))
        issues.set(item.id, {
          key: item.tracker?.key ?? `#${closed.number}`,
          url: issueUrl(closed.repository, closed.number),
          state: "closed",
        });
  }

  for (const [key, closed] of facts.closedPullRequests) {
    if (!match.known(closed.client) || facts.merged.has(key)) continue;
    const memory = facts.pullRequests.get(key);
    const numbers = [closed.number, ...(memory?.closes ?? [])];
    for (const item of match.items(closed.client, closed.repository, numbers))
      addPull(item, key, {
        number: closed.number,
        url: pullRequestUrl(closed.repository, closed.number),
        state: "closed",
        checks: checksOf(memory?.ci ?? null),
        finished: true,
      });
  }

  for (const [key, merged] of facts.merged) {
    if (!match.known(merged.client)) continue;
    const memory = facts.pullRequests.get(key);
    const numbers = [merged.number, ...(memory?.closes ?? [])];
    for (const item of match.items(merged.client, merged.repository, numbers))
      addPull(item, key, {
        number: merged.number,
        url: pullRequestUrl(merged.repository, merged.number),
        state: "merged",
        checks: checksOf(memory?.ci ?? null),
        finished: true,
      });
  }

  const development = new Map<string, DevelopmentTracking>();
  for (const id of new Set([...issues.keys(), ...pulls.keys()])) {
    const issue = issues.get(id);
    const [chosen] = [...(pulls.get(id)?.values() ?? [])].sort(
      (left, right) =>
        Number(left.finished) - Number(right.finished) ||
        right.number - left.number,
    );
    const tracking: DevelopmentTracking = {};
    if (issue) tracking.issue = issue;
    if (chosen) {
      const { finished: _finished, ...pullRequest } = chosen;
      tracking.pullRequest = pullRequest;
    }
    development.set(id, tracking);
  }
  return { development, counts };
}

/**
 * The dataset with real development tracking on every item the facts
 * match. It replaces whatever tracking the item had; other items, and the
 * dataset passed in, are left as they are.
 */
export function withGithubDevelopment(
  dataset: Dataset,
  development: ReadonlyMap<string, DevelopmentTracking>,
): Dataset {
  if (development.size === 0) return dataset;
  return {
    ...dataset,
    items: dataset.items.map((item) => {
      const tracking = development.get(item.id);
      return tracking ? { ...item, development: tracking } : item;
    }),
  };
}

/** The ids of the backlog items an `events.jsonl` line is about. */
export function itemsForEvent(
  dataset: Dataset,
  line: EventLine,
  facts: GithubFacts,
): string[] {
  const match = matcher(dataset);
  if (!match.known(line.client)) return [];
  const numbers =
    line.kind === "pr"
      ? [
          line.number,
          ...(facts.pullRequests.get(referenceKey(line.repo, line.number))
            ?.closes ?? []),
        ]
      : [line.number];
  return match.items(line.client, line.repo, numbers).map((item) => item.id);
}

/**
 * The Atlas event text for a line, built from its event and number alone,
 * so no text anyone wrote on GitHub can reach the log.
 */
export function eventText(line: Pick<EventLine, "event" | "number">): string {
  switch (line.event) {
    case "approved":
      return `Pull request #${line.number} approved`;
    case "ci_failed":
      return `Pull request #${line.number}: checks failed`;
    case "conflict":
      return `Pull request #${line.number}: merge conflict`;
    case "merged":
      return `Pull request #${line.number} merged`;
    case "closed":
      return `Pull request #${line.number} closed without merging`;
    case "issue_assigned":
      return `Issue #${line.number} assigned`;
    case "issue_closed":
      return `Issue #${line.number} closed`;
  }
}
