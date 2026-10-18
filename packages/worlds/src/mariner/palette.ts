import type { Lighting, Palette, Typefaces } from "../types";

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

/**
 * Night watch: the same chart on deep navy, engraved in pale ink. Status
 * inks keep their hue families and are raised in lightness until they read
 * on the dark ground and on a panel. The lowest is blocked: 7.17 : 1 on
 * the ground, 6.61 : 1 on a panel.
 */
export const marinerNightPalette: Palette = {
  ground: "#0d1a2b",
  darkGround: true,
  ink: "#e9e3d3",
  mute: "#9eaebf",
  accent: "#8bbbe0",
  panel: "rgba(18, 34, 54, 0.95)",
  line: "rgba(160, 190, 220, 0.3)",
  status: {
    running: "#72c27c",
    watching: "#6fb0ec",
    waiting: "#eda24a",
    blocked: "#ff8076",
    error: "#ff8076",
    idle: "#a7a9a6",
  },
};

/**
 * The chart's own inks, apart from the palette: land, water, engraving and
 * the small pictures. They never carry meaning on their own. Night lights
 * are warm white and pale gold, never the amber of waiting.
 */
export interface MarinerInks {
  /** Light at the screen centre, shadow at the edges, over the ground. */
  vignette: [string, string];
  rhumb: string;
  soundings: string;
  shallows: string;
  /** The red, green and blue of each contour line: alpha is added per ring. */
  contour: string;
  contourAlpha: number;
  land: string;
  coast: string;
  coastInner: string;
  hachure: string;
  rose: string;
  roseLight: string;
  roseDark: string;
  roseRed: string;
  frame: string;
  bay: string;
  pier: string;
  house: string;
  turtle: string;
  orbit: string;
  orbitDone: string;
  doneInk: string;
  link: string;
  cargo: { todo: string; doing: string; review: string };
  cargoStroke: string;
  cargoCross: string;
  cargoLabel: string;
  fog: string;
  fogTitle: string;
  fogLabel: string;
  tower: string;
  towerBand: string;
  lampLit: string;
  lampUnlit: string;
  /** The beam's red, green and blue: alpha is added as it fades out. */
  beam: string;
  hull: string;
  wake: string;
  signal: string;
  signalLabel: string;
  flags: [string, string, string];
  telegram: string;
}

export const marinerDayInks: MarinerInks = {
  vignette: ["rgba(255,250,235,0)", "rgba(150,115,60,0.18)"],
  rhumb: "rgba(60,48,30,0.10)",
  soundings: "rgba(40,70,100,0.32)",
  shallows: "rgba(150,190,205,0.28)",
  contour: "45,95,135",
  contourAlpha: 0.34,
  land: "#e7d29b",
  coast: "#5a3f22",
  coastInner: "rgba(90,63,34,0.35)",
  hachure: "rgba(90,63,34,0.45)",
  rose: "rgba(60,48,30,0.7)",
  roseLight: "#f6efde",
  roseDark: "#2a2116",
  roseRed: "#7a1f16",
  frame: "rgba(60,48,30,0.55)",
  bay: "#d9e6e6",
  pier: "#5a3f22",
  house: "#7a1f16",
  turtle: "#4b6b3a",
  orbit: "rgba(31,79,122,0.55)",
  orbitDone: "rgba(60,48,30,0.25)",
  doneInk: "rgba(60,48,30,0.4)",
  link: "rgba(60,48,30,0.3)",
  cargo: { todo: "#f6efde", doing: "#b8925a", review: "#d8c08a" },
  cargoStroke: "#4a3520",
  cargoCross: "rgba(74,53,32,0.5)",
  cargoLabel: "#3d3020",
  fog: "150,150,150",
  fogTitle: "#4b4b4b",
  fogLabel: "#3a3a3a",
  tower: "#f6efde",
  towerBand: "#b3261e",
  lampLit: "#e8a300",
  lampUnlit: "#b8ad99",
  beam: "255,214,120",
  hull: "#3d2a17",
  wake: "31,79,122",
  signal: "122,31,22",
  signalLabel: "#5a1810",
  flags: ["#b3261e", "#e8a300", "#1f4f7a"],
  telegram: "42,33,22",
};

export const marinerNightInks: MarinerInks = {
  vignette: ["rgba(40,70,110,0.10)", "rgba(2,6,14,0.55)"],
  rhumb: "rgba(150,185,220,0.07)",
  soundings: "rgba(150,185,220,0.26)",
  shallows: "rgba(60,105,150,0.22)",
  contour: "130,175,215",
  contourAlpha: 0.3,
  land: "#353a40",
  coast: "#b9c4cf",
  coastInner: "rgba(185,196,207,0.22)",
  hachure: "rgba(185,196,207,0.22)",
  rose: "rgba(170,200,230,0.42)",
  roseLight: "rgba(214,226,238,0.55)",
  roseDark: "rgba(13,26,43,0.9)",
  roseRed: "rgba(170,92,80,0.6)",
  frame: "rgba(150,185,220,0.38)",
  bay: "#183450",
  pier: "#8c97a3",
  house: "#3a3530",
  turtle: "#5f7f55",
  orbit: "rgba(140,185,225,0.5)",
  orbitDone: "rgba(160,180,200,0.22)",
  doneInk: "rgba(233,227,211,0.45)",
  link: "rgba(170,195,220,0.28)",
  cargo: { todo: "#d9d2c0", doing: "#a98a5c", review: "#c8b27e" },
  cargoStroke: "#efe7d2",
  cargoCross: "rgba(30,24,16,0.45)",
  cargoLabel: "#ddd6c4",
  fog: "190,208,228",
  fogTitle: "#c5d2df",
  fogLabel: "#dfe6ee",
  tower: "#d9dde0",
  towerBand: "#9b4a40",
  lampLit: "#fff3d2",
  lampUnlit: "#fff3d2",
  beam: "255,241,205",
  hull: "#aaa392",
  wake: "150,195,230",
  signal: "230,196,176",
  signalLabel: "#efcdbd",
  flags: ["#d9574d", "#e2b44f", "#5d93cc"],
  telegram: "220,228,238",
};

/** The chart's inks under this lighting. */
export function marinerInks(lighting: Lighting): MarinerInks {
  return lighting === "night" ? marinerNightInks : marinerDayInks;
}

/** The palette under this lighting, for the painter. */
export function marinerPaletteFor(lighting: Lighting): Palette {
  return lighting === "night" ? marinerNightPalette : marinerPalette;
}

/** The warm white of every light at night: lamps, lanterns, windows. */
export const nightLight = "255,240,204";

export const marinerTypefaces: Typefaces = {
  display: '"IM Fell English SC", "Iowan Old Style", Georgia, serif',
  body: '"EB Garamond", "Iowan Old Style", Georgia, serif',
  mono: '"IM Fell English", "Iowan Old Style", Georgia, serif',
};
