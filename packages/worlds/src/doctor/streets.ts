/**
 * The streets of the Doctor's district, worked out from the shared layout so
 * they follow it in landscape and portrait alike.
 *
 * The Practice sits at the centre inside a square ring road. Each hospital
 * keeps a square of ground clear of streets, and has an ambulance bay with a
 * drive out to the street it fronts. From there a main road (its spoke)
 * runs along city streets, turning at right angles, to the ring. A spoke
 * depends only on the hospital's centre, so the still SVG map draws exactly
 * the same main roads as the live map. Around all that, a grid of ordinary
 * streets fills the town, with a river along one side and a park or two.
 *
 * Ambulances follow the street graph: the shortest route by length, a little
 * cheaper along main roads, with a cost for every turn so a run takes the
 * straight way rather than a staircase.
 */
import type { Point } from "../camera";
import type { Layout } from "../layout";
import { hashString, seededRandom } from "../random";

export interface Rectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Half the side of the ring road around The Practice, to its centre line. */
export const ringHalf = 380;
export const streetWidth = 34;
export const mainRoadWidth = 46;
export const driveWidth = 22;
/** Half the side of the square of ground a hospital keeps clear of streets. */
export const hospitalReach = 330;
/** How far from its centre a hospital's ambulance bay (or The Practice's car park) sits. */
export const bayDistance = 200;
/**
 * How far round from a place's outward direction the bay sits. The layout
 * puts departments within 1.2 radians of outward, recorded diagnoses from
 * 2.1 radians on, and admissions opposite, so this is the one clear gap.
 */
const bayTurn = -2.2;
const frontageGap = 40;
const snapReach = 150;
const mergeReach = 160;
const fillerSpacing = 300;
/** How far past the layout's bounds the town carries on, so a wide screen is never empty. */
const townExtent = 2400;
/** A block's edge, set back from the centre line of its streets. */
export const blockInset = streetWidth / 2 + 7;

export function outwardOf(centre: Point, home: boolean): number {
  return home ? Math.PI / 2 : Math.atan2(centre.y, centre.x || 0.0001);
}

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

function distinct(points: Point[]): Point[] {
  return points.filter((point, index) => {
    const before = points[index - 1];
    return (
      !before ||
      Math.abs(before.x - point.x) > 0.5 ||
      Math.abs(before.y - point.y) > 0.5
    );
  });
}

export interface Spoke {
  /** Where an ambulance stands: a hospital's bay, or The Practice's car park. */
  bay: Point;
  /** The drive from the bay out to the street it fronts. */
  drive: [Point, Point];
  /** From the end of the drive along the main road to the ring. Empty at home. */
  road: Point[];
}

/** Where a street fronting a hospital runs, on one axis. */
function frontage(value: number, across: number): number {
  const side = Math.sign(value) || 1;
  const distance = Math.abs(value) - hospitalReach - frontageGap;
  let result: number;
  if (Math.abs(distance - ringHalf) <= snapReach) result = ringHalf;
  else if (distance <= snapReach) result = 0;
  else result = distance;
  // A drive that arrives level with the ring must stop at the ring, not inside it.
  if (Math.abs(across) < ringHalf) result = Math.max(result, ringHalf);
  return side * result;
}

/**
 * A place's bay, its drive and its main road to the ring. Worked out from
 * the centre alone (home is always at the origin), so the live map and the
 * still map agree.
 */
