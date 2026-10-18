import type { Lighting, Palette, World } from "./types";

/** What the reader chose: follow the device, or always day, or always night. */
export type LightingPreference = "automatic" | "day" | "night";

export const lightingPreferences: readonly LightingPreference[] = [
  "automatic",
  "day",
  "night",
];

/** The lighting to draw with, from the reader's choice and the device's. */
export function resolveLighting(
  preference: LightingPreference,
  deviceIsDark: boolean,
): Lighting {
  if (preference === "automatic") return deviceIsDark ? "night" : "day";
  return preference;
}

/** The palette a world draws with under this lighting. */
export function paletteFor(world: World, lighting: Lighting): Palette {
  return lighting === "night" && world.night
    ? world.night.palette
    : world.palette;
}

/** What the world picker says about a world after dark. */
export function describeNight(world: World): string {
  if (world.night) return `${world.night.name}: ${world.night.description}`;
  if (world.palette.darkGround) return "Always dark.";
  return "No night mode yet; the day map is shown.";
}
