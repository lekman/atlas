/**
 * The whole Atlas view. Compact by default: a sidebar-width pane with a small
 * live map, the needs-you list and the latest log lines. Expand fills the
 * screen with the full map, the log in a column down the left and the HUD
 * down the right. One record is selected at a time: the HUD holds it with
 * its buttons, the map flies to it, the log narrows to it, and Details
 * opens a pane with everything known about it. On a phone, where the HUD
 * has no room, the selected record is a sheet along the bottom and the log
 * a short box.
 *
 * The same component serves Storybook, the web app and the Claude Artifact;
 * only where its data comes from differs.
 */
import {
  findRecord,
  type AtlasEvent,
  type Dataset,
  type DetailsDocument,
  type ItemLogEntry,
} from "@atlas/core";
import {
  createAmbiencePlayer,
  defaultSoundSettings,
  isBackgroundChoice,
  isWorldId,
  lightingPreferences,
  resolveLighting,
  worldIds,
  worlds,
  type AmbiencePlayer,
  type Bounds,
  type Camera,
  type LightingPreference,
  type SoundSettings,
  type World,
  type WorldId,
} from "@atlas/worlds";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  recordedEntries,
  recordLogLines,
  type RecordedEvent,
} from "../../recordLog";
import { worldStyle } from "../../theme";
import { useAtlasMap, type ScriptStep } from "../../useAtlasMap";
import { DetailsPane } from "../DetailsPane";
import { HudReadout } from "../HudReadout";
import { Inspector, type InspectorAction } from "../Inspector";
import { KeyPanel } from "../KeyPanel";
import { LogPanel, type LogSubject } from "../LogPanel";
import { NeedsYouList } from "../NeedsYouList";
import { SoundPanel } from "../SoundPanel";
import { WorldCanvas } from "../WorldCanvas";
import { WorldPicker } from "../WorldPicker";

export type AtlasMode = "compact" | "full";

const darkQuery = "(prefers-color-scheme: dark)";
/** The width below which the HUD is hidden, matching the stylesheet. */
const phoneQuery = "(max-width: 760px)";

/** Whether a media query matches, kept current as it changes. */
function useMediaQuery(media: string): boolean {
  const [matches, setMatches] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia?.(media).matches ?? false),
  );
  useEffect(() => {
    const query = window.matchMedia?.(media);
    if (!query) return;
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [media]);
  return matches;
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
  /**
   * The worlds this view offers, for an app that shows only some of them.
   * Every world when left out. A remembered or initial world outside the
   * list falls back to the first in it.
   */
  worlds?: readonly WorldId[];
  /** Compact, the sidebar pane, unless the page opens straight to full. */
  initialMode?: AtlasMode;
  /**
   * Day, night, or follow the device. Automatic by default, so Atlas goes
   * dark when the Mac or the iPhone does.
   */
  initialLighting?: LightingPreference;
  /** Selects this record at start, for stories and deep links. */
  initialSelection?: string;
  /**
   * Details documents imported for the records. A record whose `detailsId`
   * names one shows it in the details pane.
   */
  documents?: readonly DetailsDocument[];
  /** The day the view is read on, to say how fresh a document is. Today by default. */
  today?: string;
  /** Open in Obsidian was pressed on a details document, with its path in the vault. */
  onOpenInObsidian?(sourcePath: string): void;
  /** Opens the full view zoomed in to this client, for stories and deep links. */
  initialClient?: string;
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
  /**
   * Events the server logged before this view opened, so the log is full
   * from the start. Newest or oldest first; the log sorts them.
   */
  pastEvents?: readonly RecordedEvent[];
  /**
   * Reads a backlog item's log from the task database, newest first. Called
   * when an item is selected, and again when the dataset is replaced, as
   * after the task database changed. Stories pass invented entries.
   */
  loadItemLog?(itemId: string): Promise<readonly ItemLogEntry[]>;
  /**
   * The buttons in the bar, for an app that offers only some. Every button
   * when left out. Without "expand", Escape no longer collapses the view.
   */
  controls?: readonly AtlasControl[];
}

