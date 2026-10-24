import { BacklogItem, Dataset, DevelopmentTracking } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { beforeEach, describe, expect, test } from "bun:test";

import {
  createApi,
  inventDevelopment,
  openDatabase,
  readConfiguration,
  readDataset,
  seedDataset,
  shortSlug,
  withFakeDevelopment,
  type AtlasDatabase,
} from "../src";

const governed = {
  classification: "internal",
  boundary: "home-server",
} as const;

/** An invented item tracked on GitHub, in the state given. */
function tracked(
  id: string,
  state: BacklogItem["state"],
  key = "#41",
): BacklogItem {
  return BacklogItem.parse({
    id,
    clientId: "ashgrove",
    title: "Send the October invoices, with expenses",
    state,
    priority: "normal",
    tracker: {
      system: "github",
      key,
      url: `https://github.example/ashgrove/books/issues/${key.replace("#", "")}`,
    },
    ...governed,
  });
}

/** Every state, several ids each, so the deterministic choices all show. */
const many = (["todo", "doing", "review", "done"] as const).flatMap((state) =>
  Array.from({ length: 12 }, (_, index) =>
    tracked(`${state}-${index}`, state, `#${40 + index}`),
  ),
);

describe("invented development tracking", () => {
  test("is valid development tracking for every state", () => {
    for (const item of many)
      expect(() =>
        DevelopmentTracking.parse(inventDevelopment(item)),
      ).not.toThrow();
  });

  test("is the same on every read", () => {
    for (const item of many)
      expect(inventDevelopment(item)).toEqual(inventDevelopment(item));
  });

  test("uses the tracker's issue, closed once the item is done", () => {
    const open = inventDevelopment(tracked("a", "doing"));
    expect(open.issue).toEqual({
      key: "#41",
      url: "https://github.example/ashgrove/books/issues/41",
      state: "open",
    });
    expect(inventDevelopment(tracked("a", "done")).issue?.state).toBe("closed");
  });

  test("gives work not started its issue alone", () => {
    const development = inventDevelopment(tracked("a", "todo"));
    expect(development.branch).toBeUndefined();
    expect(development.pullRequest).toBeUndefined();
  });

  test("names the branch after the tracker number and the title", () => {
    expect(inventDevelopment(tracked("a", "review")).branch?.name).toBe(
      "feature/41-send-the-october-invoices",
    );
    expect(shortSlug("Fix: the flaky sign-in test!")).toBe(
      "fix-the-flaky-sign",
    );
    expect(shortSlug("???")).toBe("work");
  });

  test("puts work in progress on a worktree, and done work not", () => {
    for (const item of many) {
      const worktree = inventDevelopment(item).branch?.worktree;
      if (item.state === "doing" || item.state === "review")
        expect(worktree?.path).toMatch(/^~\/worktrees\/books-\d+$/);
      else expect(worktree).toBeUndefined();
    }
  });

  test("gives done work a merged pull request with passing checks", () => {
    for (const item of many.filter((each) => each.state === "done"))
      expect(inventDevelopment(item).pullRequest).toMatchObject({
        state: "merged",
        checks: "passing",
      });
  });

  test("gives work in review an open pull request", () => {
    for (const item of many.filter((each) => each.state === "review"))
      expect(inventDevelopment(item).pullRequest?.state).toBe("open");
  });

  test("varies the pull request of work in progress", () => {
    const doing = many
      .filter((item) => item.state === "doing")
      .map((item) => inventDevelopment(item).pullRequest);
    expect(doing).toContain(undefined);
    const present = doing.filter((pull) => pull !== undefined);
    expect(new Set(present.map((pull) => pull.state)).size).toBe(2);
    expect(new Set(present.map((pull) => pull.checks)).size).toBe(3);
    for (const pull of present)
      expect(pull.url).toBe(
        `https://github.example/ashgrove/books/pull/${pull.number}`,
      );
  });

  test("finds the number in the address when the key has none", () => {
    const item = { ...tracked("a", "review"), tracker: undefined };
    expect(inventDevelopment(item)).toEqual({});
    const named = tracked("a", "review", "books-issue");
    const withUrl = {
      ...named,
      tracker: {
        ...named.tracker!,
        url: "https://github.example/a/b/issues/7",
      },
    };
    expect(inventDevelopment(withUrl).branch?.name).toMatch(/^feature\/7-/);
  });

  test("reads an address with a trailing slash, or with no repository", () => {
    const named = tracked("a", "review", "books-issue");
    const slashed = {
      ...named,
      tracker: {
        ...named.tracker!,
        url: "https://github.example/a/b/issues/9/",
      },
    };
    expect(inventDevelopment(slashed).branch?.name).toMatch(/^feature\/9-/);
    const bare = {
      ...named,
      tracker: { ...named.tracker!, url: "https://github.example/" },
    };
    const development = inventDevelopment(bare);
    expect(development.branch?.name).toMatch(/^feature\/\d+-/);
    expect(development.branch?.worktree?.path).toMatch(
      /^~\/worktrees\/repository-\d+$/,
    );
    expect(development.pullRequest?.url).toMatch(
      /^https:\/\/github\.example\/pull\/\d+$/,
    );
  });
});

