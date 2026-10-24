/**
 * Where everything sits, in world units, independent of any world's look.
 *
 * Home is at the centre. Clients sit in two columns around it, wide apart in
 * landscape and stacked tall in portrait so a phone shows them at a readable
 * size. Each client's work is grouped by workstream: each workstream is a
 * marker on one orbit round the client, evenly spaced, starting at the top
 * and going clockwise in workstream order, with work that has no workstream
 * at an "Unsorted" marker last. A marker's most urgent items sit in a short
 * column beside it, their labels running outward, away from the client:
 * to the right on the right half of the orbit, to the left on the left
 * half. Requirements, decisions, docked agents and watchers stay inside
 * the orbit, and open questions sit inward of what they block.
 */
import {
  isOnMap,
  orderByUrgency,
  workstreamsOfClient,
  type BacklogItem,
  type Client,
  type Dataset,
  type Decision,
  type Question,
} from "@atlas/core";

import type { Bounds, Point } from "./camera";
import {
  captionInset,
  captionLength,
  itemLabel,
  itemLabelLength,
  workstreamCaption,
  workstreamCaptionRise,
} from "./labels";

export type Orientation = "landscape" | "portrait";

export const rings = {
  requirement: 200,
  orbit: 62,
  decision: 112,
  question: 58,
  homeWatch: 170,
  dock: 58,
} as const;

/**
 * Where clients sit before the grid is spread to fit their systems. The
 * shape of the grid comes from these; its size from the largest system.
 */
const spacing: Record<Orientation, { column: number; row: number }> = {
  landscape: { column: 1560, row: 900 },
  portrait: { column: 700, row: 1760 },
};

/** The most items a workstream draws. The rest are a count on its marker. */
export const shownPerWorkstream = 5;

/** What the marker for work with no workstream is called, in every world. */
export const unsortedTitle = "Unsorted";

/** Vertical step between items in a group, so their labels never touch. */
export const itemStep = 22;

/**
 * The smallest orbit, in world units. Inside it sit the client's
 * requirements (200 out), its decisions (112), its docked agents (58) and
 * its watchers (`watchShare` of the orbit), and the inner end of the top
 * and bottom groups' items.
 */
export const smallestOrbit = 340;

/** How far out a client's watchers circle, as a share of its orbit. */
const watchShare = 0.8;

/**
 * How the layout estimates a label's size. Wide and tall, so it errs
 * towards room: 7 pixels a character, 13 high, judged just past the zooms
 * where captions (0.6) and item labels (1.05) first show. A label is a
 * fixed size on screen, so it is largest in world units at those zooms.
 */
export const labelEstimate = {
  characterWidth: 7,
  height: 13,
  captionZoom: 0.61,
  itemZoom: 1.06,
} as const;

/** How far a marker's own drawing reaches from its centre, in world units. */
const markerHalf = { width: 26, height: 18 } as const;

/**
 * Where an item's label starts and ends, past the item, in world units.
 * Every world starts its label 10 to 16 units past the item; the estimate
 * takes the widest. `dot` is how far the item's own drawing reaches.
 */
const itemLabelGap = { far: 18, dot: 11 } as const;

/** How far apart two systems' outer labels keep, in world units. */
const systemGap = 90;

/**
 * The least room a system keeps round its orbit, in world units, before
 * its labels are counted: enough at the sides for a world's own ground
 * round a client (a hospital's grounds in Doctor reach 470), and above for
 * the client's name, over the top marker's caption.
 */
export const systemRoom = { side: 130, top: 180 } as const;

/** The words " · 99 more", which a caption at its longest also carries. */
const moreCount = 10;

export interface WorkstreamMarker {
  /** The workstream's id, or `unsorted-<client id>` for work with none. */
  id: string;
  clientId: string;
  /** Null for the unsorted marker, which is not a record. */
  workstreamId: string | null;
  title: string;
  position: Point;
  /** Radians from the client's centre: -π/2 is the top, clockwise on. */
  angle: number;
  /**
   * The way its labels run: 1 to the right, on the right half of the orbit
   * and at the top; -1 to the left, on the left half and at the bottom.
   */
  side: 1 | -1;
  /** The items drawn beside the marker, most urgent first. */
  shown: string[];
  /** Items on the map beyond those drawn, shown as a count on the marker. */
  more: number;
}

