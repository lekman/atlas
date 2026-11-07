import { parseMarkdown, splitFrontMatter } from "@atlas/core/markdown";
import { useEffect, useId, useMemo, useRef, type ReactNode } from "react";

import { Badge } from "../Badge";
import {
  field,
  liveStatus,
  pageRepos,
  trackerSystem,
  TRACKER_NAME,
  type DetailsPage,
  type StatusKind,
} from "../details/model";
import { formatAgo, formatDay, formatTime } from "../format";
import { Icon, Logo } from "../Icon";
import { MarkdownBlocks } from "../../markdown/MarkdownBlocks";
import { safeUrl } from "../trackers/model";
import {
  QUADRANTS,
  quadrantOf,
  VALUE_TEXT,
  type WorkItem,
} from "../worklist/model";

/** What the reader has of the page so far. */
export type DetailsState =
  | { state: "loading" }
  /** The item has no details page. */
  | { state: "none" }
  /** It has one, but this device can't read it and has no copy. */
  | { state: "missing" }
  /** The page, live or as a copy made at `copiedAt`. */
  | { state: "ready"; page: DetailsPage; copiedAt?: string };

export interface DetailsViewProps {
  item: WorkItem;
  clientName: string;
  details: DetailsState;
  /** The client's GitHub organisation, for bare repository names. */
  githubOrg?: string;
  /** The Monday tracker's key prefix, to tell its keys from Jira's. */
  mondayPrefix?: string;
  /** Pull requests in progress, for the status badge. */
  openPullRequests?: number;
  draftPullRequests?: number;
  /** A week from today, YYYY-MM-DD: a due date by then is near. */
  weekEnd: string;
  now: Date;
  /**
   * Back and Escape call it. Without it the details are the whole page, as
   * in an editor tab of their own: no Back button, and closing the tab is
   * the way back.
   */
  onClose?: () => void;
  /** The item's actions, under the title. */
  actions?: ReactNode;
  /** The answer form, when the item waits on the operator: after the badges, before the pull requests. */
  ask?: ReactNode;
  /** The item's pull requests, after the badges. */
  pullRequests?: ReactNode;
  /** The quadrant badge opens this: the value, effort and due date form, or what saving it did. */
  assess?: ReactNode;
  onAssess?: () => void;
  assessOpen?: boolean;
}

const STATUS: Record<StatusKind, { colour: string; ink: string }> = {
  done: { colour: "#44cc11", ink: "#1b1f23" },
  review: { colour: "#8957e5", ink: "#ffffff" },
  progress: { colour: "#dfb317", ink: "#1b1f23" },
  planned: { colour: "#9f9f9f", ink: "#1b1f23" },
  none: { colour: "#9f9f9f", ink: "#1b1f23" },
};

const httpsOnly = (href: string) => /^https:\/\//i.test(href);

/**
 * A task's details over the sidebar: its badges (status, tracker,
 * quadrant, due date, repositories) and its page from the vault, drawn
 * from Markdown without any HTML. Back or Escape closes it and returns to
 * where it was opened from.
 *
 * Without `onClose` it is the page itself, as in a VS Code editor tab: the
 * main landmark with the title as its first-level heading, the full width
 * of the tab, and no Back button.
 */
