/**
 * The ground the Woodsman's map is printed on: clearings, the hills around
 * them, rivers, trails and the trees between. Every shape comes from a fixed
 * seed or from the layout, so the map draws the same way on every device,
 * and each is worked out once per layout and kept.
 */
import type { Point } from "../camera";
import { curveBetween } from "../paint";
import { rings, type Layout } from "../layout";
import { hashString, seededRandom } from "../random";

/** A client's clearing, and Base Camp's, which holds the tents. */
export const clearingRadius = 128;
export const homeClearingRadius = 150;
/** The little knoll each waymark stands on. */
export const knollRadius = 78;

const seeds = new Map<string, number[]>();

function seedsFor(id: string): number[] {
  let found = seeds.get(id);
  if (!found) {
    const random = seededRandom(hashString(id));
    found = Array.from({ length: 8 }, () => random() * Math.PI * 2);
    seeds.set(id, found);
  }
  return found;
}

/**
 * The distance from a centre to a wobbly outline, at an angle. `ring` 0 is
 * the clearing's edge; rings further out wobble more, as contours do.
 */
export function outlineRadius(
  id: string,
  angle: number,
  radius: number,
  ring = 0,
): number {
  const [a = 0, b = 0, c = 0, d = 0] = seedsFor(id);
  const wobble = 1 + ring * 0.35;
  return (
    radius *
    (1 +
      wobble *
        (0.07 * Math.sin(2 * angle + a) +
          0.05 * Math.sin(3 * angle + b) +
          0.03 * Math.sin(5 * angle + c) +
          0.015 * Math.sin(9 * angle + d + ring)))
  );
}

/** Contours drift to one side as they spread, so a hill leans. */
export function contourCentre(id: string, centre: Point, ring: number): Point {
  const [, , , , lean = 0] = seedsFor(id);
  return {
    x: centre.x + Math.cos(lean) * ring * 7,
    y: centre.y + Math.sin(lean) * ring * 7,
  };
}

