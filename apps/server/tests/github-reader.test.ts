import { BacklogItem, Dataset, type AtlasEvent } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createApi,
  createGithubReader,
  inventDevelopment,
  listEvents,
  openDatabase,
  readConfiguration,
  readDataset,
  seedDataset,
  type Api,
  type AtlasDatabase,
  type GithubReader,
} from "../src";

const sha = "0123456789abcdef0123456789abcdef01234567";
const otherSha = "89abcdef0123456789abcdef0123456789abcdef";
const repository = "example-org/sample-app";

/** An invented backlog item tracked at a GitHub address in the placeholder repository. */
function tracked(id: string, path: string): BacklogItem {
  return BacklogItem.parse({
    id,
    clientId: "ashgrove",
    title: "Retry the failed webhook deliveries",
    state: "doing",
    priority: "normal",
    tracker: {
      system: "github",
      key: `#${path.split("/").pop()}`,
      url: `https://github.com/${repository}/${path}`,
    },
    classification: "internal",
    boundary: "home-server",
  });
}

const issueItem = tracked("retry-webhooks", "issues/7");
const pullItem = tracked("rotate-keys", "pull/20");
const fakeOnly = tracked("tidy-readme", "issues/40");

function registryText(items: object[], version = 1): string {
  return JSON.stringify({
    version,
    generatedAt: new Date().toISOString(),
    intervalSeconds: 60,
    accounts: [
      {
        login: "example-login",
        ok: true,
        polledAt: new Date().toISOString(),
        error: null,
      },
    ],
    items,
  });
}

const openIssue = {
  kind: "issue",
  repo: repository,
  number: 7,
  url: `https://github.com/${repository}/issues/7`,
  account: "example-login",
  client: "ashgrove",
  state: "OPEN",
  review: null,
  ci: null,
  mergeable: null,
  sha: null,
  closes: [],
  since: "2026-10-24T08:00:00.000Z",
};
const openPullRequest = {
  ...openIssue,
  kind: "pr",
  number: 12,
  url: `https://github.com/${repository}/pull/12`,
  state: "OPEN",
  review: "REVIEW_REQUIRED",
  ci: "FAILURE",
  mergeable: "MERGEABLE",
  sha,
  closes: [7],
};

/** One events.jsonl line, as gh-events writes it. */
function line(
  event: string,
  number: number,
  values: Record<string, unknown> = {},
): string {
  const kind = event.startsWith("issue_") ? "issue" : "pr";
  const discriminator =
    kind === "pr" ? sha : event === "issue_closed" ? "2026-10-24T10:00Z" : "-";
  return `${JSON.stringify({
    v: 1,
    key: `${repository}#${number}:${event}:${discriminator}`,
    event,
    kind,
    repo: repository,
    number,
    account: "example-login",
    client: "ashgrove",
    sha: kind === "pr" ? sha : null,
    at: "2026-10-24T10:00:00.000Z",
    ...values,
  })}\n`;
}

let directory: string;
let database: AtlasDatabase;
let readers: GithubReader[];
let apis: Api[];

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "atlas-github-"));
  database = openDatabase(":memory:");
  seedDataset(
    database,
    Dataset.parse({
      ...sampleDataset,
      items: [...sampleDataset.items, issueItem, pullItem, fakeOnly],
    }),
  );
  readers = [];
  apis = [];
});

afterEach(() => {
  for (const reader of readers) reader.stop();
  for (const api of apis) api.close();
  rmSync(directory, { recursive: true, force: true });
});

const registryPath = () => join(directory, "registry.json");
const eventsPath = () => join(directory, "events.jsonl");

/** A reader and the API it is wired into, as `main.ts` does; a second call is a restart. */
function start(fakeDevelopment = false) {
  const reader = createGithubReader({ directory, database, log: () => {} });
  const api = createApi({
    database,
    version: "0.0.0-test",
    fakeDevelopment,
    github: reader,
    lookupNode: async () => undefined,
  });
  readers.push(reader);
  apis.push(api);
  return { reader, api };
}

async function read(api: Api, path: string) {
  const response = await api.handle(
    new Request(`http://atlas.test${path}`),
    "127.0.0.1",
  );
  if (!response) throw new Error(`no response for ${path}`);
  return response.json();
}

