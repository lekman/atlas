import { BacklogItem, Dataset } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { describe, expect, test } from "bun:test";

import {
  checksOf,
  eventText,
  isStale,
  itemsForEvent,
  noFacts,
  parseEventLine,
  parseGithubUrl,
  parseRegistry,
  referenceKey,
  resolveGithub,
  withGithubDevelopment,
  type GithubFacts,
  type RegistryItem,
} from "../src";

const now = new Date("2026-10-24T12:00:00.000Z");
const sha = "0123456789abcdef0123456789abcdef01234567";
const repository = "example-org/sample-app";

/** An invented registry item, open, with the values given. */
function registryItem(values: Partial<RegistryItem> = {}): RegistryItem {
  return {
    kind: "issue",
    repo: repository,
    number: 7,
    client: "ashgrove",
    state: "OPEN",
    review: null,
    ci: null,
    mergeable: null,
    sha: null,
    closes: [],
    since: "2026-10-24T09:00:00.000Z",
    ...values,
  };
}

function pullRequest(values: Partial<RegistryItem> = {}): RegistryItem {
  return registryItem({
    kind: "pr",
    number: 12,
    review: "REVIEW_REQUIRED",
    ci: "PENDING",
    mergeable: "MERGEABLE",
    sha,
    ...values,
  });
}

/** `registry.json` as gh-events writes it, with an account field Atlas never keeps. */
function registryText(
  items: unknown[],
  values: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    version: 1,
    generatedAt: "2026-10-24T11:59:30.000Z",
    intervalSeconds: 60,
    accounts: [
      {
        login: "example-login",
        ok: true,
        polledAt: "2026-10-24T11:59:30.000Z",
        error: null,
      },
    ],
    items: items.map((item) => ({
      url: "https://github.com/example-org/sample-app/issues/7",
      account: "example-login",
      ...(item as object),
    })),
    ...values,
  });
}

/** An invented backlog item tracked at the GitHub address given. */
function tracked(id: string, url: string, clientId = "ashgrove"): BacklogItem {
  return BacklogItem.parse({
    id,
    clientId,
    title: "Retry the failed webhook deliveries",
    state: "doing",
    priority: "normal",
    tracker: { system: "github", key: `#${url.split("/").pop()}`, url },
    classification: "internal",
    boundary: "home-server",
  });
}

const dataset = (items: BacklogItem[]): Dataset =>
  Dataset.parse({
    ...sampleDataset,
    items: [...sampleDataset.items, ...items],
  });

const facts = (values: Partial<GithubFacts>): GithubFacts => ({
  ...noFacts,
  ...values,
});

describe("reading registry.json", () => {
  test("keeps valid items and drops fields it does not know", () => {
    const read = parseRegistry(
      registryText([registryItem(), { ...pullRequest(), labels: ["x"] }]),
      now,
    );
    if (read.kind !== "read") throw new Error(read.kind);
    expect(read.registry.items).toHaveLength(2);
    expect(read.registry.skipped).toBe(0);
    expect(read.registry.accountsStale).toBe(0);
    for (const item of read.registry.items) {
      expect(item).not.toHaveProperty("account");
      expect(item).not.toHaveProperty("labels");
    }
  });

  test("skips and counts an item with a value it does not know", () => {
    const read = parseRegistry(
      registryText([
        registryItem(),
        pullRequest({ ci: "NEUTRAL" as never }),
        registryItem({ kind: "discussion" as never }),
        registryItem({ repo: "not a repository" }),
      ]),
      now,
    );
    if (read.kind !== "read") throw new Error(read.kind);
    expect(read.registry.items).toHaveLength(1);
    expect(read.registry.skipped).toBe(3);
  });

  test("refuses a version it does not know", () => {
    expect(parseRegistry(registryText([], { version: 2 }), now)).toEqual({
      kind: "refused",
      version: 2,
    });
    expect(parseRegistry(registryText([], { version: "1" }), now).kind).toBe(
      "refused",
    );
  });

  test("calls anything else invalid", () => {
    expect(parseRegistry("{", now).kind).toBe("invalid");
    expect(parseRegistry("[]", now).kind).toBe("invalid");
    expect(
      parseRegistry(registryText([], { generatedAt: "yesterday" }), now).kind,
    ).toBe("invalid");
  });

  test("counts an account that failed or polled too long ago", () => {
    const read = parseRegistry(
      registryText([], {
        accounts: [
          { ok: false, polledAt: "2026-10-24T11:59:30.000Z" },
          { ok: true, polledAt: "2026-10-24T11:50:00.000Z" },
          { ok: true, polledAt: null },
          { ok: true, polledAt: "2026-10-24T11:59:30.000Z" },
        ],
      }),
      now,
    );
    if (read.kind !== "read") throw new Error(read.kind);
    expect(read.registry.accountsStale).toBe(3);
  });

  test("is stale after three poll intervals", () => {
    const read = parseRegistry(registryText([]), now);
    if (read.kind !== "read") throw new Error(read.kind);
    expect(isStale(read.registry, now)).toBe(false);
    expect(isStale(read.registry, new Date("2026-10-24T12:02:31.000Z"))).toBe(
      true,
    );
  });
});

