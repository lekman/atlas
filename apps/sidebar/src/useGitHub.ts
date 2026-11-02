import type { Runtime } from "@atlas/runtime";
import { githubPage, type GitHubPage } from "@atlas/ui/sidebar";
import { useMemo } from "react";

import { useFeed, type Feed } from "./useFeed";

type Repo = { owner: string; name: string };

/**
 * A repository's open issues through the GitHub connector every five
 * minutes, newest first, and the operator's login every hour. Nothing is
 * stored, as the previous page stored nothing.
 */
export function useGitHub(
  runtime: Runtime,
  repo: Repo | undefined,
): Feed<GitHubPage> & { updatedAt: Date | null; me: string | null } {
  const issues = useFeed<GitHubPage>(
    runtime,
    repo
      ? {
          server: "GitHub",
          tool: "list_issues",
          args: {
            owner: repo.owner,
            repo: repo.name,
            state: "OPEN",
            perPage: 100,
            orderBy: "UPDATED_AT",
            direction: "DESC",
            fields: ["number", "title", "labels", "assignees", "updated_at"],
          },
          accept: (d) => githubPage(d, repo),
          watch: {
            refetchInterval: 5 * 60000,
            cache: { staleTime: 60000, gcTime: 6 * 3600000 },
          },
        }
      : null,
    "GitHub",
  );
  const me = useFeed<string>(
    runtime,
    repo
      ? {
          server: "GitHub",
          tool: "get_me",
          accept: (d) => {
            const login = (d as { login?: unknown } | null)?.login;
            return typeof login === "string" && login ? login : null;
          },
          watch: {
            refetchInterval: 60 * 60000,
            cache: { staleTime: 300000, gcTime: 86400000 },
          },
        }
      : null,
    "GitHub",
  );
  const liveAt = issues.liveAt;
  const updatedAt = useMemo(() => (liveAt ? new Date(liveAt) : null), [liveAt]);
  return { ...issues, updatedAt, me: me.data };
}
