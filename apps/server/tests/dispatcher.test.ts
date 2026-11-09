import type {
  AtlasEvent,
  GithubDispatchEvent as DispatchEvent,
  GithubSignalEvent,
} from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { beforeEach, describe, expect, test } from "bun:test";

import {
  commanderRequest,
  commanderWaker,
  createDispatcher,
  defaultDispatcherSettings,
  githubCommandLineMerger,
  openDatabase,
  taskAddInput,
  tasksApi,
  withoutTrailingSlashes,
  type AgentWaker,
  type AtlasDatabase,
  type DispatcherSettings,
  type Merger,
  type TaskApi,
  type TaskDraft,
  type WakeRequest,
} from "../src";
import type { RegistryItem } from "../src/github-contract";

const sha = "0123456789abcdef0123456789abcdef01234567";
const repository = "example-org/sample-app";
const now = () => new Date("2026-11-09T12:00:00.000Z");

const failed: GithubSignalEvent = {
  type: "signal",
  source: "github",
  key: `${repository}#12:ci_failed:${sha}`,
  kind: "pr",
  event: "ci_failed",
  repository,
  number: 12,
  client: "ashgrove",
  url: `https://github.com/${repository}/pull/12`,
  recordIds: [],
  at: "2026-11-09T11:59:00.000Z",
  text: "Pull request #12: checks failed",
};

const failingPullRequest: RegistryItem = {
  kind: "pr",
  repo: repository,
  number: 12,
  client: "ashgrove",
  state: "OPEN",
  review: null,
  ci: "FAILURE",
  mergeable: "MERGEABLE",
  sha,
  closes: [],
  since: "2026-11-09T09:00:00.000Z",
};

/** A task database in memory: tasks it added, and which are still open. */
function fakeTasks() {
  const added: TaskDraft[] = [];
  const open = new Set<string>();
  const api: TaskApi = {
    async add(draft) {
      added.push(draft);
      const id = `task-${added.length}`;
      open.add(id);
      return { id };
    },
    async isOpen(taskId) {
      return open.has(taskId);
    },
  };
  return { api, added, open };
}

function fakeWaker() {
  const woken: WakeRequest[] = [];
  const waker: AgentWaker = {
    async wake(request) {
      woken.push(request);
    },
  };
  return { waker, woken };
}

let database: AtlasDatabase;
let recorded: AtlasEvent[];
const connection = {
  record: (event: AtlasEvent) => recorded.push(event),
  dataset: () => sampleDataset,
};

function decisions(): DispatchEvent[] {
  return recorded.filter(
    (event): event is DispatchEvent => event.type === "dispatch",
  );
}

beforeEach(() => {
  database = openDatabase(":memory:");
  recorded = [];
});

