import type { Lighting, Palette, Typefaces } from "../types";

/**
 * A planting plan: watercolour washes on cream paper, drawn over in ink.
 * Status inks keep the shared hues, deepened so they read as text on the
 * paper and in the panels, and stay clear of the soft greens of the foliage.
 */
export const gardenerPalette: Palette = {
  ground: "#f4eedb",
  darkGround: false,
  ink: "#262f20",
  mute: "#5a6149",
  accent: "#5b4785",
  panel: "rgba(251, 248, 238, 0.96)",
  line: "rgba(70, 82, 52, 0.3)",
  status: {
    running: "#276a33",
    watching: "#1f5c99",
    waiting: "#8a5200",
    blocked: "#ad2a1f",
    error: "#ad2a1f",
    idle: "#66625a",
  },
};

/**
 * The night garden: a deep blue-green lawn under the moon, with ink turned to
 * moonlight. Status colours keep their hue families, raised in lightness until
 * they read on the dark ground and in the panels.
 */
export const gardenerNightPalette: Palette = {
  ground: "#0f1e1f",
  darkGround: true,
  ink: "#e8ecdc",
  mute: "#a9b8a8",
  accent: "#c3b2f0",
  panel: "rgba(18, 34, 35, 0.95)",
  line: "rgba(200, 220, 205, 0.22)",
  status: {
    running: "#6fd283",
    watching: "#79b8f2",
    waiting: "#f2aa4c",
    blocked: "#ff8577",
    error: "#ff8577",
    idle: "#ada99f",
  },
};

/** The watercolour box. Washes are laid down translucent, so these are pigments, not final colours. */
export const washes = {
  lawn: "#a9c27f",
  lawnDeep: "#6f8f4c",
  soil: "#c9a57b",
  soilDeep: "#8a6643",
  gravel: "#e6dcc4",
  gravelStone: "#978a70",
  hedge: "#6f8f4e",
  hedgeDeep: "#3c5a2d",
  hedgeLight: "#a9c483",
  foliage: "#9dbb78",
  leaf: "#6e9c4a",
  leafDeep: "#3d6a2b",
  sprout: "#8cc463",
  terracotta: "#c4714c",
  terracottaDeep: "#8e4528",
  lavender: "#a28fcc",
  lavenderDeep: "#5e4a8a",
  petal: "#eaa384",
  petalDeep: "#b0583a",
  pollen: "#e9d45c",
  pollenDeep: "#9c8420",
  water: "#86b5d2",
  waterDeep: "#3f7398",
  straw: "#dcc896",
  strawDeep: "#8f7448",
  wood: "#8a6a45",
  stone: "#aaa497",
  cloud: "#9fb2c4",
  cloudDeep: "#5d7388",
  paperLight: "#fbf8ee",
} as const;

export type Washes = { readonly [Key in keyof typeof washes]: string };

/**
 * The same box after dark. Lawn, soil and hedge go deep; what the moon
 * catches (gravel, furrows, the rim of the hedge, rain) goes pale, so the
 * plan still reads as shapes in moonlight.
 */
export const nightWashes: Washes = {
  lawn: "#3d7262",
  lawnDeep: "#06131a",
  soil: "#0d0a09",
  soilDeep: "#8a7a66",
  gravel: "#4a5754",
  gravelStone: "#232d2b",
  hedge: "#1a3328",
  hedgeDeep: "#040b09",
  hedgeLight: "#b4d2c4",
  foliage: "#3b6a55",
  leaf: "#4b7d60",
  leafDeep: "#16302a",
  sprout: "#8fbf95",
  terracotta: "#6d4639",
  terracottaDeep: "#2f1b14",
  lavender: "#ab9ddb",
  lavenderDeep: "#6e5fa3",
  petal: "#eef2e4",
  petalDeep: "#a9b9b3",
  pollen: "#ecdc7a",
  pollenDeep: "#a1903a",
  water: "#173447",
  waterDeep: "#93bad0",
  straw: "#776c52",
  strawDeep: "#352d20",
  wood: "#9a9384",
  stone: "#59615e",
  cloud: "#46596b",
  cloudDeep: "#a6bac9",
  paperLight: "#cfd6c6",
};

/**
 * Lantern light: warm white and pale gold, never the amber of waiting, so a
 * lit lantern is never read as a status. Fireflies are warm white too, clear
 * of the running green.
 */
export const lanternLight = {
  /** The bright heart of a lantern. */
  flame: "#fffaea",
  /** Its paper or glass, lit from inside. */
  paper: "#f5e8b8",
  /** The pool it throws on the ground. */
  glow: "#fff0c6",
  /** Frame, cap and post. */
  frame: "#3a3326",
  /** The moon, and what it catches. */
  moon: "#e4ecdf",
  firefly: "#fff6d8",
} as const;

/** Everything one lighting draws with. */
export interface GardenLook {
  night: boolean;
  palette: Palette;
  washes: Washes;
  /** Name boards and the cartouche: cream paper by day, a dark slate at night. */
  board: string;
  /** Drop shadows under boards, markers and the cottage. */
  shadow: string;
}

const dayLook: GardenLook = {
  night: false,
  palette: gardenerPalette,
  washes,
  board: washes.paperLight,
  shadow: "rgba(60,50,30,0.18)",
};

const nightLook: GardenLook = {
  night: true,
  palette: gardenerNightPalette,
  washes: nightWashes,
  board: "#172826",
  shadow: "rgba(0,0,0,0.4)",
};

export const gardenLook = (lighting: Lighting): GardenLook =>
  lighting === "night" ? nightLook : dayLook;

export const gardenerTypefaces: Typefaces = {
  display:
    '"Architects Daughter", "Bradley Hand", "Segoe Print", "Noteworthy", cursive',
  body: '"Fraunces", "Iowan Old Style", Georgia, serif',
  mono: '"Architects Daughter", "Bradley Hand", "Segoe Print", "Noteworthy", cursive',
};
