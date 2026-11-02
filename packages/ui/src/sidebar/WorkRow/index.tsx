import type { ReactNode } from "react";

import { formatDay } from "../format";
import { flagTag, VALUE_TEXT, whenOf, type WorkItem } from "../worklist/model";

export interface WorkRowProps {
  item: WorkItem;
  /** Today, YYYY-MM-DD. */
  today: string;
  /** In the plan view: when it is planned, and its value and effort. */
  plan?: boolean;
  /** Outside Today, the day it is planned for. */
  showDay?: boolean;
  /** Opens the item's details; without it the title is plain text. */
  onOpen?: () => void;
  /** The item's ⋯ menu, when it has one. */
  actions?: ReactNode;
  /** A line under the meta: a Commander request's state. */
  status?: ReactNode;
}

const dayOf = (day: string) => new Date(`${day}T12:00:00`);

/** One worklist task: its priority dot, title, tags, and in the plan view when and how big. */
export function WorkRow({
  item,
  today,
  plan,
  showDay,
  onOpen,
  actions,
  status,
}: WorkRowProps) {
  const when = whenOf(item, today);
  const className = ["task", item.done && "done", actions && "act"]
    .filter(Boolean)
    .join(" ");
  return (
    <li className={className} data-ref={item.ref}>
      <span
        className={`pri ${item.priority ?? ""}`.trim()}
        title={item.priority ? `${item.priority} priority` : "no priority"}
        aria-hidden="true"
      />
      <div className="tb">
        <div className="ti">
          {onOpen ? (
            <button type="button" className="tlink" onClick={onOpen}>
              {item.title}
            </button>
          ) : (
            item.title
          )}
          {item.done && <span className="sr"> (done)</span>}
        </div>
        <div className="sub">
          {item.key && <span className="key">{item.key}</span>}
          {(item.flags ?? []).map((f) => {
            const tag = flagTag(f);
            return (
              <span key={f} className={`tag ${tag.tone}`}>
                {tag.text}
              </span>
            );
          })}
          {plan ? (
            <>
              <span
                className="tag when"
                title={
                  item.day
                    ? `Planned for ${formatDay(dayOf(item.day))}`
                    : "Not planned"
                }
              >
                {when === "later" && item.day
                  ? formatDay(dayOf(item.day))
                  : when}
              </span>
              {item.value && item.effort && (
                <span title="Business value and effort">
                  {VALUE_TEXT[item.value] ?? item.value} value · {item.effort}
                </span>
              )}
            </>
          ) : (
            showDay && item.day && <span>{formatDay(dayOf(item.day))}</span>
          )}
          {item.claimedBy && (
            <span className="tag active" title="Claimed in the task database">
              claimed by {item.claimedBy}
            </span>
          )}
        </div>
        {status}
      </div>
      {actions}
    </li>
  );
}
