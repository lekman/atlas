/**
 * The Doctor's ward board: a hospital floor plan seen from above, drawn on
 * monitor glass. Clients are wards, each with a small trace whose rhythm
 * follows how many of its staff are on rounds. Requirements are care goals,
 * backlog items treatment steps, agents staff badges, open questions
 * pending lab results, decisions signed charts. Home is the Nurses’ Station.
 *
 * It is a metaphor for work. Nothing here imitates a real device, shows a
 * patient value, or uses a protected emblem: no cross shapes anywhere.
 */
import { externalSourceNames } from "@atlas/core";

import type { Point } from "../camera";
import {
  decisionPosition,
  itemPosition,
  questionPosition,
  rings,
} from "../layout";
import {
  curveBetween,
  label,
  labelScale,
  pixels,
  pulsePhase,
  setScreenTransform,
  setWorldTransform,
  withAlpha,
} from "../paint";
import type { PaintContext, WorldPainter } from "../types";
import {
  floorPlan,
  roomCorner,
  staffOf,
  traceValue,
  wardRhythm,
  type Opening,
  type Rectangle,
  type Rhythm,
  type Side,
} from "./floor";
import {
  doctorPalette as palette,
  doctorShades as shade,
  doctorTypefaces as type,
} from "./palette";
import { doctorStatusNames, doctorVocabulary } from "./vocabulary";

const isFull = (paint: PaintContext) => paint.detail === "full";
const instrument = (alpha: number) => `rgba(${shade.instrument},${alpha})`;

/** How far below home's centre the station desk sits, in world units. */
const deskDrop = 22;

/** Seconds a trace takes to sweep across its strip. */
const sweepSeconds = 5;

function roundedRectangle(
  context: CanvasRenderingContext2D,
  box: Rectangle,
  radius: number,
): void {
  const r = Math.max(
    0,
    Math.min(radius, (box.right - box.left) / 2, (box.bottom - box.top) / 2),
  );
  context.beginPath();
  context.moveTo(box.left + r, box.top);
  context.arcTo(box.right, box.top, box.right, box.bottom, r);
  context.arcTo(box.right, box.bottom, box.left, box.bottom, r);
  context.arcTo(box.left, box.bottom, box.left, box.top, r);
  context.arcTo(box.left, box.top, box.right, box.top, r);
  context.closePath();
}

function inset(box: Rectangle, by: number): Rectangle {
  return {
    left: box.left + by,
    top: box.top + by,
    right: box.right - by,
    bottom: box.bottom - by,
  };
}

/** A rounded room outline with gaps where doors and corridors open. */
function strokeWalls(
  context: CanvasRenderingContext2D,
  box: Rectangle,
  radius: number,
  openings: Opening[],
): void {
  const { left, top, right, bottom } = box;
  const r = radius;
  const sides: Array<{
    side: Side;
    fixed: number;
    start: number;
    end: number;
  }> = [
    { side: "top", fixed: top, start: left + r, end: right - r },
    { side: "bottom", fixed: bottom, start: left + r, end: right - r },
    { side: "left", fixed: left, start: top + r, end: bottom - r },
    { side: "right", fixed: right, start: top + r, end: bottom - r },
  ];
  context.beginPath();
  for (const { side, fixed, start, end } of sides) {
    const horizontal = side === "top" || side === "bottom";
    const segment = (from: number, to: number) => {
      if (horizontal) {
        context.moveTo(from, fixed);
        context.lineTo(to, fixed);
      } else {
        context.moveTo(fixed, from);
        context.lineTo(fixed, to);
      }
    };
    let cursor = start;
    for (const gap of openings
      .filter((opening) => opening.side === side)
      .sort((a, b) => a.from - b.from)) {
      const from = Math.max(start, Math.min(end, gap.from));
      const to = Math.max(start, Math.min(end, gap.to));
      if (from > cursor) segment(cursor, from);
      cursor = Math.max(cursor, to);
    }
    if (cursor < end) segment(cursor, end);
  }
  for (const [x, y, from] of [
    [left + r, top + r, Math.PI],
    [right - r, top + r, Math.PI * 1.5],
    [right - r, bottom - r, 0],
    [left + r, bottom - r, Math.PI / 2],
  ] as const) {
    context.moveTo(x + Math.cos(from) * r, y + Math.sin(from) * r);
    context.arc(x, y, r, from, from + Math.PI / 2);
  }
  context.stroke();
}

const inward: Record<Side, Point> = {
  top: { x: 0, y: 1 },
  bottom: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};

