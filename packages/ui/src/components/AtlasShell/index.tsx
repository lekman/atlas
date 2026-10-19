/**
 * The whole Atlas view. Compact by default: a sidebar-width pane with a small
 * live map, the needs-you list and the latest log lines. Expand fills the
 * screen with the full map, the inspector, the log and the readout.
 *
 * The same component serves Storybook, the web app and the Claude Artifact;
 * only where its data comes from differs.
 */
import type { AtlasEvent, Dataset } from "@atlas/core";
import {
  defaultSoundSettings,
  isWorldId,
  lightingPreferences,
  resolveLighting,
  worlds,
  type Bounds,
  type Camera,
  type LightingPreference,
  type SoundSettings,
  type WorldId,
} from "@atlas/worlds";
import { useEffect, useRef, useState } from "react";

import { worldStyle } from "../../theme";
import { useAtlasMap, type ScriptStep } from "../../useAtlasMap";
import { HudReadout } from "../HudReadout";
import { Inspector, type InspectorAction } from "../Inspector";
import { KeyPanel } from "../KeyPanel";
import { LogPanel } from "../LogPanel";
import { NeedsYouList } from "../NeedsYouList";
import { SoundPanel } from "../SoundPanel";
import { WorldCanvas } from "../WorldCanvas";
import { WorldPicker } from "../WorldPicker";

export type AtlasMode = "compact" | "full";

const darkQuery = "(prefers-color-scheme: dark)";

/** Whether the device is in dark mode, kept current as it changes. */
function useDeviceIsDark(): boolean {
  const [dark, setDark] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia?.(darkQuery).matches ?? false),
  );
  useEffect(() => {
    const query = window.matchMedia?.(darkQuery);
    if (!query) return;
    const update = () => setDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return dark;
}

export interface AtlasShellProps {
  /** The agents, clients and work to draw. */
  dataset: Dataset;
  /** Events to replay on a loop, for stories and demonstrations. */
  script?: ScriptStep[];
  /** Seconds between scripted events. */
  interval?: number;
  /** The world to open in. Otherwise the remembered one, or Astronomer. */
  initialWorld?: WorldId;
  /** Compact, the sidebar pane, unless the page opens straight to full. */
  initialMode?: AtlasMode;
  /**
   * Day, night, or follow the device. Automatic by default, so Atlas goes
   * dark when the Mac or the iPhone does.
   */
  initialLighting?: LightingPreference;
  /** Opens the inspector on this record at start, for stories and deep links. */
  initialSelection?: string;
  /** Remember the chosen world, lighting and sound settings in this browser. */
  remember?: boolean;
  /** An inspector action. The app sends it to the agent; stories show a toast. */
  onAction?(action: InspectorAction, id: string): void;
  /** Called for every event the view applies. */
  onEvent?(event: AtlasEvent): void;
  /**
   * Connects the view to a live source of events, such as the server's
   * stream. It is given the function that applies an event, and returns the
   * function that disconnects.
   */
  subscribe?(fire: (event: AtlasEvent) => void): () => void;
}

type Popover = "world" | "key" | "sound" | null;

const storageKey = "atlas.preferences";

interface Preferences {
  world?: WorldId;
  lighting?: LightingPreference;
  sound?: Pick<SoundSettings, "volume" | "categories">;
}

/**
 * What this browser remembered, keeping only fields of the right shape.
 * Storage is outside the app's control, so nothing read from it is trusted:
 * a stray or edited value is dropped rather than spread into state.
 */
function readPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const stored: unknown = raw ? JSON.parse(raw) : {};
    if (typeof stored !== "object" || stored === null) return {};
    const { world, lighting, sound } = stored as Record<string, unknown>;
    const preferences: Preferences = {};
    if (isWorldId(world)) preferences.world = world;
    if (lightingPreferences.includes(lighting as LightingPreference))
      preferences.lighting = lighting as LightingPreference;
    if (typeof sound === "object" && sound !== null) {
      const { volume, categories } = sound as Record<string, unknown>;
      const known = defaultSoundSettings.categories;
      if (
        typeof volume === "number" &&
        volume >= 0 &&
        volume <= 1 &&
        typeof categories === "object" &&
        categories !== null &&
        Object.keys(known).every(
          (key) =>
            typeof (categories as Record<string, unknown>)[key] === "boolean",
        )
      ) {
        preferences.sound = {
          volume,
          categories: Object.fromEntries(
            Object.keys(known).map((key) => [
              key,
              (categories as Record<string, boolean>)[key],
            ]),
          ) as SoundSettings["categories"],
        };
      }
    }
    return preferences;
  } catch {
    return {};
  }
}

