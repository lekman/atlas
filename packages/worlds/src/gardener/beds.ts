/**
 * Bed outlines. A bed is a rounded square (a superellipse) with a slight
 * hand-drawn wobble seeded from its id, so each bed keeps its shape across
 * reloads and devices. The Homestead's yard uses the same shape, squarer.
 */
import type { Point } from "../camera";
import { hashString, seededRandom } from "../random";

/** Half the width of a bed: wide enough to hold the seed rows and loose plants. */
export const bedSize = 336;
/** Half the width of the Homestead's fenced yard. */
export const yardSize = 318;

const seeds = new Map<string, [number, number, number]>();

function seedsFor(id: string): [number, number, number] {
  let found = seeds.get(id);
  if (!found) {
    const random = seededRandom(hashString(`bed:${id}`));
    found = [random() * 6, random() * 6, random() * 6];
    seeds.set(id, found);
  }
  return found;
}

/** Distance from the centre to the bed's edge at `angle`. */
export function bedRadius(
  id: string,
  angle: number,
  size = bedSize,
  offset = 0,
  squareness = 4,
): number {
  const [a, b, c] = seedsFor(id);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const superellipse =
    1 /
    Math.pow(
      Math.pow(cos, squareness) + Math.pow(sin, squareness),
      1 / squareness,
    );
  const wobble =
    1 +
    0.018 * Math.sin(3 * angle + a) +
    0.012 * Math.sin(7 * angle + b) +
    0.006 * Math.sin(13 * angle + c);
  return size * superellipse * wobble + offset;
}

export function bedPoints(
  id: string,
  centre: Point,
  size = bedSize,
  offset = 0,
  steps = 120,
  squareness = 4,
): Point[] {
  const points: Point[] = [];
  for (let step = 0; step < steps; step++) {
    const angle = (step / steps) * Math.PI * 2;
    const distance = bedRadius(id, angle, size, offset, squareness);
    points.push({
      x: centre.x + Math.cos(angle) * distance,
      y: centre.y + Math.sin(angle) * distance,
    });
  }
  return points;
}

export function traceBed(
  context: CanvasRenderingContext2D,
  id: string,
  centre: Point,
  size = bedSize,
  offset = 0,
  squareness = 4,
): void {
  context.beginPath();
  bedPoints(id, centre, size, offset, 120, squareness).forEach(
    (point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    },
  );
  context.closePath();
}

/** The same outline as an SVG path, for the still map. */
export function bedPath(
  id: string,
  centre: Point,
  size = bedSize,
  offset = 0,
  squareness = 4,
): string {
  const points = bedPoints(id, centre, size, offset, 48, squareness).map(
    (point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`,
  );
  return `M${points.join("L")}Z`;
}
