import type { Palette, Typefaces } from "../types";

/** An engraved chart: brown and blue ink on paper. Status inks are the same hues, deepened for paper. */
export const marinerPalette: Palette = {
  ground: "#f1e8d2",
  darkGround: false,
  ink: "#2a2116",
  mute: "#6b5b44",
  accent: "#1f4f7a",
  panel: "rgba(246, 239, 222, 0.96)",
  line: "rgba(60, 48, 30, 0.32)",
  status: {
    running: "#2a6f33",
    watching: "#1f5fa0",
    waiting: "#8f5500",
    blocked: "#b3261e",
    error: "#b3261e",
    idle: "#6e6453",
  },
};

export const marinerTypefaces: Typefaces = {
  display: '"IM Fell English SC", "Iowan Old Style", Georgia, serif',
  body: '"EB Garamond", "Iowan Old Style", Georgia, serif',
  mono: '"IM Fell English", "Iowan Old Style", Georgia, serif',
};