type Popover = "world" | "key" | "settings" | null;

/** The buttons the bar can show, top right. */
export type AtlasControl = "world" | "key" | "sound" | "expand" | "settings";
const allControls: readonly AtlasControl[] = [
  "world",
  "key",
  "sound",
  "expand",
  "settings",
];

const storageKey = "atlas.preferences";

interface Preferences {
  world?: WorldId;
  lighting?: LightingPreference;
  sound?: Pick<SoundSettings, "volume" | "categories"> &
    Partial<Pick<SoundSettings, "enabled" | "background" | "backgroundVolume">>;
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
      const { volume, categories, enabled, background, backgroundVolume } =
        sound as Record<string, unknown>;
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
          ...(typeof enabled === "boolean" ? { enabled } : {}),
          ...(isBackgroundChoice(background) ? { background } : {}),
          ...(typeof backgroundVolume === "number" &&
          backgroundVolume >= 0 &&
          backgroundVolume <= 1
            ? { backgroundVolume }
            : {}),
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

const viewKey = "atlas.view";

/** What the reader is looking at, kept for this tab so a reload comes back to it. */
interface SavedView {
  selected?: string;
  detailsOpen?: boolean;
  /** The map point in the middle of the canvas, and the scale. */
  view?: { x: number; y: number; scale: number };
}

/** The view this tab saved, keeping only fields of the right shape. */
function readView(): SavedView {
  try {
    const stored: unknown = JSON.parse(
      window.sessionStorage.getItem(viewKey) ?? "{}",
    );
    if (typeof stored !== "object" || stored === null) return {};
    const { selected, detailsOpen, view } = stored as Record<string, unknown>;
    const saved: SavedView = {};
    if (typeof selected === "string" && selected.length <= 200)
      saved.selected = selected;
    if (detailsOpen === true) saved.detailsOpen = true;
    if (typeof view === "object" && view !== null) {
      const { x, y, scale } = view as Record<string, unknown>;
      if (
        [x, y, scale].every((value) => Number.isFinite(value)) &&
        (scale as number) > 0
      )
        saved.view = { x: x as number, y: y as number, scale: scale as number };
    }
    return saved;
  } catch {
    return {};
  }
}

function writeView(view: SavedView) {
  try {
    window.sessionStorage.setItem(viewKey, JSON.stringify(view));
  } catch {
    // Blocked storage: the view simply starts fresh after a reload.
  }
}

function writePreferences(preferences: Preferences) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // Private windows and blocked storage: the view works without it.
  }
}

/** The world's term for a kind of record, with the real one beside it. */
function kindLabel(world: World, kind: string): string {
  const terms: Record<string, [string, string]> = {
    agent: [world.vocabulary.agent, "agent"],
    item: [world.vocabulary.item, "backlog item"],
    question: [world.vocabulary.question, "open question"],
    decision: [world.vocabulary.decision, "decision"],
    requirement: [world.vocabulary.requirement, "requirement"],
    workstream: [world.vocabulary.workstream, "workstream"],
  };
  const [themed, real] = terms[kind] ?? [kind, kind];
  return themed.toLowerCase() === real ? real : `${themed} · ${real}`;
}

const actionToast: Record<Exclude<InspectorAction, "details">, string> = {
  "open-session": "Opening the session",
  "ask-status": "Asked for a status update",
  pause: "Paused",
  answer: "Answer recorded as a decision",
  dispatch: "Dispatched to an agent",
  "open-record": "Opened the record",
};