export function spokeOf(centre: Point, home: boolean): Spoke {
  const angle = outwardOf(centre, home) + bayTurn;
  const bay = {
    x: centre.x + Math.cos(angle) * bayDistance,
    y: centre.y + Math.sin(angle) * bayDistance,
  };
  const offset = { x: bay.x - centre.x, y: bay.y - centre.y };
  const preferHorizontal = Math.abs(offset.x) >= Math.abs(offset.y);

  if (home) {
    const end = preferHorizontal
      ? { x: (Math.sign(offset.x) || 1) * ringHalf, y: bay.y }
      : { x: bay.x, y: (Math.sign(offset.y) || 1) * ringHalf };
    return { bay, drive: [bay, end], road: [] };
  }

  const build = (horizontal: boolean) => {
    if (horizontal) {
      const x = frontage(centre.x, bay.y);
      const end = { x, y: bay.y };
      const turn = { x, y: clamp(bay.y, -ringHalf, ringHalf) };
      const ring = { x: clamp(x, -ringHalf, ringHalf), y: turn.y };
      return {
        valid: Math.abs(x - centre.x) >= hospitalReach,
        spoke: { bay, drive: [bay, end], road: distinct([end, turn, ring]) },
      };
    }
    const y = frontage(centre.y, bay.x);
    const end = { x: bay.x, y };
    const turn = { x: clamp(bay.x, -ringHalf, ringHalf), y };
    const ring = { x: turn.x, y: clamp(y, -ringHalf, ringHalf) };
    return {
      valid: Math.abs(y - centre.y) >= hospitalReach,
      spoke: { bay, drive: [bay, end], road: distinct([end, turn, ring]) },
    };
  };
  const first = build(preferHorizontal);
  if (first.valid) return first.spoke as Spoke;
  const second = build(!preferHorizontal);
  return (second.valid ? second.spoke : first.spoke) as Spoke;
}

/** The four sides of the ring road, as closed polyline. */
export function ringRoad(): Point[] {
  return [
    { x: -ringHalf, y: -ringHalf },
    { x: ringHalf, y: -ringHalf },
    { x: ringHalf, y: ringHalf },
    { x: -ringHalf, y: ringHalf },
    { x: -ringHalf, y: -ringHalf },
  ];
}

export interface Edge {
  a: number;
  b: number;
  length: number;
  main: boolean;
  drive: boolean;
}

export interface Tree {
  x: number;
  y: number;
  radius: number;
}

export interface TownBlock {
  /** The block, already set back from its streets. */
  area: Rectangle;
  kind: "buildings" | "park" | "embankment";
  buildings: Rectangle[];
  windows: Point[];
  trees: Tree[];
  /** A footpath across a park. */
  path: Point[];
}

export interface River {
  /** The band between two streets that the river runs down. */
  band: Rectangle;
  vertical: boolean;
  /** The two banks, each from one end of the town to the other. */
  banks: [Point[], Point[]];
}

export interface StreetPlan {
  extent: Rectangle;
  xs: number[];
  ys: number[];
  /** Each client's block, to the centre line of the streets around it. */
  cells: Map<string, Rectangle>;
  town: TownBlock[];
  river: River | null;
  nodes: Point[];
  edges: Edge[];
  adjacency: Array<Array<{ to: number; edge: number }>>;
  spokes: Map<string, Spoke>;
  bayNodes: Map<string, number>;
  /** The ring and every spoke, for drawing. */
  mainRoads: Point[][];
  lights: Point[];
  /** Routes worked out so far, by `from>to`. */
  routes: Map<string, Point[]>;
}

const plans = new WeakMap<Layout, StreetPlan>();

export function streetPlan(layout: Layout, homeId: string | null): StreetPlan {
  const known = plans.get(layout);
  if (known) return known;
  const plan = buildPlan(layout, homeId);
  plans.set(layout, plan);
  return plan;
}

type LineKind = 0 | 1 | 2;
interface Line {
  value: number;
  /** 0 a main road, 1 a street midway between two hospitals, 2 a street beside one. */
  kind: LineKind;
}

function mergeLines(lines: Line[]): number[] {
  const sorted = [...lines].sort((a, b) => a.value - b.value);
  const result: number[] = [];
  let cluster: Line[] = [];
  const flush = () => {
    if (cluster.length === 0) return;
    const main = cluster.filter((line) => line.kind === 0);
    const middle = cluster.filter((line) => line.kind === 1);
    if (main.length > 0) {
      for (const line of main)
        if (!result.some((value) => Math.abs(value - line.value) < 1))
          result.push(line.value);
    } else if (middle.length > 0) {
      result.push(
        middle.reduce((sum, line) => sum + line.value, 0) / middle.length,
      );
    } else {
      result.push(
        cluster.reduce((sum, line) => sum + line.value, 0) / cluster.length,
      );
    }
    cluster = [];
  };
  for (const line of sorted) {
    const last = cluster[cluster.length - 1];
    if (last && line.value - last.value > mergeReach) flush();
    cluster.push(line);
  }
  flush();
  return result.sort((a, b) => a - b);
}

