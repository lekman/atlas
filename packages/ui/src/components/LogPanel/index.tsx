import type { World } from "@atlas/worlds";

import { describeEvent } from "../../describe";
import type { LogLine } from "../../recordLog";
import type { LogEntry } from "../../useAtlasMap";

/** The record a log is narrowed to, and its lines. */
export interface LogSubject {
  /** The record's name or title. */
  name: string;
  /** What kind of record it is, the world's term with the real one: "probe · agent". */
  kind: string;
  /** Its log, newest first. */
  lines: readonly LogLine[];
}

export interface LogPanelProps {
  /** The map's events, newest first, as `useAtlasMap` keeps them. */
  entries: readonly LogEntry[];
  /** Whose voice each line is written in. */
  world: World;
  /**
   * `panel` is the column down the left of the full map; `preview` sits in
   * the sidebar.
   */
  variant: "panel" | "preview";
  /** How many lines to show. Four in the sidebar; every line in the column. */
  limit?: number;
  /** The selected record. The column shows its log instead of every event. */
  subject?: LogSubject | null;
  /** Whether the column shows every event although a record is selected. */
  showingAllEvents?: boolean;
  /** All events was pressed, with whether it is now on. */
  onShowAllEventsChange?(showAll: boolean): void;
}

/** The time of a line, with the day in front when it is not today. */
const clock = (time: Date, seconds: boolean) => {
  const hours = time.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  });
  return time.toDateString() === new Date().toDateString()
    ? hours
    : `${time.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${hours}`;
};

/**
 * The running log of events, written in the world's voice. On the full map
 * it is a column from the top bar to the bottom margin, scrolled inside,
 * with the same panel and weight as the HUD opposite. With a record
 * selected it narrows to that record's log: the map events about it and,
 * for a backlog item, what agents wrote in the task database's item log.
 * Those lines also name who each came from. All events widens the log
 * again and keeps the selection.
 */
export function LogPanel({
  entries,
  world,
  variant,
  limit = variant === "panel" ? Infinity : 4,
  subject = null,
  showingAllEvents = false,
  onShowAllEventsChange,
}: LogPanelProps) {
  const narrowed = subject !== null && !showingAllEvents;
  const lines: readonly LogLine[] = narrowed
    ? subject.lines
    : entries.map((entry) => ({
        key: `event-${entry.id}`,
        time: entry.time,
        who: "",
        text: describeEvent(world, entry.before, entry.event),
      }));
  const shown = lines.slice(0, limit);
  const titleId = `atlas-log-${variant}`;
  return (
    <section
      className={`atlas-log atlas-log-${variant}`}
      aria-labelledby={titleId}
      data-narrowed={narrowed}
    >
      <h2 className="atlas-section-title" id={titleId}>
        <span>{world.vocabulary.log}</span>
        <span>{variant === "panel" ? `${lines.length} entries` : "live"}</span>
      </h2>
      {subject && (
        <div className="atlas-log-subject">
          <p>
            <span className="atlas-eyebrow">
              {narrowed ? `Log for ${subject.kind}` : "Every event"}
            </span>
            <strong>{subject.name}</strong>
          </p>
          <button
            type="button"
            className="atlas-button"
            aria-pressed={showingAllEvents}
            onClick={() => onShowAllEventsChange?.(!showingAllEvents)}
          >
            All events
          </button>
        </div>
      )}
      {/* Focusable, so the log scrolls from the keyboard too. */}
      <div
        className="atlas-log-scroll"
        aria-live="polite"
        tabIndex={variant === "panel" ? 0 : undefined}
      >
        {shown.length === 0 ? (
          <p className="atlas-empty">
            {narrowed ? "Nothing logged for this record yet." : "Listening…"}
          </p>
        ) : (
          <ol className="atlas-log-rows">
            {shown.map((line) => (
              <li key={line.key} data-who={line.who ? "" : undefined}>
                <time dateTime={line.time.toISOString()}>
                  {clock(line.time, variant === "panel")}
                </time>
                {line.who && (
                  <span className="atlas-log-who">
                    {line.who}
                    {line.status && (
                      <span className="atlas-log-status">{line.status}</span>
                    )}
                  </span>
                )}
                <span className="atlas-log-text">{line.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