describe("reading an events.jsonl line", () => {
  const line = {
    v: 1,
    key: `${repository}#12:ci_failed:${sha}`,
    event: "ci_failed",
    kind: "pr",
    repo: repository,
    number: 12,
    account: "example-login",
    client: "ashgrove",
    sha,
    at: "2026-10-24T11:00:00.000Z",
  };

  test("reads a line of the contract and drops the account", () => {
    const read = parseEventLine(JSON.stringify(line));
    if (read.kind !== "read") throw new Error(read.kind);
    expect(read.line).not.toHaveProperty("account");
    expect(read.line.event).toBe("ci_failed");
  });

  test("refuses a line without v, or with a v it does not know", () => {
    const { v: _v, ...noVersion } = line;
    expect(parseEventLine(JSON.stringify(noVersion)).kind).toBe("refused");
    expect(parseEventLine(JSON.stringify({ ...line, v: 2 })).kind).toBe(
      "refused",
    );
  });

  test("skips an event it does not know, or one of the wrong kind", () => {
    expect(
      parseEventLine(JSON.stringify({ ...line, event: "reopened" })).kind,
    ).toBe("skipped");
    expect(
      parseEventLine(JSON.stringify({ ...line, event: "issue_closed" })).kind,
    ).toBe("skipped");
    expect(parseEventLine("not json").kind).toBe("skipped");
    expect(parseEventLine("[1]").kind).toBe("skipped");
  });
});

describe("GitHub addresses", () => {
  test("read an issue or a pull request, in lower case", () => {
    expect(
      parseGithubUrl("https://github.com/Example-Org/Sample-App/issues/7"),
    ).toEqual({ repository: "example-org/sample-app", number: 7 });
    expect(
      parseGithubUrl("https://github.com/example-org/sample-app/pull/12/"),
    ).toEqual({ repository: "example-org/sample-app", number: 12 });
  });

  test("give nothing for another host or another kind of page", () => {
    for (const url of [
      "https://github.example/example-org/sample-app/issues/7",
      "http://github.com/example-org/sample-app/issues/7",
      "https://github.com/example-org/sample-app/pull/12/files",
      "https://github.com/example-org/sample-app/discussions/3",
      "https://github.com/example-org/sample-app/issues/0",
      "not an address",
    ])
      expect(parseGithubUrl(url)).toBeUndefined();
  });
});

