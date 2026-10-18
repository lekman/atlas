import type { World } from "@atlas/worlds";
import type { CSSProperties } from "react";

/**
 * A world's palette and typefaces as CSS custom properties. The stylesheet
 * reads only these, so a world is defined once, in `@atlas/worlds`, and
 * the canvas, the SVG and the panels can never drift apart.
 */
export function worldStyle(world: World): CSSProperties {
  const { palette, typefaces } = world;
  return {
    "--atlas-ground": palette.ground,
    "--atlas-ink": palette.ink,
    "--atlas-mute": palette.mute,
    "--atlas-accent": palette.accent,
    "--atlas-panel": palette.panel,
    "--atlas-line": palette.line,
    "--atlas-running": palette.status.running,
    "--atlas-watching": palette.status.watching,
    "--atlas-waiting": palette.status.waiting,
    "--atlas-blocked": palette.status.blocked,
    "--atlas-error": palette.status.error,
    "--atlas-idle": palette.status.idle,
    "--atlas-display": typefaces.display,
    "--atlas-body": typefaces.body,
    "--atlas-mono": typefaces.mono,
    colorScheme: palette.darkGround ? "dark" : "light",
  } as CSSProperties;
}
