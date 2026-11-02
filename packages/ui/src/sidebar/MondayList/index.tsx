import type { ReactNode } from "react";

import { formatAgo, formatTime } from "../format";
import { GroupHeader } from "../GroupHeader";
import { Note } from "../Note";
import { Panel } from "../Panel";
import { TaskRow } from "../TaskRow";
import { priorityOf } from "../trackers/model";
import {
  mondayGroups,
  mondayStatusColour,
  type MondayItem,
  type MondayPage,
} from "../trackers/monday";

export interface MondayListProps {
  /** The panel's title: the client and the board. */
  title: string;
  page: MondayPage | null;
  error?: { text: string; tone: "warn" | "err" } | null;
  /** When the page was read. */
  updatedAt: Date | null;
  now: Date;
  /** The row's button: go to its task, or plan it with Commander. */
  rowAction?: (item: MondayItem) => ReactNode;
  /** A line under the row: its Commander request. */
  rowStatus?: (item: MondayItem) => ReactNode;
}

/** The items assigned to the operator that aren't Done, grouped by status, newest first. */
export function MondayList({
  title,
  page,
  error,
  updatedAt,
  now,
  rowAction,
  rowStatus,
}: MondayListProps) {
  const notes = error ? <Note tone={error.tone}>{error.text}</Note> : null;
  if (!page) return <Panel title={title} notes={notes} loading={!error} />;
  return (
    <Panel
      title={title}
      sub={`${page.items.length} not done${page.more ? " (first 100)" : ""}`}
      notes={notes}
      fresh={
        updatedAt
          ? `Assigned to you, not Done · updated ${formatTime(updatedAt)} · refreshes every 5 min`
          : undefined
      }
    >
      {page.items.length === 0 ? (
        <div className="blank">Nothing assigned to you that isn't done.</div>
      ) : (
        mondayGroups(page.items).map((status) => {
          const rows = page.items
            .filter((i) => i.status === status)
            .sort((a, b) => b.updated.getTime() - a.updated.getTime());
          return (
            <div key={status} className="group">
              <GroupHeader
                label={status}
                count={rows.length}
                colour={mondayStatusColour(status)}
              />
              <ul className="rows">
                {rows.map((i) => (
                  <TaskRow
                    key={i.key ?? `${i.name}-${i.updated.getTime()}`}
                    priority={priorityOf(i.priority)}
                    priorityLabel={i.priority ?? "no priority"}
                    title={i.name}
                    url={i.url}
                    meta={
                      <>
                        {i.key && <span className="key">{i.key}</span>}
                        {i.priority && <span>{i.priority}</span>}
                        <span>updated {formatAgo(i.updated, now)}</span>
                      </>
                    }
                    status={rowStatus?.(i)}
                    action={rowAction?.(i)}
                  />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </Panel>
  );
}
