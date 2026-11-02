/**
 * A task's details page, as the local server's `details_read` reads it
 * from the vault, and as the sidebar copies it into the store
 * (`details/<key>`) for devices without the server.
 */
import type { WorkItem } from "../worklist/model";

export interface DetailsPage {
  path: string;
  title?: string;
  /** The note's Markdown, front matter included. */
  md: string;
  /** Only the start of a long note was read. */
  truncated?: boolean;
  modifiedAt?: string;
}

/** The stored copy: the page, and when it was copied. */
export interface DetailsCopy extends DetailsPage {
  copiedAt: string;
}

export function isDetailsPage(value: unknown): value is DetailsPage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { md?: unknown }).md === "string" &&
    typeof (value as { path?: unknown }).path === "string"
  );
}

/** The store key of a page's copy, as the previous page built it from the path. */
export function detailsKey(path: string): string {
  return String(path)
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-180);
}

export type StatusKind = "done" | "review" | "progress" | "planned" | "none";

/**
 * Where the item stands now, from the live sources rather than its page:
 * done, in review (an open pull request), in progress (the database says
 * so, a session claimed it, a draft pull request), planned (it has a
 * page), or not planned.
 */
export function liveStatus(
  item: WorkItem,
  options: {
    pageStatus?: string;
    openPullRequests?: number;
    draftPullRequests?: number;
  } = {},
): { kind: StatusKind; label: string; why: string } {
  const open = options.openPullRequests ?? 0;
  if (item.done)
    return { kind: "done", label: "done", why: "The item is done" };
  if (open) {
    return {
      kind: "review",
      label: "in review",
      why: `${open} open pull request${open > 1 ? "s" : ""}`,
    };
  }
  if ((item.flags ?? []).includes("active")) {
    return {
      kind: "progress",
      label: "in progress",
      why: "The task database says doing or review",
    };
  }
  if (item.claimedBy) {
    return {
      kind: "progress",
      label: "in progress",
      why: `Claimed by ${item.claimedBy}`,
    };
  }
  if (options.draftPullRequests) {
    return {
      kind: "progress",
      label: "in progress",
      why: "A draft pull request",
    };
  }
  if (item.details) {
    return {
      kind: "planned",
      label: options.pageStatus || "planned",
      why: "Has a details page; no work started",
    };
  }
  return { kind: "none", label: "not planned", why: "No details page yet" };
}

export type TrackerSystem = "monday" | "jira" | "github";

/** Which tracker a key belongs to: `#12` is GitHub, the Monday prefix is Monday, the rest Jira. */
export function trackerSystem(
  key: string,
  mondayPrefix?: string,
): TrackerSystem {
  if (
    mondayPrefix &&
    new RegExp(`^${mondayPrefix.replace(/[^\w-]/g, "")}-\\d+$`).test(key)
  ) {
    return "monday";
  }
  if (/#\d+$/.test(key)) return "github";
  return "jira";
}

export const TRACKER_NAME: Record<TrackerSystem, string> = {
  monday: "monday.com",
  jira: "Jira",
  github: "GitHub",
};

/**
 * The repositories a page names (`repo`, `repos` or `repository`), as
 * `owner/name`. A bare name takes the client's GitHub organisation.
 * Anything that isn't `owner/name` stays, without a link.
 */
export function pageRepos(
  fields: ReadonlyArray<[string, string]>,
  org: string | undefined,
): Array<{ name: string; url: string | null }> {
  const get = (k: string) => fields.find(([x]) => x.toLowerCase() === k)?.[1];
  const raw = (get("repo") ?? get("repos") ?? get("repository") ?? "")
    .replace(/^\[|\]$/g, "")
    .split(/\s*,\s*/)
    .filter(Boolean);
  const full = [
    ...new Set(raw.map((r) => (r.includes("/") || !org ? r : `${org}/${r}`))),
  ];
  return full.map((name) => ({
    name,
    url: /^[\w.-]+\/[\w.-]+$/.test(name) ? `https://github.com/${name}` : null,
  }));
}

/** A front matter field, ignoring case. */
export const field = (
  fields: ReadonlyArray<[string, string]>,
  key: string,
): string | undefined => fields.find(([x]) => x.toLowerCase() === key)?.[1];
