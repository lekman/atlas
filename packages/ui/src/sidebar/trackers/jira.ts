/**
 * Jira issues as the Mac's sync stores them at `board/jira`: the issues
 * assigned to the operator that aren't done, or why the sync failed.
 */
import { priorityOf, type Priority } from "./model";

export interface JiraIssue {
  key: string;
  summary?: string;
  url?: string;
  status?: string;
  /** Jira's status category: `new`, `indeterminate`, `done`. */
  category?: string;
  type?: string;
  priority?: string;
  /** YYYY-MM-DD. */
  due?: string;
  updated?: string;
}

export interface JiraDoc {
  ok: boolean;
  error?: string | null;
  syncedAt?: string;
  items: JiraIssue[];
}

/**
 * The stored copy, with only stories, bugs, tasks, sub-tasks and spikes;
 * tests, test plans and epics stay out. Null when it isn't one.
 */
export function readJira(value: unknown): JiraDoc | null {
  if (typeof value !== "object" || value === null) return null;
  const d = value as {
    ok?: unknown;
    error?: unknown;
    syncedAt?: unknown;
    items?: unknown;
  };
  const wanted = (i: JiraIssue) =>
    !i.type ||
    /^(story|bug|task|sub-?task|spike)$/i.test(String(i.type).trim());
  return {
    ok: Boolean(d.ok),
    error: typeof d.error === "string" ? d.error : null,
    syncedAt: typeof d.syncedAt === "string" ? d.syncedAt : undefined,
    items: (Array.isArray(d.items) ? (d.items as JiraIssue[]) : [])
      .filter((i) => i && typeof i.key === "string")
      .filter(wanted),
  };
}

/** Why the last sync failed, in words. */
export function jiraErrorText(error: string | null | undefined): string {
  switch (error) {
    case "not_configured":
      return "Jira isn't set up yet. On your Mac, add your Jira email and API token to _Dashboard Sync/jira.json in the vault; the next sync fills this in.";
    case "http_401":
      return "Jira rejected the credentials (401). Check the email and token in _Dashboard Sync/jira.json; tokens expire.";
    case "http_403":
      return "Jira refused access (403). The token works but isn't allowed to search; check with your Jira admin.";
    case "http_429":
      return "Jira asked the sync to slow down (429). The next sync tries again.";
    default:
      return `The last Jira sync failed (${error || "unknown error"}). The next sync tries again.`;
  }
}

export const JIRA_GROUPS = [
  { key: "indeterminate", label: "In progress", colour: "var(--warn)" },
  { key: "new", label: "To do", colour: "var(--muted)" },
  { key: "other", label: "Other", colour: "var(--muted)" },
] as const;

export function jiraGroup(issue: JiraIssue): string {
  return issue.category === "indeterminate" || issue.category === "new"
    ? issue.category
    : "other";
}

const statusRank = (s = "") =>
  /block/i.test(s)
    ? 0
    : /progress/i.test(s)
      ? 1
      : /review/i.test(s)
        ? 2
        : /test/i.test(s)
          ? 3
          : 4;

/** Blocked first, then in progress, review and test; then by status; newest first. */
export function sortJira(items: readonly JiraIssue[]): JiraIssue[] {
  return [...items].sort(
    (a, b) =>
      statusRank(a.status) - statusRank(b.status) ||
      String(a.status ?? "").localeCompare(String(b.status ?? "")) ||
      String(b.updated ?? "").localeCompare(String(a.updated ?? "")),
  );
}

export const jiraPriority = (p: string | undefined): Priority =>
  priorityOf(p, /highest|high|blocker|critical/i);