describe("the dispatcher", () => {
  test("delegates a failed check: adds a task, wakes an agent, records the decision", async () => {
    const tasks = fakeTasks();
    const { waker, woken } = fakeWaker();
    const dispatcher = createDispatcher({
      database,
      settings: defaultDispatcherSettings,
      tasks: tasks.api,
      waker,
      now,
      log: () => {},
    });
    dispatcher.handle(
      failed,
      { pullRequest: failingPullRequest, reviewRequested: false },
      connection,
    );
    await dispatcher.settled();
    expect(tasks.added).toHaveLength(1);
    expect(woken).toEqual([
      {
        requestId: expect.stringMatching(/^dash-atlas-[0-9a-f]{32}$/),
        taskId: "task-1",
        clientName: "Ashgrove Consulting",
        title: `Fix the failing checks on ${repository}#12`,
        url: failed.url,
        key: `${repository}#12`,
        day: "2026-11-09",
      },
    ]);
    expect(decisions()).toEqual([
      expect.objectContaining({
        signalKey: failed.key,
        rule: "fix-failed-checks",
        mode: "on",
        outcome: "delegate",
        taskId: "task-1",
        woken: true,
      }),
    ]);
  });

  test("decides once per signal key", async () => {
    const tasks = fakeTasks();
    const dispatcher = createDispatcher({
      database,
      settings: defaultDispatcherSettings,
      tasks: tasks.api,
      now,
      log: () => {},
    });
    const context = { pullRequest: failingPullRequest, reviewRequested: false };
    dispatcher.handle(failed, context, connection);
    dispatcher.handle(failed, context, connection);
    await dispatcher.settled();
    // A restart: a new dispatcher on the same database.
    const again = createDispatcher({
      database,
      settings: defaultDispatcherSettings,
      tasks: tasks.api,
      now,
      log: () => {},
    });
    again.handle(failed, context, connection);
    await again.settled();
    expect(tasks.added).toHaveLength(1);
    expect(decisions()).toHaveLength(1);
  });

  test("does not delegate the same pull request again while its task is open", async () => {
    const tasks = fakeTasks();
    const dispatcher = createDispatcher({
      database,
      settings: defaultDispatcherSettings,
      tasks: tasks.api,
      now,
      log: () => {},
    });
    const context = { pullRequest: failingPullRequest, reviewRequested: false };
    const nextCommit = {
      ...failed,
      key: `${repository}#12:ci_failed:${"f".repeat(40)}`,
    };
    dispatcher.handle(failed, context, connection);
    dispatcher.handle(nextCommit, context, connection);
    await dispatcher.settled();
    expect(tasks.added).toHaveLength(1);
    expect(decisions().map((decision) => decision.outcome)).toEqual([
      "delegate",
      "skip",
    ]);
    expect(decisions()[1]?.taskId).toBe("task-1");

    // Once the task is finished, a new failure is delegated again.
    tasks.open.clear();
    dispatcher.handle(
      { ...failed, key: `${repository}#12:ci_failed:${"e".repeat(40)}` },
      context,
      connection,
    );
    await dispatcher.settled();
    expect(tasks.added).toHaveLength(2);
  });

  test("in dry mode, merges nothing and records that it would", async () => {
    const merged: unknown[] = [];
    const merger: Merger = {
      async merge(request) {
        merged.push(request);
      },
    };
    const dispatcher = createDispatcher({
      database,
      settings: defaultDispatcherSettings,
      merger,
      now,
      log: () => {},
    });
    dispatcher.handle(
      { ...failed, key: `${repository}#12:approved:${sha}`, event: "approved" },
      {
        pullRequest: {
          ...failingPullRequest,
          review: "APPROVED",
          ci: "SUCCESS",
        },
        reviewRequested: false,
      },
      connection,
    );
    await dispatcher.settled();
    expect(merged).toEqual([]);
    expect(decisions()).toEqual([
      expect.objectContaining({
        rule: "merge-approved",
        mode: "dry",
        outcome: "merge",
        mergeMethod: "squash",
        text: "Would merge pull request #12 by squash",
      }),
    ]);
  });

  test("in on mode, merges at the head commit by the repository's method", async () => {
    const merged: unknown[] = [];
    const settings: DispatcherSettings = {
      ...defaultDispatcherSettings,
      rules: { ...defaultDispatcherSettings.rules, "merge-approved": "on" },
      mergeMethods: { [repository]: "rebase" },
    };
    const dispatcher = createDispatcher({
      database,
      settings,
      merger: {
        async merge(request) {
          merged.push(request);
        },
      },
      now,
      log: () => {},
    });
    dispatcher.handle(
      {
        ...failed,
        key: `${repository}#12:checks_passed:${sha}`,
        event: "checks_passed",
      },
      {
        pullRequest: {
          ...failingPullRequest,
          review: "APPROVED",
          ci: "SUCCESS",
        },
        reviewRequested: false,
      },
      connection,
    );
    await dispatcher.settled();
    expect(merged).toEqual([{ repository, number: 12, sha, method: "rebase" }]);
    expect(decisions()[0]).toMatchObject({ mode: "on", outcome: "merge" });
  });

  test("records a failed act as a failure, with the reason", async () => {
    const dispatcher = createDispatcher({
      database,
      settings: defaultDispatcherSettings,
      tasks: {
        add: async () => {
          throw new Error("task_add: Unknown client");
        },
        isOpen: async () => false,
      },
      now,
      log: () => {},
    });
    dispatcher.handle(
      failed,
      { pullRequest: failingPullRequest, reviewRequested: false },
      connection,
    );
    await dispatcher.settled();
    expect(decisions()[0]).toMatchObject({
      outcome: "fail",
      text: "Could not add the task: task_add: Unknown client",
    });
  });

  test("records a delegation as dry when no task database API is set", async () => {
    const dispatcher = createDispatcher({
      database,
      settings: defaultDispatcherSettings,
      now,
      log: () => {},
    });
    dispatcher.handle(
      failed,
      { pullRequest: failingPullRequest, reviewRequested: false },
      connection,
    );
    await dispatcher.settled();
    expect(decisions()[0]).toMatchObject({ mode: "dry", outcome: "delegate" });
    expect(decisions()[0]?.text).toContain("no task database API");
  });

  test("keeps a task when waking an agent fails", async () => {
    const tasks = fakeTasks();
    const dispatcher = createDispatcher({
      database,
      settings: defaultDispatcherSettings,
      tasks: tasks.api,
      waker: {
        wake: async () => {
          throw new Error("Commander answered HTTP 503");
        },
      },
      now,
      log: () => {},
    });
    dispatcher.handle(
      failed,
      { pullRequest: failingPullRequest, reviewRequested: false },
      connection,
    );
    await dispatcher.settled();
    expect(decisions()[0]).toMatchObject({
      outcome: "delegate",
      taskId: "task-1",
      woken: false,
    });
  });

  test("lists low alerts on the digest", async () => {
    const dispatcher = createDispatcher({
      database,
      settings: defaultDispatcherSettings,
      now,
      log: () => {},
    });
    dispatcher.handle(
      {
        ...failed,
        key: `${repository}#3:opened:-`,
        kind: "alert",
        event: "opened",
        number: 3,
        url: `https://github.com/${repository}/security/dependabot/3`,
        alertType: "dependabot",
        severity: "low",
      },
      { reviewRequested: false },
      connection,
    );
    await dispatcher.settled();
    expect(decisions()[0]?.outcome).toBe("digest");
    expect(dispatcher.digest()).toEqual([
      {
        repository,
        number: 3,
        url: `https://github.com/${repository}/security/dependabot/3`,
        alertType: "dependabot",
        severity: "low",
        decidedAt: "2026-11-09T12:00:00.000Z",
      },
    ]);
  });
});