function writePreferences(preferences: Preferences) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // Private windows and blocked storage: the view works without it.
  }
}

const actionToast: Record<InspectorAction, string> = {
  "open-session": "Opening the session",
  "ask-status": "Asked for a status update",
  pause: "Paused",
  answer: "Answer recorded as a decision",
  dispatch: "Dispatched to an agent",
  "open-record": "Opened the record",
};

export function AtlasShell(props: AtlasShellProps) {
  const remembered = props.remember ? readPreferences() : {};
  const [worldId, setWorldId] = useState<WorldId>(
    props.initialWorld ??
      (isWorldId(remembered.world) ? remembered.world : "astronomer"),
  );
  const [mode, setMode] = useState<AtlasMode>(props.initialMode ?? "compact");
  const [lightingPreference, setLightingPreference] =
    useState<LightingPreference>(
      props.initialLighting ??
        (lightingPreferences.includes(remembered.lighting as LightingPreference)
          ? (remembered.lighting as LightingPreference)
          : "automatic"),
    );
  const deviceIsDark = useDeviceIsDark();
  const lighting = resolveLighting(lightingPreference, deviceIsDark);
  const [selected, setSelected] = useState<string | null>(
    props.initialSelection ?? null,
  );
  const [zoom, setZoom] = useState<{
    clientId: string;
    request: number;
  } | null>(null);
  const [focus, setFocus] = useState<string | null>(
    props.initialSelection ?? null,
  );
  const [popover, setPopover] = useState<Popover>(null);
  const [sound, setSound] = useState<SoundSettings>({
    ...defaultSoundSettings,
    ...remembered.sound,
    enabled: false,
  });
  const [camera, setCamera] = useState<Camera | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const world = worlds[worldId];

  /**
   * The corner readout and the log, measured against the map. Both keep a
   * fixed height, so the map fitted around them stays clear as events
   * arrive.
   */
  const floatingPanels = (): Bounds[] => {
    const shell = shellRef.current;
    const canvas = shell?.querySelector("canvas");
    if (!shell || !canvas) return [];
    const origin = canvas.getBoundingClientRect();
    return [...shell.querySelectorAll(".atlas-hud, .atlas-log-panel")].map(
      (panel) => {
        const box = panel.getBoundingClientRect();
        return {
          left: box.left - origin.left,
          top: box.top - origin.top,
          right: box.right - origin.left,
          bottom: box.bottom - origin.top,
        };
      },
    );
  };

  const map = useAtlasMap({
    dataset: props.dataset,
    world,
    sound,
    ...(props.script ? { script: props.script } : {}),
    ...(props.interval ? { interval: props.interval } : {}),
  });

  useEffect(() => {
    if (props.remember)
      writePreferences({
        world: worldId,
        lighting: lightingPreference,
        sound: { volume: sound.volume, categories: sound.categories },
      });
  }, [
    props.remember,
    worldId,
    lightingPreference,
    sound.volume,
    sound.categories,
  ]);

  const { subscribe } = props;
  const { fire } = map;
  useEffect(() => subscribe?.(fire), [subscribe, fire]);

  const reported = useRef(0);
  const { onEvent } = props;
  useEffect(() => {
    const latest = map.log[0];
    if (!latest || latest.id === reported.current) return;
    reported.current = latest.id;
    onEvent?.(latest.event);
  }, [map.log, onEvent]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (popover) setPopover(null);
      else if (selected) setSelected(null);
      else if (mode === "full") setMode("compact");
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [popover, selected, mode]);

  const open = (id: string) => {
    setMode("full");
    setSelected(id);
    setFocus(null);
    window.setTimeout(() => setFocus(id), 20);
  };
  const action = (kind: InspectorAction, id: string) => {
    if (kind === "answer") {
      const question = map.dataset.questions.find(
        (candidate) => candidate.id === id,
      );
      if (question) {
        map.fire({
          type: "question-answered",
          questionId: id,
          answer: "Answered in Atlas",
          decision: {
            id: `answered-${id}`,
            clientId: question.clientId,
            title: question.title.replace(/\?$/, ""),
            decides: question.blocks,
            state: "made",
            classification: question.classification,
            boundary: question.boundary,
          },
        });
        setSelected(null);
      }
    }
    setToast(actionToast[kind]);
    props.onAction?.(kind, id);
  };
  const toggle = (which: Exclude<Popover, null>) =>
    setPopover((current) => (current === which ? null : which));
  const viewport = {
    width: shellRef.current?.clientWidth ?? 0,
    height: shellRef.current?.clientHeight ?? 0,
  };
  const label = `${world.name} map: ${map.dataset.clients.length - 1} ${world.vocabulary.clients} around ${world.vocabulary.homeName}, ${map.dataset.agents.length} ${world.vocabulary.agents}.`;

  return (
    <div
      className="atlas"
      data-world={worldId}
      data-mode={mode}
      data-lighting={lighting}
      style={worldStyle(world, lighting)}
      ref={shellRef}
    >
      <header className="atlas-bar">
        <p className="atlas-brand">
          Atlas <span>{world.name}</span>
        </p>
        <button
          type="button"
          className="atlas-icon-button"
          aria-label="Choose a world"
          aria-expanded={popover === "world"}
          onClick={() => toggle("world")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
          </svg>
        </button>
        <button
          type="button"
          className="atlas-icon-button"
          aria-label="Key"
          aria-expanded={popover === "key"}
          onClick={() => toggle("key")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </button>
        <button
          type="button"
          className="atlas-icon-button"
          aria-label="Sound"
          aria-expanded={popover === "sound"}
          aria-pressed={sound.enabled}
          onClick={() => toggle("sound")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {sound.enabled && <path d="M17 9c1.5 1.5 1.5 4.5 0 6" />}
          </svg>
        </button>
        <button
          type="button"
          className="atlas-icon-button atlas-expand"
          onClick={() => setMode(mode === "full" ? "compact" : "full")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d={
                mode === "full"
                  ? "M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"
                  : "M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"
              }
            />
          </svg>
          {mode === "full" ? "Collapse" : "Expand"}
        </button>
      </header>

      <WorldCanvas
        scene={map.scene}
        world={world}
        detail={mode}
        lighting={lighting}
        selectedId={selected}
        focusId={focus}
        label={label}
        panels={floatingPanels}
        onCameraChange={setCamera}
        zoomClientId={zoom?.clientId ?? null}
        zoomRequest={zoom?.request ?? 0}
        onOpenSystem={(clientId) => {
          setMode("full");
          setZoom({ clientId, request: Date.now() });
        }}
        onSelect={(id) => {
          if (mode === "compact") {
            if (id) open(id);
            else setMode("full");
          } else {
            setSelected(id);
            setPopover(null);
          }
        }}
      />

      {mode === "compact" ? (
        <div className="atlas-compact">
          <NeedsYouList dataset={map.dataset} world={world} onSelect={open} />
          <LogPanel entries={map.log} world={world} variant="preview" />
          <button
            type="button"
            className="atlas-button atlas-open-full"
            onClick={() => setMode("full")}
          >
            Open the full {world.name} view
          </button>
        </div>
      ) : (
        <>
          {!selected && (
            <HudReadout
              world={world}
              dataset={map.dataset}
              camera={camera}
              viewport={viewport}
            />
          )}
          <LogPanel entries={map.log} world={world} variant="panel" />
          {selected && (
            <Inspector
              dataset={map.dataset}
              world={world}
              id={selected}
              onClose={() => setSelected(null)}
              onSelect={open}
              onAction={action}
            />
          )}
        </>
      )}

      {popover && (
        <div className="atlas-popover">
          {popover === "world" && (
            <WorldPicker
              current={worldId}
              lighting={lightingPreference}
              onLightingChange={setLightingPreference}
              onChange={(id) => {
                setWorldId(id);
                setPopover(null);
                setToast(`${worlds[id].name} world`);
              }}
            />
          )}
          {popover === "key" && <KeyPanel world={world} />}
          {popover === "sound" && (
            <SoundPanel
              settings={sound}
              onChange={setSound}
              onPreview={(cue) => {
                // Previewing is a click, which is what a browser needs before
                // it plays sound, so it also turns sound on.
                setSound({ ...sound, enabled: true });
                map.preview(cue);
              }}
            />
          )}
        </div>
      )}
      <p className="atlas-toast" role="status" data-visible={toast !== null}>
        {toast}
      </p>
    </div>
  );
}