/** The architect's door symbol: the leaf standing open and its swing. */
function drawDoorSwing(paint: PaintContext, box: Rectangle, opening: Opening) {
  const { context } = paint;
  const horizontal = opening.side === "top" || opening.side === "bottom";
  const wall =
    opening.side === "top"
      ? box.top
      : opening.side === "bottom"
        ? box.bottom
        : opening.side === "left"
          ? box.left
          : box.right;
  const hinge = horizontal
    ? { x: opening.from, y: wall }
    : { x: wall, y: opening.from };
  const normal = inward[opening.side];
  const along = horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const width = opening.to - opening.from;
  context.strokeStyle = instrument(0.32);
  context.lineWidth = pixels(paint, 1);
  context.beginPath();
  context.moveTo(hinge.x, hinge.y);
  context.lineTo(hinge.x + normal.x * width, hinge.y + normal.y * width);
  context.stroke();
  context.setLineDash([pixels(paint, 2), pixels(paint, 3)]);
  context.beginPath();
  const cross = normal.x * along.y - normal.y * along.x;
  context.arc(
    hinge.x,
    hinge.y,
    width,
    Math.atan2(normal.y, normal.x),
    Math.atan2(along.y, along.x),
    cross < 0,
  );
  context.stroke();
  context.setLineDash([]);
}

function drawGrid(paint: PaintContext, area: Rectangle) {
  const { context, camera } = paint;
  const lines = (step: number, alpha: number) => {
    context.strokeStyle = instrument(alpha);
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    for (
      let x = Math.floor(area.left / step) * step;
      x <= area.right;
      x += step
    ) {
      context.moveTo(x, area.top);
      context.lineTo(x, area.bottom);
    }
    for (
      let y = Math.floor(area.top / step) * step;
      y <= area.bottom;
      y += step
    ) {
      context.moveTo(area.left, y);
      context.lineTo(area.right, y);
    }
    context.stroke();
  };
  if (camera.scale > 0.18) lines(40, 0.035);
  lines(200, 0.07);
}

/**
 * A strip of monitor with a trace that sweeps left to right, the oldest part
 * fading ahead of the sweep. Under reduced motion the trace holds still.
 */
function drawTrace(
  paint: PaintContext,
  strip: Rectangle,
  rhythm: Rhythm,
  options: { alpha: number; head: boolean; width: number },
) {
  const { context, reducedMotion } = paint;
  const now = reducedMotion ? 2.2 : paint.time;
  const width = strip.right - strip.left;
  const middle =
    (strip.top + strip.bottom) / 2 + (strip.bottom - strip.top) * 0.12;
  const height = (strip.bottom - strip.top) * 0.42;
  const sweep = (now / sweepSeconds + rhythm.offset) % 1;
  const samples = Math.round(
    Math.max(36, Math.min(150, (width * paint.camera.scale) / 2.5)),
  );
  context.lineWidth = pixels(paint, options.width);
  context.lineJoin = "round";
  let previous: Point | null = null;
  for (let index = 0; index < samples; index++) {
    const along = index / (samples - 1);
    const age = (sweep - along + 1) % 1;
    const point = {
      x: strip.left + along * width,
      y: middle - traceValue(rhythm, now - age * sweepSeconds) * height,
    };
    if (age > 0.94) {
      previous = null;
      continue;
    }
    if (previous) {
      context.strokeStyle = instrument(options.alpha * (1 - age * 0.75));
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    }
    previous = point;
  }
  if (options.head && !reducedMotion) {
    const x = strip.left + sweep * width;
    const y = middle - traceValue(rhythm, now) * height;
    const glow = context.createRadialGradient(x, y, 0, x, y, pixels(paint, 7));
    glow.addColorStop(0, instrument(0.75));
    glow.addColorStop(1, instrument(0));
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, pixels(paint, 7), 0, Math.PI * 2);
    context.fill();
  }
}

function wardIndex(paint: PaintContext, clientId: string): number {
  return (
    paint.scene.dataset.clients
      .filter((client) => client.home !== true)
      .findIndex((client) => client.id === clientId) + 1
  );
}

/** The small rounded rectangle of a treatment step, a checklist box. */
function stepBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  half: number,
) {
  roundedRectangle(
    context,
    { left: x - half, top: y - half, right: x + half, bottom: y + half },
    half * 0.4,
  );
}

function tick(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  context.beginPath();
  context.moveTo(x - size * 0.55, y);
  context.lineTo(x - size * 0.15, y + size * 0.4);
  context.lineTo(x + size * 0.6, y - size * 0.45);
  context.stroke();
}

