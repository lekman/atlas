import type { ReactNode } from "react";

import type { Priority } from "../trackers/model";

export interface TaskRowProps {
  /** The dot: red high, amber medium, an outline for low, grey for none. */
  priority: Priority;
  /** The dot's tooltip: the tracker's own word. */
  priorityLabel?: string;
  title: string;
  /** Opens in a new tab; `https://` only, already checked. */
  url?: string | null;
  /** The line under the title: key, status, people, times. */
  meta?: ReactNode;
}

/** One item from a tracker: a priority dot, the title as a link, and a meta line. */
export function TaskRow({
  priority,
  priorityLabel,
  title,
  url,
  meta,
}: TaskRowProps) {
  return (
    <li className="task">
      <span
        className={`pri ${priority}`.trim()}
        title={priorityLabel ?? (priority ? undefined : "no priority")}
        aria-hidden="true"
      />
      <div className="tb">
        <div className="ti">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
              {title}
            </a>
          ) : (
            title
          )}
        </div>
        {meta && <div className="sub">{meta}</div>}
      </div>
    </li>
  );
}