export interface Layout {
  orientation: Orientation;
  bounds: Bounds;
  /** Centre of each client, home included. */
  clients: Map<string, Point>;
  /** The radius of each client's workstream orbit, home included. */
  orbits: Map<string, number>;
  /** Fixed positions: requirements, drawn backlog items, decisions. */
  fixed: Map<string, Point>;
  /** Every workstream marker, unsorted ones included, client by client. */
  markers: WorkstreamMarker[];
  /** The backlog items the map draws. */
  shown: Set<string>;
  /** The marker each item belongs to, drawn or not. */
  markerOfItem: Map<string, WorkstreamMarker>;
  /** The direction pointing away from home, per client. */
  away: Map<string, number>;
}

/** A box in world units. */
interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** What a group's labels need: where it is, which way it runs, how long. */
interface GroupShape {
  position: Point;
  side: 1 | -1;
  /** Characters in the caption. */
  caption: number;
  items: Array<{ at: Point; label: number }>;
}

export function computeLayout(
  dataset: Dataset,
  orientation: Orientation,
): Layout {
  const clients = new Map<string, Point>();
  const away = new Map<string, number>();
  const home = dataset.clients.find((client) => client.home === true);
  const layout: Layout = {
    orientation,
    bounds: { left: 0, right: 0, top: 0, bottom: 0 },
    clients,
    orbits: new Map(),
    fixed: new Map(),
    markers: [],
    shown: new Set(),
    markerOfItem: new Map(),
    away,
  };

  // Work is placed round each client at the origin first, so each
  // system's size is known before the grid is spread to fit them all.
  const origin = { x: 0, y: 0 };
  for (const client of dataset.clients) {
    clients.set(client.id, origin);
    placeClientWork(dataset, client, layout);
  }
  const extents = new Map(
    dataset.clients.map((client) => [
      client.id,
      systemExtent(layout, dataset, client.id),
    ]),
  );
  const grid = gridPositions(dataset, orientation);
  const scale = spreadToFit(grid, extents);
  for (const client of dataset.clients) {
    const base = grid.get(client.id) ?? origin;
    const point = { x: base.x * scale, y: base.y * scale };
    clients.set(client.id, point);
    away.set(
      client.id,
      client.id === home?.id
        ? Math.PI / 2
        : Math.atan2(point.y, point.x || 0.0001),
    );
    moveClientWork(dataset, layout, client.id, point);
  }
  layout.bounds = boundsOf(clients, extents);
  return layout;
}

/**
 * Where each client sits on the grid before it is spread: home at the
 * centre, the others in two columns, a lonely last one in the middle.
 */
function gridPositions(
  dataset: Dataset,
  orientation: Orientation,
): Map<string, Point> {
  const grid = new Map<string, Point>();
  const others = dataset.clients.filter((client) => client.home !== true);
  const home = dataset.clients.find((client) => client.home === true);
  const { column, row } = spacing[orientation];
  const rows = Math.max(1, Math.ceil(others.length / 2));
  if (home) grid.set(home.id, { x: 0, y: 0 });
  others.forEach((client, index) => {
    const columnIndex = index % 2;
    const rowIndex = Math.floor(index / 2);
    const lonely = others.length % 2 === 1 && index === others.length - 1;
    const x = lonely ? 0 : (columnIndex === 0 ? -1 : 1) * (column / 2);
    const y = (rowIndex - (rows - 1) / 2) * row + (rows === 1 ? -row / 2 : 0);
    grid.set(client.id, { x, y: lonely && rows > 1 ? y + row * 0.1 : y });
  });
  return grid;
}

/**
 * How far the grid is spread so no two systems touch, labels included.
 * The smallest spread that clears them, never less than the grid itself,
 * in steps of a twentieth so a small change in the work rarely moves a
 * client.
 */
