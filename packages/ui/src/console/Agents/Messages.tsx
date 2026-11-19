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

const keyOf = (item: AgentFeedItem) =>
  item.kind === "question" ? `q:${item.id}` : `s:${item.at}:${item.text}`;

/**
 * What the agent told Atlas, newest first: its questions, and its reports
 * such as done, error or waiting. An open question opens in Beam; any other
 * message opens in place to show all of its text and the answer. The filter
 * hides answered and withdrawn questions.
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
  const closed = (items ?? []).filter(isClosed).length;
  const shown = (items ?? []).filter((i) => showClosed || !isClosed(i));

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
              onSelect: () => onShowClosed(!showClosed),
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
    </section>
  );
}
