import type {
  Agent,
  AgentStatus,
  BacklogItem,
  Client,
  Decision,
  Question,
  Requirement,
} from "@atlas/core";

import type { Camera, Point } from "./camera";
import type { WorkstreamMarker } from "./layout";
import type { Effect, Motion, Scene } from "./scene";

/** What a world calls each thing. Plural forms are spelled out, never derived. */
export interface Vocabulary {
  /** The proper name of home in this world: Terra, Turtle Bay. */
  homeName: string;
  /** What kind of place home is: "home planet", "home port". */
  home: string;
  client: string;
  clients: string;
  requirement: string;
  /** The marker a client's work is grouped around: buoy, space station. */
  workstream: string;
  item: string;
  agent: string;
  agents: string;
  question: string;
  questions: string;
  decision: string;
  agentMessage: string;
  externalEvent: string;
  log: string;
}

export interface Palette {
  /** The colour the map is drawn on. */
  ground: string;
  /** Whether the ground is dark, for the browser's own controls. */
  darkGround: boolean;
  ink: string;
  mute: string;
  accent: string;
  /** Panels laid over the map, and their edges. */
  panel: string;
  line: string;
  status: Record<AgentStatus, string>;
}

/**
 * Day is a world's own look. Night is its dark mode, where it has one: the
 * same map after dark, with its own palette and its own lit details.
 */
export type Lighting = "day" | "night";

export interface NightMode {
  /** What the world calls its dark mode, shown in the world picker. */
  name: string;
  /** One line on what changes after dark. */
  description: string;
  /** Held to the same hue families and contrast as the day palette. */
  palette: Palette;
}

export interface Typefaces {
  display: string;
  body: string;
  mono: string;
}

export type SoundCategory = "message" | "status" | "external" | "needs";
export type SoundCue = "message" | "status" | "external" | "needs" | "blocked";

/** The few sound shapes a voice is built from. See `sound.ts`. */
export interface Synthesiser {
  tone(
    frequency: number,
    duration: number,
    options?: {
      type?: OscillatorType;
      gain?: number;
      at?: number;
      glideTo?: number;
      lowPass?: number;
    },
  ): void;
  noise(
    duration: number,
    options?: { gain?: number; frequency?: number; q?: number; at?: number },
  ): void;
  bell(frequency: number, options?: { at?: number; gain?: number }): void;
}

export type Voices = Record<SoundCue, (synthesiser: Synthesiser) => void>;

export interface PaintContext {
  context: CanvasRenderingContext2D;
  camera: Camera;
  pixelRatio: number;
  width: number;
  height: number;
  /** `compact` is the sidebar map: names of clients only, no labels on work. */
  detail: "compact" | "full";
  /** Seconds, from a monotonic clock. */
  time: number;
  reducedMotion: boolean;
  /** Day or night. A world without a night mode draws its day at night. */
  lighting: Lighting;
  scene: Scene;
  selectedId: string | null;
}

export interface WorldPainter {
  background(paint: PaintContext): void;
  home(paint: PaintContext, home: Client): void;
  client(paint: PaintContext, client: Client): void;
  requirement(paint: PaintContext, requirement: Requirement): void;
  /**
   * A workstream's marker, its title and the count of items it holds but
   * does not draw. The unsorted marker comes here too, with no workstream id.
   */
  workstream(paint: PaintContext, marker: WorkstreamMarker): void;
  /** The line from a requirement to a backlog item that serves it. */
  link(paint: PaintContext, item: BacklogItem): void;
  item(paint: PaintContext, item: BacklogItem): void;
  /** `fade` runs 1 → 0 once the question is answered. */
  question(paint: PaintContext, question: Question, fade: number): void;
  /** `appear` runs 0 → 1 when a decision is new. */
  decision(paint: PaintContext, decision: Decision, appear: number): void;
  agent(
    paint: PaintContext,
    agent: Agent,
    motion: Motion,
    colour: string,
  ): void;
  /** `progress` runs 0 → 1 over the effect's life. */
  effect(paint: PaintContext, effect: Effect, progress: number): void;
  /** Drawn last, in screen space: frames, neatlines, corner brackets. */
  overlay?(paint: PaintContext): void;
}

/** What a world's log line is built from. Names are already resolved. */
export interface Phrases {
  message(from: string, to: string, text: string): string;
  external(source: string, record: string, text: string): string;
  status(agent: string, was: string, now: string, text: string): string;
  /** `where` is the client's name, or the world's name for home. */
  answered(decision: string, where: string): string;
}

export interface ReadoutInput {
  clients: number;
  agents: number;
  active: number;
  needsYou: number;
  openQuestions: number;
  /** Screen centre in world units, and the zoom. */
  x: number;
  y: number;
  scale: number;
  /** Local time, already formatted. */
  time: string;
}

/** The corner readout over the full map: a few short lines, one marked for attention. */
export interface Readout {
  title?: string;
  lines: string[];
  /** The line about what needs the reader, drawn in the waiting colour. */
  attention: string;
}

/** Shapes for the still SVG map, in world units. Each returns SVG markup. */
export interface StillMap {
  home(centre: Point, homeId: string, lighting?: Lighting): string;
  client(centre: Point, clientId: string, lighting?: Lighting): string;
  /** Where a client's name sits relative to its centre. */
  labelOffset: number;
}

export interface World {
  /** Lower-case, one word: the key in the registry and in the URL. */
  id: string;
  name: string;
  description: string;
  vocabulary: Vocabulary;
  statusNames: Record<AgentStatus, string>;
  /** The day palette; also the only one when the world has no night. */
  palette: Palette;
  /**
   * The world's dark mode. Absent when the world has none yet, or when its
   * day is already dark, as Astronomer's is.
   */
  night?: NightMode;
  typefaces: Typefaces;
  painter: WorldPainter;
  voices: Voices;
  phrases: Phrases;
  readout(input: ReadoutInput): Readout;
  stillMap: StillMap;
}

export interface PlannedWorld {
  id: string;
  name: string;
  description: string;
  homeName: string;
}