/** Fill wide gaps with ordinary streets, and carry the grid out to the town's edge. */
function fillLines(values: number[], from: number, to: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const result: number[] = [];
  const first = sorted[0] ?? 0;
  for (let value = first - fillerSpacing; value > from; value -= fillerSpacing)
    result.push(value);
  sorted.forEach((value, index) => {
    result.push(value);
    const next = sorted[index + 1];
    if (next === undefined) return;
    const gap = next - value;
    if (gap > fillerSpacing * 1.9) {
      const parts = Math.round(gap / fillerSpacing);
      for (let part = 1; part < parts; part++)
        result.push(value + (gap * part) / parts);
    }
  });
  const last = sorted[sorted.length - 1] ?? 0;
  for (let value = last + fillerSpacing; value < to; value += fillerSpacing)
    result.push(value);
  return result.sort((a, b) => a - b);
}

const inside = (rectangle: Rectangle, point: Point, margin = 0.5) =>
  point.x > rectangle.left + margin &&
  point.x < rectangle.right - margin &&
  point.y > rectangle.top + margin &&
  point.y < rectangle.bottom - margin;

function buildPlan(layout: Layout, homeId: string | null): StreetPlan {
  const { bounds } = layout;
  const extent = {
    left: bounds.left - townExtent,
    right: bounds.right + townExtent,
    top: bounds.top - townExtent,
    bottom: bounds.bottom + townExtent,
  };
  const hospitals = [...layout.clients.entries()].filter(
    ([id]) => id !== homeId,
  );
  const zones = new Map<string, Rectangle>(
    hospitals.map(([id, centre]) => [
      id,
      {
        left: centre.x - hospitalReach,
        right: centre.x + hospitalReach,
        top: centre.y - hospitalReach,
        bottom: centre.y + hospitalReach,
      },
    ]),
  );

  // The ring, each spoke, the streets between and beside each hospital.
  const spokes = new Map<string, Spoke>();
  const xLines: Line[] = [
    { value: -ringHalf, kind: 0 },
    { value: ringHalf, kind: 0 },
  ];
  const yLines: Line[] = [
    { value: -ringHalf, kind: 0 },
    { value: ringHalf, kind: 0 },
  ];
  const mainRoads: Point[][] = [ringRoad()];
  if (homeId) spokes.set(homeId, spokeOf({ x: 0, y: 0 }, true));
  for (const [id, centre] of hospitals) {
    const spoke = spokeOf(centre, false);
    spokes.set(id, spoke);
    mainRoads.push(spoke.road);
    for (let index = 0; index + 1 < spoke.road.length; index++) {
      const from = spoke.road[index];
      const to = spoke.road[index + 1];
      if (!from || !to) continue;
      if (Math.abs(from.x - to.x) < 0.5)
        xLines.push({ value: from.x, kind: 0 });
      else yLines.push({ value: from.y, kind: 0 });
    }
    const [, end] = spoke.drive;
    if (Math.abs(spoke.bay.y - end.y) < 0.5)
      xLines.push({ value: end.x, kind: 0 });
    else yLines.push({ value: end.y, kind: 0 });
    xLines.push(
      { value: centre.x - hospitalReach - frontageGap, kind: 2 },
      { value: centre.x + hospitalReach + frontageGap, kind: 2 },
    );
    yLines.push(
      { value: centre.y - hospitalReach - frontageGap, kind: 2 },
      { value: centre.y + hospitalReach + frontageGap, kind: 2 },
    );
  }
  for (let first = 0; first < hospitals.length; first++) {
    for (let second = first + 1; second < hospitals.length; second++) {
      const a = hospitals[first]?.[1];
      const b = hospitals[second]?.[1];
      if (!a || !b) continue;
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (dy < hospitalReach * 2 && dx > hospitalReach * 2)
        xLines.push({ value: (a.x + b.x) / 2, kind: 1 });
      if (dx < hospitalReach * 2 && dy > hospitalReach * 2)
        yLines.push({ value: (a.y + b.y) / 2, kind: 1 });
    }
  }
  const xs = fillLines(mergeLines(xLines), extent.left, extent.right);
  const ys = fillLines(mergeLines(yLines), extent.top, extent.bottom);

  // Each client's block: its clear square, out to the nearest streets.
  const cells = new Map<string, Rectangle>();
  if (homeId)
    cells.set(homeId, {
      left: -ringHalf,
      right: ringHalf,
      top: -ringHalf,
      bottom: ringHalf,
    });
  for (const [id, zone] of zones) {
    const before = (values: number[], limit: number, fallback: number) =>
      values.filter((value) => value <= limit + 0.5).pop() ?? fallback;
    const after = (values: number[], limit: number, fallback: number) =>
      values.find((value) => value >= limit - 0.5) ?? fallback;
    cells.set(id, {
      left: before(xs, zone.left, extent.left),
      right: after(xs, zone.right, extent.right),
      top: before(ys, zone.top, extent.top),
      bottom: after(ys, zone.bottom, extent.bottom),
    });
  }
  const inCell = (point: Point) =>
    [...cells.values()].some((cell) => inside(cell, point));

  // The street graph: every grid line, less what runs inside a block.
  const nodes: Point[] = [];
  const index = new Map<string, number>();
  const nodeAt = (point: Point) => {
    const key = `${Math.round(point.x * 2)},${Math.round(point.y * 2)}`;
    let found = index.get(key);
    if (found === undefined) {
      found = nodes.length;
      nodes.push({ x: point.x, y: point.y });
      index.set(key, found);
    }
    return found;
  };
  const edges: Edge[] = [];
  const extraOnX = new Map<number, number[]>();
  const extraOnY = new Map<number, number[]>();
  for (const spoke of spokes.values()) {
    const [, end] = spoke.drive;
    if (Math.abs(spoke.bay.y - end.y) < 0.5) {
      const line = xs.find((value) => Math.abs(value - end.x) < 0.5);
      if (line !== undefined)
        extraOnX.set(line, [...(extraOnX.get(line) ?? []), end.y]);
    } else {
      const line = ys.find((value) => Math.abs(value - end.y) < 0.5);
      if (line !== undefined)
        extraOnY.set(line, [...(extraOnY.get(line) ?? []), end.x]);
    }
  }
  const mainSegments: Array<[Point, Point]> = [];
  for (const road of mainRoads)
    for (let at = 0; at + 1 < road.length; at++) {
      const from = road[at];
      const to = road[at + 1];
      if (from && to) mainSegments.push([from, to]);
    }
  const onMain = (a: Point, b: Point) =>
    mainSegments.some(([p, q]) => {
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(p.x - q.x) < 0.5) {
        if (Math.abs(a.x - p.x) > 0.5) return false;
        const low = Math.min(p.y, q.y) - 0.5;
        const high = Math.max(p.y, q.y) + 0.5;
        return Math.min(a.y, b.y) >= low && Math.max(a.y, b.y) <= high;
      }
      if (Math.abs(a.y - b.y) < 0.5 && Math.abs(p.y - q.y) < 0.5) {
        if (Math.abs(a.y - p.y) > 0.5) return false;
        const low = Math.min(p.x, q.x) - 0.5;
        const high = Math.max(p.x, q.x) + 0.5;
        return Math.min(a.x, b.x) >= low && Math.max(a.x, b.x) <= high;
      }
      return false;
    });
  const addEdge = (a: Point, b: Point, drive = false) => {
    const length = Math.hypot(a.x - b.x, a.y - b.y);
    if (length < 0.5) return;
    edges.push({
      a: nodeAt(a),
      b: nodeAt(b),
      length,
      main: drive || onMain(a, b),
      drive,
    });
  };
  const run = (
    fixed: number,
    stops: number[],
    point: (fixed: number, along: number) => Point,
  ) => {
    const sorted = [...new Set(stops)].sort((a, b) => a - b);
    for (let at = 0; at + 1 < sorted.length; at++) {
      const from = sorted[at];
      const to = sorted[at + 1];
      if (from === undefined || to === undefined) continue;
      if (inCell(point(fixed, (from + to) / 2))) continue;
      addEdge(point(fixed, from), point(fixed, to));
    }
  };
  for (const x of xs)
    run(x, [...ys, ...(extraOnX.get(x) ?? [])], (fixed, along) => ({
      x: fixed,
      y: along,
    }));
  for (const y of ys)
    run(y, [...xs, ...(extraOnY.get(y) ?? [])], (fixed, along) => ({
      x: along,
      y: fixed,
    }));
  const bayNodes = new Map<string, number>();
  for (const [id, spoke] of spokes) {
    addEdge(spoke.drive[0], spoke.drive[1], true);
    bayNodes.set(id, nodeAt(spoke.bay));
  }
  const adjacency: StreetPlan["adjacency"] = nodes.map(() => []);
  edges.forEach((edge, at) => {
    adjacency[edge.a]?.push({ to: edge.b, edge: at });
    adjacency[edge.b]?.push({ to: edge.a, edge: at });
  });

  const river = riverOf(layout, cells, xs, ys, extent, homeId);
  const town = townBlocks(xs, ys, extent, cells, river);
  const lights = streetLights(mainRoads);
  return {
    extent,
    xs,
    ys,
    cells,
    town,
    river,
    nodes,
    edges,
    adjacency,
    spokes,
    bayNodes,
    mainRoads,
    lights,
    routes: new Map(),
  };
}

