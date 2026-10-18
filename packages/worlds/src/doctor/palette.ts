import type { Lighting, Palette, Typefaces } from "../types";

/**
 * By day, a wayfinding map of the district: pale grey blocks, white
 * streets, roofs and trees in leaf, a deep violet for the hospitals and the
 * world's own marks. Status inks keep the shared hues, deepened so each
 * reads as text on the ground and on the panels (4.5:1 or better).
 */
export const doctorPalette: Palette = {
  ground: "#e9ecf1",
  darkGround: false,
  ink: "#1b2131",
  mute: "#4f586b",
  accent: "#6a3db5",
  panel: "rgba(250, 251, 253, 0.96)",
  line: "rgba(106, 61, 181, 0.28)",
  status: {
    running: "#1f7034",
    watching: "#1b5da3",
    waiting: "#8a5000",
    blocked: "#b3232f",
    error: "#b3232f",
    idle: "#5d656e",
  },
};

/**
 * The night shift: a town plan at night, deep navy ground, graphite
 * streets, lit windows and street lights, and a soft violet for the
 * hospitals. Violet sits well clear of every status hue, so a hospital
 * outline, a helipad light or an ambulance's light bar never reads as a
 * status. Everything else that glows is a dim warm white.
 */
export const doctorNightPalette: Palette = {
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
export interface Shades {
  /** The accent as `r,g,b`, for `rgba()`. */
  accent: string;
  /** Road markings, and at night the warm white of windows and lamps, as `r,g,b`. */
  warm: string;
  /** Whether windows, street lights and door lamps are lit. */
  lit: boolean;
  street: string;
  streetEdge: string;
  mainRoad: string;
  mainRoadEdge: string;
  kerb: string;
  building: string;
  buildingEdge: string;
  park: string;
  tree: string;
  treeLight: string;
  river: string;
  riverEdge: string;
  /** Hospital grounds, a step apart from the town's blocks. */
  grounds: string;
  roof: string;
  roofPlant: string;
  floor: string;
  helipad: string;
  helipadMark: string;
  cars: readonly string[];
  /** Pending test results: a lilac kept clear of every status hue. */
  sample: string;
  tube: string;
  /** Charts and paper. */
  paper: string;
  chartClip: string;
  chartLines: string;
  signature: string;
  bedFrame: string;
  bedBase: string;
  bedCover: string;
  /** Vehicles: always a white body with a darker rim. */
  vehicle: string;
  rim: string;
  glass: string;
  rotor: string;
  /** The Practice's sign: a deep blue plate with white letters. */
  signPlate: string;
  signEdge: string;
  signName: string;
  signDetail: string;
  /** A hospital's sign plate. */
  plate: string;
  labelDepartment: string;
  labelItem: string;
  labelDecision: string;
  labelEffect: string;
  /** The darkening towards the screen's edges, as `r,g,b` and its strength. */
  vignette: string;
  vignetteAlpha: number;
}

const dayShades: Shades = {
  accent: "106,61,181",
  warm: "96,106,128",
  lit: false,
  street: "#fdfdfe",
  streetEdge: "#cfd4dd",
  mainRoad: "#ffffff",
  mainRoadEdge: "#a99bc9",
  kerb: "#3b4458",
  building: "#d6dbe3",
  buildingEdge: "#bcc3cf",
  park: "#d3e3cb",
  tree: "#a9c79c",
  treeLight: "rgba(255,255,255,0.35)",
  river: "#b9d0e6",
  riverEdge: "#8fb0d0",
  grounds: "#f6f5fa",
  roof: "#d9d4e8",
  roofPlant: "#c3bcd8",
  floor: "#fbfaff",
  helipad: "#4c5468",
  helipadMark: "#ffffff",
  cars: ["#8d95a6", "#a7aebb", "#6f788c"],
  sample: "#6a3db5",
  tube: "rgba(255,255,255,0.9)",
  paper: "#ffffff",
  chartClip: "#5b6480",
  chartLines: "rgba(40,52,84,0.45)",
  signature: "#3b2f7a",
  bedFrame: "#3b4458",
  bedBase: "#ffffff",
  bedCover: "#6d7690",
  vehicle: "#ffffff",
  rim: "#3b4458",
  glass: "#2a3550",
  rotor: "rgba(40,48,70,0.8)",
  signPlate: "#1d3a7a",
  signEdge: "rgba(255,255,255,0.9)",
  signName: "#ffffff",
  signDetail: "#dfe6f7",
  plate: "rgba(255,255,255,0.94)",
  labelDepartment: "#3a3156",
  labelItem: "#3d4559",
  labelDecision: "#2c3346",
  labelEffect: "#4a2a8a",
  vignette: "60,70,100",
  vignetteAlpha: 0.12,
};

const nightShades: Shades = {
  accent: "207,163,255",
  warm: "255,238,212",
  lit: true,
  street: "#151c2a",
  streetEdge: "#151c2a",
  mainRoad: "#2a3550",
  mainRoadEdge: "#2a3550",
  kerb: "#0e1524",
  building: "#131b2c",
  buildingEdge: "#1b2438",
  park: "#0d1918",
  tree: "#132423",
  treeLight: "rgba(160,200,190,0.05)",
  river: "#0a1729",
  riverEdge: "#1a2c47",
  grounds: "#0f1729",
  roof: "#1d2740",
  roofPlant: "#273350",
  floor: "#232f4b",
  helipad: "#141c2f",
  helipadMark: "#e7ecf7",
  cars: ["#3a4256", "#4a5064", "#2f394e"],
  sample: "#dccbff",
  tube: "rgba(6,10,20,0.85)",
  paper: "#e6ebf5",
  chartClip: "#56628a",
  chartLines: "rgba(40,52,84,0.5)",
  signature: "#3b2f7a",
  bedFrame: "#e6ebf5",
  bedBase: "#0e1524",
  bedCover: "#e6ebf5",
  vehicle: "#eef2f9",
  rim: "#0e1524",
  glass: "#26314a",
  rotor: "rgba(220,228,245,0.75)",
  signPlate: "#1d3a7a",
  signEdge: "rgba(255,255,255,0.8)",
  signName: "#ffffff",
  signDetail: "#dfe6f7",
  plate: "rgba(14,21,38,0.92)",
  labelDepartment: "#c9d2e6",
  labelItem: "#b9c4da",
  labelDecision: "#d3daea",
  labelEffect: "#e2d4ff",
  vignette: "3,6,14",
  vignetteAlpha: 0.4,
};

export interface Tone {
  palette: Palette;
  shade: Shades;
  /** The accent at an alpha. */
  accent(alpha: number): string;
  /** The marking colour (warm white at night) at an alpha. */
  warm(alpha: number): string;
}

function toneFrom(palette: Palette, shade: Shades): Tone {
  return {
    palette,
    shade,
    accent: (alpha) => `rgba(${shade.accent},${alpha})`,
    warm: (alpha) => `rgba(${shade.warm},${alpha})`,
  };
}

const tones: Record<Lighting, Tone> = {
  day: toneFrom(doctorPalette, dayShades),
  night: toneFrom(doctorNightPalette, nightShades),
};

/** Everything the painter colours with, for day or night. */
export function toneOf(lighting: Lighting | undefined): Tone {
  return tones[lighting ?? "day"];
}

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
