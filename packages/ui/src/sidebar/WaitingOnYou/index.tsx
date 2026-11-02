import { useId, type CSSProperties } from "react";

import { formatTime } from "../format";
import { Icon } from "../Icon";
import {
  askText,
  failedSources,
  waitingSource,
  type WaitingItem,
} from "../waiting/model";

export interface WaitingRow {
  item: WaitingItem;
  /** The client it belongs to, for the colour and the source line. */
  client: { name: string; colour: string };
  /** Opens the task's details; without it the ask is plain text. */
  onOpen?: () => void;
  /** A rule Commander would follow to answer it, in words. */
  rule?: string;
  /**
   * Answered, and still waiting ten minutes later: the time it was answered.
   * The source line then says so, with a warning icon, instead of who asks.
   */
  answeredAt?: string;
}

export interface WaitingOnYouProps {
  rows: readonly WaitingRow[];
  /** The operator's name, as the asks begin with it. */
  operator: string;
  /**
   * Sources that couldn't be read, each "<source>: <message>". With nothing
   * to list, they say so, so a failed source doesn't read as nothing waiting.
   */
  errors?: readonly string[];
  /**
   * Opens Teach Commander. With it, an icon button takes the count's place
   * and says the count in its name.
   */
  onTeach?: () => void;
}

/**
 * Amber, above the worklist: questions and decisions that wait on the
 * operator. It only shows and links; nothing here approves or answers.
 * Absent when nothing waits.
 */
export function WaitingOnYou({
  rows,
  operator,
  errors,
  onTeach,
}: WaitingOnYouProps) {
  const heading = useId();
  if (!rows.length) {
    const failed = failedSources(errors);
    if (!failed.length) return null;
    return (
      <div className="note" title={errors?.join("\n")}>
        Couldn't check everything that waits on you: {failed.join(", ")}.
      </div>
    );
  }
  return (
    <section className="waiting" aria-labelledby={heading}>
      <div className="wy-h" id={heading}>
        Waiting on you
        {onTeach ? (
          <button
            type="button"
            className="teach"
            aria-label={`Teach Commander, ${rows.length} waiting`}
            title="Teach Commander your answers"
            onClick={onTeach}
          >
            <Icon name="teach" />
          </button>
        ) : (
          <span className="n">{rows.length}</span>
        )}
      </div>
      <ul>
        {rows.map((row, i) => {
          const { ask, tooltip } = askText(row.item, operator);
          return (
            <li
              key={row.item.ref ?? `${row.item.kind}-${i}`}
              className="wy"
              style={{ "--c": row.client.colour } as CSSProperties}
              title={tooltip || undefined}
            >
              {row.onOpen ? (
                <button
                  type="button"
                  className="tlink ask"
                  onClick={row.onOpen}
                >
                  {ask}
                </button>
              ) : (
                <span className="ask">{ask}</span>
              )}
              <div className="sub">
                {waitingSource(row.item, row.client.name).map((part, j) =>
                  j === 0 && row.answeredAt ? (
                    <span key={part} className="late">
                      <Icon name="gapc" />
                      Answered {formatTime(new Date(row.answeredAt))}, no reply
                      yet
                    </span>
                  ) : (
                    <span key={part} className={j === 0 ? "cust" : undefined}>
                      {part}
                    </span>
                  ),
                )}
              </div>
              {row.rule && (
                <div className="rule">Commander's rule: {row.rule}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