export function AtlasShell(props: AtlasShellProps) {
  const remembered = props.remember ? readPreferences() : {};
  const offered = props.worlds ?? worldIds;
  const isOffered = (id: unknown): id is WorldId =>
    isWorldId(id) && offered.includes(id);
  const [worldId, setWorldId] = useState<WorldId>(() => {
    if (isOffered(props.initialWorld)) return props.initialWorld;
    if (isOffered(remembered.world)) return remembered.world;
    return isOffered("astronomer")
      ? "astronomer"
      : (offered[0] ?? "astronomer");
  });
  const [mode, setMode] = useState<AtlasMode>(props.initialMode ?? "compact");
  const [lightingPreference, setLightingPreference] =
    useState<LightingPreference>(
      props.initialLighting ??
        (lightingPreferences.includes(remembered.lighting as LightingPreference)
          ? (remembered.lighting as LightingPreference)
          : "automatic"),
    );
  const deviceIsDark = useMediaQuery(darkQuery);
  const lighting = resolveLighting(lightingPreference, deviceIsDark);
  const isPhone = useMediaQuery(phoneQuery);
  // The one selected record. Collapse keeps it, so Expand comes back to it.
  // A reload, such as the one after a deploy, comes back to the same view:
  // the selection, the open details and where the map was looking.
  const [saved] = useState<SavedView>(() => (props.remember ? readView() : {}));
  const [selected, setSelected] = useState<string | null>(
    props.initialSelection ?? saved.selected ?? null,
  );
  const [detailsOpen, setDetailsOpen] = useState(
    !props.initialSelection && saved.detailsOpen === true && !!saved.selected,
  );
  const deselect = () => {
    setSelected(null);
    setDetailsOpen(false);
  };
  const [zoom, setZoom] = useState<{
    clientId: string;
    request: number;
  } | null>(
    props.initialClient ? { clientId: props.initialClient, request: 0 } : null,
  );
  const [focus, setFocus] = useState<string | null>(
    props.initialSelection ?? null,
  );
  const [popover, setPopover] = useState<Popover>(null);
  const shownControls = props.controls ?? allControls;
  const offers = (control: AtlasControl) => shownControls.includes(control);
  const [sound, setSound] = useState<SoundSettings>({
    ...defaultSoundSettings,
    ...remembered.sound,
    // A remembered "on" stays on. The browser still holds audio back until
    // the first click or tap, and the player resumes then.
    enabled: remembered.sound?.enabled ?? false,
  });
  const [camera, setCamera] = useState<Camera | null>(null);
  useEffect(() => {
    if (!props.remember) return;
    const shell = shellRef.current;
    const view =
      camera && shell && shell.clientWidth > 0
        ? {
            x: (shell.clientWidth / 2 - camera.x) / camera.scale,
            y: (shell.clientHeight / 2 - camera.y) / camera.scale,
            scale: camera.scale,
          }
        : saved.view;
    writeView({
      ...(selected ? { selected } : {}),
      ...(selected && detailsOpen ? { detailsOpen: true } : {}),
      ...(view ? { view } : {}),
    });
  }, [props.remember, selected, detailsOpen, camera, saved.view]);
  const [toast, setToast] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const world = worlds[worldId];

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
        sound: {
          enabled: sound.enabled,
          volume: sound.volume,
          categories: sound.categories,
          background: sound.background,
          backgroundVolume: sound.backgroundVolume,
        },
      });
  }, [
    props.remember,
    worldId,
    lightingPreference,
    sound.enabled,
    sound.volume,
    sound.categories,
    sound.background,
    sound.backgroundVolume,
  ]);

  // The background plays while sound is on and a background is chosen. A
  // browser holds audio back until the first click or tap after a load, so
  // the first gesture asks again.
  const ambience = useRef<AmbiencePlayer | null>(null);
  useEffect(() => {
    ambience.current ??= createAmbiencePlayer();
    const player = ambience.current;
    const apply = () =>
      sound.enabled && sound.background !== "off"
        ? player.play(sound.background, sound.backgroundVolume)
        : player.stop();
    apply();
    window.addEventListener("pointerdown", apply, { once: true });
    window.addEventListener("keydown", apply, { once: true });
    return () => {
      window.removeEventListener("pointerdown", apply);
      window.removeEventListener("keydown", apply);
    };
  }, [sound.enabled, sound.background, sound.backgroundVolume]);
  useEffect(() => () => ambience.current?.stop(), []);

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

  // Escape steps back one layer at a time: a popover, then the details
  // pane, then the selection, then the full view.
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (popover) setPopover(null);
      else if (mode === "full" && selected && detailsOpen)
        setDetailsOpen(false);
      else if (mode === "full" && selected) deselect();
      else if (mode === "full" && offers("expand")) setMode("compact");
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [popover, selected, detailsOpen, mode]);

  /** Select a record, from the map, a list or a link, and fly to it. */
  const select = (id: string) => {
    setMode("full");
    setSelected(id);
    setFocus(null);
    window.setTimeout(() => setFocus(id), 20);
  };
  /** A question is flown to with the work it holds up, so both are in view. */
  const focusWith = (() => {
    const question = map.dataset.questions.find(
      (candidate) => candidate.id === focus,
    );
    return question ? [question.blocks] : [];
  })();
  /**
   * The map left clear between the top bar, the log column and the HUD, or
   * above the sheet and the short log on a phone. A record flown to lands
   * in its middle.
   */
  const focusArea = (): Bounds | null => {
    const shell = shellRef.current;
    const canvas = shell?.querySelector("canvas");
    if (!shell || !canvas) return null;
    const origin = canvas.getBoundingClientRect();
    const box = (selector: string) =>
      shell.querySelector(selector)?.getBoundingClientRect() ?? null;
    const bar = box(".atlas-bar");
    const hud = box(".atlas-hud");
    const log = box(".atlas-log-panel");
    const gap = 12;
    // The log is a column beside the map, except on a phone, where it is a
    // short box below it.
    const logBeside = !isPhone && log !== null;
    const below = box(".atlas-sheet") ?? (logBeside ? null : log);
    return {
      left: (logBeside ? log.right + gap : origin.left) - origin.left,
      top: (bar ? bar.bottom : origin.top) - origin.top,
      right: (hud ? hud.left - gap : origin.right) - origin.left,
      bottom: (below ? below.top - gap : origin.bottom) - origin.top,
    };
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
        deselect();
      }
    }
    if (kind === "details") {
      setDetailsOpen(true);
      return;
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
  const inspector = selected ? (
    <Inspector
      dataset={map.dataset}
      world={world}
      id={selected}
      variant="embedded"
      onClose={deselect}
      onSelect={select}
      onAction={action}
    />
  ) : null;
  const detailsDocument = (() => {
    const item = map.dataset.items.find(
      (candidate) => candidate.id === selected,
    );
    return item?.detailsId
      ? props.documents?.find((candidate) => candidate.id === item.detailsId)
      : undefined;
  })();
  const detailsPane =
    selected && detailsOpen ? (
      <DetailsPane
        dataset={map.dataset}
        world={world}
        id={selected}
        {...(detailsDocument ? { document: detailsDocument } : {})}
        today={props.today ?? new Date().toISOString().slice(0, 10)}
        onClose={() => setDetailsOpen(false)}
        onSelect={select}
        onOpenInObsidian={(path) => props.onOpenInObsidian?.(path)}
      />
    ) : null;
  // The log: every event this view has, live and from before it opened,
  // and with a record selected on the full map, that record's log.
  const { dataset: givenDataset, pastEvents, loadItemLog } = props;
  const recorded = useMemo(
    () => recordedEntries(givenDataset, pastEvents ?? []),
    [givenDataset, pastEvents],
  );
  const logEntries = useMemo(
    () => [...map.log, ...recorded],
    [map.log, recorded],
  );
  const selectedRecord = selected ? findRecord(map.dataset, selected) : null;
  const selectedItemId =
    selectedRecord?.kind === "item" ? selectedRecord.record.id : null;
  const [itemLog, setItemLog] = useState<{
    id: string;
    entries: readonly ItemLogEntry[];
  } | null>(null);
  // Read when an item is selected, and again when the dataset is replaced.
  // A failed read keeps what was shown for the same item.
  useEffect(() => {
    if (!selectedItemId || !loadItemLog) return;
    let current = true;
    loadItemLog(selectedItemId)
      .then((entries) => {
        if (current) setItemLog({ id: selectedItemId, entries });
      })
      .catch(() => {
        if (current)
          setItemLog((shown) =>
            shown?.id === selectedItemId
              ? shown
              : { id: selectedItemId, entries: [] },
          );
      });
    return () => {
      current = false;
    };
  }, [selectedItemId, loadItemLog, givenDataset]);
  const [showingAllEvents, setShowingAllEvents] = useState(false);
  useEffect(() => setShowingAllEvents(false), [selected]);
  const logSubject: LogSubject | null =
    selectedRecord && !isPhone
      ? {
          name:
            "title" in selectedRecord.record
              ? selectedRecord.record.title
              : selectedRecord.record.name,
          kind: kindLabel(world, selectedRecord.kind),
          lines: recordLogLines({
            world,
            dataset: map.dataset,
            recordId: selectedRecord.record.id,
            entries: logEntries,
            ...(itemLog && itemLog.id === selectedItemId
              ? { itemLog: itemLog.entries }
              : {}),
          }),
        }
      : null;

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
        {offers("world") && (
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
        )}
        {offers("key") && (
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
        )}
        {offers("sound") && (
          <button
            type="button"
            className="atlas-icon-button"
            aria-label="Sound"
            aria-pressed={sound.enabled}
            title={sound.enabled ? "Turn sound off" : "Turn sound on"}
            onClick={() => {
              setSound({ ...sound, enabled: !sound.enabled });
              setToast(sound.enabled ? "Sound off" : "Sound on");
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9h4l5-4v14l-5-4H4z" />
              {sound.enabled ? (
                <path d="M17 9c1.5 1.5 1.5 4.5 0 6" />
              ) : (
                <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
              )}
            </svg>
          </button>
        )}
        {offers("expand") && (
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
        )}
        {offers("settings") && (
          <button
            type="button"
            className="atlas-icon-button"
            aria-label="Settings"
            aria-expanded={popover === "settings"}
            onClick={() => toggle("settings")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
            </svg>
          </button>
        )}
      </header>

      <WorldCanvas
        initialView={saved.view ?? null}
        scene={map.scene}
        world={world}
        detail={mode}
        lighting={lighting}
        selectedId={selected}
        focusId={focus}
        focusWith={focusWith}
        focusArea={focusArea}
        label={label}
        onCameraChange={setCamera}
        zoomClientId={zoom?.clientId ?? null}
        zoomRequest={zoom?.request ?? 0}
        onOpenSystem={(clientId) => {
          setMode("full");
          setZoom({ clientId, request: Date.now() });
        }}
        onSelect={(id) => {
          if (mode === "compact") {
            if (id) select(id);
            else setMode("full");
          } else {
            if (id) select(id);
            setPopover(null);
          }
        }}
      />

      {mode === "compact" ? (
        <div className="atlas-compact">
          <NeedsYouList dataset={map.dataset} world={world} onSelect={select} />
          <LogPanel entries={logEntries} world={world} variant="preview" />
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
          {!isPhone && (
            <HudReadout
              world={world}
              dataset={map.dataset}
              camera={camera}
              viewport={viewport}
              onSelect={select}
              selectedId={selected}
              selected={inspector}
            />
          )}
          <LogPanel
            entries={logEntries}
            world={world}
            variant="panel"
            subject={logSubject}
            showingAllEvents={showingAllEvents}
            onShowAllEventsChange={setShowingAllEvents}
          />
          {isPhone
            ? selected && (
                <div className="atlas-phone-column">
                  {detailsPane}
                  <div className="atlas-sheet">{inspector}</div>
                </div>
              )
            : detailsPane && (
                <div className="atlas-details-layer">{detailsPane}</div>
              )}
        </>
      )}

      {popover && (
        <div className="atlas-popover">
          {popover === "world" && (
            <WorldPicker
              current={worldId}
              {...(props.worlds ? { worlds: props.worlds } : {})}
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
          {popover === "settings" && (
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
