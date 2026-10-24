import { needsYou, type Dataset } from "@atlas/core";
import type { Camera, World } from "@atlas/worlds";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { NeedsYouList } from "../NeedsYouList";

export interface HudReadoutProps {
  /** Whose words the readout uses. */
  world: World;
  /** What is counted: clients, agents, who is active, what needs you. */
  dataset: Dataset;
  /** Where the map is looking, for worlds that show a position or a scale. */
  camera: Camera | null;
  /** The map's size in pixels, to turn the camera into a map position. */
  viewport: { width: number; height: number };
  /** A needs-you entry was picked from the expanded list. */
  onSelect?(id: string): void;
  /** The height of the needs-you list at start, in pixels. 0 is closed. */
  initialListHeight?: number;
  /**
   * The record selected on the map or in the list. Selecting one opens a
   * closed list to fit. A needs-you entry expands in place; any other
   * record shows in a Selected section above the list.
   */
  selectedId?: string | null;
  /** The selected record and its controls, as the parent draws them. */
  selected?: ReactNode;
}

/** Fitted to its content, up to the maximum, rather than a dragged height. */
type ListHeight = number | "fit";

/** The list's height after a click on a closed handle. */
const openHeight = 240;
/** Below this, a drag closes the list. */
const closeBelow = 48;
/** How far a key press on the handle moves it. */
const keyStep = 40;
/** A press that moves less than this is a click, not a drag. */
const dragThreshold = 4;

/**
 * The HUD: the corner readout over the full map, in the world's own words,
 * with a handle under its title. Drag the handle up, or click it, to open the
 * needs-you list above the readout. The selected record opens here too, so
 * the record and its buttons sit beside the list that led to it. The readout lines are hidden from
 * screen readers: what they count is in that list and in the map's own
 * description, and a line that changes as the map pans would only be noise.
 */
export function HudReadout({
  world,
  dataset,
  camera,
  viewport,
  onSelect,
  initialListHeight = 0,
  selectedId = null,
  selected,
}: HudReadoutProps) {
  const [listHeight, setListHeight] = useState<ListHeight>(initialListHeight);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedTitleId = useId();
  const drag = useRef<{
    startY: number;
    startHeight: number;
    moved: boolean;
  } | null>(null);
  const listId = useId();
  const entries = needsYou(dataset);
  const open = listHeight === "fit" || listHeight > 0;
  const selectedNeedsYou = entries.some((entry) => entry.id === selectedId);
  /** The list's height now, in pixels, measured when it is fitted. */
  const currentHeight = () =>
    listHeight === "fit" ? (listRef.current?.offsetHeight ?? 0) : listHeight;

  // A selection opens a closed list to fit, and scrolls an open one so the
  // expanded record is in view. A height the reader dragged is kept.
  useEffect(() => {
    if (!selectedId) return;
    setListHeight((height) => (height === 0 ? "fit" : height));
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const entry = list?.querySelector<HTMLElement>("[data-selected]");
      if (!list || !entry) return;
      const outer = list.getBoundingClientRect();
      const inner = entry.getBoundingClientRect();
      if (inner.top < outer.top) list.scrollTop -= outer.top - inner.top;
      else if (inner.bottom > outer.bottom)
        list.scrollTop += Math.min(
          inner.bottom - outer.bottom,
          inner.top - outer.top,
        );
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  const maximum = () =>
    Math.max(openHeight, Math.round((window.innerHeight || 800) * 0.6));
  const clamp = (height: number) =>
    height < closeBelow ? 0 : Math.min(height, maximum());

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
    setListHeight(clamp(current.startHeight + distance));
  };
  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (current && !current.moved)
      setListHeight(current.startHeight > 0 ? 0 : openHeight);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setListHeight(clamp((currentHeight() || closeBelow) + keyStep));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setListHeight(clamp(currentHeight() - keyStep));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setListHeight(open ? 0 : openHeight);
    }
  };

  const readout = world.readout({
    clients: dataset.clients.filter((client) => client.home !== true).length,
    agents: dataset.agents.length,
    active: dataset.agents.filter(
      (agent) => agent.status === "running" || agent.status === "watching",
    ).length,
    needsYou: entries.length,
    openQuestions: dataset.questions.filter(
      (question) => question.state === "open",
    ).length,
    x: camera ? (viewport.width / 2 - camera.x) / camera.scale : 0,
    y: camera ? (viewport.height / 2 - camera.y) / camera.scale : 0,
    scale: camera?.scale ?? 1,
    time: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
  const [first, ...rest] = readout.lines;
  return (
    <div className="atlas-hud" data-open={open}>
      <h2 className="atlas-section-title atlas-hud-title">
        <span>HUD</span>
      </h2>
      <button
        type="button"
        className="atlas-hud-handle"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${open ? "Hide" : "Show"} what needs you, ${entries.length}`}
        title="Drag up to see what needs you"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden="true" />
      </button>
      <div
        className="atlas-hud-list"
        id={listId}
        ref={listRef}
        hidden={!open}
        style={
          listHeight === "fit"
            ? { maxHeight: maximum() }
            : { height: listHeight }
        }
      >
        {open && (
          <>
            {selectedId && selected && !selectedNeedsYou && (
              <section
                className="atlas-section atlas-hud-selected"
                aria-labelledby={selectedTitleId}
                data-selected="true"
              >
                <h2 className="atlas-section-title" id={selectedTitleId}>
                  <span>Selected</span>
                </h2>
                {selected}
              </section>
            )}
            <NeedsYouList
              dataset={dataset}
              world={world}
              onSelect={(id) => onSelect?.(id)}
              selectedId={selectedNeedsYou ? selectedId : null}
              selected={selectedNeedsYou ? selected : undefined}
            />
          </>
        )}
      </div>
      <div className="atlas-hud-readout" aria-hidden="true">
        {readout.title && <strong>{readout.title}</strong>}
        {first && <span>{first}</span>}
        <span className="atlas-hud-attention">{readout.attention}</span>
        {rest.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </div>
  );
}
