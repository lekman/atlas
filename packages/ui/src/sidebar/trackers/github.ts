/**
 * Open issues as the GitHub connector's list_issues sends them, read into
 * the sidebar's rows, and grouped by their first label.
 */

export interface GitHubIssue {
  number: number;
  title: string;
  url: string;
  labels: string[];
  assignees: string[];
  updated: string | null;
}

export interface GitHubPage {
  /** Open issues in the repository, beyond this page too. */
  total: number;
  more: boolean;
  items: GitHubIssue[];
}

/** Label names arrive as strings or as `{ name }`. */
const labelName = (l: unknown): string =>
  typeof l === "string"
    ? l
    : ((l as { name?: unknown } | null)?.name as string) || "";

const login = (a: unknown): string =>
  typeof a === "string"
    ? a
    : ((a as { login?: unknown } | null)?.login as string) || "";

/** A page of issues; the links are built from the repository, never taken from the answer. */
export function githubPage(
  payload: unknown,
  repo: { owner: string; name: string },
): GitHubPage {
  const p = (payload ?? {}) as {
    issues?: unknown;
    totalCount?: unknown;
    pageInfo?: { hasNextPage?: unknown };
  };
  const list = Array.isArray(p.issues)
    ? (p.issues as Array<Record<string, unknown>>)
    : [];
  return {
    total: typeof p.totalCount === "number" ? p.totalCount : list.length,
    more: Boolean(p.pageInfo?.hasNextPage),
    items: list
      .filter((i) => typeof i.number === "number")
      .map((i) => ({
        number: i.number as number,
        title: String(i.title || "(no title)"),
        url: `https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/issues/${i.number as number}`,
        labels: (Array.isArray(i.labels) ? i.labels : [])
          .map(labelName)
          .filter(Boolean)
          .slice(0, 6),
        assignees: (Array.isArray(i.assignees) ? i.assignees : [])
          .map(login)
          .filter(Boolean),
        updated: typeof i.updated_at === "string" ? i.updated_at : null,
      })),
  };
}

/** Groups by first label, alphabetically; issues without a label last. */
export function githubGroups(items: readonly GitHubIssue[]): string[] {
  return [...new Set(items.map((i) => i.labels[0] ?? ""))].sort(
    (a, b) => Number(a === "") - Number(b === "") || a.localeCompare(b),
  );
}

/** A label that makes an issue urgent: a red dot. */
export const isHot = (issue: GitHubIssue): boolean =>
  issue.labels.some((l) => /p0|p1|critical|urgent|bug/i.test(l));
