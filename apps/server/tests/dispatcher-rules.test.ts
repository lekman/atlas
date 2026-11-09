import type { GithubSignalEvent } from "@atlas/core";
import { describe, expect, test } from "bun:test";

import {
  decide,
  defaultDispatcherSettings,
  effectiveSeverity,
  mergeMethodFor,
  parseDispatcherFile,
  readConfiguration,
  subjectOf,
  type DispatcherSettings,
  type SignalContext,
} from "../src";
import type { RegistryItem } from "../src/github-contract";

const sha = "0123456789abcdef0123456789abcdef01234567";
const repository = "example-org/sample-app";
const now = new Date("2026-11-09T12:00:00.000Z");

function signal(values: Partial<GithubSignalEvent> = {}): GithubSignalEvent {
  return {
    type: "signal",
    source: "github",
    key: `${repository}#12:approved:${sha}`,
    kind: "pr",
    event: "approved",
    repository,
    number: 12,
    client: "ashgrove",
    url: `https://github.com/${repository}/pull/12`,
    recordIds: [],
    at: "2026-11-09T11:59:00.000Z",
    text: "Pull request #12 approved",
    ...values,
  };
}

function alert(values: Partial<GithubSignalEvent> = {}): GithubSignalEvent {
  return signal({
    key: `${repository}#3:opened:-`,
    kind: "alert",
    event: "opened",
    number: 3,
    url: `https://github.com/${repository}/security/dependabot/3`,
    alertType: "dependabot",
    severity: "high",
    text: "Dependabot alert #3 (high) opened",
    ...values,
  });
}

const greenPullRequest: RegistryItem = {
  kind: "pr",
  repo: repository,
  number: 12,
  client: "ashgrove",
  state: "OPEN",
  review: "APPROVED",
  ci: "SUCCESS",
  mergeable: "MERGEABLE",
  sha,
  closes: [],
  since: "2026-11-09T09:00:00.000Z",
};

function context(values: Partial<SignalContext> = {}): SignalContext {
  return {
    pullRequest: greenPullRequest,
    reviewRequested: false,
    now,
    ...values,
  };
}

describe("the merge rule", () => {
  test("in dry mode, records that it would merge an approved, green pull request", () => {
    const plan = decide(signal(), context(), defaultDispatcherSettings);
    expect(plan).toMatchObject({
      rule: "merge-approved",
      mode: "dry",
      outcome: "merge",
      method: "squash",
      sha,
      text: "Would merge pull request #12 by squash",
    });
  });

  test("runs on checks turning green as well as on an approval", () => {
    const plan = decide(
      signal({ event: "checks_passed" }),
      context(),
      defaultDispatcherSettings,
    );
    expect(plan?.outcome).toBe("merge");
  });

  test("skips, with the reason, when the pull request is not ready", () => {
    const cases: Array<[Partial<RegistryItem> | undefined, string]> = [
      [{ ci: "PENDING" }, "checks are not green"],
      [{ review: "REVIEW_REQUIRED" }, "is not approved"],
      [{ state: "DRAFT" }, "is a draft"],
      [{ mergeable: "CONFLICTING" }, "has a merge conflict"],
      [undefined, "is no longer open"],
    ];
    for (const [change, reason] of cases) {
      const plan = decide(
        signal(),
        context({
          ...(change
            ? { pullRequest: { ...greenPullRequest, ...change } }
            : {}),
          ...(change ? {} : { pullRequest: undefined }),
        }),
        defaultDispatcherSettings,
      );
      expect(plan?.outcome).toBe("skip");
      expect(plan?.text).toContain(reason);
    }
  });

  test("uses the repository's merge method, then its owner's, then the default", () => {
    const settings: DispatcherSettings = {
      ...defaultDispatcherSettings,
      mergeMethods: { "example-org": "rebase", "example-org/ledger": "merge" },
    };
    expect(mergeMethodFor("Example-Org/Ledger", settings)).toBe("merge");
    expect(mergeMethodFor(repository, settings)).toBe("rebase");
    expect(mergeMethodFor("other-org/app", settings)).toBe("squash");
  });

  test("decides nothing when the rule is off", () => {
    const settings: DispatcherSettings = {
      ...defaultDispatcherSettings,
      rules: { ...defaultDispatcherSettings.rules, "merge-approved": "off" },
    };
    expect(decide(signal(), context(), settings)).toBeUndefined();
  });
});

