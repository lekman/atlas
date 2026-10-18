import type { Palette, Typefaces } from "../types";

/**
 * A printed trail map: black and brown ink on pale paper, a woodland tint,
 * blue water. Status inks keep the shared hues, deepened so each reads as
 * text on the paper and on the panels (4.5:1 or better).
 */
export const woodsmanPalette: Palette = {
  ground: "#f3f0e2",
  darkGround: false,
  ink: "#23261c",
  mute: "#5a5847",
  accent: "#5f3f22",
  panel: "rgba(249, 247, 238, 0.96)",
  line: "rgba(72, 62, 40, 0.3)",
  status: {
    running: "#2d6a30",
    watching: "#1c5e98",
    waiting: "#8e5200",
    blocked: "#b0241b",
    error: "#b0241b",
    idle: "#67655a",
  },
};

/** The inks the terrain is printed in. Not used as text. */
export const terrain = {
  woodland: "rgba(170, 196, 140, 0.42)",
  canopy: "rgba(70, 108, 56, 0.5)",
  conifer: "rgba(44, 86, 50, 0.55)",
  clearing: "#f7f4e6",
  contour: "rgba(140, 92, 48, 0.5)",
  water: "#6f9fc4",
  waterEdge: "#3f74a3",
  waterInk: "#2f5f8c",
  grid: "rgba(47, 95, 140, 0.13)",
  trail: "#3b2a1a",
  trunk: "#6b4a2a",
  stone: "#a59f8f",
  stoneDark: "#6f6a5c",
  flame: "#e0781c",
  flameCore: "#f6c64a",
  canvas: "#e9dcb8",
  canvasShade: "#c9b689",
} as const;

export const woodsmanTypefaces: Typefaces = {
  display:
    '"Barlow Condensed", "Avenir Next Condensed", "Arial Narrow", sans-serif',
  body: '"Bitter", "Rockwell", "Roboto Slab", Georgia, serif',
  mono: '"Bitter", "Rockwell", "Roboto Slab", Georgia, serif',
};
