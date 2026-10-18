import type { Palette, Typefaces } from "../types";

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

export const gardenerTypefaces: Typefaces = {
  display:
    '"Architects Daughter", "Bradley Hand", "Segoe Print", "Noteworthy", cursive',
  body: '"Fraunces", "Iowan Old Style", Georgia, serif',
  mono: '"Architects Daughter", "Bradley Hand", "Segoe Print", "Noteworthy", cursive',
};
