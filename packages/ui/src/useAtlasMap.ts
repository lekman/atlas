/**
 * The live state behind an Atlas view: a scene the canvas draws, a log, and
 * the sound each event makes. Events come from a script in stories and from
 * the server's event stream in the app; both call `fire`.
 */
import { applyEvent, type AtlasEvent, type Dataset } from "@atlas/core";
import {
  createSoundPlayer,
  Scene,
  type SoundCue,
  type SoundSettings,
  type World,
} from "@atlas/worlds";
import { useCallback, useEffect, useRef, useState } from "react";

export interface LogEntry {
  id: number;
  time: Date;
  event: AtlasEvent;
  /** The dataset just before the event, so the line can say what changed. */
  before: Dataset;
}

export type ScriptStep = AtlasEvent | { type: "reset" };

export interface AtlasMapOptions {
  dataset: Dataset;
  world: World;
  sound: SoundSettings;
  /** Steps to replay in a loop. Leave out for a still map. */
  script?: ScriptStep[];
  /** Seconds between scripted steps. */
  interval?: number;
  /** Fire the first step straight away, so a story opens with motion. */
  startImmediately?: boolean;
}

export interface AtlasMap {
  scene: Scene;
  /** The dataset as of the last event. A new value after every event. */
  dataset: Dataset;
  log: LogEntry[];
  fire(event: AtlasEvent): void;
  /** Play one cue now, whatever the category switches say. */
  preview(cue: SoundCue): void;
}

const logLimit = 100;

export function cueFor(event: AtlasEvent): SoundCue {
  switch (event.type) {
    case "agent-message":
      return "message";
    case "external":
      return "external";
    case "status-change":
      return event.to === "waiting"
        ? "needs"
        : event.to === "blocked" || event.to === "error"
          ? "blocked"
          : "status";
    case "question-answered":
    case "agent-launched":
    case "agent-returned":
      return "status";
  }
}

export function useAtlasMap(options: AtlasMapOptions): AtlasMap {
  const {
    dataset: initial,
    script,
    interval = 3.4,
    startImmediately = true,
  } = options;
  const sceneRef = useRef<Scene | null>(null);
  if (!sceneRef.current) sceneRef.current = new Scene(initial);
  const scene = sceneRef.current;

  const [dataset, setDataset] = useState(initial);
  const [log, setLog] = useState<LogEntry[]>([]);
  const nextId = useRef(1);
  const player = useRef(createSoundPlayer());
  // Read through refs so the script timer never restarts when the world or
  // the sound settings change.
  const world = useRef(options.world);
  const sound = useRef(options.sound);
  world.current = options.world;
  sound.current = options.sound;

  const fire = useCallback(
    (event: AtlasEvent) => {
      const before = scene.dataset;
      scene.apply(event, performance.now() / 1000);
      setDataset(scene.dataset);
      setLog((entries) =>
        [
          { id: nextId.current++, time: new Date(), event, before },
          ...entries,
        ].slice(0, logLimit),
      );
      player.current.play(world.current, cueFor(event), sound.current);
    },
    [scene],
  );

  useEffect(() => {
    scene.reset(initial);
    setDataset(initial);
  }, [scene, initial]);

  useEffect(() => {
    if (!script || script.length === 0) return;
    let index = 0;
    const step = () => {
      const next = script[index % script.length];
      index++;
      if (!next) return;
      if (next.type === "reset") {
        scene.reset(initial);
        setDataset(initial);
      } else {
        fire(next);
      }
    };
    const first = startImmediately ? window.setTimeout(step, 600) : undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) step();
    }, interval * 1000);
    return () => {
      window.clearInterval(timer);
      if (first !== undefined) window.clearTimeout(first);
    };
  }, [scene, script, interval, initial, fire, startImmediately]);

  const preview = useCallback((cue: SoundCue) => {
    player.current.preview(world.current, cue, sound.current);
  }, []);

  return { scene, dataset, log, fire, preview };
}

/** Replays events in order, for a story that shows one kind of event. */
export function datasetAfter(dataset: Dataset, events: AtlasEvent[]): Dataset {
  return events.reduce(applyEvent, dataset);
}
