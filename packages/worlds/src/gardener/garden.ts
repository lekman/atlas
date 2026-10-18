/**
 * The ground of the plan: lawn inside a clipped hedge, gravel paths from the
 * Homestead out to each bed, corner trees and, where there is room, a pond.
 * Everything random here comes from fixed seeds and is cached per layout, so
 * the plan draws the same way on every frame and every device.
 */
import type { Bounds, Point } from "../camera";
import type { Layout } from "../layout";
import { pixels, withAlpha } from "../paint";
import { seededRandom } from "../random";
import type { PaintContext } from "../types";
import { bedRadius, bedSize, yardSize } from "./beds";
import {
  lanternBody,
  lanternPool,
  moonInWater,
  moonlitRims,
  type Lantern,
} from "./night";
import { gardenLook } from "./palette";

interface Blot {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  deep: boolean;
}

interface Shrub {
  x: number;
  y: number;
  radius: number;
}

interface GravelPath {
  from: Point;
  to: Point;
  stones: Array<{ x: number; y: number; radius: number }>;
}

export interface Garden {
  /** The line the hedge grows along. */
  hedgeLine: Bounds;
  blots: Blot[];
  tufts: Point[];
  hedge: Shrub[];
  trees: Shrub[];
  paths: GravelPath[];
  pond: Point | null;
  /** Night only: lanterns along the gravel paths and at the gate in the hedge. */
  pathLanterns: Lantern[];
  /** Night only: the pairs of lanterns where paths leave the Homestead's yard. */
  gates: Lantern[];
  /** Night only: the pair of lanterns at each bed's entrance, by client id. */
  entrances: Map<string, Lantern[]>;
}

const pathWidth = 58;
const cache = new WeakMap<Layout, Garden>();

function insideBed(layout: Layout, point: Point, margin: number): boolean {
  for (const centre of layout.clients.values()) {
    if (
      Math.abs(point.x - centre.x) < bedSize + margin &&
      Math.abs(point.y - centre.y) < bedSize + margin
    )
      return true;
  }
  return false;
}

export function gardenOf(layout: Layout): Garden {
  const found = cache.get(layout);
  if (found) return found;
  const random = seededRandom(1867);
  const { left, right, top, bottom } = layout.bounds;
  const hedgeLine = {
    left: left + 22,
    right: right - 22,
    top: top + 22,
    bottom: bottom - 22,
  };
  const width = hedgeLine.right - hedgeLine.left;
  const height = hedgeLine.bottom - hedgeLine.top;

  const blots: Blot[] = Array.from({ length: 34 }, (_, index) => ({
    x: hedgeLine.left + random() * width,
    y: hedgeLine.top + random() * height,
    radius: 110 + random() * 230,
    alpha: 0.05 + random() * 0.06,
    deep: index % 3 === 0,
  }));

  const tufts: Point[] = [];
  for (let index = 0; index < 420; index++) {
    const point = {
      x: hedgeLine.left + 40 + random() * (width - 80),
      y: hedgeLine.top + 40 + random() * (height - 80),
    };
    if (!insideBed(layout, point, 30)) tufts.push(point);
  }

  const homeEntry = [...layout.clients.entries()].find(
    ([, point]) => point.x === 0 && point.y === 0,
  );
  const home = homeEntry?.[1] ?? { x: 0, y: 0 };
  const paths: GravelPath[] = [];
  const addPath = (from: Point, to: Point) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const stones = Array.from({ length: Math.round(length / 4) }, () => {
      const along = random();
      const across = (random() - 0.5) * (pathWidth - 8);
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      return {
        x: from.x + (to.x - from.x) * along - Math.sin(angle) * across,
        y: from.y + (to.y - from.y) * along + Math.cos(angle) * across,
        radius: 1.2 + random() * 2.2,
      };
    });
    paths.push({ from, to, stones });
  };
  for (const [id, centre] of layout.clients) {
    if (homeEntry && id === homeEntry[0]) continue;
    addPath(home, centre);
  }
  if (layout.orientation === "landscape")
    addPath({ x: home.x, y: hedgeLine.bottom }, home);
  const { pathLanterns, gates, entrances } = placeLanterns(
    layout,
    homeEntry?.[0] ?? "",
    home,
    hedgeLine,
  );

  const hedge: Shrub[] = [];
  const step = 19;
  const edge = (from: Point, to: Point) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    for (let along = 0; along < length; along += step) {
      const x = from.x + ((to.x - from.x) * along) / length;
      const y = from.y + ((to.y - from.y) * along) / length;
      // A gate where the gravel path from the lane comes in.
      if (
        layout.orientation === "landscape" &&
        y === hedgeLine.bottom &&
        Math.abs(x - home.x) < pathWidth * 0.8
      )
        continue;
      hedge.push({
        x: x + (random() - 0.5) * 5,
        y: y + (random() - 0.5) * 5,
        radius: 15 + random() * 6,
      });
    }
  };
  edge(
    { x: hedgeLine.left, y: hedgeLine.top },
    { x: hedgeLine.right, y: hedgeLine.top },
  );
  edge(
    { x: hedgeLine.right, y: hedgeLine.top },
    { x: hedgeLine.right, y: hedgeLine.bottom },
  );
  edge(
    { x: hedgeLine.right, y: hedgeLine.bottom },
    { x: hedgeLine.left, y: hedgeLine.bottom },
  );
  edge(
    { x: hedgeLine.left, y: hedgeLine.bottom },
    { x: hedgeLine.left, y: hedgeLine.top },
  );

  const trees: Shrub[] = [
    { x: hedgeLine.left + 70, y: hedgeLine.top + 70, radius: 62 },
    { x: hedgeLine.right - 70, y: hedgeLine.top + 70, radius: 54 },
    { x: hedgeLine.left + 70, y: hedgeLine.bottom - 70, radius: 50 },
    { x: hedgeLine.right - 70, y: hedgeLine.bottom - 70, radius: 64 },
  ].filter((tree) => !insideBed(layout, tree, -tree.radius * 0.4));

  const pondPoint = { x: home.x, y: hedgeLine.top + 230 };
  const pond =
    layout.orientation === "landscape" &&
    !insideBed(layout, pondPoint, 120) &&
    pondPoint.y < home.y - 520
      ? pondPoint
      : null;

  const garden = {
    hedgeLine,
    blots,
    tufts,
    hedge,
    trees,
    paths,
    pond,
    pathLanterns,
    gates,
    entrances,
  };
  cache.set(layout, garden);
  return garden;
}