/**
 * The river runs down the first band of town beyond the hospitals: along
 * the east side in landscape, and across the north in portrait, where a
 * phone has room above the map.
 */
function riverOf(
  layout: Layout,
  cells: Map<string, Rectangle>,
  xs: number[],
  ys: number[],
  extent: Rectangle,
  homeId: string | null,
): River | null {
  const hospitalCells = [...cells.entries()]
    .filter(([id]) => id !== homeId)
    .map(([, cell]) => cell);
  if (hospitalCells.length === 0) return null;
  const vertical = layout.orientation === "landscape";
  let band: Rectangle;
  if (vertical) {
    const edge = Math.max(...hospitalCells.map((cell) => cell.right));
    const next = xs.find((value) => value > edge + 1);
    if (next === undefined) return null;
    band = { left: edge, right: next, top: extent.top, bottom: extent.bottom };
  } else {
    const edge = Math.min(...hospitalCells.map((cell) => cell.top));
    const next = [...ys].reverse().find((value) => value < edge - 1);
    if (next === undefined) return null;
    band = { left: extent.left, right: extent.right, top: next, bottom: edge };
  }
  const across = vertical ? band.right - band.left : band.bottom - band.top;
  const half = Math.min(64, across / 2 - 34);
  const swing = Math.max(0, across / 2 - half - 20);
  const middle = vertical
    ? (band.left + band.right) / 2
    : (band.top + band.bottom) / 2;
  const start = vertical ? extent.top : extent.left;
  const end = vertical ? extent.bottom : extent.right;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let along = start; along <= end; along += 24) {
    const centre =
      middle +
      swing * 0.75 * Math.sin(along * 0.0042 + 1.3) +
      swing * 0.25 * Math.sin(along * 0.011 + 0.4);
    const width = half * (1 + 0.08 * Math.sin(along * 0.007));
    if (vertical) {
      left.push({ x: centre - width, y: along });
      right.push({ x: centre + width, y: along });
    } else {
      left.push({ x: along, y: centre - width });
      right.push({ x: along, y: centre + width });
    }
  }
  return { band, vertical, banks: [left, right] };
}

