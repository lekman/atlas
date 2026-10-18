/**
 * The landscape of the scroll: a few ranges of brushed mountains in the
 * empty country between the clans, pines at their feet, bands of mist, and
 * the fibres and gold flecks of the paper. All of it is placed from fixed
 * seeds and the layout alone, so it draws the same way on every device.
 */
import type { Point } from "../camera";
import type { Layout } from "../layout";
import { seededRandom } from "../random";

export interface Range {
  /** The ridge, left to right. */
  ridge: Point[];
  /** Where the wash fades out, and the highest point of the ridge. */
  base: number;
  top: number;
  /** Short texture strokes down the slopes. */
  slopes: Point[][];
  /** 0 to 1: far ranges are paler. */
  depth: number;
}

export interface Pine {
  root: Point;
  height: number;
  lean: number;
  /** Needle pads: offset from the trunk at a height, and a width. */
  pads: Array<{ along: number; side: number; width: number }>;
}

export interface Mist {
  x: number;
  y: number;
  width: number;
  height: number;
  phase: number;
}

export interface Scenery {
  ranges: Range[];
  pines: Pine[];
  mists: Mist[];
  flecks: Array<{ x: number; y: number; size: number }>;
  fibres: Array<[Point, Point, Point]>;
}

const cache = new WeakMap<Layout, Scenery>();

/** How far from a clan's centre the country is empty enough for a mountain. */
const clearance = 455;

export function sceneryFor(layout: Layout): Scenery {
  const known = cache.get(layout);
  if (known) return known;
  const random = seededRandom(1603);
  const centres = [...layout.clients.values()];
  const { left, right, top, bottom } = layout.bounds;
  const room = (point: Point) =>
    Math.min(
      ...centres.map((centre) =>
        Math.hypot(point.x - centre.x, point.y - centre.y),
      ),
    );

  // Open country: grid points far from every clan, the emptiest first.
  const open: Array<{ point: Point; room: number }> = [];
  for (let y = top + 140; y <= bottom - 60; y += 70) {
    for (let x = left + 120; x <= right - 120; x += 70) {
      const point = { x, y };
      const space = room(point);
      if (space > clearance) open.push({ point, room: space });
    }
  }
  open.sort((a, b) => b.room - a.room);
  const chosen: Array<{ point: Point; room: number }> = [];
  for (const candidate of open) {
    if (chosen.length >= 5) break;
    if (
      chosen.every(
        (other) =>
          Math.hypot(
            other.point.x - candidate.point.x,
            other.point.y - candidate.point.y,
          ) > 560,
      )
    )
      chosen.push(candidate);
  }

  const ranges: Range[] = [];
  const pines: Pine[] = [];
  const mists: Mist[] = [];
  chosen.forEach(({ point, room: space }, index) => {
    const width = Math.min(620, Math.max(300, (space - clearance) * 2.2 + 300));
    const height = width * (0.34 + random() * 0.16);
    const depth = index % 2 === 0 ? 0.35 : 0.8;
    const range = makeRange(point, width, height, depth, random);
    ranges.push(range);
    // A nearer, smaller range in front of the first two, for depth.
    if (index < 2) {
      const front = makeRange(
        {
          x: point.x + (random() - 0.5) * width * 0.5,
          y: point.y + height * 0.32,
        },
        width * 0.6,
        height * 0.5,
        0,
        random,
      );
      ranges.push(front);
    }
    mists.push({
      x: point.x,
      y: range.base - height * 0.28,
      width: width * 1.25,
      height: 34 + random() * 18,
      phase: random() * Math.PI * 2,
    });
    if (index < 3) {
      const count = 2 + Math.floor(random() * 2);
      const foot = {
        x: point.x + (random() < 0.5 ? -1 : 1) * width * 0.38,
        y: range.base - 4,
      };
      for (let tree = 0; tree < count; tree++)
        pines.push(
          makePine(
            {
              x: foot.x + tree * (14 + random() * 10),
              y: foot.y + (random() - 0.5) * 8,
            },
            60 + random() * 34 - tree * 10,
            random,
          ),
        );
    }
  });

  // Free-floating mist across the open country.
  for (const { point } of open
    .slice(0, 40)
    .filter((_, index) => index % 9 === 4))
    mists.push({
      x: point.x,
      y: point.y,
      width: 380 + random() * 200,
      height: 26 + random() * 14,
      phase: random() * Math.PI * 2,
    });

  const flecks: Scenery["flecks"] = [];
  for (let index = 0; index < 110; index++)
    flecks.push({
      x: left - 80 + random() * (right - left + 160),
      y: top - 80 + random() * (bottom - top + 160),
      size: 1.2 + random() * 2.6,
    });

  const fibres: Scenery["fibres"] = [];
  for (let index = 0; index < 180; index++) {
    const start = {
      x: left - 100 + random() * (right - left + 200),
      y: top - 100 + random() * (bottom - top + 200),
    };
    const angle = random() * Math.PI * 2;
    const length = 14 + random() * 30;
    fibres.push([
      start,
      {
        x: start.x + Math.cos(angle + 0.6) * length * 0.5,
        y: start.y + Math.sin(angle + 0.6) * length * 0.5,
      },
      {
        x: start.x + Math.cos(angle) * length,
        y: start.y + Math.sin(angle) * length,
      },
    ]);
  }

  const scenery = { ranges, pines, mists, flecks, fibres };
  cache.set(layout, scenery);
  return scenery;
}

