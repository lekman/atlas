import { describe, expect, it } from "bun:test";

import { githubGroups, githubPage, isHot } from "../src/sidebar";

const repo = { owner: "acme", name: "app" };

describe("githubPage", () => {
  it("reads issues, labels as strings or objects, and builds the links", () => {
    const page = githubPage(
      {
        totalCount: 40,
        pageInfo: { hasNextPage: true },
        issues: [
          {
            number: 7,
            title: "T",
            labels: ["bug", { name: "ux" }, null],
            assignees: ["a", { login: "b" }],
            updated_at: "2026-03-12T09:00:00Z",
            html_url: "javascript:alert(1)",
          },
        ],
      },
      repo,
    );
    expect(page).toEqual({
      total: 40,
      more: true,
      items: [
        {
          number: 7,
          title: "T",
          url: "https://github.com/acme/app/issues/7",
          labels: ["bug", "ux"],
          assignees: ["a", "b"],
          updated: "2026-03-12T09:00:00Z",
        },
      ],
    });
  });

  it("drops an issue without a number and survives an unreadable answer", () => {
    expect(githubPage({ issues: [{ title: "x" }] }, repo).items).toEqual([]);
    expect(githubPage("nope", repo)).toEqual({
      total: 0,
      more: false,
      items: [],
    });
  });
});

describe("githubGroups and isHot", () => {
  const issue = (labels: string[]) => ({
    number: 1,
    title: "",
    url: "",
    labels,
    assignees: [],
    updated: null,
  });

  it("sorts groups by first label, no label last", () => {
    expect(
      githubGroups([issue([]), issue(["docs"]), issue(["bug", "docs"])]),
    ).toEqual(["bug", "docs", ""]);
  });

  it("marks bugs, criticals and p0/p1 as hot", () => {
    expect(isHot(issue(["P1"]))).toBe(true);
    expect(isHot(issue(["docs"]))).toBe(false);
  });
});
