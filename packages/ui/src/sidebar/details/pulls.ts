/**
 * A task's pull requests, as the local server's `task_prs` finds them on
 * GitHub (linked to the task, or found by its tracker key), and as the
 * sidebar stores them at `prs/<key>` for devices without the server.
 */
import { safeUrl } from "../trackers/model";

export type PullState = "open" | "draft" | "merged" | "closed";

export interface PullRequest {
  repo: string;
  number: number;
  title: string;
  url: string;
  state: PullState;
  author?: string;
  additions?: number;
  deletions?: number;
  files?: number;
  updatedAt?: string;
  mergedAt?: string | null;
  closedAt?: string | null;
  /** The combined state of its checks. */
  checks?: "success" | "failure" | "error" | "pending" | "expected" | null;
  conflicts?: boolean;
  /** Review threads nobody has answered, and threads still open. */
  awaiting?: number;
  unresolved?: number;
  review?: "approved" | "changes_requested" | "review_required" | null;
}

/** The answer, and the stored copy. */
export interface PullsDoc {
  ref?: string;
  prs: PullRequest[];
  fetchedAt?: string;
  /** True when the pull requests are linked to the task, not found by its key. */
  linked?: boolean;
}

export function readPulls(value: unknown): PullsDoc | null {
  if (typeof value !== "object" || value === null) return null;
  const d = value as {
    prs?: unknown;
    fetchedAt?: unknown;
    linked?: unknown;
    ref?: unknown;
  };
  if (!Array.isArray(d.prs)) return null;
  return {
    ref: typeof d.ref === "string" ? d.ref : undefined,
    fetchedAt: typeof d.fetchedAt === "string" ? d.fetchedAt : undefined,
    linked: Boolean(d.linked),
    prs: (d.prs as PullRequest[]).filter(
      (p) =>
        p &&
        typeof p.repo === "string" &&
        typeof p.number === "number" &&
        safeUrl(p.url),
    ),
  };
}

export type Tone = "ok" | "bad" | "warn" | null;

/** The facts an open or draft pull request shows, each in its colour. */
export function pullFacts(p: PullRequest): Array<{ text: string; tone: Tone }> {
  if (p.state !== "open" && p.state !== "draft") return [];
  const ci: Record<string, { text: string; tone: Tone }> = {
    success: { text: "✓ CI green", tone: "ok" },
    failure: { text: "✗ CI failing", tone: "bad" },
    error: { text: "✗ CI error", tone: "bad" },
    pending: { text: "● CI running", tone: "warn" },
    expected: { text: "● CI waiting", tone: "warn" },
  };
  const facts = [ci[p.checks ?? ""] ?? { text: "no CI checks", tone: null }];
  facts.push(
    p.conflicts
      ? { text: "✗ merge conflicts", tone: "bad" }
      : { text: "✓ no conflicts", tone: "ok" },
  );
  if (p.awaiting) {
    facts.push({
      text: `${p.awaiting} unanswered thread${p.awaiting > 1 ? "s" : ""}`,
      tone: "warn",
    });
  } else if (p.unresolved) {
    facts.push({
      text: `${p.unresolved} open thread${p.unresolved > 1 ? "s" : ""}, answered`,
      tone: null,
    });
  } else {
    facts.push({ text: "✓ no open threads", tone: "ok" });
  }
  const review: Record<string, { text: string; tone: Tone }> = {
    approved: { text: "approved", tone: "ok" },
    changes_requested: { text: "changes requested", tone: "bad" },
    review_required: { text: "review required", tone: "warn" },
  };
  if (p.review && review[p.review]) facts.push(review[p.review]!);
  return facts;
}

/** Open and draft pull requests, for the status badge. */
export function pullCounts(doc: PullsDoc | null): {
  open: number;
  draft: number;
} {
  const prs = doc?.prs ?? [];
  return {
    open: prs.filter((p) => p.state === "open").length,
    draft: prs.filter((p) => p.state === "draft").length,
  };
}