export function DetailsView({
  item,
  clientName,
  details,
  githubOrg,
  mondayPrefix,
  openPullRequests,
  draftPullRequests,
  ask,
  weekEnd,
  now,
  onClose,
  actions,
  pullRequests,
  assess,
  onAssess,
  assessOpen,
}: DetailsViewProps) {
  const title = useId();
  const back = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const overlay = Boolean(onClose);

  // Once, on opening over the sidebar: focus Back, close on Escape, and on closing return to where it was opened from.
  useEffect(() => {
    if (!close.current) return;
    const from = document.activeElement as HTMLElement | null;
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      from?.focus?.();
    };
  }, []);

  const page = details.state === "ready" ? details.page : null;
  const { fields, blocks } = useMemo(() => {
    if (!page) return { fields: [] as Array<[string, string]>, blocks: [] };
    const split = splitFrontMatter(page.md);
    return { fields: split.fields, blocks: parseMarkdown(split.body) };
  }, [page]);

  const status = liveStatus(item, {
    pageStatus: field(fields, "status"),
    openPullRequests,
    draftPullRequests,
  });
  const key = field(fields, "tracker") ?? item.key;
  const system = key ? trackerSystem(key, mondayPrefix) : null;
  const trackerUrl = safeUrl(field(fields, "url")) ?? safeUrl(item.link);
  const repos = pageRepos(fields, githubOrg);
  const quadrant = QUADRANTS.find((q) => q.key === quadrantOf(item))!;
  const graded = item.ref?.startsWith("db:");
  const near = Boolean(item.due && item.due <= weekEnd);

  const Root = overlay ? "div" : "main";
  const Heading = overlay ? "h2" : "h1";
  return (
    <Root
      className={overlay ? "detail" : "detail page"}
      {...(overlay ? { role: "dialog", "aria-modal": true } : {})}
      aria-labelledby={title}
    >
      <div className="inner">
        <div className="dbar">
          {overlay && (
            <button
              ref={back}
              type="button"
              className="dback"
              aria-label="Back to Atlas"
              onClick={onClose}
            >
              <Icon name="back" />
              <span aria-hidden="true">Back</span>
            </button>
          )}
          <div className="dt">
            <Heading id={title}>{item.title}</Heading>
            <div className="sub">
              {[clientName, item.key, item.details].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        {actions}
        <div className="dbody">
          {details.state === "ready" && details.copiedAt && (
            <div className="dnote">
              Copy from {formatDay(new Date(details.copiedAt))}{" "}
              {formatTime(new Date(details.copiedAt))}
              {details.page.modifiedAt
                ? `; the page itself changed ${formatAgo(new Date(details.page.modifiedAt), now)}`
                : ""}
              .
            </div>
          )}
          <div className="bdgs">
            <Badge
              label="STATUS"
              value={status.label.toUpperCase()}
              title={status.why}
              {...STATUS[status.kind]}
            />
            {key && system && (
              <Badge
                label={<Logo name={system} />}
                value={key}
                colour="#0070b0"
                href={trackerUrl}
                title={`${TRACKER_NAME[system]} ${key}`}
              />
            )}
            {graded && (
              <Badge
                label="Q"
                value={`${quadrant.key === "unsized" ? "N/A" : quadrant.short}${
                  item.value && item.effort
                    ? ` · ${VALUE_TEXT[item.value] ?? item.value} · ${item.effort}`
                    : ""
                }`.toUpperCase()}
                colour={quadrant.colour}
                ink="var(--panel)"
                title={
                  onAssess
                    ? "Change value, effort and due date"
                    : quadrant.about
                }
                onClick={onAssess}
                expanded={onAssess ? Boolean(assessOpen) : undefined}
              />
            )}
            {graded && item.due && (
              <Badge
                label="DUE"
                value={formatDay(
                  new Date(`${item.due}T12:00:00`),
                ).toUpperCase()}
                colour={near ? "var(--bad)" : "#9f9f9f"}
                ink={near ? "var(--panel)" : "#1b1f23"}
                title={
                  near
                    ? "Due within 7 days, so it counts as urgent"
                    : "Due date"
                }
              />
            )}
          </div>
          {assess}
          {repos.length > 0 && (
            <div className="bdgs repos">
              {repos.map((r) => (
                <Badge
                  key={r.name}
                  label={<Logo name="github" />}
                  value={r.name.split("/").pop() ?? r.name}
                  colour="#24292f"
                  href={r.url}
                  title={r.url ? r.name : undefined}
                />
              ))}
            </div>
          )}
          {ask}
          {pullRequests}
          {details.state === "loading" && <div className="dnote">Loading…</div>}
          {details.state === "none" && (
            <div className="dnote">
              No details page yet. Plan asks Commander to write one, with a test
              plan, and link it here.
            </div>
          )}
          {details.state === "missing" && (
            <div className="dnote">
              This details page isn't available here yet. Atlas copies it for
              the phone when it next runs on your Mac.
            </div>
          )}
          {page && (
            <div className="md">
              <MarkdownBlocks blocks={blocks} allowLink={httpsOnly} />
            </div>
          )}
          {page?.truncated && (
            <div className="dnote">
              The page is longer than this; open it in Obsidian for the rest.
            </div>
          )}
        </div>
      </div>
    </Root>
  );
}