describe("laying it over a dataset", () => {
  const dataset = Dataset.parse({
    ...sampleDataset,
    items: [
      ...sampleDataset.items,
      tracked("github-tracked", "doing"),
      {
        ...tracked("already-tracked", "doing"),
        development: { branch: { name: "real/branch" } },
      },
      {
        ...tracked("on-jira", "doing"),
        tracker: {
          system: "jira",
          key: "HAL-1",
          url: "https://hal.tracker.example/browse/HAL-1",
        },
      },
    ],
  });

  test("fills only items tracked on GitHub that have none", () => {
    const laid = withFakeDevelopment(dataset);
    const byId = (id: string) => laid.items.find((item) => item.id === id);
    expect(byId("github-tracked")?.development?.issue?.key).toBe("#41");
    expect(byId("already-tracked")?.development).toEqual({
      branch: { name: "real/branch" },
    });
    expect(byId("on-jira")?.development).toBeUndefined();
    expect(
      laid.items.filter((item) => item.development).map((item) => item.id),
    ).toEqual(["github-tracked", "already-tracked"]);
  });

  test("leaves the dataset passed in unchanged", () => {
    const before = structuredClone(dataset);
    withFakeDevelopment(dataset);
    expect(dataset).toEqual(before);
  });
});

describe("the fake development setting", () => {
  let database: AtlasDatabase;
  const githubItem = tracked("github-tracked", "doing");

  beforeEach(() => {
    database = openDatabase(":memory:");
    seedDataset(database, {
      ...sampleDataset,
      items: [...sampleDataset.items, githubItem],
    });
  });

  const read = async (fakeDevelopment: boolean, path: string) => {
    const api = createApi({
      database,
      version: "0.0.0-test",
      fakeDevelopment,
      lookupNode: async () => undefined,
    });
    const response = await api.handle(
      new Request(`http://atlas.test${path}`),
      "127.0.0.1",
    );
    if (!response) throw new Error(`no response for ${path}`);
    return response.json();
  };

  test("is off unless the environment turns it on", () => {
    expect(readConfiguration({}).fakeDevelopment).toBe(false);
    expect(
      readConfiguration({ ATLAS_FAKE_DEVELOPMENT: "1" }).fakeDevelopment,
    ).toBe(false);
    expect(
      readConfiguration({ ATLAS_FAKE_DEVELOPMENT: "true" }).fakeDevelopment,
    ).toBe(true);
  });

  test("when off, serves the dataset as stored and says nothing in health", async () => {
    const dataset = Dataset.parse(await read(false, "/api/dataset"));
    expect(
      dataset.items.find((item) => item.id === githubItem.id)?.development,
    ).toBeUndefined();
    expect(await read(false, "/api/health")).not.toHaveProperty("development");
  });

  test("when on, serves invented tracking and says so in health", async () => {
    const dataset = Dataset.parse(await read(true, "/api/dataset"));
    expect(
      dataset.items.find((item) => item.id === githubItem.id)?.development,
    ).toEqual(inventDevelopment(githubItem));
    expect(await read(true, "/api/health")).toMatchObject({
      development: "fake",
    });
  });

  test("never writes the invented tracking to the store", async () => {
    await read(true, "/api/dataset");
    expect(
      readDataset(database).items.find((item) => item.id === githubItem.id)
        ?.development,
    ).toBeUndefined();
  });
});
