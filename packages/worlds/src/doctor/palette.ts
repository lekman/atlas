import type { Palette, Typefaces } from "../types";

/**
 * Monitor glass: a deep blue-green ground with a pale aqua instrument
 * colour. Decoration (walls, traces, the grid) stays in that aqua and dim,
 * so the green of "on rounds" is the only bright green on the floor.
 */
export const doctorPalette: Palette = {
  ground: "#07171b",
  darkGround: true,
  ink: "#dcefed",
  mute: "#88a9a7",
  accent: "#7ad6cf",
  panel: "rgba(12, 32, 37, 0.94)",
  line: "rgba(122, 214, 207, 0.24)",
  status: {
    running: "#72e27e",
    watching: "#62b5ff",
    waiting: "#ffb547",
    blocked: "#ff6070",
    error: "#ff6070",
    idle: "#94a1a7",
  },
};

/** Colours the painter uses beyond the shared palette. None is a status hue. */
export const doctorShades = {
  /** The aqua of walls, traces and the grid, as `r,g,b` for `rgba()`. */
  instrument: "122,214,207",
  /** Room floors, a step lighter than the ground. */
  floor: "#0b2126",
  corridor: "#0d262b",
  /** Pending lab results: a soft lilac, kept clear of every status hue. */
  sample: "#cdb8f2",
  /** Charts and paper. */
  paper: "#e4f1ef",
} as const;

/**
 * Atkinson Hyperlegible was drawn for readers with low vision: clear,
 * calm letterforms that suit a board read at a glance across a room.
 */
export const doctorTypefaces: Typefaces = {
  display:
    '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif',
  body: '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif',
  mono: '"Atkinson Hyperlegible Mono", ui-monospace, "SF Mono", Menlo, monospace',
};
