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

/**
 * Ninja, the scroll by moonlight: a deep indigo ground, ink read as pale
 * moonlit silver, and status banners raised in lightness until each reads as
 * text on the dark ground and on the panels. Blocked leans a little to rose
 * (hue 353) so it stays well apart from the seals' vermilion (hue 16).
 */
export const samuraiNightPalette: Palette = {
  ground: "#141824",
  darkGround: true,
  ink: "#ece5d3",
  mute: "#aaa595",
  accent: "#c4a8e0",
  panel: "rgba(30, 35, 50, 0.96)",
  line: "rgba(214, 220, 232, 0.24)",
  status: {
    running: "#6fca82",
    watching: "#78b2ec",
    waiting: "#e3a342",
    blocked: "#f4707f",
    error: "#f4707f",
    idle: "#a7a196",
  },
};

/**
 * The night's decoration. Gold leaf turns to moonlit silver, vermilion is
 * brightened for the dark ground, and lantern light is warm white and pale
 * gold: lighter and far less saturated than the waiting amber, so a lit lamp
 * is never read as a status.
 */
export const samuraiNightDecoration = {
  vermilion: "#ee6e3e",
  silver: "#c3cbd9",
  moon: "#ebe6d6",
  /** Scrolls, flags and white stones, as paper looks by moonlight. */
  paper: "#d9d5c9",
  /** The keep's walls in moonlight, and its stone base in shadow. */
  plaster: "#8c96aa",
  stone: "#3b4255",
  /** Dark garb, roofs and silhouettes: darker than the ground. */
  sumi: "#07080d",
  petal: "#d6c3cb",
  cord: "#3a4a66",
  /** Paper lanterns and lit windows: pale gold, with a warm white flame. */
  lantern: "#f6e6b4",
  flame: "#fffaf0",
} as const;

export const samuraiTypefaces: Typefaces = {
  display:
    '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif',
  body: '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif',
  mono: '"Zen Kaku Gothic New", "Hiragino Sans", "Avenir Next", system-ui, sans-serif',
};