function townBlocks(
  xs: number[],
  ys: number[],
  extent: Rectangle,
  cells: Map<string, Rectangle>,
  river: River | null,
): TownBlock[] {
  const columns = [extent.left, ...xs, extent.right];
  const rows = [extent.top, ...ys, extent.bottom];
  const plain: Rectangle[] = [];
  for (let column = 0; column + 1 < columns.length; column++) {
    for (let row = 0; row + 1 < rows.length; row++) {
      const left = columns[column];
      const right = columns[column + 1];
      const top = rows[row];
      const bottom = rows[row + 1];
      if (
        left === undefined ||
        right === undefined ||
        top === undefined ||
        bottom === undefined
      )
        continue;
      const centre = { x: (left + right) / 2, y: (top + bottom) / 2 };
      if ([...cells.values()].some((cell) => inside(cell, centre))) continue;
      plain.push({ left, right, top, bottom });
    }
  }
  const inRiver = (cell: Rectangle) =>
    river !== null &&
    cell.left >= river.band.left - 0.5 &&
    cell.right <= river.band.right + 0.5 &&
    cell.top >= river.band.top - 0.5 &&
    cell.bottom <= river.band.bottom + 0.5;

  // The two plain blocks nearest The Practice, on opposite sides, are parks.
  const byDistance = plain
    .filter((cell) => !inRiver(cell))
    .map((cell) => ({
      cell,
      distance: Math.hypot(
        (cell.left + cell.right) / 2,
        (cell.top + cell.bottom) / 2,
      ),
    }))
    .sort((a, b) => a.distance - b.distance);
  const parks: Rectangle[] = [];
  const firstPark = byDistance[0]?.cell;
  if (firstPark) {
    parks.push(firstPark);
    const side = Math.sign(firstPark.top + firstPark.bottom);
    const opposite = byDistance.find(
      ({ cell }) => Math.sign(cell.top + cell.bottom) === -side,
    )?.cell;
    if (opposite) parks.push(opposite);
  }

  return plain.map((cell) => {
    const area = {
      left: cell.left + blockInset,
      right: cell.right - blockInset,
      top: cell.top + blockInset,
      bottom: cell.bottom - blockInset,
    };
    const random = seededRandom(
      hashString(`${Math.round(cell.left)},${Math.round(cell.top)}`),
    );
    if (inRiver(cell))
      return {
        area,
        kind: "embankment" as const,
        buildings: [],
        windows: [],
        trees: trees(area, random, 0.35),
        path: [],
      };
    if (parks.includes(cell))
      return {
        area,
        kind: "park" as const,
        buildings: [],
        windows: [],
        trees: trees(area, random, 0.8),
        path: footpath(area, random),
      };
    const { buildings, windows } = buildingsOf(area, random);
    return {
      area,
      kind: "buildings" as const,
      buildings,
      windows,
      trees: [],
      path: [],
    };
  });
}