/**
 * Where the lanterns stand: in pairs where each gravel path leaves the
 * Homestead's yard and where it meets a bed's box edging, and singly along
 * any long stretch between, alternating sides. In landscape a pair also marks
 * the gate in the hedge. A random of their own keeps the day's seeded drawing
 * exactly as it was.
 */
function placeLanterns(
  layout: Layout,
  homeId: string,
  home: Point,
  hedgeLine: Bounds,
): {
  pathLanterns: Lantern[];
  gates: Lantern[];
  entrances: Map<string, Lantern[]>;
} {
  const random = seededRandom(5309);
  const beside = pathWidth / 2 + 16;
  const lantern = (x: number, y: number): Lantern => ({
    x,
    y,
    seed: random() * 10,
  });
  const pathLanterns: Lantern[] = [];
  const gates: Lantern[] = [];
  const entrances = new Map<string, Lantern[]>();
  for (const [id, centre] of layout.clients) {
    if (id === homeId) continue;
    const angle = Math.atan2(centre.y - home.y, centre.x - home.x);
    const length = Math.hypot(centre.x - home.x, centre.y - home.y);
    const along = { x: Math.cos(angle), y: Math.sin(angle) };
    const across = { x: -along.y, y: along.x };
    const at = (distance: number, side: number) =>
      lantern(
        home.x + along.x * distance + across.x * side * beside,
        home.y + along.y * distance + across.y * side * beside,
      );
    const bedEdge = length - bedRadius(id, angle + Math.PI, bedSize, 8) - 34;
    entrances.set(id, [at(bedEdge, -1), at(bedEdge, 1)]);
    const gate = bedRadius(homeId, angle, yardSize, 0, 6) - 26;
    gates.push(at(gate, -1), at(gate, 1));
    const start = gate + 260;
    const end = bedEdge - 220;
    if (end > start) {
      const count = Math.round((end - start) / 280);
      for (let index = 0; index <= count; index++) {
        const distance =
          count === 0
            ? (start + end) / 2
            : start + ((end - start) * index) / count;
        pathLanterns.push(at(distance, index % 2 ? 1 : -1));
      }
    }
  }
  if (layout.orientation === "landscape") {
    const gate = hedgeLine.bottom - 44;
    for (const side of [-1, 1])
      pathLanterns.push(lantern(home.x + side * beside, gate));
    const yardEdge = home.y + bedRadius(homeId, Math.PI / 2, yardSize, 0, 6);
    for (const side of [-1, 1])
      gates.push(lantern(home.x + side * beside, yardEdge - 26));
    if (gate - yardEdge > 300)
      pathLanterns.push(lantern(home.x + beside, (gate + yardEdge) / 2));
  }
  return { pathLanterns, gates, entrances };
}

