import { useState } from "react";

import { formatAgo } from "../../sidebar/format";
import { ConsoleMenu } from "../ConsoleMenu";
import { feedBadge, isClosed, type AgentFeedItem } from "../agent-state";

export interface AgentMessagesProps {
  /** The agent's feed, newest first, or null before the host answered. */
  items: readonly AgentFeedItem[] | null;
  /** Why the feed is missing or old, in words. */
  note?: string | null;
  /** Whether answered and withdrawn questions show too. */
  showClosed: boolean;
  onShowClosed(show: boolean): void;
  /** Opens an open question in Beam. */
  onOpenQuestion?(id: string): void;
  now: Date;
}

/** Messages shown on one page. */
export const PAGE_SIZE = 5;

const keyOf = (item: AgentFeedItem) =>
  item.kind === "question" ? `q:${item.id}` : `s:${item.at}:${item.text}`;

/**
 * What the agent told Atlas, newest first: its questions, and its reports
 * such as done, error or waiting. An open question opens in Beam; any other
 * message opens in place to show all of its text and the answer. The filter
 * hides answered and withdrawn questions, and a waiting report once the
 * agent has moved on. Five show at a time; Newer and
 * Older page through the rest.
 */
export function AgentMessages({
  items,
  note = null,
  showClosed,
  onShowClosed,
  onOpenQuestion,
  now,
}: AgentMessagesProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const list = items ?? [];
  const closed = list.filter((i) => isClosed(i, list)).length;
  const all = list.filter((i) => showClosed || !isClosed(i, list));
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  // A shorter list, after the filter or a refresh, keeps the page in range.
  const at = Math.min(page, pages - 1);
  const shown = all.slice(at * PAGE_SIZE, (at + 1) * PAGE_SIZE);

  return (
    <section className="console-detail-section" aria-label="Messages">
      <div className="console-label-row">
        <h3 className="console-label">Messages</h3>
        <ConsoleMenu
          label="Filter"
          name="the messages"
          icon="filter"
          buttonClassName="console-chip console-icon-chip"
          items={[
            {
              label: `Show answered and closed (${closed})`,
              checked: showClosed,
              onSelect: () => {
                setPage(0);
                onShowClosed(!showClosed);
              },
            },
          ]}
        />
      </div>
      {note ? <p className="console-note">{note}</p> : null}
      {items === null ? (
        note ? null : (
          <p className="console-note">Reading the messages…</p>
        )
      ) : shown.length === 0 ? (
        <p className="console-note">
          {items.length ? "Nothing open." : "No messages from this agent."}
        </p>
      ) : (
        <ul className="console-agent-feed">
          {shown.map((item) => {
            const key = keyOf(item);
            const badge = feedBadge(item);
            const text = item.kind === "question" ? item.title : item.text;
            const toBeam =
              item.kind === "question" &&
              item.state === "open" &&
              item.id &&
              onOpenQuestion;
            const expanded = open === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  className="console-agent-feed-item"
                  aria-expanded={toBeam ? undefined : expanded}
                  onClick={() =>
                    toBeam
                      ? onOpenQuestion(item.id!)
                      : setOpen(expanded ? null : key)
                  }
                >
                  <span className="console-agent-feed-meta">
                    <span className="console-badge" data-tone={badge.tone}>
                      {badge.word}
                    </span>
                    <span className="console-task-fact">
                      {formatAgo(new Date(item.at), now)}
                    </span>
                    {toBeam ? (
                      <span className="console-task-fact">Open in Beam</span>
                    ) : null}
                  </span>
                  <span
                    className="console-agent-feed-text"
                    data-expanded={expanded || undefined}
                  >
                    {text}
                  </span>
                  {expanded && item.detail ? (
                    <span className="console-agent-feed-detail">
                      {item.detail}
                    </span>
                  ) : null}
                  {expanded && item.answer ? (
                    <span className="console-agent-feed-answer">
                      Answer: {item.answer}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 ? (
        <nav className="console-pager" aria-label="Message pages">
          <button
            type="button"
            className="console-secondary"
            aria-disabled={at === 0 || undefined}
            onClick={() => at > 0 && setPage(at - 1)}
          >
            Newer
          </button>
          <span className="console-pager-count" aria-live="polite">
            {at * PAGE_SIZE + 1}–{Math.min(all.length, (at + 1) * PAGE_SIZE)} of{" "}
            {all.length}
          </span>
          <button
            type="button"
            className="console-secondary"
            aria-disabled={at >= pages - 1 || undefined}
            onClick={() => at < pages - 1 && setPage(at + 1)}
          >
            Older
          </button>
        </nav>
      ) : null}
    </section>
  );
}
