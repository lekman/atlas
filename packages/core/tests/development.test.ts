import { describe, expect, it } from "bun:test";

import { BacklogItem, DevelopmentTracking } from "../src";

const item = {
  id: "partner-api",
  clientId: "acme",
  title: "Open the partner API",
  state: "doing",
  priority: "normal",
  classification: "internal",
  boundary: "home-server",
} as const;

const complete = {
  issue: {
    key: "#88",
    url: "https://github.example/acme/api/issues/88",
    state: "open",
  },
  branch: {
    name: "feature/88-partner-api",
    worktree: { path: "~/work/api-partner" },
  },
  pullRequest: {
    number: 91,
    url: "https://github.example/acme/api/pull/91",
    state: "draft",
    checks: "pending",
  },
} as const;

describe("development tracking", () => {
  it("leaves a backlog item without it valid", () => {
    expect(BacklogItem.parse(item).development).toBeUndefined();
  });

  it("reads an issue, a branch on a worktree and a pull request", () => {
    const parsed = BacklogItem.parse({ ...item, development: complete });
    expect(parsed.development).toEqual(complete);
  });

  it("allows each part on its own", () => {
    expect(DevelopmentTracking.parse({})).toEqual({});
    expect(DevelopmentTracking.parse({ issue: complete.issue })).toEqual({
      issue: complete.issue,
    });
    expect(
      DevelopmentTracking.parse({ branch: { name: "fix/88-typo" } }),
    ).toEqual({ branch: { name: "fix/88-typo" } });
  });

  it("refuses a state it does not know", () => {
    expect(
      DevelopmentTracking.safeParse({
        issue: { ...complete.issue, state: "reopened" },
      }).success,
    ).toBe(false);
    expect(
      DevelopmentTracking.safeParse({
        pullRequest: { ...complete.pullRequest, state: "approved" },
      }).success,
    ).toBe(false);
    expect(
      DevelopmentTracking.safeParse({
        pullRequest: { ...complete.pullRequest, checks: "flaky" },
      }).success,
    ).toBe(false);
  });

  it("refuses a pull request without a positive whole number", () => {
    for (const number of [0, -3, 1.5])
      expect(
        DevelopmentTracking.safeParse({
          pullRequest: { ...complete.pullRequest, number },
        }).success,
      ).toBe(false);
  });

  it("refuses an issue or pull request without an address", () => {
    expect(
      DevelopmentTracking.safeParse({
        issue: { ...complete.issue, url: "issues/88" },
      }).success,
    ).toBe(false);
  });

  it("refuses an empty branch name or worktree path", () => {
    expect(
      DevelopmentTracking.safeParse({ branch: { name: "" } }).success,
    ).toBe(false);
    expect(
      DevelopmentTracking.safeParse({
        branch: { name: "feature/88", worktree: { path: "" } },
      }).success,
    ).toBe(false);
  });
});
