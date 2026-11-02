/**
 * The sidebar in a world's look: its colour tokens from the world's palette
 * (day, or its night where it has one), its faces, and a background drawn
 * after the full page's. Only the worlds the sidebar offers are here.
 */
import { paletteFor, worlds, type Lighting, type Palette } from "@atlas/worlds";
import type { CSSProperties } from "react";

export const SIDEBAR_WORLDS = ["astronomer", "mariner"] as const;
export type SidebarWorldId = (typeof SIDEBAR_WORLDS)[number];

export const isSidebarWorld = (value: unknown): value is SidebarWorldId =>
  SIDEBAR_WORLDS.includes(value as SidebarWorldId);

type Rgb = [number, number, number];

function parse(colour: string): { rgb: Rgb; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(colour);
  if (!rgba) throw new Error(`Not a colour: ${colour}`);
  const [r, g, b, a = "1"] = rgba[1]!.split(",").map((p) => p.trim());
  return { rgb: [Number(r), Number(g), Number(b)], alpha: Number(a) };
}

const hex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** `top` laid over `under`, as the screen shows it. */
export function over(top: string, under: string): string {
  const t = parse(top);
  const u = parse(under).rgb;
  return hex(t.rgb.map((c, i) => c * t.alpha + u[i]! * (1 - t.alpha)) as Rgb);
}

/** `top` at `share` (0 to 1) over `under`. */
const mix = (top: string, share: number, under: string) => {
  const t = parse(top).rgb;
  const u = parse(under).rgb;
  return hex(t.map((c, i) => c * share + u[i]! * (1 - share)) as Rgb);
};

/** Client colour slots for a light ground and a dark one; each holds 4.5:1 there. */
const CLIENT_SLOTS = {
  light: ["#a03060", "#0b6b73", "#8a5510", "#2a52bf", "#6046bf", "#5f6670"],
  dark: ["#f07aae", "#43c6cf", "#e7b054", "#86a6ff", "#ae9bff", "#9aa3af"],
};

/**
 * The sidebar's colour tokens for a world and lighting. Panels are the
 * world's panel colour laid over its ground, and the "now" highlight is its
 * accent faintly over the panel, as solid colours, so the contrast test
 * reads them as drawn.
 */
export function worldTokens(
  id: SidebarWorldId,
  lighting: Lighting,
): Record<string, string> {
  const palette: Palette = paletteFor(worlds[id], lighting);
  const panel = over(palette.panel, palette.ground);
  const slots = palette.darkGround ? CLIENT_SLOTS.dark : CLIENT_SLOTS.light;
  return {
    "--bg": palette.ground,
    "--panel": panel,
    "--ink": palette.ink,
    "--muted": palette.mute,
    "--line": over(palette.line, panel),
    "--accent": palette.accent,
    "--warn": palette.status.waiting,
    "--bad": palette.status.blocked,
    "--ok": palette.status.running,
    "--yellow": palette.status.waiting,
    "--merged": palette.darkGround ? "#c09bff" : "#6c3fc4",
    // A faint accent tint: lighter on a light ground, so text keeps 4.5:1 on it.
    "--now": mix(palette.accent, palette.darkGround ? 0.14 : 0.07, panel),
    "--hatch": palette.darkGround
      ? "rgba(255, 255, 255, 0.07)"
      : "rgba(60, 48, 30, 0.08)",
    "--client-1": slots[0]!,
    "--client-2": slots[1]!,
    "--client-3": slots[2]!,
    "--client-4": slots[3]!,
    "--client-5": slots[4]!,
    "--client-other": slots[5]!,
  };
}

/** The tokens and faces as a style for the sidebar's frame. */
export function worldFrameStyle(
  id: SidebarWorldId,
  lighting: Lighting,
): CSSProperties {
  const { typefaces } = worlds[id];
  const palette = paletteFor(worlds[id], lighting);
  return {
    ...worldTokens(id, lighting),
    "--f-sans": typefaces.body,
    "--f-mono": typefaces.mono,
    "--f-display": typefaces.display,
    colorScheme: palette.darkGround ? "dark" : "light",
  } as CSSProperties;
}