function buildingsOf(
  area: Rectangle,
  random: () => number,
): { buildings: Rectangle[]; windows: Point[] } {
  const width = area.right - area.left;
  const height = area.bottom - area.top;
  const buildings: Rectangle[] = [];
  const windows: Point[] = [];
  if (width < 30 || height < 30) return { buildings, windows };
  const columns = Math.max(1, Math.round(width / 115));
  const rows = Math.max(1, Math.round(height / 100));
  const lotWidth = width / columns;
  const lotHeight = height / rows;
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      // Some lots are yards and car parks, so the town is never a solid grid.
      if (random() < 0.14) continue;
      const left = area.left + column * lotWidth;
      const top = area.top + row * lotHeight;
      const inset = 6 + random() * 9;
      const building = {
        left: left + inset,
        top: top + inset,
        right: left + lotWidth - inset - random() * lotWidth * 0.25,
        bottom: top + lotHeight - inset - random() * lotHeight * 0.25,
      };
      if (
        building.right - building.left < 18 ||
        building.bottom - building.top < 18
      )
        continue;
      buildings.push(building);
      const count = Math.floor(
        ((building.right - building.left) * (building.bottom - building.top)) /
          1300,
      );
      for (let window = 0; window < count; window++) {
        if (random() > 0.32) continue;
        windows.push({
          x:
            building.left +
            6 +
            random() * (building.right - building.left - 12),
          y:
            building.top + 6 + random() * (building.bottom - building.top - 12),
        });
      }
    }
  }
  return { buildings, windows };
}

