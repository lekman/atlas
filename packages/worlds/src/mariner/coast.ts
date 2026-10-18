/**
 * Coastlines. Each island's outline is a wobbly circle seeded from its id,
 * so it keeps its shape across reloads and devices.
 */
import type { Point } from "../camera";
import { hashString, seededRandom } from "../random";

export const islandRadius = 96;

const seeds = new Map<string, [number, number, number]>();

function seedsFor(id: string): [number, number, number] {
  let found = seeds.get(id);
  if (!found) {
    const random = seededRandom(hashString(id));
    found = [random() * 6, random() * 6, random() * 6];
    seeds.set(id, found);
  }
  return found;
}

export function coastRadius(
  id: string,
  angle: number,
  offset = 0,
  radius = islandRadius,
): number {
  const [a, b, c] = seedsFor(id);
  return (
    radius *
      (1 +
        0.13 * Math.sin(3 * angle + a) +
        0.08 * Math.sin(5 * angle + b) +
        0.05 * Math.sin(9 * angle + c)) +
    offset
  );
}

export function traceCoast(
  context: CanvasRenderingContext2D,
  id: string,
  centre: Point,
  offset = 0,
  radius = islandRadius,
): void {
  context.beginPath();
  for (let step = 0; step <= 96; step++) {
    const angle = (step / 96) * Math.PI * 2;
    const distance = coastRadius(id, angle, offset, radius);
    const x = centre.x + Math.cos(angle) * distance;
    const y = centre.y + Math.sin(angle) * distance;
    if (step === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

/** The same outline as an SVG path, for the still map. */
export function coastPath(
  id: string,
  centre: Point,
  offset = 0,
  radius = islandRadius,
): string {
  const points: string[] = [];
  for (let step = 0; step < 48; step++) {
    const angle = (step / 48) * Math.PI * 2;
    const distance = coastRadius(id, angle, offset, radius);
    points.push(
      `${(centre.x + Math.cos(angle) * distance).toFixed(1)},${(centre.y + Math.sin(angle) * distance).toFixed(1)}`,
    );
  }
  return `M${points.join("L")}Z`;
}
