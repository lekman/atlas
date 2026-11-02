import { describe, expect, it } from "bun:test";

import {
  pullCounts,
  pullFacts,
  readPulls,
  type PullRequest,
} from "../src/sidebar";

const pr = (more: Partial<PullRequest>): PullRequest => ({
  repo: "acme/app",
  number: 1,
  title: "t",
  url: "https://github.com/acme/app/pull/1",
  state: "open",
  ...more,
});

describe("readPulls", () => {
  it("keeps only pull requests with a repository, a number and an https link", () => {
    const doc = readPulls({
      prs: [pr({}), pr({ url: "javascript:alert(1)" }), { title: "no repo" }],
      fetchedAt: "x",
      linked: 1,
    });
    expect(doc?.prs).toHaveLength(1);
    expect(doc?.linked).toBe(true);
    expect(readPulls({ items: [] })).toBeNull();
  });
});

describe("pullFacts", () => {
  it("lists checks, conflicts, threads and review for an open one", () => {
    expect(
      pullFacts(
        pr({
          checks: "failure",
          conflicts: true,
          unresolved: 2,
          review: "approved",
        }),
      ),
    ).toEqual([
      { text: "✗ CI failing", tone: "bad" },
      { text: "✗ merge conflicts", tone: "bad" },
      { text: "2 open threads, answered", tone: null },
      { text: "approved", tone: "ok" },
    ]);
  });

  it("says no checks, and lists nothing for a merged one", () => {
    expect(pullFacts(pr({}))[0]).toEqual({ text: "no CI checks", tone: null });
    expect(pullFacts(pr({ state: "merged" }))).toEqual([]);
  });
});

describe("pullCounts", () => {
  it("counts open and draft pull requests for the status badge", () => {
    expect(
      pullCounts({
        prs: [pr({}), pr({ state: "draft" }), pr({ state: "merged" })],
      }),
    ).toEqual({
      open: 1,
      draft: 1,
    });
    expect(pullCounts(null)).toEqual({ open: 0, draft: 0 });
  });
});