export const doctorPainter: WorldPainter = {
  background(paint) {
    const { context, width, height, scene } = paint;
    setScreenTransform(paint);
    context.fillStyle = palette.ground;
    context.fillRect(0, 0, width, height);
    const glow = context.createRadialGradient(
      width * 0.5,
      height * 0.45,
      0,
      width * 0.5,
      height * 0.45,
      Math.max(width, height) * 0.75,
    );
    glow.addColorStop(0, "rgba(40,110,112,0.16)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    setWorldTransform(paint);
    const bounds = scene.layout.bounds;
    drawGrid(paint, {
      left: bounds.left - 400,
      right: bounds.right + 400,
      top: bounds.top - 400,
      bottom: bounds.bottom + 400,
    });

    const floor = floorPlan(scene.layout, scene.dataset);

    // Corridors, only where no room covers them.
    context.save();
    context.beginPath();
    context.rect(
      bounds.left - 2000,
      bounds.top - 2000,
      bounds.right - bounds.left + 4000,
      bounds.bottom - bounds.top + 4000,
    );
    for (const room of floor.rooms.values()) {
      const { box } = room;
      context.rect(
        box.left,
        box.top,
        box.right - box.left,
        box.bottom - box.top,
      );
    }
    context.clip("evenodd");
    context.strokeStyle = instrument(0.2);
    context.lineWidth = pixels(paint, 2);
    for (const corridor of floor.corridors)
      context.strokeRect(
        corridor.left,
        corridor.top,
        corridor.right - corridor.left,
        corridor.bottom - corridor.top,
      );
    context.fillStyle = shade.corridor;
    for (const corridor of floor.corridors)
      context.fillRect(
        corridor.left,
        corridor.top,
        corridor.right - corridor.left,
        corridor.bottom - corridor.top,
      );
    context.strokeStyle = instrument(0.22);
    context.lineWidth = pixels(paint, 1.5);
    context.setLineDash([pixels(paint, 10), pixels(paint, 7)]);
    for (const route of floor.routes) {
      context.beginPath();
      route.forEach((point, index) =>
        index === 0
          ? context.moveTo(point.x, point.y)
          : context.lineTo(point.x, point.y),
      );
      context.stroke();
    }
    context.setLineDash([]);
    context.restore();

    // Rooms: a floor a step lighter than the glass, and a double wall.
    for (const room of floor.rooms.values()) {
      roundedRectangle(context, room.box, roomCorner);
      context.fillStyle = withAlpha(shade.floor, room.home ? 0.9 : 0.78);
      context.fill();
      context.lineCap = "round";
      context.strokeStyle = instrument(room.home ? 0.6 : 0.46);
      context.lineWidth = pixels(paint, 1.6);
      strokeWalls(context, room.box, roomCorner, room.openings);
      context.strokeStyle = instrument(0.16);
      context.lineWidth = pixels(paint, 1);
      strokeWalls(context, inset(room.box, 8), roomCorner - 8, room.openings);
      context.lineCap = "butt";
      for (const opening of room.openings)
        if (opening.door) drawDoorSwing(paint, room.box, opening);
    }
  },

  home(paint, home) {
    const { context, scene } = paint;
    const centre = scene.layout.clients.get(home.id) ?? { x: 0, y: 0 };
    const { x, y } = centre;

    const pool = context.createRadialGradient(
      x,
      y + deskDrop,
      0,
      x,
      y + deskDrop,
      120,
    );
    pool.addColorStop(0, instrument(0.13));
    pool.addColorStop(1, instrument(0));
    context.fillStyle = pool;
    context.beginPath();
    context.arc(x, y + deskDrop, 120, 0, Math.PI * 2);
    context.fill();

    // The desk sits a little below the middle, clear of the decisions that
    // are placed above and to the left of every centre.
    context.save();
    context.translate(0, deskDrop);
    context.translate(x, y);
    context.scale(1.15, 1.15);
    context.translate(-x, -y);
    // The desk: a U-shaped counter, open towards the corridor below.
    const counter = () => {
      context.beginPath();
      context.moveTo(x - 66, y + 36);
      context.lineTo(x - 66, y - 12);
      context.arcTo(x - 66, y - 38, x - 40, y - 38, 26);
      context.lineTo(x + 40, y - 38);
      context.arcTo(x + 66, y - 38, x + 66, y - 12, 26);
      context.lineTo(x + 66, y + 36);
    };
    context.lineCap = "round";
    context.lineJoin = "round";
    counter();
    context.strokeStyle = instrument(0.7);
    context.lineWidth = 20 + pixels(paint, 2.6);
    context.stroke();
    context.strokeStyle = "#123238";
    context.lineWidth = 20;
    context.stroke();
    context.lineCap = "butt";

    // A chair inside the counter.
    context.strokeStyle = instrument(0.35);
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.arc(x, y + 4, 8, 0, Math.PI * 2);
    context.stroke();

    // A bank of small monitors on the back of the desk, one per ward.
    const wards = scene.dataset.clients.filter(
      (client) => client.home !== true,
    );
    const count = Math.max(3, Math.min(5, wards.length));
    const spacing = 25;
    for (let index = 0; index < count; index++) {
      const mx = x + (index - (count - 1) / 2) * spacing;
      const screen = {
        left: mx - 10.5,
        right: mx + 10.5,
        top: y - 51,
        bottom: y - 36,
      };
      roundedRectangle(context, screen, 2.5);
      context.fillStyle = "#03100f";
      context.fill();
      context.strokeStyle = instrument(0.75);
      context.lineWidth = pixels(paint, 1);
      context.stroke();
      const ward = wards[index];
      const rhythm: Rhythm = ward
        ? wardRhythm(scene.dataset, ward.id)
        : { rate: 0, amplitude: 0.12, offset: index * 0.37 };
      drawTrace(paint, inset(screen, 2.5), rhythm, {
        alpha: 0.95,
        head: false,
        width: 1,
      });
    }

    // A clipboard on the right arm of the desk.
    context.save();
    context.translate(x + 66, y + 14);
    context.rotate(0.14);
    roundedRectangle(context, { left: -7, top: -9, right: 7, bottom: 9 }, 1.5);
    context.fillStyle = shade.paper;
    context.globalAlpha = 0.85;
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = "#3d6a6a";
    context.fillRect(-3.5, -10.5, 7, 3);
    context.strokeStyle = "rgba(29,74,80,0.7)";
    context.lineWidth = 0.9;
    for (const line of [-3, 0.5, 4]) {
      context.beginPath();
      context.moveTo(-4.5, line);
      context.lineTo(4.5 - (line > 3 ? 3 : 0), line);
      context.stroke();
    }
    context.restore();
    context.restore();

    const below = y + deskDrop + 46 + pixels(paint, 12);
    label(paint, doctorVocabulary.homeName, x, below, {
      size: isFull(paint)
        ? Math.max(11, Math.min(16, (16 * paint.camera.scale) / 0.4))
        : 10.5,
      font: type.display,
      colour: palette.accent,
      align: "center",
      baseline: "top",
      letterSpacing: isFull(paint) ? 0.6 : 0.3,
    });
    if (isFull(paint)) {
      label(paint, `Home · ${home.name}`, x, below + pixels(paint, 20), {
        size: 10,
        font: type.mono,
        colour: palette.mute,
        align: "center",
        baseline: "top",
      });
    }
  },

  client(paint, client) {
    const { context, scene } = paint;
    const room = floorPlan(scene.layout, scene.dataset).rooms.get(client.id);
    if (!room) return;
    const { box, centre } = room;

    // Bays along the far side wall, curtain rails drawn faint.
    const outer =
      centre.x <=
      (scene.layout.clients.get(
        scene.dataset.clients.find((candidate) => candidate.home === true)
          ?.id ?? "",
      )?.x ?? 0)
        ? box.left
        : box.right;
    const direction = outer === box.left ? 1 : -1;
    const bayTop = box.top + 96;
    const bayBottom = box.bottom - 24;
    const bays = Math.max(2, Math.floor((bayBottom - bayTop) / 100));
    const bayHeight = (bayBottom - bayTop) / bays;
    context.setLineDash([pixels(paint, 4), pixels(paint, 4)]);
    context.strokeStyle = instrument(0.1);
    context.lineWidth = pixels(paint, 1);
    for (let bay = 0; bay < bays; bay++) {
      const top = bayTop + bay * bayHeight + 6;
      const bottom = top + bayHeight - 12;
      const inner = outer + direction * 70;
      context.beginPath();
      context.moveTo(outer + direction * 10, top);
      context.lineTo(inner, top);
      context.lineTo(inner, bottom);
      context.lineTo(outer + direction * 10, bottom);
      context.stroke();
    }
    context.setLineDash([]);

    // The staff room table at the heart of the ward, where idle staff sit.
    roundedRectangle(
      context,
      {
        left: centre.x - 22,
        top: centre.y - 16,
        right: centre.x + 22,
        bottom: centre.y + 16,
      },
      8,
    );
    context.fillStyle = instrument(0.05);
    context.fill();
    context.strokeStyle = instrument(0.3);
    context.lineWidth = pixels(paint, 1);
    context.stroke();

    // The ward's monitor strip along the top wall.
    const strip = {
      left: box.left + 26,
      right: box.right - 26,
      top: box.top + 16,
      bottom: box.top + 74,
    };
    roundedRectangle(context, strip, 8);
    context.fillStyle = "rgba(3,14,16,0.7)";
    context.fill();
    context.strokeStyle = instrument(0.2);
    context.lineWidth = pixels(paint, 1);
    context.stroke();
    const rhythm = wardRhythm(scene.dataset, client.id);
    drawTrace(paint, inset(strip, 4), rhythm, {
      alpha: 0.8,
      head: true,
      width: 1.6,
    });

    const staff = staffOf(scene.dataset, client.id);
    const onRounds = staff.filter((agent) => agent.status === "running").length;
    const full = isFull(paint);
    label(
      paint,
      client.name,
      box.left + pixels(paint, 2),
      box.top - pixels(paint, full ? 27 : 11),
      {
        size: full
          ? Math.max(11, Math.min(17, (17 * paint.camera.scale) / 0.4))
          : 10.5,
        font: type.display,
        colour: palette.ink,
        letterSpacing: full ? 0.4 : 0.2,
      },
    );
    if (full) {
      const roomy = (box.right - box.left) * paint.camera.scale > 240;
      label(
        paint,
        `${roomy ? `Ward ${wardIndex(paint, client.id)} · ` : ""}${staff.length} staff · ${onRounds} ${doctorStatusNames.running}`,
        box.left + pixels(paint, 2),
        box.top - pixels(paint, 10),
        { size: 9.5, font: type.mono, colour: palette.mute },
      );
      if (paint.camera.scale > labelScale.requirement) {
        label(paint, "Staff room", centre.x, centre.y, {
          size: 8.5,
          font: type.mono,
          colour: palette.mute,
          align: "center",
        });
      }
    }
  },

  requirement(paint, requirement) {
    const { context } = paint;
    const point = paint.scene.layout.fixed.get(requirement.id);
    if (!point) return;
    const done = requirement.state === "done";
    // The bay's curtain rail, which its treatment steps move along.
    context.setLineDash([pixels(paint, 3), pixels(paint, 5)]);
    context.strokeStyle = instrument(done ? 0.08 : 0.18);
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.arc(point.x, point.y, rings.orbit, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);

    context.globalAlpha = done ? 0.5 : 1;
    context.fillStyle = "#123a40";
    context.beginPath();
    context.arc(point.x, point.y, 15, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = instrument(0.85);
    context.lineWidth = pixels(paint, 1.4);
    context.stroke();
    if (done) {
      context.strokeStyle = palette.ink;
      tick(context, point.x, point.y, 10);
    } else {
      context.lineWidth = pixels(paint, 1.1);
      context.beginPath();
      context.arc(point.x, point.y, 8, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = palette.ink;
      context.beginPath();
      context.arc(point.x, point.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(paint, requirement.title, point.x, point.y + 20, {
        size: 10,
        font: type.mono,
        colour: done ? "#628784" : "#b5dcd8",
        align: "center",
        baseline: "top",
      });
    }
  },

  link(paint, item) {
    const { context, scene } = paint;
    const from = item.requirementId
      ? scene.layout.fixed.get(item.requirementId)
      : undefined;
    if (!from) return;
    const to = itemPosition(
      scene.layout,
      item,
      paint.time,
      paint.reducedMotion,
    );
    context.strokeStyle = instrument(0.14);
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  },

  item(paint, item) {
    const { context, scene } = paint;
    const point = itemPosition(
      scene.layout,
      item,
      paint.time,
      paint.reducedMotion,
    );
    const half = item.priority === "high" ? 7 : 5.5;
    const outline = pixels(paint, 1.3);
    context.save();
    context.lineWidth = outline;
    context.lineJoin = "round";
    switch (item.state) {
      case "todo":
        // Planned: an empty box.
        stepBox(context, point.x, point.y, half);
        context.fillStyle = palette.ground;
        context.fill();
        context.strokeStyle = "#9fcbc6";
        context.stroke();
        break;
      case "doing":
        // Under way: a filled box.
        stepBox(context, point.x, point.y, half);
        context.fillStyle = palette.ink;
        context.fill();
        break;
      case "review":
        // Being checked: half filled, corner to corner.
        stepBox(context, point.x, point.y, half);
        context.fillStyle = palette.ground;
        context.fill();
        context.save();
        context.clip();
        context.fillStyle = palette.ink;
        context.beginPath();
        context.moveTo(point.x - half, point.y - half);
        context.lineTo(point.x - half, point.y + half);
        context.lineTo(point.x + half, point.y + half);
        context.closePath();
        context.fill();
        context.restore();
        stepBox(context, point.x, point.y, half);
        context.strokeStyle = palette.ink;
        context.stroke();
        break;
      case "done":
        // Given: a ticked box, faded.
        context.globalAlpha = 0.5;
        stepBox(context, point.x, point.y, half);
        context.strokeStyle = "#9fcbc6";
        context.stroke();
        tick(context, point.x, point.y, half * 1.2);
        break;
    }
    if (item.priority === "high") {
      // A frame around the box: higher priority.
      context.globalAlpha = item.state === "done" ? 0.4 : 0.75;
      stepBox(context, point.x, point.y, half + 4);
      context.strokeStyle = palette.ink;
      context.lineWidth = outline;
      context.stroke();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.item) {
      label(paint, item.title, point.x + 13, point.y, {
        size: 10,
        font: type.mono,
        colour: "#a6cdc9",
      });
    }
  },

  question(paint, question, fade) {
    const { context, scene, time, reducedMotion } = paint;
    const point = questionPosition(
      scene.layout,
      scene.dataset,
      question,
      time,
      reducedMotion,
    );
    context.save();
    context.globalAlpha = fade;
    const blocked = scene.dataset.items.find(
      (item) => item.id === question.blocks,
    );
    if (blocked) {
      const to = itemPosition(scene.layout, blocked, time, reducedMotion);
      context.setLineDash([pixels(paint, 2), pixels(paint, 4)]);
      context.strokeStyle = withAlpha(shade.sample, 0.45);
      context.lineWidth = pixels(paint, 1);
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.setLineDash([]);
    }

    // A test tube in a little stand, waiting on its result.
    context.save();
    context.translate(point.x, point.y);
    context.rotate(-0.3);
    const tube = () => {
      context.beginPath();
      context.moveTo(-5, -14);
      context.lineTo(-5, 8);
      context.arc(0, 8, 5, Math.PI, 0, true);
      context.lineTo(5, -14);
    };
    tube();
    context.fillStyle = "rgba(3,14,16,0.85)";
    context.fill();
    context.save();
    context.clip();
    context.fillStyle = withAlpha(shade.sample, 0.85);
    context.fillRect(-6, 0, 12, 14);
    context.restore();
    tube();
    context.strokeStyle = shade.sample;
    context.lineWidth = pixels(paint, 1.3);
    context.stroke();
    context.beginPath();
    context.moveTo(-7.5, -14);
    context.lineTo(7.5, -14);
    context.stroke();
    context.restore();
    if (isFull(paint))
      label(paint, "?", point.x + 11, point.y - 9, {
        size: 11,
        font: type.display,
        colour: shade.sample,
        align: "center",
      });

    if (question.asks === "You") {
      const phase = pulsePhase(paint, 1.1, question.id.length * 0.13);
      context.strokeStyle = withAlpha(palette.status.waiting, 1 - phase);
      context.lineWidth = pixels(paint, 1.6);
      context.beginPath();
      context.arc(point.x, point.y, 16 + phase * 16, 0, Math.PI * 2);
      context.stroke();
    }
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(
        paint,
        `Result pending · ${question.title}`,
        point.x - pixels(paint, 12),
        point.y - pixels(paint, 16),
        {
          size: 10,
          font: type.mono,
          colour: shade.sample,
          align: "right",
        },
      );
    }
    context.restore();
  },

  decision(paint, decision, appear) {
    const { context, scene } = paint;
    const point = decisionPosition(scene.layout, scene.dataset, decision);
    const made = decision.state === "made";
    const grow = 1 + (1 - appear) * 0.9;
    context.save();
    context.globalAlpha = Math.min(1, appear * 1.4);
    context.translate(point.x, point.y);
    context.scale(grow, grow);
    // A signed chart on its clipboard.
    const sheet = { left: -9, top: -11, right: 9, bottom: 12 };
    roundedRectangle(context, sheet, 2);
    if (made) {
      context.fillStyle = shade.paper;
      context.fill();
    } else {
      context.setLineDash([2, 2]);
      context.strokeStyle = withAlpha(shade.paper, 0.6);
      context.lineWidth = 1;
      context.stroke();
      context.setLineDash([]);
    }
    context.fillStyle = "#3d6a6a";
    context.fillRect(-4.5, -13, 9, 3.5);
    context.strokeStyle = made ? "rgba(29,74,80,0.55)" : instrument(0.4);
    context.lineWidth = 0.9;
    for (const line of [-5, -1.5, 2]) {
      context.beginPath();
      context.moveTo(-6, line);
      context.lineTo(line > 1 ? 2 : 6, line);
      context.stroke();
    }
    if (made) {
      // The signature, written as the decision appears.
      context.strokeStyle = "#174a54";
      context.lineWidth = 1.2;
      context.beginPath();
      const steps = Math.max(1, Math.round(20 * appear));
      for (let step = 0; step <= steps; step++) {
        const along = step / 20;
        const sx = -6 + along * 12;
        const sy = 7.5 - Math.sin(along * Math.PI * 3.2) * 2.2 + along * 0.5;
        if (step === 0) context.moveTo(sx, sy);
        else context.lineTo(sx, sy);
      }
      context.stroke();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(paint, `Diagnosis · ${decision.title}`, point.x + 15, point.y, {
        size: 9.5,
        font: type.mono,
        colour: "#c7e5e1",
        alpha: appear,
      });
    }
  },

  agent(paint, agent, motion, colour) {
    const { context } = paint;
    const { position, trail } = motion;

    // Faint footsteps behind staff on rounds.
    if (agent.status === "running" && trail.length > 6) {
      for (let index = 4; index < trail.length; index += 4) {
        const here = trail[index];
        const before = trail[index - 2];
        if (!here || !before) continue;
        const heading = Math.atan2(here.y - before.y, here.x - before.x);
        if (Math.hypot(here.x - before.x, here.y - before.y) < 0.4) continue;
        const side = (index / 4) % 2 === 0 ? 1 : -1;
        const across = heading + Math.PI / 2;
        context.fillStyle = withAlpha(colour, (1 - index / trail.length) * 0.4);
        context.beginPath();
        context.ellipse(
          here.x + Math.cos(across) * pixels(paint, 3) * side,
          here.y + Math.sin(across) * pixels(paint, 3) * side,
          pixels(paint, 2.2),
          pixels(paint, 1.3),
          heading,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }

    // An identity badge on a clip: upright, in the status colour.
    const size =
      pixels(paint, isFull(paint) ? 6.5 : 5) *
      Math.max(1, paint.camera.scale * 1.5);
    const badge = {
      left: position.x - size * 0.78,
      right: position.x + size * 0.78,
      top: position.y - size * 1.05,
      bottom: position.y + size * 1.05,
    };
    roundedRectangle(context, inset(badge, -pixels(paint, 1.5)), size * 0.45);
    context.fillStyle = palette.ground;
    context.fill();
    roundedRectangle(context, badge, size * 0.35);
    context.fillStyle = colour;
    context.fill();
    context.fillStyle = withAlpha(palette.ground, 0.85);
    roundedRectangle(
      context,
      {
        left: position.x - size * 0.32,
        right: position.x + size * 0.32,
        top: badge.top + size * 0.22,
        bottom: badge.top + size * 0.44,
      },
      size * 0.1,
    );
    context.fill();
    context.fillStyle = withAlpha(palette.ground, 0.45);
    context.beginPath();
    context.arc(
      position.x,
      position.y + size * 0.12,
      size * 0.3,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillRect(
      position.x - size * 0.45,
      position.y + size * 0.6,
      size * 0.9,
      size * 0.14,
    );

    if (paint.scene.needsAttention(agent)) {
      const phase = pulsePhase(
        paint,
        1,
        paint.scene.dataset.agents.indexOf(agent) * 0.3,
      );
      context.strokeStyle = withAlpha(colour, 1 - phase);
      context.lineWidth = pixels(paint, 1.6);
      context.beginPath();
      context.arc(
        position.x,
        position.y,
        pixels(paint, 12) + phase * pixels(paint, 18),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    if (!isFull(paint)) return;
    label(
      paint,
      agent.name,
      position.x + pixels(paint, 13),
      position.y - pixels(paint, 6),
      { size: 11, font: type.display, colour: palette.ink },
    );
    if (paint.camera.scale > labelScale.agentStatus) {
      label(
        paint,
        doctorStatusNames[agent.status],
        position.x + pixels(paint, 13),
        position.y + pixels(paint, 7),
        { size: 9.5, font: type.mono, colour },
      );
    }
  },

  effect(paint, effect, progress) {
    const { context, scene, time, reducedMotion } = paint;
    const fadeOut = Math.min(1, (1 - progress) * 2);
    if (effect.kind === "message") {
      // A page: a dashed line, a pager travelling along it, a buzz on arrival.
      const from = scene.motions.get(effect.from)?.position;
      const to = scene.motions.get(effect.to)?.position;
      if (!from || !to) return;
      const curve = curveBetween(from, to, 0.16);
      context.setLineDash([pixels(paint, 5), pixels(paint, 4)]);
      context.strokeStyle = instrument((1 - progress) * 0.75);
      context.lineWidth = pixels(paint, 1.3);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.quadraticCurveTo(curve.control.x, curve.control.y, to.x, to.y);
      context.stroke();
      context.setLineDash([]);
      const travel = reducedMotion ? 1 : Math.min(1, progress * 1.6);
      const pager = curve.at(travel);
      const w = pixels(paint, 7);
      const h = pixels(paint, 5);
      roundedRectangle(
        context,
        {
          left: pager.x - w,
          right: pager.x + w,
          top: pager.y - h,
          bottom: pager.y + h,
        },
        pixels(paint, 2),
      );
      context.fillStyle = palette.ink;
      context.globalAlpha = fadeOut;
      context.fill();
      context.fillStyle = "#123238";
      context.fillRect(
        pager.x - w * 0.65,
        pager.y - h * 0.55,
        w * 1.3,
        h * 0.7,
      );
      context.globalAlpha = 1;
      if (travel >= 1) {
        const buzz = reducedMotion ? 0.5 : (progress * 3) % 1;
        context.strokeStyle = instrument((1 - buzz) * fadeOut * 0.8);
        context.lineWidth = pixels(paint, 1.2);
        for (const side of [-1, 1]) {
          context.beginPath();
          context.arc(
            to.x,
            to.y,
            pixels(paint, 14) + buzz * pixels(paint, 10),
            (side < 0 ? Math.PI : 0) - 0.5,
            (side < 0 ? Math.PI : 0) + 0.5,
          );
          context.stroke();
        }
      }
      if (isFull(paint)) {
        label(
          paint,
          `Page · ${effect.text}`,
          curve.control.x,
          curve.control.y,
          {
            size: 10,
            font: type.mono,
            colour: "#c4ebe6",
            align: "center",
            alpha: fadeOut,
          },
        );
      }
    } else if (effect.kind === "external") {
      // The lab feed: a line of results running in from beyond the ward.
      const target = scene.dataset.items.find(
        (item) => item.id === effect.recordId,
      );
      const point = target
        ? itemPosition(scene.layout, target, time, reducedMotion)
        : scene.layout.fixed.get(effect.recordId);
      if (!point) return;
      const clientId =
        target?.clientId ??
        scene.dataset.requirements.find(
          (requirement) => requirement.id === effect.recordId,
        )?.clientId;
      const centre = (clientId && scene.layout.clients.get(clientId)) || {
        x: 0,
        y: -1,
      };
      const angle = Math.atan2(centre.y || -1, centre.x);
      const start = {
        x: point.x + Math.cos(angle) * 640,
        y: point.y + Math.sin(angle) * 640,
      };
      const travel = reducedMotion ? 1 : Math.min(1, progress * 1.5);
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const normal = { x: -dy / length, y: dx / length };
      context.strokeStyle = instrument((1 - progress) * 0.85);
      context.lineWidth = pixels(paint, 1.4);
      context.lineJoin = "round";
      context.beginPath();
      const samples = 90;
      for (let index = 0; index <= samples * travel; index++) {
        const along = index / samples;
        // A small blip every so often along the line, like data arriving.
        const local = (along * 7) % 1;
        const blip =
          local > 0.42 && local < 0.58
            ? Math.sin(((local - 0.42) / 0.16) * Math.PI * 2) * 14
            : 0;
        const x = start.x + dx * along + normal.x * blip;
        const y = start.y + dy * along + normal.y * blip;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      const head = { x: start.x + dx * travel, y: start.y + dy * travel };
      context.fillStyle = instrument(fadeOut);
      context.beginPath();
      context.arc(head.x, head.y, pixels(paint, 3), 0, Math.PI * 2);
      context.fill();
      if (travel >= 1) {
        context.strokeStyle = instrument(1 - progress);
        context.lineWidth = pixels(paint, 1.4);
        context.beginPath();
        context.arc(
          point.x,
          point.y,
          Math.max(0, (progress - 0.66) * 3) * pixels(paint, 36),
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      if (isFull(paint)) {
        label(
          paint,
          `Lab feed · ${externalSourceNames[effect.source]}: ${effect.text}`,
          head.x + pixels(paint, 10),
          head.y - pixels(paint, 12),
          {
            size: 10,
            font: type.mono,
            colour: "#c4ebe6",
            alpha: fadeOut,
          },
        );
      }
    } else {
      const motion = scene.motions.get(effect.agentId);
      const agent = scene.dataset.agents.find(
        (candidate) => candidate.id === effect.agentId,
      );
      if (!motion || !agent) return;
      context.strokeStyle = withAlpha(
        palette.status[agent.status],
        1 - progress,
      );
      context.lineWidth = pixels(paint, 2);
      context.beginPath();
      context.arc(
        motion.position.x,
        motion.position.y,
        pixels(paint, 9) + progress * pixels(paint, 38),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  },

  overlay(paint) {
    // Monitor glass: the edges fall a little darker, never over the centre.
    const { context, width, height } = paint;
    const edge = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.45,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.8,
    );
    edge.addColorStop(0, "rgba(2,8,10,0)");
    edge.addColorStop(1, "rgba(2,8,10,0.35)");
    context.fillStyle = edge;
    context.fillRect(0, 0, width, height);
  },
};