describe("the connections", () => {
  const token = async () => "test-token";

  test("adds a task through the tasks API, and reads whether one is open", async () => {
    const calls: Array<{
      url: string;
      body: unknown;
      authorization: string | null;
    }> = [];
    const api = tasksApi({
      url: "http://tasks.test/mcp",
      token,
      fetch: async (url, init) => {
        const body = JSON.parse(String(init.body)) as {
          params: { name: string };
        };
        calls.push({
          url,
          body,
          authorization: new Headers(init.headers).get("authorization"),
        });
        const answer =
          body.params.name === "task_add"
            ? { id: "new-task" }
            : { id: "new-task", state: "done" };
        // The server may answer as one server-sent event.
        return new Response(
          `event: message\ndata: ${JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              content: [{ type: "text", text: JSON.stringify(answer) }],
            },
          })}\n\n`,
        );
      },
    });
    const draft: TaskDraft = {
      clientId: "ashgrove",
      title: "Fix it",
      summary: "Fix it now",
      tags: ["from-signal", "github"],
      priority: "high",
      needsYou: true,
    };
    expect(await api.add(draft, "atlas-dispatcher", "2026-11-09")).toEqual({
      id: "new-task",
    });
    expect(await api.isOpen("new-task")).toBe(false);
    expect(calls[0]).toEqual({
      url: "http://tasks.test/mcp",
      authorization: "Bearer test-token",
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "task_add",
          arguments: taskAddInput(draft, "atlas-dispatcher", "2026-11-09"),
        },
      },
    });
  });

  test("marks a task that needs you as waiting on you", () => {
    const input = taskAddInput(
      {
        clientId: "ashgrove",
        title: "Fix it",
        summary: "Fix it now",
        tags: ["from-signal"],
        priority: "high",
        needsYou: true,
      },
      "atlas-dispatcher",
      "2026-11-09",
    );
    expect(input).toMatchObject({
      blocked: true,
      blockedOn: { since: "2026-11-09", waitingFor: "You" },
    });
  });

  test("reports a refusal by its message, and an HTTP failure by its status alone", async () => {
    const refused = tasksApi({
      url: "http://tasks.test/mcp",
      token,
      fetch: async () =>
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: "Unknown client. Find the client id with client_list.",
              },
            ],
          },
        }),
    });
    await expect(refused.isOpen("x")).rejects.toThrow(
      "task_get: Unknown client",
    );
    const down = tasksApi({
      url: "http://tasks.test/mcp",
      token,
      fetch: async () => new Response("no", { status: 401 }),
    });
    await expect(down.isOpen("x")).rejects.toThrow(
      "the tasks API answered HTTP 401",
    );
  });

  test("wakes an agent through Commander's request path", async () => {
    let sent:
      { url: string; body: unknown; authorization: string | null } | undefined;
    const waker = commanderWaker({
      url: "http://commander.test/",
      token,
      now,
      fetch: async (url, init) => {
        sent = {
          url,
          body: JSON.parse(String(init.body)),
          authorization: new Headers(init.headers).get("authorization"),
        };
        return new Response(null, { status: 202 });
      },
    });
    const request: WakeRequest = {
      requestId: "dash-atlas-0123456789abcdef",
      taskId: "task-1",
      clientName: "Ashgrove Consulting",
      title: "Fix it",
      url: failed.url,
      key: `${repository}#12`,
      day: "2026-11-09",
    };
    await waker.wake(request);
    expect(sent).toEqual({
      url: "http://commander.test/requests",
      authorization: "Bearer test-token",
      body: commanderRequest(request, "2026-11-09T12:00:00Z"),
    });
    expect(commanderRequest(request, "2026-11-09T12:00:00Z")).toEqual({
      id: "dash-atlas-0123456789abcdef",
      action: "execute",
      client: "Ashgrove Consulting",
      title: "Fix it",
      key: `${repository}#12`,
      link: failed.url,
      band: "today",
      day: "2026-11-09",
      ref: "db:task-1",
      requestedAt: "2026-11-09T12:00:00Z",
    });
  });

  test("trims the slashes an address ends with, and only those", () => {
    expect(withoutTrailingSlashes("http://commander.test///")).toBe(
      "http://commander.test",
    );
    expect(withoutTrailingSlashes("http://commander.test/a")).toBe(
      "http://commander.test/a",
    );
    expect(withoutTrailingSlashes("/".repeat(100_000))).toBe("");
  });

  test("merges with the GitHub command line at the head commit", async () => {
    const ran: string[][] = [];
    const merger = githubCommandLineMerger("gh", async (argumentsList) => {
      ran.push(argumentsList);
      return { exitCode: 0 };
    });
    await merger.merge({ repository, number: 12, sha, method: "squash" });
    expect(ran).toEqual([
      [
        "gh",
        "pr",
        "merge",
        "12",
        "--repo",
        repository,
        "--squash",
        "--match-head-commit",
        sha,
      ],
    ]);
    const failing = githubCommandLineMerger("gh", async () => ({
      exitCode: 1,
    }));
    await expect(
      failing.merge({ repository, number: 12, sha, method: "merge" }),
    ).rejects.toThrow("exited with 1");
  });
});