/** The lanterns along the paths: pools first, so no pool lights another's lamp. */
export function drawPathLanterns(paint: PaintContext, garden: Garden): void {
  for (const lantern of garden.pathLanterns) lanternPool(paint, lantern);
  for (const lantern of garden.pathLanterns) lanternBody(paint, lantern);
}

/** A watercolour bloom: soft in the middle, pigment gathered towards its rim. */
export function softBlot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colour: string,
  alpha: number,
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, withAlpha(colour, alpha * 0.5));
  gradient.addColorStop(0.8, withAlpha(colour, alpha));
  gradient.addColorStop(0.9, withAlpha(colour, alpha * 0.6));
  gradient.addColorStop(1, withAlpha(colour, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

export function drawLawn(paint: PaintContext, garden: Garden): void {
  const { context } = paint;
  const { hedgeLine } = garden;
  const { washes, night } = gardenLook(paint.lighting);
  context.save();
  context.beginPath();
  context.rect(
    hedgeLine.left,
    hedgeLine.top,
    hedgeLine.right - hedgeLine.left,
    hedgeLine.bottom - hedgeLine.top,
  );
  context.clip();
  context.fillStyle = withAlpha(washes.lawn, night ? 0.32 : 0.2);
  context.fillRect(
    hedgeLine.left,
    hedgeLine.top,
    hedgeLine.right - hedgeLine.left,
    hedgeLine.bottom - hedgeLine.top,
  );
  for (const blot of garden.blots)
    softBlot(
      context,
      blot.x,
      blot.y,
      blot.radius,
      blot.deep ? washes.lawnDeep : washes.lawn,
      night ? blot.alpha * 2.2 : blot.alpha,
    );
  if (paint.camera.scale > 0.3) {
    // At night the grass blades are what the moon catches.
    context.strokeStyle = night
      ? withAlpha(washes.lawn, 0.55)
      : withAlpha(washes.lawnDeep, 0.38);
    context.lineWidth = pixels(paint, 0.8);
    context.beginPath();
    for (const tuft of garden.tufts) {
      for (const lean of [-1, 0, 1]) {
        context.moveTo(tuft.x + lean * 2.5, tuft.y);
        context.lineTo(tuft.x + lean * 5, tuft.y - 6 + Math.abs(lean) * 1.5);
      }
    }
    context.stroke();
  }
  context.restore();
}

export function drawPaths(paint: PaintContext, garden: Garden): void {
  const { context } = paint;
  const { washes } = gardenLook(paint.lighting);
  context.save();
  context.lineCap = "butt";
  for (const path of garden.paths) {
    const { from, to } = path;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const across = { x: -Math.sin(angle), y: Math.cos(angle) };
    context.strokeStyle = withAlpha(washes.gravel, 0.95);
    context.lineWidth = pathWidth;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.strokeStyle = withAlpha(washes.gravelStone, 0.55);
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    for (const side of [-1, 1]) {
      const offset = (side * pathWidth) / 2;
      context.moveTo(from.x + across.x * offset, from.y + across.y * offset);
      context.lineTo(to.x + across.x * offset, to.y + across.y * offset);
    }
    context.stroke();
    if (paint.camera.scale > 0.24) {
      context.fillStyle = withAlpha(washes.gravelStone, 0.42);
      context.beginPath();
      for (const stone of path.stones) {
        context.moveTo(stone.x + stone.radius, stone.y);
        context.arc(stone.x, stone.y, stone.radius, 0, Math.PI * 2);
      }
      context.fill();
    }
  }
  context.restore();
}

function drawShrubs(
  paint: PaintContext,
  shrubs: Shrub[],
  fill: string,
  highlight: boolean,
) {
  const { context } = paint;
  const { washes, night } = gardenLook(paint.lighting);
  context.fillStyle = fill;
  context.beginPath();
  for (const shrub of shrubs) {
    context.moveTo(shrub.x + shrub.radius, shrub.y);
    context.arc(shrub.x, shrub.y, shrub.radius, 0, Math.PI * 2);
  }
  context.fill();
  context.strokeStyle = withAlpha(washes.hedgeDeep, 0.75);
  context.lineWidth = pixels(paint, 1);
  context.stroke();
  if (night) {
    // A dark silhouette, edged by the moon.
    moonlitRims(paint, shrubs, washes.hedgeLight, highlight ? 0.42 : 0.3);
  } else if (highlight) {
    context.fillStyle = withAlpha(washes.hedgeLight, 0.55);
    context.beginPath();
    for (const shrub of shrubs) {
      const radius = shrub.radius * 0.5;
      const x = shrub.x - shrub.radius * 0.28;
      const y = shrub.y - shrub.radius * 0.28;
      context.moveTo(x + radius, y);
      context.arc(x, y, radius, 0, Math.PI * 2);
    }
    context.fill();
  }
}

export function drawHedgeAndTrees(paint: PaintContext, garden: Garden): void {
  const { context } = paint;
  const { washes, night } = gardenLook(paint.lighting);
  const detailed = paint.camera.scale > 0.2;
  drawShrubs(
    paint,
    garden.hedge,
    withAlpha(washes.hedge, night ? 0.97 : 0.9),
    detailed,
  );
  for (const tree of garden.trees) {
    // A tree in plan: a broad scalloped canopy and the dot of its trunk.
    context.fillStyle = withAlpha(washes.hedge, night ? 0.85 : 0.42);
    context.strokeStyle = withAlpha(washes.hedgeDeep, 0.7);
    context.lineWidth = pixels(paint, 1.1);
    context.beginPath();
    const lobes = 14;
    for (let lobe = 0; lobe <= lobes; lobe++) {
      const from = (lobe / lobes) * Math.PI * 2;
      const to = ((lobe + 1) / lobes) * Math.PI * 2;
      const middle = (from + to) / 2;
      if (lobe === 0)
        context.moveTo(
          tree.x + Math.cos(from) * tree.radius,
          tree.y + Math.sin(from) * tree.radius,
        );
      context.quadraticCurveTo(
        tree.x + Math.cos(middle) * tree.radius * 1.14,
        tree.y + Math.sin(middle) * tree.radius * 1.14,
        tree.x + Math.cos(to) * tree.radius,
        tree.y + Math.sin(to) * tree.radius,
      );
    }
    context.fill();
    context.stroke();
    if (night) {
      moonlitRims(
        paint,
        [{ x: tree.x, y: tree.y, radius: tree.radius * 1.12 }],
        washes.hedgeLight,
        0.3,
      );
    } else {
      context.fillStyle = withAlpha(washes.hedgeLight, 0.4);
      context.beginPath();
      context.arc(
        tree.x - tree.radius * 0.25,
        tree.y - tree.radius * 0.25,
        tree.radius * 0.55,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.fillStyle = washes.wood;
    context.beginPath();
    context.arc(tree.x, tree.y, 4, 0, Math.PI * 2);
    context.fill();
  }
}

export function drawPond(
  paint: PaintContext,
  centre: Point,
  time: number,
  reducedMotion: boolean,
): void {
  const { context } = paint;
  const { washes, night } = gardenLook(paint.lighting);
  const trace = (grow: number) => {
    context.beginPath();
    for (let step = 0; step <= 64; step++) {
      const angle = (step / 64) * Math.PI * 2;
      const radius =
        1 + 0.16 * Math.sin(2 * angle + 0.6) + 0.06 * Math.sin(5 * angle);
      const x = centre.x + Math.cos(angle) * (96 * radius + grow);
      const y = centre.y + Math.sin(angle) * (58 * radius + grow);
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  };
  trace(10);
  context.fillStyle = withAlpha(washes.stone, 0.35);
  context.fill();
  context.strokeStyle = withAlpha(washes.gravelStone, 0.6);
  context.lineWidth = pixels(paint, 1);
  context.stroke();
  trace(0);
  context.fillStyle = withAlpha(washes.water, 0.6);
  context.fill();
  context.strokeStyle = withAlpha(washes.waterDeep, 0.65);
  context.lineWidth = pixels(paint, 1.2);
  context.stroke();
  trace(-16);
  context.fillStyle = withAlpha(washes.water, 0.35);
  context.fill();
  if (night) {
    context.save();
    trace(-2);
    context.clip();
    moonInWater(paint, { x: centre.x + 42, y: centre.y + 4 }, 11);
    context.restore();
  }
  // Lily pads, turning very slowly on the surface.
  const turn = reducedMotion ? 0 : time * 0.05;
  for (const [dx, dy, radius] of [
    [-40, -10, 13],
    [-18, 16, 10],
    [30, -18, 12],
  ] as const) {
    const x = centre.x + dx;
    const y = centre.y + dy;
    context.fillStyle = withAlpha(washes.leaf, night ? 0.75 : 0.85);
    context.beginPath();
    context.moveTo(x, y);
    context.arc(
      x,
      y,
      radius,
      turn + dx * 0.05 + 0.35,
      turn + dx * 0.05 + Math.PI * 2,
    );
    context.closePath();
    context.fill();
  }
  context.fillStyle = washes.petal;
  context.beginPath();
  context.arc(centre.x - 36, centre.y - 13, 3.2, 0, Math.PI * 2);
  context.fill();
}