function spreadToFit(
  grid: Map<string, Point>,
  extents: Map<string, Box>,
): number {
  const entries = [...grid.entries()].flatMap(([id, point]) => {
    const extent = extents.get(id);
    return extent ? [{ point, extent }] : [];
  });
  const clear = (scale: number) =>
    entries.every((a, index) =>
      entries
        .slice(index + 1)
        .every(
          (b) =>
            !overlaps(
              shifted(a.extent, a.point, scale),
              shifted(b.extent, b.point, scale),
              systemGap,
            ),
        ),
    );
  let steps = 0;
  while (!clear(1 + steps / 20) && steps < 400) steps += 1;
  return 1 + steps / 20;
}

function shifted(box: Box, point: Point, scale: number): Box {
  return {
    left: box.left + point.x * scale,
    right: box.right + point.x * scale,
    top: box.top + point.y * scale,
    bottom: box.bottom + point.y * scale,
  };
}

function overlaps(a: Box, b: Box, gap = 0): boolean {
  return (
    a.left < b.right + gap &&
    b.left < a.right + gap &&
    a.top < b.bottom + gap &&
    b.top < a.bottom + gap
  );
}

/**
 * The angle of the `index`-th of `count` markers on an orbit: the first at
 * the top, the rest evenly round it, clockwise.
 */
export function orbitAngle(index: number, count: number): number {
  return -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, count);
}

/**
 * Which way a marker's labels run at an angle: outward, so right on the
 * right half and left on the left half. The top runs right and the bottom
 * left, the way the orbit turns there.
 */
export function orbitSide(angle: number): 1 | -1 {
  const across = Math.cos(angle);
  if (Math.abs(across) > 1e-6) return across > 0 ? 1 : -1;
  return Math.sin(angle) < 0 ? 1 : -1;
}

/**
 * Where the `index`-th of `count` items sits, relative to its marker: a
 * column on the marker's outer side, curving a little towards it at the
 * ends, a fixed step apart so labels stay clear.
 */
function itemSlot(index: number, count: number, side: 1 | -1): Point {
  const y = (index - (count - 1) / 2) * itemStep;
  return { x: side * (34 + 10 * (1 - (y / 50) ** 2)), y };
}

/** The boxes a group's labels and marker take at a zoom, in world units. */
function groupBoxes(shape: GroupShape, scale: number): Box[] {
  const width = (characters: number) =>
    (characters * labelEstimate.characterWidth) / scale;
  const height = labelEstimate.height / scale;
  const { x, y } = shape.position;
  const side = shape.side;
  const start = x - side * captionInset;
  const end = start + side * width(shape.caption);
  const boxes: Box[] = [
    {
      left: x - markerHalf.width,
      right: x + markerHalf.width,
      top: y - markerHalf.height,
      bottom: y + markerHalf.height,
    },
    {
      left: Math.min(start, end),
      right: Math.max(start, end),
      top: y - workstreamCaptionRise - height,
      bottom: y - workstreamCaptionRise,
    },
  ];
  if (scale < labelEstimate.itemZoom) return boxes;
  for (const { at, label } of shape.items) {
    const near = at.x - side * itemLabelGap.dot;
    const far = at.x + side * (itemLabelGap.far + width(label));
    const half = Math.max(height / 2, itemLabelGap.dot);
    boxes.push({
      left: Math.min(near, far),
      right: Math.max(near, far),
      top: at.y - half,
      bottom: at.y + half,
    });
  }
  return boxes;
}

/** Whether any two groups' boxes touch, at either zoom that shows labels. */
function groupsCollide(shapes: readonly GroupShape[]): boolean {
  for (const scale of [labelEstimate.captionZoom, labelEstimate.itemZoom]) {
    const boxes = shapes.map((shape) => groupBoxes(shape, scale));
    for (let a = 0; a < boxes.length; a++)
      for (let b = a + 1; b < boxes.length; b++)
        for (const one of boxes[a] ?? [])
          for (const other of boxes[b] ?? [])
            if (overlaps(one, other, 6)) return true;
  }
  return false;
}