/** The GitHub events in the Atlas log, as their record and text. */
function githubEvents() {
  return listEvents(database)
    .map((stored) => stored.event)
    .filter(
      (event): event is Extract<AtlasEvent, { type: "external" }> =>
        event.type === "external" && event.source === "github",
    )
    .map((event) => `${event.recordId}: ${event.text}`);
}

describe("the configuration", () => {
  test("is off unless the folder is set", () => {
    expect(readConfiguration({}).githubStateDirectory).toBeUndefined();
    expect(
      readConfiguration({ ATLAS_GITHUB_STATE_DIR: "/state/gh-events" })
        .githubStateDirectory,
    ).toBe("/state/gh-events");
  });

  test("when off, health says so and the dataset is as stored", async () => {
    const api = createApi({
      database,
      version: "0.0.0-test",
      lookupNode: async () => undefined,
    });
    apis.push(api);
    expect((await read(api, "/api/health")).github).toMatchObject({
      source: "none",
      items: 0,
    });
    expect(Dataset.parse(await read(api, "/api/dataset"))).toEqual(
      readDataset(database),
    );
  });
});

describe("development tracking from the registry", () => {
  test("serves real tracking on matched items, and fake on the rest", async () => {
    writeFileSync(registryPath(), registryText([openIssue, openPullRequest]));
    const { reader, api } = start(true);
    reader.poll();
    const dataset = Dataset.parse(await read(api, "/api/dataset"));
    const byId = (id: string) =>
      dataset.items.find((item) => item.id === id)?.development;
    expect(byId(issueItem.id)).toEqual({
      issue: {
        key: "#7",
        url: `https://github.com/${repository}/issues/7`,
        state: "open",
      },
      pullRequest: {
        number: 12,
        url: `https://github.com/${repository}/pull/12`,
        state: "open",
        checks: "failing",
      },
    });
    expect(byId(fakeOnly.id)).toEqual(inventDevelopment(fakeOnly));
    expect(byId(pullItem.id)).toEqual(inventDevelopment(pullItem));
  });

  test("never writes the tracking to the store", () => {
    writeFileSync(registryPath(), registryText([openIssue]));
    const { reader } = start();
    reader.poll();
    expect(
      readDataset(database).items.find((item) => item.id === issueItem.id)
        ?.development,
    ).toBeUndefined();
  });

  test("refuses a registry version it does not know, and says so", async () => {
    writeFileSync(registryPath(), registryText([openIssue], 2));
    const { reader, api } = start();
    reader.poll();
    const health = (await read(api, "/api/health")).github;
    expect(health).toMatchObject({ source: "gh-events", ok: false, items: 0 });
    expect(health.error).toContain("version 2");
    const dataset = Dataset.parse(await read(api, "/api/dataset"));
    expect(
      dataset.items.find((item) => item.id === issueItem.id)?.development,
    ).toBeUndefined();
  });

  test("reports counts only in health", async () => {
    writeFileSync(
      registryPath(),
      registryText([
        openIssue,
        openPullRequest,
        { ...openIssue, number: 50 },
        { ...openIssue, number: 51, client: null },
        { ...openIssue, number: 52, client: "not-a-client" },
        { ...openIssue, number: 53, state: "PINNED" },
      ]),
    );
    appendFileSync(eventsPath(), line("ci_failed", 12));
    appendFileSync(eventsPath(), line("approved", 99));
    appendFileSync(eventsPath(), line("reopened", 12));
    appendFileSync(eventsPath(), line("approved", 12, { v: 2 }));
    const { reader, api } = start();
    reader.poll();
    const health = (await read(api, "/api/health")).github;
    expect(health).toEqual({
      source: "gh-events",
      ok: true,
      stale: false,
      error: null,
      items: 5,
      matched: 2,
      unmatched: 1,
      unknownClients: 2,
      skipped: 1,
      eventsApplied: 1,
      eventsUnmatched: 1,
      eventsSkipped: 1,
      eventsRefused: 1,
      lastEventAt: "2026-10-24T10:00:00.000Z",
    });
    expect(JSON.stringify(health)).not.toContain(repository);
  });

  test("reports a missing registry as not ok", async () => {
    const { reader, api } = start();
    reader.poll();
    expect((await read(api, "/api/health")).github).toMatchObject({
      ok: false,
      error: "registry.json is missing",
    });
  });
});