function makeRange(
  centre: Point,
  width: number,
  height: number,
  depth: number,
  random: () => number,
): Range {
  const peaks = 2 + Math.floor(random() * 3);
  const bumps = Array.from({ length: peaks }, (_, index) => ({
    x:
      centre.x -
      width * 0.35 +
      (index / Math.max(1, peaks - 1)) * width * 0.7 +
      (random() - 0.5) * width * 0.12,
    height: height * (0.45 + random() * 0.55),
    spread: width * (0.08 + random() * 0.1),
  }));
  const base = centre.y + height * 0.45;
  const ridge: Point[] = [];
  const steps = 48;
  for (let step = 0; step <= steps; step++) {
    const x = centre.x - width / 2 + (width * step) / steps;
    let lift = 0;
    for (const bump of bumps)
      lift = Math.max(
        lift,
        bump.height * Math.exp(-Math.pow((x - bump.x) / bump.spread, 2)),
      );
    // The ridge settles to the ground at both ends.
    const edge = Math.sin((Math.PI * step) / steps);
    ridge.push({
      x,
      y: base - height * 0.12 * edge - lift * edge + (random() - 0.5) * 3,
    });
  }
  const slopes: Point[][] = [];
  for (const bump of bumps) {
    for (let stroke = 0; stroke < 4; stroke++) {
      const side = stroke % 2 ? 1 : -1;
      const startX = bump.x + side * bump.spread * (0.15 + random() * 0.5);
      const nearest = ridge.reduce((best, point) =>
        Math.abs(point.x - startX) < Math.abs(best.x - startX) ? point : best,
      );
      const length = bump.height * (0.25 + random() * 0.3);
      const points: Point[] = [];
      for (let step = 0; step <= 6; step++) {
        const t = step / 6;
        points.push({
          x:
            nearest.x + side * length * 0.35 * t + Math.sin(t * 3 + stroke) * 2,
          y: nearest.y + 3 + length * t,
        });
      }
      slopes.push(points);
    }
  }
  const top = Math.min(...ridge.map((point) => point.y));
  return { ridge, base, top, slopes, depth };
}

function makePine(root: Point, height: number, random: () => number): Pine {
  const pads: Pine["pads"] = [];
  const tiers = 3 + Math.floor(random() * 2);
  for (let tier = 0; tier < tiers; tier++) {
    const along = 0.42 + (tier / tiers) * 0.6;
    pads.push({
      along,
      side: (tier % 2 ? 1 : -1) * (0.15 + random() * 0.2),
      width: height * (0.5 - tier * 0.07) * (0.8 + random() * 0.4),
    });
  }
  return { root, height, lean: (random() - 0.5) * 0.35, pads };
}