const orbitCache = new Map<number, number>();

/**
 * The radius of an orbit with `count` markers: the smallest at which no
 * group's labels touch another's, with every caption and item label at its
 * longest. It depends on the count alone, so a renamed workstream never
 * moves a marker, and it is never below `smallestOrbit`.
 */
export function orbitRadius(count: number): number {
  const known = orbitCache.get(count);
  if (known !== undefined) return known;
  const shapes = (radius: number): GroupShape[] =>
    Array.from({ length: count }, (_, index) => {
      const angle = orbitAngle(index, count);
      const side = orbitSide(angle);
      const position = polar({ x: 0, y: 0 }, angle, radius);
      return {
        position,
        side,
        caption: captionLength + moreCount,
        items: Array.from({ length: shownPerWorkstream }, (_, slot) => {
          const relative = itemSlot(slot, shownPerWorkstream, side);
          return {
            at: { x: position.x + relative.x, y: position.y + relative.y },
            label: itemLabelLength,
          };
        }),
      };
    });
  let radius = smallestOrbit;
  while (count > 1 && groupsCollide(shapes(radius)) && radius < 5000)
    radius += 10;
  orbitCache.set(count, radius);
  return radius;
}

/** How far out a client's watching agents circle. */
export function watchRadius(layout: Layout, clientId: string): number {
  return Math.round(
    (layout.orbits.get(clientId) ?? smallestOrbit) * watchShare,
  );
}

/**
 * Where the `index`-th requirement sits, inside the orbit: above the star,
 * below it, then left and right of it, then further above and below. The
 * first four keep clear of the groups at the top and bottom of the orbit.
 */
function requirementSlot(index: number): Point {
  const first = [
    { x: 0, y: -170 },
    { x: 0, y: 215 },
    { x: -190, y: 30 },
    { x: 190, y: 30 },
  ][index];
  if (first) return first;
  const step = Math.floor((index - 4) / 2) + 1;
  return index % 2 === 0
    ? { x: 0, y: -170 - step * 70 }
    : { x: 0, y: 215 + step * 70 };
}

function placeClientWork(dataset: Dataset, client: Client, layout: Layout) {
  const centre = layout.clients.get(client.id);
  if (!centre) return;
  const offset = (point: Point): Point => ({
    x: centre.x + point.x,
    y: centre.y + point.y,
  });

  dataset.requirements
    .filter((requirement) => requirement.clientId === client.id)
    .forEach((requirement, index) => {
      layout.fixed.set(requirement.id, offset(requirementSlot(index)));
    });

  const workstreams = workstreamsOfClient(dataset, client.id);
  const known = new Set(workstreams.map((workstream) => workstream.id));
  const items = dataset.items.filter((item) => item.clientId === client.id);
  const groups: Array<{
    id: string;
    workstreamId: string | null;
    title: string;
    items: BacklogItem[];
  }> = workstreams.map((workstream) => ({
    id: workstream.id,
    workstreamId: workstream.id,
    title: workstream.title,
    items: items.filter((item) => item.workstreamId === workstream.id),
  }));
  const unsorted = items.filter(
    (item) => item.workstreamId === undefined || !known.has(item.workstreamId),
  );
  if (unsorted.some(isOnMap))
    groups.push({
      id: `unsorted-${client.id}`,
      workstreamId: null,
      title: unsortedTitle,
      items: unsorted,
    });

  const radius = orbitRadius(groups.length);
  layout.orbits.set(client.id, radius);
  groups.forEach((group, index) => {
    const angle = orbitAngle(index, groups.length);
    const side = orbitSide(angle);
    const position = polar(centre, angle, radius);
    const onMap = orderByUrgency(group.items.filter(isOnMap));
    const shown = onMap.slice(0, shownPerWorkstream);
    const marker: WorkstreamMarker = {
      id: group.id,
      clientId: client.id,
      workstreamId: group.workstreamId,
      title: group.title,
      position,
      angle,
      side,
      shown: shown.map((item) => item.id),
      more: onMap.length - shown.length,
    };
    layout.markers.push(marker);
    for (const item of group.items) layout.markerOfItem.set(item.id, marker);
    shown.forEach((item, slot) => {
      const relative = itemSlot(slot, shown.length, side);
      layout.fixed.set(item.id, {
        x: position.x + relative.x,
        y: position.y + relative.y,
      });
      layout.shown.add(item.id);
    });
  });

  dataset.decisions
    .filter((decision) => decision.clientId === client.id)
    .forEach((decision, index) => {
      layout.fixed.set(decision.id, decisionSlot(centre, index));
    });
}

