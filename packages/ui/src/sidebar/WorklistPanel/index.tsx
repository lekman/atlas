import { useState, type CSSProperties, type ReactNode } from "react";

import { GroupHeader } from "../GroupHeader";
import { Panel } from "../Panel";
import { WorkRow } from "../WorkRow";
import {
  byDoneThenPriority,
  byWhenThenPriority,
  DAY_HOURS,
  foldKeys,
  formatHours,
  isWaiting,
  itemsFor,
  QUADRANTS,
  quadrantOf,
  todaySummary,
  whenOf,
  type Band,
  type WorkItem,
} from "../worklist/model";

export interface WorklistClient {
  key: string;
  name: string;
  colour: string;
}

export interface WorklistProps {
  /** The worklist; null when there is none to show, with `empty` saying why. */
  items: readonly WorkItem[] | null;
  /** Shown instead of the list when `items` is null. */
  empty?: string;
  loading?: boolean;
  band: Band;
  onBand: (band: Band) => void;
  /** Clients in the order their groups show; items of any other client go last, as Other. */
  clients: readonly WorklistClient[];
  /** A client key, or `"all"`. */
  focus: string;
  /** Folded groups, by the previous page's keys. */
  folded: ReadonlySet<string>;
  onFold: (key: string) => void;
  showDone: boolean;
  showWaiting: boolean;
  /** YYYY-MM-DD. */
  today: string;
  tomorrow: string;
  /** Above the list: Waiting on you, and notes. */
  notes?: ReactNode;
  /** The worklist's ⋯ menu. */
  menu?: ReactNode;
  /** Opens a task's details. */
  onOpen?: (item: WorkItem) => void;
}

/** A group shows its first five tasks until it is opened in full. */
const CAP = 5;

const OTHER: WorklistClient = {
  key: "other",
  name: "Other",
  colour: "var(--client-other)",
};

const BANDS: Array<[Band, string, string?]> = [
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  [
    "backlog",
    "Backlog",
    "Everything open, today, tomorrow and later, grouped by Covey quadrant",
  ],
];

/**
 * The worklist: today's, tomorrow's or every open task. Today and Tomorrow
 * group by client; with one client chosen that client always shows in
 * full. The Backlog groups by Covey quadrant, then by client, under a bar
 * that weighs today's graded work against a day.
 */
export function Worklist(props: WorklistProps) {
  const { band, onBand, menu, notes, items, empty, loading } = props;
  const controls = (
    <>
      <div className="seg" role="group" aria-label="Worklist range">
        {BANDS.map(([b, label, title]) => (
          <button
            key={b}
            type="button"
            aria-pressed={band === b}
            title={title}
            onClick={() => onBand(b)}
          >
            {label}
          </button>
        ))}
      </div>
      {menu && <span className="wmenu">{menu}</span>}
    </>
  );
  return (
    <Panel
      title="Worklist"
      controls={controls}
      notes={notes}
      loading={loading ? 2 : undefined}
    >
      {!items ? (
        <div className="blank">{empty}</div>
      ) : band === "backlog" ? (
        <PlanView {...props} items={items} />
      ) : (
        <DayView {...props} items={items} />
      )}
    </Panel>
  );
}

function clientList(clients: readonly WorklistClient[]): WorklistClient[] {
  return [...clients, OTHER];
}

const clientKey = (item: WorkItem, clients: readonly WorklistClient[]) =>
  clients.some((c) => c.key === item.customer) ? item.customer : "other";

function MoreButton({
  shown,
  total,
  onToggle,
}: {
  shown: boolean;
  total: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="more"
      aria-expanded={shown}
      onClick={onToggle}
    >
      {shown ? `Show top ${CAP} only` : `Show ${total - CAP} more`}
    </button>
  );
}

