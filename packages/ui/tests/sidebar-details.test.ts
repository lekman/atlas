import { describe, expect, it } from "bun:test";

import {
  detailsKey,
  isDetailsPage,
  liveStatus,
  pageRepos,
  trackerSystem,
} from "../src/sidebar";

describe("detailsKey", () => {
  it("makes the store key the previous page made from the path", () => {
    expect(detailsKey("Clients/Acme Ltd/Plan, v2.md")).toBe(
      "clients-acme-ltd-plan-v2",
    );
    expect(detailsKey("../x.md")).toBe("x");
    expect(detailsKey(`${"a".repeat(300)}.md`)).toHaveLength(180);
  });
});

describe("liveStatus", () => {
  const item = { title: "t", customer: "acme" };
  it("goes done, review, progress, planned, not planned", () => {
    expect(
      liveStatus({ ...item, done: true }, { openPullRequests: 1 }).kind,
    ).toBe("done");
    expect(liveStatus(item, { openPullRequests: 2 })).toMatchObject({
      kind: "review",
      why: "2 open pull requests",
    });
    expect(liveStatus({ ...item, flags: ["active"] }).kind).toBe("progress");
    expect(liveStatus({ ...item, claimedBy: "ops" }).why).toBe(
      "Claimed by ops",
    );
    expect(liveStatus(item, { draftPullRequests: 1 }).kind).toBe("progress");
    expect(
      liveStatus({ ...item, details: "x.md" }, { pageStatus: "drafted" }),
    ).toMatchObject({
      kind: "planned",
      label: "drafted",
    });
    expect(liveStatus(item).kind).toBe("none");
  });
});

describe("trackerSystem and pageRepos", () => {
  it("tells the trackers apart by key", () => {
    expect(trackerSystem("KF-12", "KF")).toBe("monday");
    expect(trackerSystem("KF-12")).toBe("jira");
    expect(trackerSystem("acme/app#4")).toBe("github");
  });

  it("reads the page's repositories, a bare name taking the organisation", () => {
    expect(
      pageRepos([["Repos", "[app, other/lib, not a repo]"]], "acme"),
    ).toEqual([
      { name: "acme/app", url: "https://github.com/acme/app" },
      { name: "other/lib", url: "https://github.com/other/lib" },
      { name: "acme/not a repo", url: null },
    ]);
    expect(pageRepos([], "acme")).toEqual([]);
  });
});

describe("isDetailsPage", () => {
  it("needs a path and Markdown", () => {
    expect(isDetailsPage({ path: "a.md", md: "# A" })).toBe(true);
    expect(isDetailsPage({ path: "a.md" })).toBe(false);
  });
});
