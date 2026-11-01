import type { ReactNode } from "react";

export interface NextUpProps {
  /** A meeting under way, or the next one. */
  state: "now" | "next";
  /** The meeting's title; none when the calendar has nothing coming. */
  title?: string;
  /** Shown instead of a title: why there is none. */
  empty?: string;
  /** "in 25 min", or "ends in 10 min" for a meeting under way. */
  countdown?: string;
  /** When and whose: "14:00–15:00 · Halcyon Labs". */
  when?: string;
  /** Sits in the card's corner: the client pill. */
  corner?: ReactNode;
}

/** The card at the top: the meeting under way, or the next one. */
export function NextUp({
  state,
  title,
  empty = "—",
  countdown,
  when,
  corner,
}: NextUpProps) {
  const heading = title ?? empty;
  const line = countdown ? `${countdown}${when ? ` · ${when}` : ""}` : when;
  return (
    <div className="strip">
      <div className="nextup">
        {corner}
        <div className="label">
          {state === "now" ? "In progress" : "Next up"}
        </div>
        <div className="title" title={heading}>
          {heading}
        </div>
        {line && (
          <div className="when" title={line}>
            {countdown && <b>{countdown}</b>}
            {when && `${countdown ? " · " : ""}${when}`}
          </div>
        )}
      </div>
    </div>
  );
}