function DayView({
  items,
  band,
  clients,
  focus,
  folded,
  onFold,
  showDone,
  showWaiting,
  today,
  tomorrow,
  onOpen,
}: WorklistProps & { items: readonly WorkItem[] }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const all = itemsFor(items, band, today, tomorrow);
  const single = focus !== "all";
  const list = all
    .filter((t) => !single || t.customer === focus)
    .filter((t) => showDone || !t.done)
    .filter((t) => showWaiting || !isWaiting(t));
  if (!list.length) {
    return (
      <div className="blank">
        {band === "today"
          ? "Nothing on today's list for this view."
          : "Nothing here."}
      </div>
    );
  }
  return (
    <>
      {clientList(clients).map((client) => {
        const rows = list
          .filter((t) => clientKey(t, clients) === client.key)
          .sort(byDoneThenPriority);
        if (!rows.length) return null;
        const open = rows.filter((t) => !t.done).length;
        const done = all.filter(
          (t) => clientKey(t, clients) === client.key && t.done,
        ).length;
        // With one client chosen, Today and Tomorrow always show that client in full.
        const closed = !single && folded.has(foldKeys.client(client.key));
        const full = single || expanded.has(client.key) || rows.length <= CAP;
        return (
          <div key={client.key} className="group">
            <GroupHeader
              label={client.name}
              count={rows.length}
              countText={`${open} open${done ? ` · ${done} done${showDone ? "" : " hidden"}` : ""}`}
              colour={client.colour}
              open={!closed}
              onToggle={
                single ? undefined : () => onFold(foldKeys.client(client.key))
              }
              title={
                single
                  ? undefined
                  : `${closed ? "Expand" : "Collapse"} ${client.name}`
              }
            />
            {!closed && (
              <>
                <ul className="rows">
                  {(full ? rows : rows.slice(0, CAP)).map((t) => (
                    <WorkRow
                      key={t.ref ?? t.title}
                      item={t}
                      today={today}
                      showDay={band !== "today"}
                      onOpen={onOpen && t.ref ? () => onOpen(t) : undefined}
                    />
                  ))}
                </ul>
                {!single && rows.length > CAP && (
                  <MoreButton
                    shown={full}
                    total={rows.length}
                    onToggle={() => setExpanded(toggled(expanded, client.key))}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

function PlanView({
  items,
  clients,
  focus,
  folded,
  onFold,
  showWaiting,
  today,
  onOpen,
}: WorklistProps & { items: readonly WorkItem[] }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [info, setInfo] = useState<string | null>(null);
  const open = items.filter(
    (t) =>
      !t.meeting &&
      !t.done &&
      (focus === "all" || t.customer === focus) &&
      (showWaiting || !isWaiting(t)),
  );
  if (!open.length) return <div className="blank">Nothing open.</div>;
  const summary = todaySummary(open, today);
  return (
    <>
      <div className="planbar">
        <div>
          <b>
            Today {summary.count} task{summary.count === 1 ? "" : "s"}
          </b>
          {" · "}
          <span
            className={summary.hours > DAY_HOURS ? "over" : undefined}
            title="Effort of today's graded tasks that aren't blocked"
          >
            {formatHours(summary.hours)} of {DAY_HOURS}h graded
          </span>
          {summary.ungraded ? ` · ${summary.ungraded} ungraded` : ""}
          {summary.blocked ? ` · ${summary.blocked} blocked` : ""}
        </div>
      </div>
      {QUADRANTS.map((q) => {
        const rows = open.filter((t) => quadrantOf(t) === q.key);
        if (!rows.length) return null;
        const closed = folded.has(foldKeys.quadrant(q.key));
        const todays = rows.filter((t) => whenOf(t, today) === "today").length;
        return (
          <div key={q.key} className="quad">
            <div className="qhdr">
              <button
                type="button"
                className="grp"
                style={{ "--c": q.colour } as CSSProperties}
                aria-expanded={!closed}
                onClick={() => onFold(foldKeys.quadrant(q.key))}
              >
                <span className="nm">
                  <i className="chev" aria-hidden="true" />
                  <b>{q.short}</b>
                </span>
              </button>
              <button
                type="button"
                className="qi"
                title={q.about}
                aria-label={`About ${q.short}`}
                aria-expanded={info === q.key}
                onClick={() => setInfo(info === q.key ? null : q.key)}
              >
                i
              </button>
              <span className="qc">
                {rows.length} open{todays ? ` · ${todays} today` : ""}
              </span>
            </div>
            {info === q.key && <div className="qnote">{q.about}</div>}
            {!closed && (
              <div className="qin">
                {clientList(clients).map((client) => {
                  const cr = rows
                    .filter((t) => clientKey(t, clients) === client.key)
                    .sort(byWhenThenPriority(today));
                  if (!cr.length) return null;
                  const key = foldKeys.quadrantClient(q.key, client.key);
                  const cclosed = folded.has(key);
                  const full = expanded.has(key) || cr.length <= CAP;
                  return (
                    <div key={client.key} className="group">
                      <GroupHeader
                        label={client.name}
                        count={cr.length}
                        countText={`${cr.length} open`}
                        colour={client.colour}
                        open={!cclosed}
                        onToggle={() => onFold(key)}
                      />
                      {!cclosed && (
                        <>
                          <ul className="rows">
                            {(full ? cr : cr.slice(0, CAP)).map((t) => (
                              <WorkRow
                                key={t.ref ?? t.title}
                                item={t}
                                today={today}
                                plan
                                onOpen={
                                  onOpen && t.ref ? () => onOpen(t) : undefined
                                }
                              />
                            ))}
                          </ul>
                          {cr.length > CAP && (
                            <MoreButton
                              shown={full}
                              total={cr.length}
                              onToggle={() =>
                                setExpanded(toggled(expanded, key))
                              }
                            />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function toggled(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}
