import { needsYou, type Dataset } from "@atlas/core";
import type { Camera, World } from "@atlas/worlds";
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
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
}

/** The list's height after a click on a closed handle. */
const openHeight = 240;
/** Below this, a drag closes the list. */
const closeBelow = 48;
/** How far a key press on the handle moves it. */
const keyStep = 40;
/** A press that moves less than this is a click, not a drag. */
const dragThreshold = 4;

/**
 * The corner readout over the full map, in the world's own words, with a
 * handle on its top edge. Drag the handle up, or click it, to open the
 * needs-you list above the readout. The readout lines are hidden from
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
}: HudReadoutProps) {
  const [listHeight, setListHeight] = useState(initialListHeight);
  const drag = useRef<{
    startY: number;
    startHeight: number;
    moved: boolean;
  } | null>(null);
  const listId = useId();
  const entries = needsYou(dataset);
  const open = listHeight > 0;

  const maximum = () =>
    Math.max(openHeight, Math.round((window.innerHeight || 800) * 0.6));
  const clamp = (height: number) =>
    height < closeBelow ? 0 : Math.min(height, maximum());

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      startY: event.clientY,
      startHeight: listHeight,
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
      setListHeight((height) => clamp((height || closeBelow) + keyStep));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setListHeight((height) => clamp(height - keyStep));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setListHeight((height) => (height > 0 ? 0 : openHeight));
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
        hidden={!open}
        style={{ height: listHeight }}
      >
        {open && (
          <NeedsYouList
            dataset={dataset}
            world={world}
            onSelect={(id) => onSelect?.(id)}
          />
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