describe("tailing events.jsonl", () => {
  test("records each matched line once, as a GitHub event", () => {
    writeFileSync(registryPath(), registryText([openIssue, openPullRequest]));
    appendFileSync(eventsPath(), line("ci_failed", 12));
    const { reader } = start();
    reader.poll();
    expect(githubEvents()).toEqual([
      "retry-webhooks: Pull request #12: checks failed",
    ]);
    appendFileSync(
      eventsPath(),
      line("approved", 12) + line("issue_assigned", 7),
    );
    reader.poll();
    reader.poll();
    expect(githubEvents()).toEqual([
      "retry-webhooks: Pull request #12: checks failed",
      "retry-webhooks: Pull request #12 approved",
      "retry-webhooks: Issue #7 assigned",
    ]);
  });

  test("treats a missing file as no events", () => {
    const { reader } = start();
    expect(() => reader.poll()).not.toThrow();
    expect(githubEvents()).toEqual([]);
  });

  test("leaves a partial last line for the next read", () => {
    writeFileSync(registryPath(), registryText([openIssue]));
    const whole = line("issue_assigned", 7);
    appendFileSync(eventsPath(), whole.slice(0, 40));
    const { reader } = start();
    reader.poll();
    expect(githubEvents()).toEqual([]);
    appendFileSync(eventsPath(), whole.slice(40));
    reader.poll();
    expect(githubEvents()).toEqual(["retry-webhooks: Issue #7 assigned"]);
  });

  test("finishes a rotated file, then reads the new one from the start", () => {
    writeFileSync(registryPath(), registryText([openIssue, openPullRequest]));
    appendFileSync(eventsPath(), line("ci_failed", 12));
    const { reader } = start();
    reader.poll();
    // gh-events appends once more, renames the log and starts a new file,
    // which repeats a line already read.
    appendFileSync(eventsPath(), line("approved", 12));
    renameSync(eventsPath(), join(directory, "events.1.jsonl"));
    writeFileSync(
      eventsPath(),
      line("approved", 12) + line("issue_assigned", 7),
    );
    reader.poll();
    expect(githubEvents()).toEqual([
      "retry-webhooks: Pull request #12: checks failed",
      "retry-webhooks: Pull request #12 approved",
      "retry-webhooks: Issue #7 assigned",
    ]);
  });

  test("neither replays nor skips across a restart", () => {
    writeFileSync(registryPath(), registryText([openIssue, openPullRequest]));
    appendFileSync(eventsPath(), line("ci_failed", 12));
    const first = start();
    first.reader.poll();
    first.reader.stop();
    first.api.close();
    appendFileSync(
      eventsPath(),
      line("ci_failed", 12, { sha: otherSha, key: `x:${otherSha}` }),
    );
    const second = start();
    second.reader.poll();
    expect(githubEvents()).toEqual([
      "retry-webhooks: Pull request #12: checks failed",
      "retry-webhooks: Pull request #12: checks failed",
    ]);
    // A new file at the path that repeats every key adds nothing.
    rmSync(eventsPath());
    writeFileSync(
      eventsPath(),
      line("ci_failed", 12) +
        line("ci_failed", 12, { sha: otherSha, key: `x:${otherSha}` }),
    );
    const third = start();
    third.reader.poll();
    expect(githubEvents()).toHaveLength(2);
  });

  test("shows a merge and a close after the items leave the registry", async () => {
    writeFileSync(registryPath(), registryText([openIssue, openPullRequest]));
    const { reader } = start();
    reader.poll();
    reader.stop();
    // The next poll of gh-events: both items left the registry.
    writeFileSync(registryPath(), registryText([]));
    appendFileSync(eventsPath(), line("merged", 12) + line("issue_closed", 7));
    const restarted = start();
    restarted.reader.poll();
    expect(githubEvents()).toEqual([
      "retry-webhooks: Pull request #12 merged",
      "retry-webhooks: Issue #7 closed",
    ]);
    const dataset = Dataset.parse(await read(restarted.api, "/api/dataset"));
    expect(
      dataset.items.find((item) => item.id === issueItem.id)?.development,
    ).toEqual({
      issue: {
        key: "#7",
        url: `https://github.com/${repository}/issues/7`,
        state: "closed",
      },
      pullRequest: {
        number: 12,
        url: `https://github.com/${repository}/pull/12`,
        state: "merged",
        checks: "failing",
      },
    });
  });

  test("shows a pull request closed without merging", async () => {
    writeFileSync(registryPath(), registryText([openIssue, openPullRequest]));
    const { reader } = start();
    reader.poll();
    reader.stop();
    writeFileSync(registryPath(), registryText([openIssue]));
    appendFileSync(eventsPath(), line("closed", 12));
    const restarted = start();
    restarted.reader.poll();
    expect(githubEvents()).toEqual([
      "retry-webhooks: Pull request #12 closed without merging",
    ]);
    const dataset = Dataset.parse(await read(restarted.api, "/api/dataset"));
    expect(
      dataset.items.find((item) => item.id === issueItem.id)?.development
        ?.pullRequest,
    ).toMatchObject({ number: 12, state: "closed" });
  });

  test("after a restart, finishes a file rotated meanwhile, found by its inode", () => {
    writeFileSync(registryPath(), registryText([openIssue, openPullRequest]));
    appendFileSync(eventsPath(), line("ci_failed", 12));
    const first = start();
    first.reader.poll();
    first.reader.stop();
    first.api.close();
    // While Atlas is down, gh-events appends, rotates to its dated name and
    // starts a new file.
    appendFileSync(
      eventsPath(),
      line("ci_failed", 12, { sha: otherSha, key: `x:${otherSha}` }),
    );
    renameSync(eventsPath(), join(directory, "events.20261024T133000Z.jsonl"));
    writeFileSync(eventsPath(), line("issue_assigned", 7));
    const second = start();
    second.reader.poll();
    expect(githubEvents()).toEqual([
      "retry-webhooks: Pull request #12: checks failed",
      "retry-webhooks: Pull request #12: checks failed",
      "retry-webhooks: Issue #7 assigned",
    ]);
  });

  test("tells open pages to reload when what it knows changes", async () => {
    writeFileSync(registryPath(), registryText([]));
    const { reader, api } = start();
    reader.poll();
    const response = await api.handle(
      new Request("http://atlas.test/api/stream"),
      "127.0.0.1",
    );
    const stream = response?.body?.getReader();
    if (!stream) throw new Error("no stream");
    await stream.read();
    writeFileSync(registryPath(), registryText([openIssue]));
    reader.poll();
    const { value } = await stream.read();
    expect(new TextDecoder().decode(value)).toContain("event: refresh");
    await stream.cancel();
  });

  test("keeps only the newest keys", () => {
    const reader = createGithubReader({
      directory,
      database,
      keptKeys: 2,
      log: () => {},
    });
    readers.push(reader);
    reader.connect({ dataset: () => readDataset(database), record: () => {} });
    appendFileSync(
      eventsPath(),
      [1, 2, 3, 4].map((number) => line("approved", number)).join(""),
    );
    reader.poll();
    expect(
      database.$client
        .query("select count(*) as count from github_events")
        .get(),
    ).toEqual({ count: 2 });
  });
});
