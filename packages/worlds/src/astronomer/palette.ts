import type { Palette, Typefaces } from "../types";

/** A dark tactical display: cyan instruments over deep space, warm stars. */
export const astronomerPalette: Palette = {
  ground: "#04070d",
  darkGround: true,
  ink: "#d7f6ff",
  mute: "#7f9db1",
  accent: "#5edcff",
  panel: "rgba(8, 16, 28, 0.9)",
  line: "rgba(94, 220, 255, 0.24)",
  status: {
    running: "#5dffa0",
    watching: "#59c8ff",
    waiting: "#ffb340",
    blocked: "#ff4f64",
    error: "#ff4f64",
    idle: "#7d8aa3",
  },
};

export const astronomerTypefaces: Typefaces = {
  display:
    '"Chakra Petch", "Avenir Next Condensed", "Arial Narrow", sans-serif',
  body: '"Chakra Petch", "Avenir Next", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
};