describe("the failed checks rule", () => {
  const failed = signal({
    key: `${repository}#12:ci_failed:${sha}`,
    event: "ci_failed",
    text: "Pull request #12: checks failed",
  });
  const failing = context({
    pullRequest: { ...greenPullRequest, ci: "FAILURE", review: null },
  });

  test("delegates a fix, linked to the pull request", () => {
    const plan = decide(failed, failing, defaultDispatcherSettings);
    expect(plan).toMatchObject({
      rule: "fix-failed-checks",
      mode: "on",
      outcome: "delegate",
      subject: `pr:${repository}#12`,
      task: {
        clientId: "ashgrove",
        title: `Fix the failing checks on ${repository}#12`,
        tags: ["from-signal", "github"],
        pullRequests: [`${repository}#12`],
        tracker: { system: "github", key: `${repository}#12` },
        needsYou: false,
      },
    });
  });

  test("leaves a pull request the account was asked to review", () => {
    const plan = decide(
      failed,
      { ...failing, reviewRequested: true },
      defaultDispatcherSettings,
    );
    expect(plan?.outcome).toBe("skip");
  });

  test("skips when the checks pass again, or no client is set", () => {
    expect(decide(failed, context(), defaultDispatcherSettings)?.outcome).toBe(
      "skip",
    );
    expect(
      decide({ ...failed, client: null }, failing, defaultDispatcherSettings)
        ?.text,
    ).toContain("No client");
  });

  test("records an old signal without acting on it", () => {
    const plan = decide(
      { ...failed, at: "2026-11-07T12:00:00.000Z" },
      failing,
      defaultDispatcherSettings,
    );
    expect(plan?.outcome).toBe("skip");
    expect(plan?.text).toContain("Older than 24 hours");
  });
});

describe("the alert rule", () => {
  test("delegates a critical or high alert, and asks you", () => {
    for (const severity of ["critical", "high"] as const) {
      const plan = decide(
        alert({ severity }),
        context(),
        defaultDispatcherSettings,
      );
      expect(plan).toMatchObject({
        rule: "alert-by-severity",
        outcome: "delegate",
        needsYou: true,
        subject: `alert:dependabot:${repository}#3`,
        task: { priority: "high", needsYou: true },
      });
    }
  });

  test("delegates a medium alert without asking", () => {
    const plan = decide(
      alert({ severity: "medium" }),
      context(),
      defaultDispatcherSettings,
    );
    expect(plan).toMatchObject({ outcome: "delegate", needsYou: false });
  });

  test("puts a low alert on the digest", () => {
    const plan = decide(
      alert({ severity: "low" }),
      context(),
      defaultDispatcherSettings,
    );
    expect(plan?.outcome).toBe("digest");
  });

  test("treats a secret scanning alert without severity as high", () => {
    const leaked = alert({ alertType: "secret_scanning", severity: null });
    expect(effectiveSeverity(leaked)).toBe("high");
    expect(
      effectiveSeverity(alert({ alertType: "code_scanning", severity: null })),
    ).toBe("medium");
    expect(subjectOf(leaked)).toBe(`alert:secret_scanning:${repository}#3`);
  });

  test("names an alert's tracker key as an alert, never as a pull request", () => {
    const plan = decide(alert(), context(), defaultDispatcherSettings);
    expect(plan?.outcome === "delegate" && plan.task.tracker?.key).toBe(
      `${repository}:alert-3`,
    );
  });

  test("decides nothing on a fixed or dismissed alert", () => {
    expect(
      decide(alert({ event: "fixed" }), context(), defaultDispatcherSettings),
    ).toBeUndefined();
  });
});

