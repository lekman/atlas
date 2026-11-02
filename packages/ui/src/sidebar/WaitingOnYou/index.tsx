import { useId, type CSSProperties } from "react";

import { askText, waitingSource, type WaitingItem } from "../waiting/model";

export interface WaitingRow {
  item: WaitingItem;
  /** The client it belongs to, for the colour and the source line. */
  client: { name: string; colour: string };
  /** Opens the task's details; without it the ask is plain text. */
  onOpen?: () => void;
}

export interface WaitingOnYouProps {
  rows: readonly WaitingRow[];
  /** The operator's name, as the asks begin with it. */
  operator: string;
}

/**
 * Amber, above the worklist: questions and decisions that wait on the
 * operator. It only shows and links; nothing here approves or answers.
 * Absent when nothing waits.
 */
export function WaitingOnYou({ rows, operator }: WaitingOnYouProps) {
  const heading = useId();
  if (!rows.length) return null;
  return (
    <section className="waiting" aria-labelledby={heading}>
      <div className="wy-h" id={heading}>
        Waiting on you <span className="n">{rows.length}</span>
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
                {waitingSource(row.item, row.client.name).map((part, j) => (
                  <span key={part} className={j === 0 ? "cust" : undefined}>
                    {part}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
