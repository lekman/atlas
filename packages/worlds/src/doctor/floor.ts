/**
 * The floor plan: a room per ward, the station room at home, and corridors
 * from the station to each ward door. Worked out from the shared layout, so
 * the rooms follow it in landscape and portrait alike, and cached per layout.
 */
import type { Agent, Dataset } from "@atlas/core";
import { clientOfAgent } from "@atlas/core";

import type { Point } from "../camera";
import type { Layout } from "../layout";
import { hashString } from "../random";

export interface Rectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type Side = "top" | "bottom" | "left" | "right";

/** A gap in a wall, measured along it in world units. */
export interface Opening {
  side: Side;
  from: number;
  to: number;
  /** A ward door draws its swing; a corridor mouth is just a gap. */
  door: boolean;
}

export interface Room {
  id: string;
  home: boolean;
  centre: Point;
  box: Rectangle;
  openings: Opening[];
}

export interface Floor {
  rooms: Map<string, Room>;
  corridors: Rectangle[];
  /** The guide line painted down each corridor, station to ward door. */
  routes: Point[][];
}

export const corridorWidth = 104;
export const doorWidth = 72;
export const roomCorner = 30;

const wardHalf = { width: 360, height: 352 };
const stationHalf = { width: 290, height: 348 };
const roomGap = 44;
const smallestHalf = 150;

const floors = new WeakMap<Layout, Floor>();

export function floorPlan(layout: Layout, dataset: Dataset): Floor {
  const known = floors.get(layout);
  if (known) return known;

  const homeId = dataset.clients.find((client) => client.home === true)?.id;
  const halves = new Map<string, { width: number; height: number }>();
  for (const id of layout.clients.keys())
    halves.set(id, id === homeId ? { ...stationHalf } : { ...wardHalf });

  // Shrink any two rooms that would touch, along the axis they are apart on.
  const entries = [...layout.clients.entries()];
  for (let first = 0; first < entries.length; first++) {
    for (let second = first + 1; second < entries.length; second++) {
      const [idA, a] = entries[first] ?? [];
      const [idB, b] = entries[second] ?? [];
      if (!idA || !idB || !a || !b) continue;
      const halfA = halves.get(idA);
      const halfB = halves.get(idB);
      if (!halfA || !halfB) continue;
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      const overlapX = halfA.width + halfB.width + roomGap - dx;
      const overlapY = halfA.height + halfB.height + roomGap - dy;
      if (overlapX <= 0 || overlapY <= 0) continue;
      if (dx >= dy) {
        const factor = (dx - roomGap) / (halfA.width + halfB.width);
        halfA.width = Math.max(smallestHalf, halfA.width * factor);
        halfB.width = Math.max(smallestHalf, halfB.width * factor);
      } else {
        const factor = (dy - roomGap) / (halfA.height + halfB.height);
        halfA.height = Math.max(smallestHalf, halfA.height * factor);
        halfB.height = Math.max(smallestHalf, halfB.height * factor);
      }
    }
  }

  const rooms = new Map<string, Room>();
  for (const [id, centre] of layout.clients) {
    const half = halves.get(id) ?? wardHalf;
    rooms.set(id, {
      id,
      home: id === homeId,
      centre,
      box: {
        left: centre.x - half.width,
        right: centre.x + half.width,
        top: centre.y - half.height,
        bottom: centre.y + half.height,
      },
      openings: [],
    });
  }

  const corridors: Rectangle[] = [];
  const routes: Point[][] = [];
  const station = homeId ? rooms.get(homeId) : undefined;
  const hub = station?.centre ?? { x: 0, y: 0 };
  const half = corridorWidth / 2;
  const mouth = half - 10;
  const addStationOpening = (opening: Opening) => {
    if (!station) return;
    const same = station.openings.some(
      (existing) =>
        existing.side === opening.side &&
        Math.abs(existing.from - opening.from) < 1,
    );
    if (!same) station.openings.push(opening);
  };

  for (const room of rooms.values()) {
    if (room.home) continue;
    const { centre, box } = room;
    const width = (box.right - box.left) / 2;
    if (Math.abs(centre.y - hub.y) > 1) {
      // A door in the wall that faces the station's row, towards its side.
      const below = centre.y > hub.y;
      const side: Side = below ? "top" : "bottom";
      const wall = below ? box.top : box.bottom;
      const inward = Math.sign(hub.x - centre.x);
      const doorX = centre.x + inward * width * 0.45;
      room.openings.push({
        side,
        from: doorX - doorWidth / 2,
        to: doorX + doorWidth / 2,
        door: true,
      });
      corridors.push({
        left: Math.min(hub.x, doorX) - half,
        right: Math.max(hub.x, doorX) + half,
        top: hub.y - half,
        bottom: hub.y + half,
      });
      corridors.push({
        left: doorX - half,
        right: doorX + half,
        top: Math.min(hub.y, wall),
        bottom: Math.max(hub.y, wall),
      });
      routes.push([
        { x: hub.x, y: hub.y },
        { x: doorX, y: hub.y },
        { x: doorX, y: wall },
      ]);
      if (station) {
        const stationHalfWidth = (station.box.right - station.box.left) / 2;
        if (Math.abs(doorX - hub.x) > stationHalfWidth - half) {
          addStationOpening({
            side: doorX > hub.x ? "right" : "left",
            from: hub.y - mouth,
            to: hub.y + mouth,
            door: false,
          });
        } else {
          addStationOpening({
            side: below ? "bottom" : "top",
            from: doorX - mouth,
            to: doorX + mouth,
            door: false,
          });
        }
      }
    } else {
      // Level with the station: a door in the side wall that faces it.
      const right = centre.x < hub.x;
      const wall = right ? box.right : box.left;
      room.openings.push({
        side: right ? "right" : "left",
        from: centre.y - doorWidth / 2,
        to: centre.y + doorWidth / 2,
        door: true,
      });
      corridors.push({
        left: Math.min(hub.x, wall),
        right: Math.max(hub.x, wall),
        top: hub.y - half,
        bottom: hub.y + half,
      });
      routes.push([
        { x: hub.x, y: hub.y },
        { x: wall, y: hub.y },
      ]);
      addStationOpening({
        side: right ? "left" : "right",
        from: hub.y - mouth,
        to: hub.y + mouth,
        door: false,
      });
    }
  }

  const floor = { rooms, corridors, routes };
  floors.set(layout, floor);
  return floor;
}