describe("matching to backlog items", () => {
  const issueItem = tracked(
    "webhook-retries-issue",
    "https://github.com/Example-Org/Sample-App/issues/7",
  );
  const pullItem = tracked(
    "webhook-retries-pull",
    "https://github.com/example-org/sample-app/pull/20",
  );
  const otherClient = tracked(
    "kestrel-issue",
    "https://github.com/example-org/sample-app/issues/30",
    "kestrel",
  );
  const data = dataset([issueItem, pullItem, otherClient]);

  test("matches an issue by repository and number, whatever the case", () => {
    const { development, counts } = resolveGithub(
      data,
      facts({ registry: [registryItem()] }),
    );
    expect(development.get(issueItem.id)).toEqual({
      issue: {
        key: "#7",
        url: "https://github.com/example-org/sample-app/issues/7",
        state: "open",
      },
    });
    expect(counts).toEqual({
      items: 1,
      matched: 1,
      unmatched: 0,
      unknownClients: 0,
    });
  });

  test("matches a pull request through the issues it closes", () => {
    const { development } = resolveGithub(
      data,
      facts({
        registry: [registryItem(), pullRequest({ closes: [7], ci: "FAILURE" })],
      }),
    );
    expect(development.get(issueItem.id)?.pullRequest).toEqual({
      number: 12,
      url: "https://github.com/example-org/sample-app/pull/12",
      state: "open",
      checks: "failing",
    });
    expect(development.get(issueItem.id)?.branch).toBeUndefined();
  });

  test("matches a pull request that is the item's own tracker address", () => {
    const { development } = resolveGithub(
      data,
      facts({
        registry: [pullRequest({ number: 20, state: "DRAFT", ci: null })],
      }),
    );
    expect(development.get(pullItem.id)).toEqual({
      pullRequest: {
        number: 20,
        url: "https://github.com/example-org/sample-app/pull/20",
        state: "draft",
        checks: "none",
      },
    });
  });

  test("never matches across clients, and counts unknown clients", () => {
    const { development, counts } = resolveGithub(
      data,
      facts({
        registry: [
          registryItem({ number: 30 }),
          registryItem({ number: 31, client: null }),
          registryItem({ number: 32, client: "not-a-client" }),
          registryItem({ number: 33 }),
        ],
      }),
    );
    expect(development.size).toBe(0);
    expect(counts).toEqual({
      items: 4,
      matched: 0,
      unmatched: 2,
      unknownClients: 2,
    });
  });

  test("shows a closed issue and a merged pull request after they leave the registry", () => {
    const { development } = resolveGithub(
      data,
      facts({
        closedIssues: new Map([
          [
            referenceKey(repository, 7),
            { repository, number: 7, client: "ashgrove" },
          ],
        ]),
        merged: new Map([
          [
            referenceKey(repository, 12),
            { repository, number: 12, client: "ashgrove" },
          ],
        ]),
        pullRequests: new Map([
          [referenceKey(repository, 12), { closes: [7], ci: "SUCCESS" }],
        ]),
      }),
    );
    expect(development.get(issueItem.id)).toEqual({
      issue: {
        key: "#7",
        url: "https://github.com/example-org/sample-app/issues/7",
        state: "closed",
      },
      pullRequest: {
        number: 12,
        url: "https://github.com/example-org/sample-app/pull/12",
        state: "merged",
        checks: "passing",
      },
    });
  });

  test("prefers an open pull request to a merged one, then the highest number", () => {
    const merged = new Map([
      [
        referenceKey(repository, 15),
        { repository, number: 15, client: "ashgrove" },
      ],
    ]);
    const pullRequests = new Map([
      [referenceKey(repository, 15), { closes: [7], ci: null }],
    ]);
    const { development } = resolveGithub(
      data,
      facts({
        registry: [
          pullRequest({ number: 12, closes: [7] }),
          pullRequest({ number: 14, closes: [7] }),
        ],
        merged,
        pullRequests,
      }),
    );
    expect(development.get(issueItem.id)?.pullRequest?.number).toBe(14);
  });

  test("lays real tracking over the dataset, replacing what an item had", () => {
    const withFake = dataset([
      { ...issueItem, development: { branch: { name: "invented/branch" } } },
    ]);
    const { development } = resolveGithub(
      withFake,
      facts({ registry: [registryItem()] }),
    );
    const laid = withGithubDevelopment(withFake, development);
    expect(
      laid.items.find((item) => item.id === issueItem.id)?.development,
    ).toEqual(development.get(issueItem.id));
    expect(withFake.items.at(-1)?.development?.branch?.name).toBe(
      "invented/branch",
    );
  });

  test("finds the items an event line is about", () => {
    const line = {
      v: 1 as const,
      key: "k",
      kind: "pr" as const,
      event: "merged" as const,
      repo: "EXAMPLE-ORG/sample-app",
      number: 12,
      client: "ashgrove",
      sha,
      at: "2026-10-24T11:00:00.000Z",
    };
    const known = facts({
      pullRequests: new Map([
        [referenceKey(repository, 12), { closes: [7], ci: null }],
      ]),
    });
    expect(itemsForEvent(data, line, known)).toEqual([issueItem.id]);
    expect(itemsForEvent(data, line, noFacts)).toEqual([]);
    expect(itemsForEvent(data, { ...line, client: null }, known)).toEqual([]);
  });
});

describe("event text", () => {
  test("is built from the event and number alone", () => {
    expect(eventText({ event: "ci_failed", number: 148 })).toBe(
      "Pull request #148: checks failed",
    );
    expect(eventText({ event: "approved", number: 148 })).toBe(
      "Pull request #148 approved",
    );
    expect(eventText({ event: "conflict", number: 148 })).toBe(
      "Pull request #148: merge conflict",
    );
    expect(eventText({ event: "merged", number: 148 })).toBe(
      "Pull request #148 merged",
    );
    expect(eventText({ event: "issue_assigned", number: 391 })).toBe(
      "Issue #391 assigned",
    );
    expect(eventText({ event: "issue_closed", number: 391 })).toBe(
      "Issue #391 closed",
    );
  });

  test("maps checks as the contract suggests", () => {
    expect(checksOf("SUCCESS")).toBe("passing");
    expect(checksOf("FAILURE")).toBe("failing");
    expect(checksOf("ERROR")).toBe("failing");
    expect(checksOf("PENDING")).toBe("pending");
    expect(checksOf("EXPECTED")).toBe("pending");
    expect(checksOf(null)).toBe("none");
  });
});
