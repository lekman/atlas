import type { Palette, Typefaces } from "../types";

/**
 * Sumi ink on warm rice paper. Status inks keep the shared hue families,
 * deepened so each reads as text on the paper and on the panels.
 */
export const samuraiPalette: Palette = {
  ground: "#f2ebdb",
  darkGround: false,
  ink: "#1e1b17",
  mute: "#5c5447",
  accent: "#5a3b6c",
  panel: "rgba(249, 245, 236, 0.96)",
  line: "rgba(46, 38, 28, 0.28)",
  status: {
    running: "#2e6a3c",
    watching: "#245c93",
    waiting: "#8a5200",
    blocked: "#a3221d",
    error: "#a3221d",
    idle: "#686156",
  },
};

/**
 * Colours that only decorate. None of them is ever a status: vermilion
 * belongs to seals (decisions), gold leaf to clouds, finials and flecks.
 */
export const samuraiDecoration = {
  /** Vermilion seal paste, more orange than the blocked red. */
  vermilion: "#d0502a",
  gold: "#c09a48",
  paper: "#f8f3e7",
  plaster: "#fbf8f0",
  stone: "#d8cfbd",
  sumi: "#1e1b17",
  petal: "#e7b9bd",
  cord: "#2f3d55",
} as const;

export const samuraiTypefaces: Typefaces = {
  display:
    '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif',
  body: '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif',
  mono: '"Zen Kaku Gothic New", "Hiragino Sans", "Avenir Next", system-ui, sans-serif',
};
