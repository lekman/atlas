import type { World } from "@atlas/worlds";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";

import { describeEvent } from "../../describe";
import { logClock, withinLogWindow } from "../../logWindow";
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
  /**
   * The column's drawer: shut (a short box of the latest lines), a height
   * in pixels the reader dragged it to, or open the full height. Leave out
   * for a log that is always open.
   */
  drawer?: LogDrawer;
  /** The handle was dragged, clicked or moved with the keyboard. */
  onDrawerChange?(drawer: LogDrawer): void;
  /**
   * The moment the last 24 hours are counted back from. The clock when left
   * out; stories and tests fix it.
   */
  now?: Date;
}

export type LogDrawer = "shut" | "full" | number;

/** Below this, a drag shuts the drawer. */
const shutBelow = 120;
/** A press that moves less than this is a click, not a drag. */
const dragThreshold = 4;
/** How far a key press on the handle moves it. */
const keyStep = 60;

/**
 * The running log of events, written in the world's voice. On the full map
 * it is a column from the top bar to the bottom margin, scrolled inside,
 * with the same panel and weight as the HUD opposite. With a record
 * selected it narrows to that record's log: the map events about it and,
 * for a backlog item, what agents wrote in the task database's item log.
 * Those lines also name who each came from. All events widens the log
 * again and keeps the selection. Either way it shows the last 24 hours,
 * each line stamped with its time of day and no date.
 */
export function LogPanel({
  entries,
  world,
  variant,
  limit = variant === "panel" ? Infinity : 4,
  subject = null,
  showingAllEvents = false,
  onShowAllEventsChange,
  drawer,
  onDrawerChange,
  now = new Date(),
}: LogPanelProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const drag = useRef<{
    startY: number;
    startHeight: number;
    moved: boolean;
  } | null>(null);
  const open = drawer !== undefined && drawer !== "shut";
  const tallest = () => {
    const parent = sectionRef.current?.parentElement;
    return Math.max(
      shutBelow,
      (parent?.clientHeight ?? window.innerHeight) - 80,
    );
  };
  const currentHeight = () =>
    sectionRef.current?.getBoundingClientRect().height ?? 0;
  const settle = (height: number): LogDrawer =>
    height < shutBelow
      ? "shut"
      : height >= tallest() - 8
        ? "full"
        : Math.round(height);
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      startY: event.clientY,
      startHeight: currentHeight(),
      moved: false,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    const distance = current.startY - event.clientY;
    if (!current.moved && Math.abs(distance) < dragThreshold) return;
    current.moved = true;
    onDrawerChange?.(
      settle(Math.min(current.startHeight + distance, tallest())),
    );
  };
  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (current && !current.moved) onDrawerChange?.(open ? "shut" : "full");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const step = event.key === "ArrowUp" ? keyStep : -keyStep;
      onDrawerChange?.(settle(Math.min(currentHeight() + step, tallest())));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onDrawerChange?.(open ? "shut" : "full");
    }
  };
  const narrowed = subject !== null && !showingAllEvents;
  const lines: readonly LogLine[] = withinLogWindow(
    narrowed
      ? subject.lines
      : entries.map((entry) => ({
          key: `event-${entry.id}`,
          time: entry.time,
          who: "",
          text: describeEvent(world, entry.before, entry.event),
        })),
    now,
  );
  const shown = lines.slice(0, limit);
  const titleId = `atlas-log-${variant}`;
  return (
    <section
      ref={sectionRef}
      className={`atlas-log atlas-log-${variant}`}
      aria-labelledby={titleId}
      data-narrowed={narrowed}
      data-drawer={
        drawer === undefined
          ? undefined
          : typeof drawer === "number"
            ? "height"
            : drawer
      }
      style={typeof drawer === "number" ? { height: drawer } : undefined}
    >
      {drawer !== undefined && (
        <button
          type="button"
          className="atlas-drawer-handle"
          aria-expanded={open}
          aria-label={open ? "Shorten the log" : "Open the whole log"}
          title="Drag up to read more of the log"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKeyDown}
        >
          <span aria-hidden="true" />
        </button>
      )}
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
                  {logClock(line.time, variant === "panel")}
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