/** The staff whose group serves a client. */
export function staffOf(dataset: Dataset, clientId: string): Agent[] {
  return dataset.agents.filter(
    (agent) => clientOfAgent(dataset, agent) === clientId,
  );
}

export interface Rhythm {
  /** Beats per second; zero means the ward is resting. */
  rate: number;
  amplitude: number;
  /** Where in its cycle this ward starts, so wards never beat together. */
  offset: number;
}

/**
 * How a ward's trace moves: faster and taller the more of its staff are on
 * rounds. A ward with nobody active rests on a slow, low wave, never a flat
 * line, which reads as something far more serious than a quiet ward.
 */
export function wardRhythm(dataset: Dataset, clientId: string): Rhythm {
  const staff = staffOf(dataset, clientId);
  const running = staff.filter((agent) => agent.status === "running").length;
  const watching = staff.filter((agent) => agent.status === "watching").length;
  const offset = (hashString(clientId) % 1000) / 1000;
  if (running + watching === 0) return { rate: 0, amplitude: 0.34, offset };
  return {
    rate: Math.min(1.9, 0.75 + running * 0.24 + watching * 0.08),
    amplitude: Math.min(1, 0.5 + running * 0.14 + watching * 0.05),
    offset,
  };
}

/** One beat of a stylised trace, for a phase from 0 to 1. Roughly -0.3 to 1. */
export function beat(phase: number): number {
  const bump = (centre: number, width: number, height: number) =>
    height * Math.exp(-(((phase - centre) / width) ** 2));
  return (
    bump(0.16, 0.04, 0.12) -
    bump(0.29, 0.012, 0.14) +
    bump(0.32, 0.014, 1) -
    bump(0.35, 0.014, 0.26) +
    bump(0.56, 0.06, 0.24)
  );
}

/** The trace's height at `time` seconds, from -1 to 1. */
export function traceValue(rhythm: Rhythm, time: number): number {
  if (rhythm.rate === 0)
    return (
      rhythm.amplitude *
      Math.sin((time * 0.3 + rhythm.offset) * Math.PI * 2) *
      (0.75 + 0.25 * Math.sin(time * 0.11 + rhythm.offset * 6))
    );
  const phase = (((time * rhythm.rate + rhythm.offset) % 1) + 1) % 1;
  return beat(phase) * rhythm.amplitude;
}
