import type {
  Agent,
  AgentStatus,
  BacklogItem,
  Client,
  Decision,
  Question,
  Requirement,
} from "@atlas/core";

import type { Camera } from "./camera";
import type { Effect, Motion, Scene } from "./scene";

export type WorldId = "astronomer" | "mariner";

/** What a world calls each thing. Plural forms are spelled out, never derived. */
export interface Vocabulary {
  /** The proper name of home in this world: Terra, Turtle Bay. */
  homeName: string;
  /** What kind of place home is: "home planet", "home port". */
  home: string;
  client: string;
  clients: string;
  requirement: string;
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
  scene: Scene;
  selectedId: string | null;
}

export interface WorldPainter {
  background(paint: PaintContext): void;
  home(paint: PaintContext, home: Client): void;
  client(paint: PaintContext, client: Client): void;
  requirement(paint: PaintContext, requirement: Requirement): void;
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

export interface World {
  id: WorldId;
  name: string;
  description: string;
  vocabulary: Vocabulary;
  statusNames: Record<AgentStatus, string>;
  palette: Palette;
  typefaces: Typefaces;
  painter: WorldPainter;
  voices: Voices;
}

export interface PlannedWorld {
  id: string;
  name: string;
  description: string;
  homeName: string;
}
