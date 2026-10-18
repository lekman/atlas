/**
 * The night garden's lights: paper lanterns on posts along the gravel paths
 * and at each bed's entrance, the moon's edge on the hedge, fireflies over
 * the beds and the moon in the pond. All of it is decoration in warm white
 * and pale gold, never a status hue. Lanterns flicker very gently where
 * motion is allowed and burn steady under reduced motion.
 */
import type { Point } from "../camera";
import { pixels, withAlpha } from "../paint";
import { hashString, seededRandom } from "../random";
import type { PaintContext } from "../types";
import { lanternLight } from "./palette";

export interface Lantern extends Point {
  /** Fixed per lantern, so each one flickers on its own beat. */
  seed: number;
}

/** How bright a lantern is just now: about 1, wavering by a few per cent. */
export function flicker(paint: PaintContext, seed: number): number {
  if (paint.reducedMotion) return 1;
  const time = paint.time;
  return (
    1 +
    0.045 * Math.sin(time * 4.7 + seed * 7.1) +
    0.03 * Math.sin(time * 11.3 + seed * 3.7) +
    0.015 * Math.sin(time * 23.9 + seed)
  );
}

/** The warm pool a lantern throws on the ground around it, in world units. */
export function lanternPool(
  paint: PaintContext,
  lantern: Lantern,
  radius = 96,
  strength = 1,
): void {
  const { context } = paint;
  const bright = flicker(paint, lantern.seed) * strength;
  const reach = radius * (0.97 + (bright - 1) * 0.8);
  const gradient = context.createRadialGradient(
    lantern.x,
    lantern.y,
    0,
    lantern.x,
    lantern.y,
    reach,
  );
  gradient.addColorStop(0, withAlpha(lanternLight.glow, 0.34 * bright));
  gradient.addColorStop(0.35, withAlpha(lanternLight.glow, 0.15 * bright));
  gradient.addColorStop(0.7, withAlpha(lanternLight.glow, 0.05 * bright));
  gradient.addColorStop(1, withAlpha(lanternLight.glow, 0));
  context.save();
  context.globalCompositeOperation = "screen";
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(lantern.x, lantern.y, reach, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/**
 * A paper lantern on a post, seen from above and a little to the side: a
 * short shadow, the lit paper with its ribs, a dark cap, and a close halo.
 * It keeps a readable size at the overview zoom.
 */
export function lanternBody(paint: PaintContext, lantern: Lantern): void {
  const { context } = paint;
  const bright = flicker(paint, lantern.seed);
  const size = Math.max(8, pixels(paint, 3.4));
  const { x, y } = lantern;
  context.save();
  // The post's shadow, cast away from the moon.
  context.fillStyle = "rgba(0,0,0,0.35)";
  context.beginPath();
  context.ellipse(
    x + size * 0.9,
    y + size * 1.1,
    size * 1.1,
    size * 0.5,
    0.5,
    0,
    Math.PI * 2,
  );
  context.fill();
  // A close halo, brighter than the pool.
  const halo = context.createRadialGradient(x, y, size * 0.4, x, y, size * 3.4);
  halo.addColorStop(0, withAlpha(lanternLight.glow, 0.55 * bright));
  halo.addColorStop(1, withAlpha(lanternLight.glow, 0));
  context.globalCompositeOperation = "screen";
  context.fillStyle = halo;
  context.beginPath();
  context.arc(x, y, size * 3.4, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "source-over";
  // The paper, lit from inside.
  const paper = context.createRadialGradient(x, y, 0, x, y, size);
  paper.addColorStop(0, lanternLight.flame);
  paper.addColorStop(0.55, lanternLight.paper);
  paper.addColorStop(1, withAlpha(lanternLight.paper, 0.9));
  context.fillStyle = paper;
  context.beginPath();
  context.ellipse(x, y, size * 0.82, size, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = withAlpha(lanternLight.frame, 0.8);
  context.lineWidth = Math.max(0.6, pixels(paint, 0.7));
  context.stroke();
  // Ribs of the paper.
  context.strokeStyle = withAlpha(lanternLight.frame, 0.32);
  context.beginPath();
  for (const rib of [-0.4, 0.4]) {
    context.moveTo(x - size * 0.78, y + rib * size);
    context.quadraticCurveTo(
      x,
      y + rib * size * 1.18,
      x + size * 0.78,
      y + rib * size,
    );
  }
  context.stroke();
  // The cap.
  context.fillStyle = lanternLight.frame;
  context.fillRect(x - size * 0.42, y - size * 1.16, size * 0.84, size * 0.3);
  context.restore();
}

/**
 * The moon's edge on a row of round shrubs: a pale crescent along the upper
 * left of each, so a dark hedge reads as a silhouette with a moonlit rim.
 */
export function moonlitRims(
  paint: PaintContext,
  shrubs: ReadonlyArray<{ x: number; y: number; radius: number }>,
  colour: string,
  alpha: number,
): void {
  const { context } = paint;
  const from = Math.PI * 1.1;
  const to = Math.PI * 1.55;
  context.save();
  context.lineCap = "round";
  context.strokeStyle = withAlpha(colour, alpha);
  const average =
    shrubs.reduce((sum, shrub) => sum + shrub.radius, 0) /
    Math.max(1, shrubs.length);
  context.lineWidth = Math.max(average * 0.1, pixels(paint, 0.8));
  context.beginPath();
  for (const shrub of shrubs) {
    const radius = shrub.radius * 0.8;
    context.moveTo(
      shrub.x + Math.cos(from) * radius,
      shrub.y + Math.sin(from) * radius,
    );
    context.arc(shrub.x, shrub.y, radius, from, to);
  }
  context.stroke();
  context.restore();
}

interface Firefly {
  x: number;
  y: number;
  reach: number;
  speed: number;
  phase: number;
}

const swarms = new Map<string, Firefly[]>();

function swarmFor(id: string, size: number): Firefly[] {
  let found = swarms.get(id);
  if (!found) {
    const random = seededRandom(hashString(`fireflies:${id}`));
    found = Array.from({ length: 6 }, () => {
      const angle = random() * Math.PI * 2;
      const distance = (0.25 + random() * 0.55) * size;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        reach: 30 + random() * 50,
        speed: 0.05 + random() * 0.06,
        phase: random() * 100,
      };
    });
    swarms.set(id, found);
  }
  return found;
}

/**
 * A few fireflies drifting low over a bed: tiny, dim and warm white, so they
 * are never read as a running bee. Under reduced motion they hold still.
 */
export function fireflies(
  paint: PaintContext,
  id: string,
  centre: Point,
  size: number,
): void {
  const { context, time, reducedMotion } = paint;
  const core = Math.max(1.4, pixels(paint, 0.9));
  context.save();
  context.globalCompositeOperation = "screen";
  for (const fly of swarmFor(id, size)) {
    const at = reducedMotion ? fly.phase : time * fly.speed + fly.phase;
    const x = centre.x + fly.x + Math.sin(at * 1.3) * fly.reach;
    const y = centre.y + fly.y + Math.cos(at * 0.9) * fly.reach * 0.7;
    const blink = reducedMotion
      ? 0.5
      : Math.max(0, Math.sin(time * 0.8 + fly.phase)) ** 2;
    const alpha = 0.12 + 0.3 * blink;
    const glow = context.createRadialGradient(x, y, 0, x, y, core * 5);
    glow.addColorStop(0, withAlpha(lanternLight.firefly, alpha));
    glow.addColorStop(1, withAlpha(lanternLight.firefly, 0));
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, core * 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = withAlpha(lanternLight.firefly, alpha + 0.2);
    context.beginPath();
    context.arc(x, y, core, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

/**
 * The moon, as the pond gives it back: a pale disc with a soft halo and a few
 * broken streaks of light that shimmer where motion is allowed.
 */
export function moonInWater(
  paint: PaintContext,
  centre: Point,
  radius: number,
): void {
  const { context, time, reducedMotion } = paint;
  context.save();
  const halo = context.createRadialGradient(
    centre.x,
    centre.y,
    radius * 0.6,
    centre.x,
    centre.y,
    radius * 3.2,
  );
  halo.addColorStop(0, withAlpha(lanternLight.moon, 0.32));
  halo.addColorStop(1, withAlpha(lanternLight.moon, 0));
  context.globalCompositeOperation = "screen";
  context.fillStyle = halo;
  context.beginPath();
  context.arc(centre.x, centre.y, radius * 3.2, 0, Math.PI * 2);
  context.fill();
  const shimmer = reducedMotion ? 0 : Math.sin(time * 0.9) * 0.06;
  context.fillStyle = withAlpha(lanternLight.moon, 0.9);
  context.beginPath();
  context.ellipse(
    centre.x,
    centre.y,
    radius * (1 + shimmer),
    radius * (1 - shimmer * 0.5),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.strokeStyle = withAlpha(lanternLight.moon, 0.45);
  context.lineCap = "round";
  context.lineWidth = Math.max(1.4, pixels(paint, 1));
  context.beginPath();
  for (const [row, width, beat] of [
    [1.6, 1.2, 0],
    [2.3, 0.8, 1.7],
    [2.9, 0.5, 3.1],
  ] as const) {
    const drift = reducedMotion
      ? 0
      : Math.sin(time * 0.7 + beat) * radius * 0.25;
    const y = centre.y + row * radius;
    context.moveTo(centre.x - width * radius + drift, y);
    context.lineTo(centre.x + width * radius + drift, y);
  }
  context.stroke();
  context.restore();
}

/** Moonlight over the whole sheet, in screen space: pale from the upper left, dark at the edges. */
export function moonlight(paint: PaintContext): void {
  const { context, width, height } = paint;
  const wash = context.createRadialGradient(
    width * 0.18,
    height * 0.02,
    0,
    width * 0.18,
    height * 0.02,
    Math.max(width, height) * 1.05,
  );
  wash.addColorStop(0, withAlpha(lanternLight.moon, 0.09));
  wash.addColorStop(1, withAlpha(lanternLight.moon, 0));
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);
  const vignette = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.38,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.8,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.32)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}
