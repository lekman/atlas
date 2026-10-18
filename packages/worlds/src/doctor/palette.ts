import type { Palette, Typefaces } from "../types";

/**
 * A town plan at night: deep navy ground, graphite streets, and a soft
 * violet for the hospitals and the world's own marks. Violet sits well clear
 * of every status hue, so a hospital outline, a helipad light or an
 * ambulance's light bar never reads as a status. Everything else (windows,
 * street lights, road markings) is a dim warm white.
 */
export const doctorPalette: Palette = {
  ground: "#0b1120",
  darkGround: true,
  ink: "#e7ecf7",
  mute: "#95a3bd",
  accent: "#cfa3ff",
  panel: "rgba(14, 21, 38, 0.94)",
  line: "rgba(207, 163, 255, 0.24)",
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
  /** The accent as `r,g,b`, for `rgba()`. */
  accent: "207,163,255",
  /** Warm white, for lit windows, street lights and road markings. */
  warm: "255,238,212",
  street: "#151c2a",
  mainRoad: "#2a3550",
  kerb: "#0e1524",
  building: "#131b2c",
  buildingEdge: "#1b2438",
  park: "#0d1918",
  tree: "#132423",
  river: "#0a1729",
  riverEdge: "#1a2c47",
  /** Hospital grounds, a step lighter than the town's blocks. */
  grounds: "#0f1729",
  roof: "#1d2740",
  floor: "#232f4b",
  helipad: "#141c2f",
  /** Pending test results: a pale lilac, kept clear of every status hue. */
  sample: "#dccbff",
  /** Charts, beds and paper. */
  paper: "#e6ebf5",
  /** The Practice's sign: a deep blue plate with white letters. */
  signPlate: "#1d3a7a",
} as const;

/**
 * Atkinson Hyperlegible was drawn for readers with low vision: clear, calm
 * letterforms that suit wayfinding signs read at a glance.
 */
export const doctorTypefaces: Typefaces = {
  display:
    '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif',
  body: '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif',
  mono: '"Atkinson Hyperlegible Mono", ui-monospace, "SF Mono", Menlo, monospace',
};
