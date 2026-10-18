/**
 * Where everything sits, in world units, independent of any world's look.
 *
 * Home is at the centre. Clients sit in two columns around it, wide apart in
 * landscape and stacked tall in portrait so a phone shows them at a readable
 * size. Around each client: requirements on an inner ring, the backlog items
 * that serve a requirement orbiting it like moons, other items on an outer
 * ring, decisions close in, and open questions beside whatever they block.
 */
import type {
  BacklogItem,
  Client,
  Dataset,
  Decision,
  Question,
} from "@atlas/core";

import type { Bounds, Point } from "./camera";

export type Orientation = "landscape" | "portrait";

export const rings = {
  requirement: 200,
  orbit: 62,
  outer: 310,
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

export interface Layout {
  orientation: Orientation;
  bounds: Bounds;
  /** Centre of each client, home included. */
  clients: Map<string, Point>;
  /** Fixed positions: requirements, loose backlog items, decisions. */
  fixed: Map<string, Point>;
  /** Items that orbit a requirement: their requirement and starting angle. */
  orbits: Map<string, { requirementId: string; angle: number }>;
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

  const fixed = new Map<string, Point>();
  const orbits = new Map<string, { requirementId: string; angle: number }>();

  for (const client of dataset.clients) {
    placeClientWork(dataset, client, clients, away, fixed, orbits);
  }

  return {
    orientation,
    bounds: boundsOf(clients),
    clients,
    fixed,
    orbits,
    away,
  };
}

function placeClientWork(
  dataset: Dataset,
  client: Client,
  clients: Map<string, Point>,
  away: Map<string, number>,
  fixed: Map<string, Point>,
  orbits: Map<string, { requirementId: string; angle: number }>,
) {
  const centre = clients.get(client.id);
  if (!centre) return;
  const outward = away.get(client.id) ?? 0;

  const requirements = dataset.requirements.filter(
    (requirement) => requirement.clientId === client.id,
  );
  const spread = 2.4;
  requirements.forEach((requirement, index) => {
    const angle =
      requirements.length === 1
        ? outward
        : outward - spread / 2 + (index * spread) / (requirements.length - 1);
    fixed.set(requirement.id, polar(centre, angle, rings.requirement));
  });

  const items = dataset.items.filter((item) => item.clientId === client.id);
  const loose = items.filter((item) => item.requirementId === undefined);
  loose.forEach((item, index) => {
    const angle = outward + Math.PI + 0.55 * (index - (loose.length - 1) / 2);
    fixed.set(item.id, polar(centre, angle, rings.outer));
  });
  for (const requirement of requirements) {
    const siblings = items.filter(
      (item) => item.requirementId === requirement.id,
    );
    siblings.forEach((item, index) => {
      orbits.set(item.id, {
        requirementId: requirement.id,
        angle: (index * Math.PI * 2) / siblings.length,
      });
    });
  }

  placeDecisions(
    dataset.decisions.filter((decision) => decision.clientId === client.id),
    centre,
    outward,
    fixed,
  );
}

function placeDecisions(
  decisions: Decision[],
  centre: Point,
  outward: number,
  fixed: Map<string, Point>,
) {
  decisions.forEach((decision, index) => {
    fixed.set(
      decision.id,
      polar(centre, outward + 2.1 + index * 0.5, rings.decision),
    );
  });
}

function boundsOf(clients: Map<string, Point>): Bounds {
  const margin = rings.watch + 70;
  const points = [...clients.values()];
  return {
    left: Math.min(...points.map((point) => point.x)) - margin,
    right: Math.max(...points.map((point) => point.x)) + margin,
    top: Math.min(...points.map((point) => point.y)) - margin - 40,
    bottom: Math.max(...points.map((point) => point.y)) + margin,
  };
}

export function polar(centre: Point, angle: number, radius: number): Point {
  return {
    x: centre.x + Math.cos(angle) * radius,
    y: centre.y + Math.sin(angle) * radius,
  };
}

/**
 * Where a backlog item is at `time` seconds. Items serving a requirement
 * orbit it slowly; under reduced motion they hold their starting angle.
 */
export function itemPosition(
  layout: Layout,
  item: BacklogItem,
  time: number,
  reducedMotion: boolean,
): Point {
  const orbit = layout.orbits.get(item.id);
  if (orbit) {
    const requirement = layout.fixed.get(orbit.requirementId);
    if (requirement) {
      return polar(
        requirement,
        orbit.angle + (reducedMotion ? 0 : time * 0.05),
        rings.orbit,
      );
    }
  }
  return (
    layout.fixed.get(item.id) ??
    layout.clients.get(item.clientId) ?? { x: 0, y: 0 }
  );
}

/** Where any work record (requirement or item) is, for things that point at it. */
export function workPosition(
  layout: Layout,
  dataset: Dataset,
  id: string,
  time: number,
  reducedMotion: boolean,
): Point | null {
  const item = dataset.items.find((candidate) => candidate.id === id);
  if (item) return itemPosition(layout, item, time, reducedMotion);
  return layout.fixed.get(id) ?? null;
}

/** An open question floats just outside what it blocks, drifting a little. */
export function questionPosition(
  layout: Layout,
  dataset: Dataset,
  question: Question,
  time: number,
  reducedMotion: boolean,
): Point {
  const blocked = workPosition(
    layout,
    dataset,
    question.blocks,
    time,
    reducedMotion,
  );
  const centre = layout.clients.get(question.clientId) ?? { x: 0, y: 0 };
  if (!blocked) return centre;
  const angle = Math.atan2(blocked.y - centre.y, blocked.x - centre.x) + 0.7;
  const drift = reducedMotion
    ? 0
    : Math.sin(time * 0.6 + question.id.length) * 6;
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
  const point = polar(
    centre,
    (layout.away.get(decision.clientId) ?? 0) + 2.1 + index * 0.5,
    rings.decision,
  );
  layout.fixed.set(decision.id, point);
  return point;
}