function trees(area: Rectangle, random: () => number, density: number): Tree[] {
  const result: Tree[] = [];
  const spacing = 30;
  for (let y = area.top + 14; y < area.bottom - 10; y += spacing) {
    for (let x = area.left + 14; x < area.right - 10; x += spacing) {
      if (random() > density) continue;
      result.push({
        x: x + (random() - 0.5) * spacing * 0.7,
        y: y + (random() - 0.5) * spacing * 0.7,
        radius: 8 + random() * 7,
      });
    }
  }
  return result;
}

function footpath(area: Rectangle, random: () => number): Point[] {
  const points: Point[] = [];
  const bend = (random() - 0.5) * 0.5;
  for (let step = 0; step <= 16; step++) {
    const t = step / 16;
    points.push({
      x: area.left + (area.right - area.left) * t,
      y:
        area.top +
        (area.bottom - area.top) *
          (0.5 + bend * Math.sin(t * Math.PI) + 0.12 * Math.sin(t * 6.3)),
    });
  }
  return points;
}

function streetLights(roads: Point[][]): Point[] {
  const lights: Point[] = [];
  const offset = mainRoadWidth / 2 + 7;
  let side = 1;
  for (const road of roads) {
    for (let at = 0; at + 1 < road.length; at++) {
      const from = road[at];
      const to = road[at + 1];
      if (!from || !to) continue;
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.floor(length / 120);
      const normal = {
        x: -(to.y - from.y) / (length || 1),
        y: (to.x - from.x) / (length || 1),
      };
      for (let step = 1; step <= steps; step++) {
        const t = (step * 120) / length;
        side = -side;
        lights.push({
          x: from.x + (to.x - from.x) * t + normal.x * offset * side,
          y: from.y + (to.y - from.y) * t + normal.y * offset * side,
        });
      }
    }
  }
  return lights;
}

/** A small binary heap of `[cost, state]`, for the route search. */
class Queue {
  private items: Array<[number, number]> = [];
  get size() {
    return this.items.length;
  }
  push(cost: number, state: number) {
    const items = this.items;
    items.push([cost, state]);
    let child = items.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      const above = items[parent];
      const here = items[child];
      if (!above || !here || above[0] <= here[0]) break;
      items[parent] = here;
      items[child] = above;
      child = parent;
    }
  }
  pop(): [number, number] | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0 && last) {
      items[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = left + 1;
        let smallest = parent;
        const costOf = (at: number) => items[at]?.[0] ?? Infinity;
        if (left < items.length && costOf(left) < costOf(smallest))
          smallest = left;
        if (right < items.length && costOf(right) < costOf(smallest))
          smallest = right;
        if (smallest === parent) break;
        const a = items[parent];
        const b = items[smallest];
        if (!a || !b) break;
        items[parent] = b;
        items[smallest] = a;
        parent = smallest;
      }
    }
    return top;
  }
}

const turnCost = 140;
const mainRoadDiscount = 0.8;

/** Which way an edge runs from `a` to `b`: 0 east, 1 west, 2 south, 3 north. */
function heading(a: Point, b: Point): number {
  if (Math.abs(a.y - b.y) < 0.5) return b.x > a.x ? 0 : 1;
  return b.y > a.y ? 2 : 3;
}

/**
 * The route an ambulance drives from one place's bay to another's, as a
 * polyline with a point at every corner. Null when the places are the same
 * or the streets do not join them.
 */