export function traceOutline(
  context: CanvasRenderingContext2D,
  id: string,
  centre: Point,
  radius: number,
  ring = 0,
  steps = 96,
): void {
  context.beginPath();
  for (let step = 0; step <= steps; step++) {
    const angle = (step / steps) * Math.PI * 2;
    const distance = outlineRadius(id, angle, radius, ring);
    const x = centre.x + Math.cos(angle) * distance;
    const y = centre.y + Math.sin(angle) * distance;
    if (step === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

/** The same outline as an SVG path, for the still map. */
export function outlinePath(
  id: string,
  centre: Point,
  radius: number,
  ring = 0,
): string {
  const points: string[] = [];
  for (let step = 0; step < 48; step++) {
    const angle = (step / 48) * Math.PI * 2;
    const distance = outlineRadius(id, angle, radius, ring);
    points.push(
      `${(centre.x + Math.cos(angle) * distance).toFixed(1)},${(centre.y + Math.sin(angle) * distance).toFixed(1)}`,
    );
  }
  return `M${points.join("L")}Z`;
}

export interface Tree {
  x: number;
  y: number;
  size: number;
  conifer: boolean;
}

export interface Bridge {
  x: number;
  y: number;
  /** Radians, along the trail. */
  angle: number;
}

export interface Terrain {
  rivers: Point[][];
  /** From Base Camp's edge to each clearing's edge. */
  trails: Point[][];
  /** From a clearing's edge out to each of its waymarks. */
  spurs: Point[][];
  bridges: Bridge[];
  trees: Tree[];
  /** A few hills between the clearings, for the contours. */
  hills: Array<{ id: string; centre: Point; radius: number; rings: number }>;
  /** The spot height printed on each clearing's hill. */
  heights: Map<string, number>;
}

const cache = new WeakMap<Layout, Terrain>();

export function terrainOf(
  layout: Layout,
  homeId: string | null,
  requirementsByClient: Map<string, Point[]>,
): Terrain {
  let found = cache.get(layout);
  if (!found) {
    found = buildTerrain(layout, homeId, requirementsByClient);
    cache.set(layout, found);
  }
  return found;
}

interface Obstacle {
  centre: Point;
  radius: number;
}

function buildTerrain(
  layout: Layout,
  homeId: string | null,
  requirementsByClient: Map<string, Point[]>,
): Terrain {
  const { left, right, top, bottom } = layout.bounds;
  const width = right - left;
  const height = bottom - top;
  const centres = [...layout.clients.entries()];
  const home = homeId ? layout.clients.get(homeId) : undefined;
  const obstacles: Obstacle[] = centres.map(([, centre]) => ({
    centre,
    radius: rings.requirement + 60,
  }));

  const rivers = [
    river(
      { x: left + width * 0.36, y: top - 500 },
      { x: left + width * 0.3, y: bottom + 500 },
      obstacles,
      3,
    ),
    river(
      { x: right + 500, y: top + height * 0.55 },
      { x: left + width * 0.64, y: bottom + 500 },
      obstacles,
      5,
    ),
  ];

  const trails: Point[][] = [];
  const spurs: Point[][] = [];
  if (home) {
    centres.forEach(([id, centre], index) => {
      if (id === homeId) return;
      const curve = curveBetween(home, centre, index % 2 ? 0.1 : -0.1);
      const points: Point[] = [];
      for (let step = 0; step <= 48; step++) points.push(curve.at(step / 48));
      trails.push(
        clipToOutside(points, [
          { centre: home, radius: homeClearingRadius - 6 },
          { centre, radius: clearingRadius - 6 },
        ]),
      );
    });
  }
  for (const [id, centre] of centres) {
    const radius = id === homeId ? homeClearingRadius : clearingRadius;
    for (const waymark of requirementsByClient.get(id) ?? []) {
      const angle = Math.atan2(waymark.y - centre.y, waymark.x - centre.x);
      const from = {
        x: centre.x + Math.cos(angle) * (radius - 8),
        y: centre.y + Math.sin(angle) * (radius - 8),
      };
      const to = {
        x: waymark.x - Math.cos(angle) * 22,
        y: waymark.y - Math.sin(angle) * 22,
      };
      const curve = curveBetween(from, to, 0.08);
      const points: Point[] = [];
      for (let step = 0; step <= 12; step++) points.push(curve.at(step / 12));
      spurs.push(points);
    }
  }

  const bridges: Bridge[] = [];
  for (const trail of trails) {
    for (const water of rivers) {
      const crossing = firstCrossing(trail, water);
      if (crossing) bridges.push(crossing);
    }
  }

  const hills = placeHills(layout, obstacles);
  const heights = new Map<string, number>();
  for (const [id] of centres) heights.set(id, 300 + (hashString(id) % 40) * 10);

  const trees = placeTrees(layout, rivers, trails, spurs, requirementsByClient);
  return { rivers, trails, spurs, bridges, trees, hills, heights };
}

function river(
  from: Point,
  to: Point,
  obstacles: Obstacle[],
  seed: number,
): Point[] {
  const random = seededRandom(seed);
  const phase = random() * Math.PI * 2;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const across = {
    x: -(to.y - from.y) / length,
    y: (to.x - from.x) / length,
  };
  let points: Point[] = [];
  const count = 160;
  for (let step = 0; step <= count; step++) {
    const t = step / count;
    const meander =
      Math.sin(t * 17 + phase) * 70 +
      Math.sin(t * 43 + phase * 2) * 26 +
      Math.sin(t * 97 + phase * 3) * 8;
    points.push({
      x: from.x + (to.x - from.x) * t + across.x * meander,
      y: from.y + (to.y - from.y) * t + across.y * meander,
    });
  }
  for (let pass = 0; pass < 8; pass++) {
    points = points.map((point) => pushOut(point, obstacles));
    points = points.map((point, index) => {
      const before = points[index - 1];
      const after = points[index + 1];
      if (!before || !after) return point;
      return {
        x: point.x * 0.5 + (before.x + after.x) * 0.25,
        y: point.y * 0.5 + (before.y + after.y) * 0.25,
      };
    });
  }
  points = points.map((point) => pushOut(point, obstacles));
  return chaikin(chaikin(points));
}

function pushOut(point: Point, obstacles: Obstacle[]): Point {
  let result = point;
  for (const { centre, radius } of obstacles) {
    const dx = result.x - centre.x;
    const dy = result.y - centre.y;
    const distance = Math.hypot(dx, dy) || 0.001;
    if (distance < radius)
      result = {
        x: centre.x + (dx / distance) * radius,
        y: centre.y + (dy / distance) * radius,
      };
  }
  return result;
}

function chaikin(points: Point[]): Point[] {
  const result: Point[] = [];
  const first = points[0];
  const last = points[points.length - 1];
  if (first) result.push(first);
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index];
    const b = points[index + 1];
    if (!a || !b) continue;
    result.push(
      { x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 },
      { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 },
    );
  }
  if (last) result.push(last);
  return result;
}

function clipToOutside(points: Point[], areas: Obstacle[]): Point[] {
  return points.filter((point) =>
    areas.every(
      ({ centre, radius }) =>
        Math.hypot(point.x - centre.x, point.y - centre.y) > radius,
    ),
  );
}

function firstCrossing(trail: Point[], water: Point[]): Bridge | null {
  for (let index = 0; index < trail.length - 1; index++) {
    const a = trail[index];
    const b = trail[index + 1];
    if (!a || !b) continue;
    for (let other = 0; other < water.length - 1; other++) {
      const c = water[other];
      const d = water[other + 1];
      if (!c || !d) continue;
      const hit = intersect(a, b, c, d);
      if (hit) return { ...hit, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
  }
  return null;
}

function intersect(a: Point, b: Point, c: Point, d: Point): Point | null {
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(denominator) < 1e-9) return null;
  const t =
    ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator;
  const u =
    ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function placeHills(layout: Layout, obstacles: Obstacle[]): Terrain["hills"] {
  const random = seededRandom(23);
  const { left, right, top, bottom } = layout.bounds;
  const hills: Terrain["hills"] = [];
  for (let attempt = 0; attempt < 60 && hills.length < 5; attempt++) {
    const centre = {
      x: left + random() * (right - left),
      y: top + random() * (bottom - top),
    };
    const radius = 40 + random() * 50;
    const clear = obstacles.every(
      (obstacle) =>
        Math.hypot(centre.x - obstacle.centre.x, centre.y - obstacle.centre.y) >
        obstacle.radius + radius + 120,
    );
    const apart = hills.every(
      (hill) =>
        Math.hypot(centre.x - hill.centre.x, centre.y - hill.centre.y) > 360,
    );
    if (clear && apart)
      hills.push({
        id: `hill-${attempt}`,
        centre,
        radius,
        rings: 3 + Math.floor(random() * 3),
      });
  }
  return hills;
}

function distanceToPolyline(point: Point, line: Point[]): number {
  let best = Infinity;
  for (let index = 0; index < line.length - 1; index++) {
    const a = line[index];
    const b = line[index + 1];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared,
      ),
    );
    best = Math.min(
      best,
      Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t)),
    );
  }
  return best;
}