/** Every record placed round a client, moved from the origin to `point`. */
function moveClientWork(
  dataset: Dataset,
  layout: Layout,
  clientId: string,
  point: Point,
) {
  const move = (at: Point): Point => ({ x: at.x + point.x, y: at.y + point.y });
  const records = [
    ...dataset.requirements,
    ...dataset.items,
    ...dataset.decisions,
  ].filter((record) => record.clientId === clientId);
  for (const { id } of records) {
    const at = layout.fixed.get(id);
    if (at) layout.fixed.set(id, move(at));
  }
  for (const marker of layout.markers)
    if (marker.clientId === clientId) marker.position = move(marker.position);
}

/**
 * The box a client's system takes round its centre, while at the origin:
 * its orbit, every group with its real captions and labels at both label
 * zooms, and room above for the client's name.
 */
function systemExtent(layout: Layout, dataset: Dataset, clientId: string): Box {
  const orbit = layout.orbits.get(clientId) ?? smallestOrbit;
  const titles = new Map(dataset.items.map((item) => [item.id, item.title]));
  const box: Box = {
    left: -orbit - systemRoom.side,
    right: orbit + systemRoom.side,
    top: -orbit - systemRoom.top,
    bottom: orbit + systemRoom.side,
  };
  for (const marker of layout.markers) {
    if (marker.clientId !== clientId) continue;
    const shape: GroupShape = {
      position: marker.position,
      side: marker.side,
      caption: [...workstreamCaption(marker)].length,
      items: marker.shown.map((id) => ({
        at: layout.fixed.get(id) ?? marker.position,
        label: [...itemLabel(titles.get(id) ?? "")].length,
      })),
    };
    for (const scale of [labelEstimate.captionZoom, labelEstimate.itemZoom])
      for (const part of groupBoxes(shape, scale)) {
        box.left = Math.min(box.left, part.left);
        box.right = Math.max(box.right, part.right);
        box.top = Math.min(box.top, part.top);
        box.bottom = Math.max(box.bottom, part.bottom);
      }
  }
  return box;
}

/**
 * Where the `index`-th decision sits: close in, round the upper left of
 * its client, so a label drawn to its right stays inside the orbit.
 */
function decisionSlot(centre: Point, index: number): Point {
  return polar(centre, -2 - index * 0.32, rings.decision);
}

function boundsOf(
  clients: Map<string, Point>,
  extents: Map<string, Box>,
): Bounds {
  const boxes = [...clients.entries()].flatMap(([id, point]) => {
    const extent = extents.get(id);
    return extent ? [shifted(extent, point, 1)] : [];
  });
  if (boxes.length === 0)
    return { left: -400, right: 400, top: -400, bottom: 400 };
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.min(...boxes.map((box) => box.top)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  };
}

export function polar(centre: Point, angle: number, radius: number): Point {
  return {
    x: centre.x + Math.cos(angle) * radius,
    y: centre.y + Math.sin(angle) * radius,
  };
}

/**
 * Where a backlog item is. A drawn item has its own place beside its
 * workstream's marker; an item not drawn (done, unscheduled, or beyond the
 * most urgent few) is at its marker, so an agent or a question that points
 * at it still lands in the right group.
 */
export function itemPosition(layout: Layout, item: BacklogItem): Point {
  return (
    layout.fixed.get(item.id) ??
    layout.markerOfItem.get(item.id)?.position ??
    layout.clients.get(item.clientId) ?? { x: 0, y: 0 }
  );
}

