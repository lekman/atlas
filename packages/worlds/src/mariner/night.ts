/**
 * What comes on at night on the Mariner's chart: lamps, beams, lanterns,
 * harbour windows and the moon on the water. Every light is warm white or
 * pale gold, never the amber of waiting, so a lit lamp is never read as a
 * status. Lights hold still under reduced motion; only the beams turn, and
 * they stop where they are when motion is reduced.
 */
import type { Point } from "../camera";
import { pixels } from "../paint";
import { hashString, seededRandom } from "../random";
import type { PaintContext } from "../types";
import { nightLight } from "./palette";

const light = (alpha: number) =>
  `rgba(${nightLight},${Math.max(0, Math.min(1, alpha))})`;

/** A soft round glow with a bright core, in world units. */
export function glow(
  paint: PaintContext,
  centre: Point,
  radius: number,
  strength: number,
  core = 0,
): void {
  const { context } = paint;
  const halo = context.createRadialGradient(
    centre.x,
    centre.y,
    0,
    centre.x,
    centre.y,
    radius,
  );
  halo.addColorStop(0, light(0.75 * strength));
  halo.addColorStop(0.25, light(0.32 * strength));
  halo.addColorStop(1, light(0));
  context.fillStyle = halo;
  context.beginPath();
  context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  context.fill();
  if (core > 0) {
    context.fillStyle = "#fff8e6";
    context.beginPath();
    context.arc(centre.x, centre.y, core, 0, Math.PI * 2);
    context.fill();
  }
}

/** Seconds for one turn of a lighthouse beam. */
const beamPeriod = 6;

/**
 * Where a lighthouse's beam points now. Each lighthouse starts at its own
 * angle, from its id, so no two sweep in step; under reduced motion the
 * beam stands still at that angle.
 */
export function beamAngle(paint: PaintContext, id: string): number {
  const phase = ((hashString(id) % 3600) / 3600) * Math.PI * 2;
  if (paint.reducedMotion) return phase;
  return phase + (paint.time / beamPeriod) * Math.PI * 2;
}

/** How many faint wedges a beam is built from: enough that no edge shows. */
const beamLayers = 14;

/**
 * A soft cone of light: faint wedges laid one inside the next, so the
 * light is brightest along the beam's line and falls away to either side,
 * and every wedge fades with distance from the lamp.
 */
export function beam(
  paint: PaintContext,
  lamp: Point,
  angle: number,
  reach: number,
  strength: number,
): void {
  const { context } = paint;
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let layer = 0; layer < beamLayers; layer++) {
    const wide = (layer + 1) / beamLayers;
    const spread = 0.025 + 0.3 * wide;
    const end = reach * (1 - 0.3 * wide);
    const alpha = 0.021 * strength;
    const fade = context.createRadialGradient(
      lamp.x,
      lamp.y,
      0,
      lamp.x,
      lamp.y,
      end,
    );
    fade.addColorStop(0, light(alpha * 1.8));
    fade.addColorStop(0.4, light(alpha));
    fade.addColorStop(1, light(0));
    context.fillStyle = fade;
    context.beginPath();
    context.moveTo(lamp.x, lamp.y);
    context.arc(lamp.x, lamp.y, end, angle - spread, angle + spread);
    context.closePath();
    context.fill();
  }
  context.restore();
}

/** A ship's masthead light: a small warm point that stays the same size on screen. */
export function lantern(paint: PaintContext, at: Point): void {
  glow(paint, at, pixels(paint, 7), 1, pixels(paint, 1.4));
}

const shimmerCache = new Map<
  string,
  Array<{ x: number; y: number; length: number; phase: number }>
>();

function shimmers(width: number, height: number) {
  const key = `${Math.round(width)}x${Math.round(height)}`;
  let found = shimmerCache.get(key);
  if (!found) {
    const random = seededRandom(29);
    found = [];
    const column = width * 0.62;
    // Fewer and shorter strokes on a small map, so the sidebar is not busy.
    const count = Math.round(
      Math.min(110, Math.max(24, (width * height) / 9000)),
    );
    const reach = Math.min(1, Math.max(0.5, width / 1200));
    for (let index = 0; index < count; index++) {
      const depth = random() ** 1.4;
      const y = height * (0.04 + depth * 0.56);
      const spread = (10 + depth * 46) * reach;
      found.push({
        x: column + (random() - 0.5) * 2 * spread,
        y,
        length: (6 + random() * 22 * (1 - depth * 0.5)) * reach,
        phase: random() * Math.PI * 2,
      });
    }
    shimmerCache.set(key, found);
    if (shimmerCache.size > 8) shimmerCache.clear();
  }
  return found;
}

/**
 * Moonlight, in screen space: a pale wash from a moon just above the top
 * of the chart, and its reflection broken into short strokes on the water.
 * Kept faint so it never competes with a label or a status.
 */
export function moonlight(paint: PaintContext): void {
  const { context, width, height, time, reducedMotion } = paint;
  const moon = { x: width * 0.62, y: -height * 0.08 };
  const wash = context.createRadialGradient(
    moon.x,
    moon.y,
    0,
    moon.x,
    moon.y,
    Math.max(width, height) * 0.7,
  );
  wash.addColorStop(0, "rgba(150,180,215,0.16)");
  wash.addColorStop(0.45, "rgba(110,145,185,0.05)");
  wash.addColorStop(1, "rgba(110,145,185,0)");
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);
  context.save();
  context.lineCap = "round";
  context.lineWidth = 1.1;
  for (const stroke of shimmers(width, height)) {
    const fall = 1 - stroke.y / (height * 0.62);
    const flicker = reducedMotion
      ? 0.7
      : 0.55 + 0.45 * Math.sin(time * 0.6 + stroke.phase);
    context.strokeStyle = `rgba(200,218,238,${(0.22 * fall * flicker).toFixed(3)})`;
    context.beginPath();
    context.moveTo(stroke.x - stroke.length / 2, stroke.y);
    context.lineTo(stroke.x + stroke.length / 2, stroke.y);
    context.stroke();
  }
  context.restore();
}