describe("an alert already open when gh-events first read it", () => {
  test("is delegated, and asks you, when critical or high", () => {
    const plan = decide(
      alert({ event: "swept", severity: "critical" }),
      context(),
      defaultDispatcherSettings,
    );
    expect(plan).toMatchObject({ outcome: "delegate", needsYou: true });
  });

  test("goes to the digest when medium or low", () => {
    for (const severity of ["medium", "low"] as const)
      expect(
        decide(
          alert({ event: "swept", severity }),
          context(),
          defaultDispatcherSettings,
        )?.outcome,
      ).toBe("digest");
  });
});

test("no rule applies to review requests or changes requested yet", () => {
  for (const event of ["review_requested", "changes_requested", "merged"])
    expect(
      decide(signal({ event }), context(), defaultDispatcherSettings),
    ).toBeUndefined();
});

describe("the dispatcher file", () => {
  test("lays what it sets over the defaults", () => {
    const { settings, by } = parseDispatcherFile(
      JSON.stringify({
        rules: { "merge-approved": "on" },
        mergeMethods: { default: "merge", "Example-Org": "rebase" },
        by: "dispatcher-test",
      }),
    );
    expect(settings.rules).toEqual({
      "merge-approved": "on",
      "fix-failed-checks": "on",
      "alert-by-severity": "on",
      "nudge-idle-with-work": "dry",
    });
    expect(settings.defaultMergeMethod).toBe("merge");
    expect(settings.mergeMethods).toEqual({ "example-org": "rebase" });
    expect(settings.maxAgeHours).toBe(24);
    expect(by).toBe("dispatcher-test");
  });

  test("refuses a mode, a method or a field it does not know", () => {
    expect(() =>
      parseDispatcherFile(
        JSON.stringify({ rules: { "merge-approved": "yes" } }),
      ),
    ).toThrow("does not match");
    expect(() =>
      parseDispatcherFile(
        JSON.stringify({ mergeMethods: { default: "fast" } }),
      ),
    ).toThrow("does not match");
    expect(() => parseDispatcherFile(JSON.stringify({ rule: {} }))).toThrow(
      "does not match",
    );
    expect(() => parseDispatcherFile("{")).toThrow("not JSON");
  });
});

describe("the dispatcher configuration", () => {
  const github = { ATLAS_GITHUB_STATE_DIR: "/tmp/gh-events" };

  test("is on with the defaults whenever GitHub state is on", () => {
    expect(readConfiguration(github).dispatcher).toEqual({
      settings: defaultDispatcherSettings,
      by: "atlas-dispatcher",
      githubCommand: "gh",
      sweepOpenAlerts: true,
    });
    expect(readConfiguration({}).dispatcher).toBeUndefined();
    expect(
      readConfiguration({ ...github, ATLAS_DISPATCHER: "off" }).dispatcher,
    ).toBeUndefined();
  });

  test("is on for the idle-with-work rule whenever live agent status is on", () => {
    const sessions = { ATLAS_SESSIONS_DIR: "/tmp/sessions" };
    expect(readConfiguration(sessions).dispatcher?.settings).toEqual(
      defaultDispatcherSettings,
    );
    expect(
      readConfiguration({ ...sessions, ATLAS_DISPATCHER: "off" }).dispatcher,
    ).toBeUndefined();
  });

  test("reads the tasks API and Commander, each with its token command", () => {
    const configuration = readConfiguration({
      ...github,
      ATLAS_TASKS_API_URL: "http://tasks.test/mcp",
      ATLAS_TASKS_API_TOKEN_COMMAND: "printf token",
      ATLAS_COMMANDER_URL: "http://commander.test",
      ATLAS_COMMANDER_TOKEN_COMMAND: "printf token",
    });
    expect(configuration.dispatcher).toMatchObject({
      tasksApi: { url: "http://tasks.test/mcp", tokenCommand: "printf token" },
      commander: { url: "http://commander.test", tokenCommand: "printf token" },
    });
  });

  test("refuses an address without its token command", () => {
    expect(() =>
      readConfiguration({
        ...github,
        ATLAS_TASKS_API_URL: "http://tasks.test",
      }),
    ).toThrow("set together");
  });
});