/** Where an item sits in its group, for placing the agents that work it. */
export interface TaskPlace {
  /** Where the task is drawn. */
  task: Point;
  /** The way the task's label runs: 1 to the right, -1 to the left. */
  side: 1 | -1;
  /** How many rows of its group are above it. */
  above: number;
  /** How many rows of its group are below it. */
  below: number;
  /** 1 when the task is below its client's centre, -1 when above. */
  away: 1 | -1;
}

/**
 * Where an item sits in its group, counted in the rows of a full group, so
 * an agent clears the marker's caption, which sits above a full group,
 * however few items its group draws. An item not drawn sits at its
 * marker, level with the middle row.
 */
export function taskPlace(layout: Layout, item: BacklogItem): TaskPlace {
  const task = itemPosition(layout, item);
  const centre = layout.clients.get(item.clientId) ?? { x: 0, y: 0 };
  const away = task.y > centre.y ? 1 : -1;
  const marker = layout.markerOfItem.get(item.id);
  if (!marker) return { task, side: 1, above: 0, below: 0, away };
  const index = marker.shown.indexOf(item.id);
  const row =
    (shownPerWorkstream - 1) / 2 +
    (index >= 0 ? index - (marker.shown.length - 1) / 2 : 0);
  return {
    task,
    side: marker.side,
    above: row,
    below: shownPerWorkstream - 1 - row,
    away,
  };
}

/** Where any work record (requirement or item) is, for things that point at it. */
export function workPosition(
  layout: Layout,
  dataset: Dataset,
  id: string,
): Point | null {
  const item = dataset.items.find((candidate) => candidate.id === id);
  if (item) return itemPosition(layout, item);
  return layout.fixed.get(id) ?? null;
}

/**
 * An open question floats just outside what it blocks, drifting a little.
 * One that holds up a backlog item sits on the inner side of the item's
 * workstream marker, level with the item, clear of the labels that run
 * outward from the marker.
 */
export function questionPosition(
  layout: Layout,
  dataset: Dataset,
  question: Question,
  time: number,
  reducedMotion: boolean,
): Point {
  const drift = reducedMotion
    ? 0
    : Math.sin(time * 0.6 + question.id.length) * 6;
  const item = dataset.items.find(
    (candidate) => candidate.id === question.blocks,
  );
  const marker = item ? layout.markerOfItem.get(item.id) : undefined;
  if (item && marker) {
    const level = itemPosition(layout, item).y;
    return {
      x: marker.position.x - marker.side * rings.question + drift,
      y: level - drift,
    };
  }
  const blocked = workPosition(layout, dataset, question.blocks);
  const centre = layout.clients.get(question.clientId) ?? { x: 0, y: 0 };
  if (!blocked) return centre;
  const angle = Math.atan2(blocked.y - centre.y, blocked.x - centre.x) + 0.7;
  const point = polar(blocked, angle, rings.question);
  return { x: point.x + drift, y: point.y - drift };
}

/**
 * The way an open question's label runs from it: away from the marker of
 * the item it blocks, so it never crosses the marker or its items, and to
 * the left for anything else.
 */
export function questionSide(
  layout: Layout,
  question: Pick<Question, "blocks">,
): 1 | -1 {
  const marker = layout.markerOfItem.get(question.blocks);
  return marker?.side === -1 ? 1 : -1;
}

/** Decisions added after the layout was computed get a place on demand. */
export function decisionPosition(
  layout: Layout,
  dataset: Dataset,
  decision: Decision,
): Point {
  const known = layout.fixed.get(decision.id);
  if (known) return known;
  const centre = layout.clients.get(decision.clientId) ?? { x: 0, y: 0 };
  const siblings = dataset.decisions.filter(
    (candidate) => candidate.clientId === decision.clientId,
  );
  const index = Math.max(0, siblings.indexOf(decision));
  const point = decisionSlot(centre, index);
  layout.fixed.set(decision.id, point);
  return point;
}
