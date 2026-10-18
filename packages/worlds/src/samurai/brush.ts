/**
 * Brush strokes, simulated: a stroke is a filled outline whose width follows
 * the pressure of a brush (a firm press, then a lift to a fine tip). Laying
 * several at low alpha gives the layered look of ink wash.
 */
import type { Point } from "../camera";
import { seededRandom } from "../random";

/** Half-width at `t` (0 at the start, 1 at the end) as a share of the full width. */
export type Pressure = (t: number) => number;

/** Pressed at the start, lifted to a point at the end. */
export const pressAndLift: Pressure = (t) =>
  Math.min(1, 0.45 + t * 4) * Math.pow(Math.max(0, 1 - t), 0.7);

/** Fine at both ends, full in the middle. */
export const swell: Pressure = (t) =>
  Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.6);

/** Add a stroke's outline to the current path. Fill it to draw. */
export function traceBrush(
  context: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  pressure: Pressure = pressAndLift,
): void {
  const count = points.length;
  if (count < 2) return;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let index = 0; index < count; index++) {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(count - 1, index + 1)];
    const here = points[index];
    if (!before || !after || !here) continue;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const half = (width / 2) * pressure(index / (count - 1));
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    left.push({ x: here.x + nx, y: here.y + ny });
    right.push({ x: here.x - nx, y: here.y - ny });
  }
  const first = left[0];
  if (!first) return;
  context.moveTo(first.x, first.y);
  for (const point of left) context.lineTo(point.x, point.y);
  for (let index = right.length - 1; index >= 0; index--) {
    const point = right[index];
    if (point) context.lineTo(point.x, point.y);
  }
  context.closePath();
}

/** Fill one stroke, then a few dry, lighter passes beside it. */
export function paintBrush(
  context: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  colour: string,
  options: { pressure?: Pressure; dry?: number; seed?: number } = {},
): void {
  context.fillStyle = colour;
  context.beginPath();
  traceBrush(context, points, width, options.pressure);
  context.fill();
  const dry = options.dry ?? 0;
  if (dry <= 0) return;
  const random = seededRandom(options.seed ?? 1);
  context.save();
  context.globalAlpha *= 0.45;
  for (let pass = 0; pass < dry; pass++) {
    const offset = (random() - 0.5) * width * 0.9;
    const shifted = offsetAcross(points, offset);
    context.beginPath();
    traceBrush(context, shifted, width * (0.18 + random() * 0.2), swell);
    context.fill();
  }
  context.restore();
}

/** Move every point sideways from the direction of travel. */
export function offsetAcross(points: Point[], offset: number): Point[] {
  return points.map((point, index) => {
    const before = points[Math.max(0, index - 1)] ?? point;
    const after = points[Math.min(points.length - 1, index + 1)] ?? point;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (-dy / length) * offset,
      y: point.y + (dx / length) * offset,
    };
  });
}

/** Points along an arc, with a seeded hand-drawn wobble in the radius. */
export function arcPoints(
  centre: Point,
  radius: number,
  from: number,
  to: number,
  steps: number,
  wobble = 0,
  seed = 1,
): Point[] {
  const random = seededRandom(seed);
  const phase = random() * Math.PI * 2;
  const points: Point[] = [];
  for (let step = 0; step <= steps; step++) {
    const angle = from + ((to - from) * step) / steps;
    const distance =
      radius + Math.sin(angle * 3 + phase) * wobble + (random() - 0.5) * wobble;
    points.push({
      x: centre.x + Math.cos(angle) * distance,
      y: centre.y + Math.sin(angle) * distance,
    });
  }
  return points;
}

/** Points along a quadratic curve. */
export function curvePoints(
  from: Point,
  control: Point,
  to: Point,
  steps: number,
  start = 0,
  end = 1,
): Point[] {
  const points: Point[] = [];
  for (let step = 0; step <= steps; step++) {
    const t = start + ((end - start) * step) / steps;
    points.push({
      x:
        (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * control.x + t * t * to.x,
      y:
        (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * control.y + t * t * to.y,
    });
  }
  return points;
}