export function routeBetween(
  plan: StreetPlan,
  fromId: string,
  toId: string,
): Point[] | null {
  const key = `${fromId}>${toId}`;
  const known = plan.routes.get(key);
  if (known) return known;
  const start = plan.bayNodes.get(fromId);
  const goal = plan.bayNodes.get(toId);
  if (start === undefined || goal === undefined || start === goal) return null;

  // States are a node and the heading it was reached by (4 for none).
  const states = plan.nodes.length * 5;
  const cost = new Float64Array(states).fill(Infinity);
  const previous = new Int32Array(states).fill(-1);
  const queue = new Queue();
  const first = start * 5 + 4;
  cost[first] = 0;
  queue.push(0, first);
  let reached = -1;
  while (queue.size > 0) {
    const next = queue.pop();
    if (!next) break;
    const [spent, state] = next;
    if (spent > (cost[state] ?? Infinity)) continue;
    const node = Math.floor(state / 5);
    const arrivedBy = state % 5;
    if (node === goal) {
      reached = state;
      break;
    }
    const here = plan.nodes[node];
    if (!here) continue;
    for (const { to, edge } of plan.adjacency[node] ?? []) {
      const there = plan.nodes[to];
      const road = plan.edges[edge];
      if (!there || !road) continue;
      const direction = heading(here, there);
      const turning = arrivedBy !== 4 && arrivedBy !== direction;
      const step =
        road.length * (road.main ? mainRoadDiscount : 1) +
        (turning ? turnCost : 0);
      const target = to * 5 + direction;
      if (spent + step < (cost[target] ?? Infinity)) {
        cost[target] = spent + step;
        previous[target] = state;
        queue.push(spent + step, target);
      }
    }
  }
  if (reached < 0) return null;
  const path: Point[] = [];
  for (let state = reached; state >= 0; state = previous[state] ?? -1) {
    const point = plan.nodes[Math.floor(state / 5)];
    if (point) path.unshift(point);
  }
  const route = corners(path);
  plan.routes.set(key, route);
  return route;
}

/** Drop the points along a straight run, keeping the corners. */
function corners(path: Point[]): Point[] {
  return path.filter((point, at) => {
    const before = path[at - 1];
    const after = path[at + 1];
    if (!before || !after) return true;
    const straight =
      (Math.abs(before.x - point.x) < 0.5 &&
        Math.abs(after.x - point.x) < 0.5) ||
      (Math.abs(before.y - point.y) < 0.5 && Math.abs(after.y - point.y) < 0.5);
    return !straight;
  });
}

export interface Measured {
  points: Point[];
  /** Distance along the route to each point. */
  lengths: number[];
  total: number;
}

export function measure(points: Point[]): Measured {
  const lengths = [0];
  for (let at = 1; at < points.length; at++) {
    const a = points[at - 1];
    const b = points[at];
    lengths.push(
      (lengths[at - 1] ?? 0) + (a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0),
    );
  }
  return { points, lengths, total: lengths[lengths.length - 1] ?? 0 };
}

/** The point a distance along a measured route. */
export function pointAlong(route: Measured, distance: number): Point {
  const along = clamp(distance, 0, route.total);
  for (let at = 1; at < route.points.length; at++) {
    const end = route.lengths[at] ?? 0;
    if (along <= end || at === route.points.length - 1) {
      const start = route.lengths[at - 1] ?? 0;
      const a = route.points[at - 1];
      const b = route.points[at];
      if (!a || !b) break;
      const t = end > start ? (along - start) / (end - start) : 1;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return route.points[0] ?? { x: 0, y: 0 };
}

/**
 * Where a vehicle is and which way it faces, a distance along a route. The
 * heading looks a little ahead and behind, so it swings round a corner
 * rather than snapping.
 */
export function poseAlong(
  route: Measured,
  distance: number,
  look = 18,
): { position: Point; heading: number } {
  const position = pointAlong(route, distance);
  const ahead = pointAlong(route, distance + look);
  const behind = pointAlong(route, distance - look);
  const dx = ahead.x - behind.x;
  const dy = ahead.y - behind.y;
  return {
    position,
    heading: Math.hypot(dx, dy) > 0.01 ? Math.atan2(dy, dx) : 0,
  };
}