function placeTrees(
  layout: Layout,
  rivers: Point[][],
  trails: Point[][],
  spurs: Point[][],
  requirementsByClient: Map<string, Point[]>,
): Tree[] {
  const random = seededRandom(41);
  const { left, right, top, bottom } = layout.bounds;
  const margin = 700;
  const spacing = 46;
  const trees: Tree[] = [];
  const waymarks = [...requirementsByClient.values()].flat();
  const centres = [...layout.clients.values()];
  for (let y = top - margin; y < bottom + margin; y += spacing) {
    for (let x = left - margin; x < right + margin; x += spacing) {
      const point = {
        x: x + (random() - 0.5) * spacing * 0.9,
        y: y + (random() - 0.5) * spacing * 0.9,
      };
      // Woods thin out in a patchwork, as real ones do.
      const patch =
        Math.sin(point.x * 0.004 + 1.3) * Math.cos(point.y * 0.005 - 0.4) +
        Math.sin((point.x + point.y) * 0.0021);
      const nearClearing = centres.some(
        (centre) => Math.hypot(point.x - centre.x, point.y - centre.y) < 440,
      );
      if (!nearClearing && patch < -0.3) continue;
      if (
        centres.some(
          (centre) =>
            Math.hypot(point.x - centre.x, point.y - centre.y) <
            homeClearingRadius + 36,
        )
      )
        continue;
      if (
        waymarks.some(
          (waymark) =>
            Math.hypot(point.x - waymark.x, point.y - waymark.y) <
            knollRadius + 10,
        )
      )
        continue;
      if (rivers.some((line) => distanceToPolyline(point, line) < 30)) continue;
      if (
        [...trails, ...spurs].some(
          (line) => distanceToPolyline(point, line) < 16,
        )
      )
        continue;
      trees.push({
        ...point,
        size: 5 + random() * 3,
        conifer:
          Math.sin(point.x * 0.003 - 0.8) + Math.cos(point.y * 0.0042 + 2) >
          0.2,
      });
    }
  }
  return trees;
}
