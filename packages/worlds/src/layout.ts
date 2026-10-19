/**
 * Where everything sits, in world units, independent of any world's look.
 *
 * Home is at the centre. Clients sit in two columns around it, wide apart in
 * landscape and stacked tall in portrait so a phone shows them at a readable
 * size. Around each client, its work is grouped by workstream: each
 * workstream is a marker, with the most urgent items on the map in a curve
 * beside it, and work with no workstream gathers at an "Unsorted" marker.
 * Requirements sit in the clear space beside the client, decisions close
 * in, and open questions beside whatever they block.
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

export type Orientation = "landscape" | "portrait";

export const rings = {
  requirement: 200,
  orbit: 62,
  decision: 112,
  question: 58,
  watch: 330,
  homeWatch: 170,
  dock: 58,
} as const;

const spacing: Record<Orientation, { column: number; row: number }> = {
  landscape: { column: 1560, row: 900 },
  portrait: { column: 700, row: 1760 },
};

/** The most items a workstream draws. The rest are a count on its marker. */
export const shownPerWorkstream = 5;

/** What the marker for work with no workstream is called, in every world. */
export const unsortedTitle = "Unsorted";

/**
 * How far a workstream's group reaches from its marker, with labels drawn
 * at the zoom where item labels first show. The slots keep groups this far
 * apart, so no label runs into another group's.
 */
export const workstreamReach = {
  left: 70,
  right: 240,
  top: 75,
  bottom: 55,
} as const;

/** The grid workstream markers are placed on, around their client. */
const workstreamGrid = {
  /** Landscape: two columns, left and right of the client. */
  columns: [-380, 210],
  /** Portrait: one column through the client, with the client in a gap. */
  portraitColumn: -85,
  row: 125,
  portraitAbove: -215,
  portraitBelow: 245,
} as const;

/** Vertical step between items in a group, so their labels never touch. */
const itemStep = 22;

export interface WorkstreamMarker {
  /** The workstream's id, or `unsorted-<client id>` for work with none. */
  id: string;
  clientId: string;
  /** Null for the unsorted marker, which is not a record. */
  workstreamId: string | null;
  title: string;
  position: Point;
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

export function computeLayout(
  dataset: Dataset,
  orientation: Orientation,
): Layout {
  const clients = new Map<string, Point>();
  const away = new Map<string, number>();
  const others = dataset.clients.filter((client) => client.home !== true);
  const home = dataset.clients.find((client) => client.home === true);
  const { column, row } = spacing[orientation];
  const rows = Math.max(1, Math.ceil(others.length / 2));

  if (home) {
    clients.set(home.id, { x: 0, y: 0 });
    away.set(home.id, Math.PI / 2);
  }
  others.forEach((client, index) => {
    const columnIndex = index % 2;
    const rowIndex = Math.floor(index / 2);
    const lonely = others.length % 2 === 1 && index === others.length - 1;
    const x = lonely ? 0 : (columnIndex === 0 ? -1 : 1) * (column / 2);
    const y = (rowIndex - (rows - 1) / 2) * row + (rows === 1 ? -row / 2 : 0);
    const point = { x, y: lonely && rows > 1 ? y + row * 0.1 : y };
    clients.set(client.id, point);
    away.set(client.id, Math.atan2(point.y, point.x || 0.0001));
  });

  const layout: Layout = {
    orientation,
    bounds: { left: 0, right: 0, top: 0, bottom: 0 },
    clients,
    fixed: new Map(),
    markers: [],
    shown: new Set(),
    markerOfItem: new Map(),
    away,
  };
  for (const client of dataset.clients)
    placeClientWork(dataset, client, layout);
  layout.bounds = boundsOf(clients, layout.markers);
  return layout;
}

/** Where the `index`-th of `count` markers sits, relative to its client. */
function markerSlot(
  index: number,
  count: number,
  orientation: Orientation,
): Point {
  if (orientation === "portrait") {
    const step = Math.floor(index / 2) * workstreamGrid.row;
    return index % 2 === 0
      ? {
          x: workstreamGrid.portraitColumn,
          y: workstreamGrid.portraitAbove - step,
        }
      : {
          x: workstreamGrid.portraitColumn,
          y: workstreamGrid.portraitBelow + step,
        };
  }
  const rows = Math.ceil(count / 2);
  const row = Math.floor(index / 2);
  return {
    x: workstreamGrid.columns[index % 2] ?? 0,
    y: (row - (rows - 1) / 2) * workstreamGrid.row,
  };
}

/**
 * Where the `index`-th of `count` items sits, relative to its marker: a
 * curve on the marker's right, a fixed step apart so labels stay clear.
 */
function itemSlot(index: number, count: number): Point {
  const y = (index - (count - 1) / 2) * itemStep;
  return { x: 34 + 10 * (1 - (y / 50) ** 2), y };
}

/** Where the `index`-th requirement sits, in the space the markers leave. */
function requirementSlot(index: number, orientation: Orientation): Point {
  const step = Math.floor(index / 2);
  if (orientation === "portrait")
    return { x: index % 2 === 0 ? 230 : -230, y: -20 + step * 60 };
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
      layout.fixed.set(
        requirement.id,
        offset(requirementSlot(index, layout.orientation)),
      );
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

  groups.forEach((group, index) => {
    const position = offset(
      markerSlot(index, groups.length, layout.orientation),
    );
    const onMap = orderByUrgency(group.items.filter(isOnMap));
    const shown = onMap.slice(0, shownPerWorkstream);
    const marker: WorkstreamMarker = {
      id: group.id,
      clientId: client.id,
      workstreamId: group.workstreamId,
      title: group.title,
      position,
      shown: shown.map((item) => item.id),
      more: onMap.length - shown.length,
    };
    layout.markers.push(marker);
    for (const item of group.items) layout.markerOfItem.set(item.id, marker);
    shown.forEach((item, slot) => {
      const relative = itemSlot(slot, shown.length);
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

/**
 * Where the `index`-th decision sits: close in, round the upper left of
 * its client, so a label drawn to its right stays inside the space between
 * the workstream columns.
 */
function decisionSlot(centre: Point, index: number): Point {
  return polar(centre, -2 - index * 0.32, rings.decision);
}

function boundsOf(
  clients: Map<string, Point>,
  markers: readonly WorkstreamMarker[],
): Bounds {
  const margin = rings.watch + 70;
  const points = [...clients.values()];
  const reach = markers.map(({ position }) => position);
  return {
    left: Math.min(
      ...points.map((point) => point.x - margin),
      ...reach.map((point) => point.x - workstreamReach.left),
    ),
    right: Math.max(
      ...points.map((point) => point.x + margin),
      ...reach.map((point) => point.x + workstreamReach.right),
    ),
    top: Math.min(
      ...points.map((point) => point.y - margin - 40),
      ...reach.map((point) => point.y - workstreamReach.top),
    ),
    bottom: Math.max(
      ...points.map((point) => point.y + margin),
      ...reach.map((point) => point.y + workstreamReach.bottom),
    ),
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
 * One that holds up a backlog item sits left of the item's workstream
 * marker, level with the item, clear of the labels on the marker's right.
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
      x: marker.position.x - rings.question + drift,
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
