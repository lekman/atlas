/**
 * The Mariner's sea chart: an engraved chart with soundings, depth contours
 * and rhumb lines. Clients are islands, agents ships, open questions fog
 * banks, decisions lighthouses. Home is Turtle Bay, a harbour island beside
 * the compass rose.
 *
 * At night (Night watch) the same chart is engraved in pale ink on deep
 * navy: every lighthouse is lit and sweeps its beam, each ship carries a
 * masthead light, and Turtle Bay's windows and pier light are on. The night
 * inks are in `palette.ts`, the lights in `night.ts`.
 */
import { externalSourceNames, isVessel, type AgentStatus } from "@atlas/core";

import type { Point } from "../camera";
import {
  decisionPosition,
  itemPosition,
  questionPosition,
  questionSide,
  rings,
  smallestOrbit,
} from "../layout";
import {
  agentLabelSize,
  bodyScale,
  curveBetween,
  itemSide,
  label,
  labelScale,
  pixels,
  pulsePhase,
  setScreenTransform,
  setWorldTransform,
  showsAgentName,
  showsAgentStatus,
  withAlpha,
} from "../paint";
import {
  captionInset,
  itemLabel,
  labelAlign,
  workstreamCaption,
  workstreamCaptionRise,
} from "../labels";
import { seededRandom } from "../random";
import type { Motion } from "../scene";
import type { PaintContext, WorldPainter } from "../types";
import { coastRadius, islandRadius, traceCoast } from "./coast";
import { beam, beamAngle, glow, lantern, moonlight } from "./night";
import {
  marinerInks,
  marinerPaletteFor,
  marinerTypefaces as type,
  type MarinerInks,
} from "./palette";
import { marinerStatusNames, marinerVocabulary } from "./vocabulary";

const homeRadius = 70;

const isFull = (paint: PaintContext) => paint.detail === "full";
const isNight = (paint: PaintContext) => paint.lighting === "night";
const inksOf = (paint: PaintContext): MarinerInks =>
  marinerInks(paint.lighting);
const paletteOf = (paint: PaintContext) => marinerPaletteFor(paint.lighting);

/**
 * A vessel's size in world units. `scale` shrinks it for a smaller boat; 1
 * is an agent's ship.
 */
function vesselSize(paint: PaintContext, scale: number): number {
  return (
    pixels(paint, isFull(paint) ? 9 : 6) *
    Math.max(1, paint.camera.scale * 1.5) *
    scale
  );
}

/**
 * Which way a vessel points. Under way it follows its course; as it comes
 * alongside its cargo it turns broadside, so the cargo lies off its port
 * side where the line goes over. A ship that is not running lies at anchor.
 */
function vesselHeading(status: AgentStatus, motion: Motion): number {
  if (status !== "running") return -Math.PI / 2 + 0.2;
  const work = motion.work;
  if (!work) return motion.heading;
  const distance = Math.hypot(
    motion.position.x - work.spot.x,
    motion.position.y - work.spot.y,
  );
  const alongside = Math.max(0, Math.min(1, 1 - distance / 40));
  return motion.heading + (Math.PI / 2) * alongside;
}

/** A hull with its sail in the status colour, at `size`. */
function drawVessel(
  paint: PaintContext,
  position: Point,
  heading: number,
  colour: string,
  size: number,
) {
  const { context } = paint;
  context.save();
  context.translate(position.x, position.y);
  context.rotate(heading + Math.PI / 2);
  context.fillStyle = inksOf(paint).hull;
  context.beginPath();
  context.moveTo(0, -size * 1.3);
  context.quadraticCurveTo(size * 0.7, -size * 0.2, size * 0.45, size * 1.1);
  context.lineTo(-size * 0.45, size * 1.1);
  context.quadraticCurveTo(-size * 0.7, -size * 0.2, 0, -size * 1.3);
  context.fill();
  context.fillStyle = colour;
  context.beginPath();
  context.moveTo(0, -size * 0.9);
  context.quadraticCurveTo(size * 1.1, -size * 0.1, 0, size * 0.75);
  context.closePath();
  context.fill();
  context.restore();
}

/** How far short of the cargo the float rides, in world units. */
const floatStandOff = 13;

/**
 * A fishing line from a vessel's side to the cargo it works: a slack line
 * to a float riding beside the cargo, the float bobbing, and small ripple
 * rings spreading round it. Under reduced motion the line and float hold
 * still and there are no ripples. `scale` makes it finer for a smaller
 * boat; `seed` keeps two floats from bobbing in step.
 */
function drawFishingLine(
  paint: PaintContext,
  from: Point,
  cargo: Point,
  scale: number,
  seed: number,
) {
  const { context, time, reducedMotion } = paint;
  const ink = inksOf(paint);
  const back = Math.atan2(from.y - cargo.y, from.x - cargo.x);
  const bob = reducedMotion
    ? 0
    : Math.sin(time * 2.3 + seed * 1.9) * pixels(paint, 1.6 * scale);
  const float = {
    x: cargo.x + Math.cos(back) * floatStandOff,
    y: cargo.y + Math.sin(back) * floatStandOff + bob,
  };
  context.save();
  if (!reducedMotion) {
    for (let ring = 0; ring < 2; ring++) {
      const life = (time * 0.45 + ring / 2 + seed * 0.29) % 1;
      const radius = pixels(paint, (4 + life * 13) * scale);
      context.strokeStyle = `rgba(${ink.wake},${(1 - life) * 0.55})`;
      context.lineWidth = pixels(paint, 1);
      context.beginPath();
      context.ellipse(
        float.x,
        float.y - bob,
        radius,
        radius * 0.6,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  }
  // The line hangs slack from the rod to the float, then runs down to the
  // cargo under the water, drawn fainter and broken.
  const curve = curveBetween(from, float, 0.14);
  context.strokeStyle = withAlpha(ink.hull, 0.85);
  context.lineWidth = pixels(paint, 1.1 * scale);
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.quadraticCurveTo(curve.control.x, curve.control.y, float.x, float.y);
  context.stroke();
  context.setLineDash([pixels(paint, 2), pixels(paint, 2.5)]);
  context.strokeStyle = withAlpha(ink.hull, 0.45);
  context.beginPath();
  context.moveTo(float.x, float.y);
  context.lineTo(cargo.x, cargo.y);
  context.stroke();
  context.setLineDash([]);
  const radius = pixels(paint, 4.2 * scale);
  context.fillStyle = ink.tower;
  context.beginPath();
  context.arc(float.x, float.y, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = ink.hull;
  context.beginPath();
  context.arc(float.x, float.y, radius, Math.PI, Math.PI * 2);
  context.fill();
  context.strokeStyle = ink.hull;
  context.lineWidth = pixels(paint, 0.9 * scale);
  context.beginPath();
  context.arc(float.x, float.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

const soundingsCache = new WeakMap<
  object,
  Array<{ x: number; y: number; depth: number }>
>();

function soundings(paint: PaintContext) {
  const layout = paint.scene.layout;
  let found = soundingsCache.get(layout);
  if (!found) {
    const random = seededRandom(11);
    const { left, right, top, bottom } = layout.bounds;
    const centres = [...layout.clients.values()];
    found = [];
    for (let index = 0; index < 260; index++) {
      const x = left - 100 + random() * (right - left + 200);
      const y = top - 100 + random() * (bottom - top + 200);
      const depth = Math.round(4 + random() * 60 + Math.hypot(x, y) / 40);
      if (
        centres.some((centre) => Math.hypot(x - centre.x, y - centre.y) < 160)
      )
        continue;
      found.push({ x, y, depth });
    }
    soundingsCache.set(layout, found);
  }
  return found;
}

/** Where the compass rose sits: the chart's lower-left, clear of the islands. */
function rosePosition(paint: PaintContext): Point {
  const { left, bottom } = paint.scene.layout.bounds;
  return { x: left + 150, y: bottom - 150 };
}

function drawRose(paint: PaintContext, centre: Point, radius: number) {
  const { context } = paint;
  const ink = inksOf(paint);
  context.save();
  context.translate(centre.x, centre.y);
  if (isNight(paint)) {
    // At night the rose is faintly lit, as a binnacle is.
    const lit = context.createRadialGradient(0, 0, 0, 0, 0, radius * 1.6);
    lit.addColorStop(0, "rgba(150,185,225,0.16)");
    lit.addColorStop(1, "rgba(150,185,225,0)");
    context.fillStyle = lit;
    context.beginPath();
    context.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = ink.rose;
  context.lineWidth = pixels(paint, 1);
  for (const ring of [radius, radius * 0.86, radius * 0.6]) {
    context.beginPath();
    context.arc(0, 0, ring, 0, Math.PI * 2);
    context.stroke();
  }
  for (let degree = 0; degree < 360; degree += 5) {
    const angle = (degree * Math.PI) / 180;
    const length = degree % 45 ? 4 : 10;
    context.beginPath();
    context.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    context.lineTo(
      Math.cos(angle) * (radius - length),
      Math.sin(angle) * (radius - length),
    );
    context.stroke();
  }
  for (let point = 0; point < 16; point++) {
    const angle = (point / 16) * Math.PI * 2 - Math.PI / 2;
    const length =
      point % 4 ? (point % 2 ? radius * 0.42 : radius * 0.62) : radius * 0.92;
    const width = point % 4 ? 6 : 11;
    for (const [side, light, dark] of [
      [1, ink.roseLight, ink.roseDark],
      [-1, ink.roseRed, ink.roseLight],
    ] as const) {
      context.beginPath();
      context.moveTo(Math.cos(angle) * length, Math.sin(angle) * length);
      context.lineTo(
        Math.cos(angle + (side * Math.PI) / 2) * width,
        Math.sin(angle + (side * Math.PI) / 2) * width,
      );
      context.lineTo(0, 0);
      context.closePath();
      context.fillStyle = point % 2 ? dark : light;
      context.fill();
      context.stroke();
    }
  }
  context.restore();
  label(paint, "N", centre.x, centre.y - radius - pixels(paint, 8), {
    size: 13,
    font: type.display,
    colour: paletteOf(paint).ink,
    align: "center",
    baseline: "bottom",
  });
}

function drawContours(
  paint: PaintContext,
  id: string,
  centre: Point,
  radius: number,
) {
  const { context } = paint;
  const ink = inksOf(paint);
  traceCoast(context, id, centre, 70, radius);
  context.fillStyle = ink.shallows;
  context.fill();
  [28, 70, 120, 190].forEach((offset, index) => {
    traceCoast(context, id, centre, offset, radius);
    context.strokeStyle = `rgba(${ink.contour},${ink.contourAlpha - index * 0.06})`;
    context.lineWidth = pixels(paint, 0.9);
    if (index > 1) context.setLineDash([pixels(paint, 4), pixels(paint, 4)]);
    context.stroke();
    context.setLineDash([]);
  });
}

function drawLand(
  paint: PaintContext,
  id: string,
  centre: Point,
  radius: number,
) {
  const { context } = paint;
  const ink = inksOf(paint);
  traceCoast(context, id, centre, 0, radius);
  context.fillStyle = ink.land;
  context.fill();
  if (isNight(paint)) {
    // Moonlight catches the high ground, so the island reads against the sea.
    const moonlit = context.createRadialGradient(
      centre.x - radius * 0.25,
      centre.y - radius * 0.35,
      0,
      centre.x,
      centre.y,
      radius * 1.1,
    );
    moonlit.addColorStop(0, "rgba(170,190,210,0.16)");
    moonlit.addColorStop(1, "rgba(170,190,210,0)");
    context.fillStyle = moonlit;
    context.fill();
  }
  context.strokeStyle = ink.coast;
  context.lineWidth = pixels(paint, 1.6);
  context.stroke();
  traceCoast(context, id, centre, -7, radius);
  context.strokeStyle = ink.coastInner;
  context.lineWidth = pixels(paint, 0.8);
  context.stroke();
}

export const marinerPainter: WorldPainter = {
  background(paint) {
    const { context, width, height, scene } = paint;
    const ink = inksOf(paint);
    setScreenTransform(paint);
    context.fillStyle = paletteOf(paint).ground;
    context.fillRect(0, 0, width, height);
    const vignette = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.3,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    vignette.addColorStop(0, ink.vignette[0]);
    vignette.addColorStop(1, ink.vignette[1]);
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
    if (isNight(paint)) moonlight(paint);

    setWorldTransform(paint);
    const rose = rosePosition(paint);
    context.strokeStyle = ink.rhumb;
    context.lineWidth = pixels(paint, 0.8);
    for (let line = 0; line < 32; line++) {
      const angle = (line / 32) * Math.PI * 2;
      context.beginPath();
      context.moveTo(rose.x, rose.y);
      context.lineTo(
        rose.x + Math.cos(angle) * 4000,
        rose.y + Math.sin(angle) * 4000,
      );
      context.stroke();
    }
    for (const [id, centre] of scene.layout.clients) {
      const home =
        scene.dataset.clients.find((client) => client.id === id)?.home === true;
      drawContours(paint, id, centre, home ? homeRadius : islandRadius);
    }
    if (paint.camera.scale > 0.32) {
      context.save();
      context.font = `italic ${pixels(paint, 9.5)}px ${type.mono}`;
      context.fillStyle = ink.soundings;
      context.textAlign = "center";
      for (const sounding of soundings(paint))
        context.fillText(String(sounding.depth), sounding.x, sounding.y);
      context.restore();
    }
    drawRose(paint, rose, 78);
  },

  overlay(paint) {
    const { context, width, height } = paint;
    const ink = inksOf(paint);
    context.strokeStyle = ink.frame;
    context.lineWidth = 1;
    context.strokeRect(8.5, 8.5, width - 17, height - 17);
    context.strokeRect(12.5, 12.5, width - 25, height - 25);
    context.fillStyle = ink.frame;
    for (let x = 12; x < width - 12; x += 80) {
      context.fillRect(x, 9, Math.min(40, width - 12 - x), 3);
      context.fillRect(x, height - 12, Math.min(40, width - 12 - x), 3);
    }
  },

  home(paint, home) {
    const { context, time, reducedMotion } = paint;
    const ink = inksOf(paint);
    const palette = paletteOf(paint);
    const night = isNight(paint);
    const centre = paint.scene.layout.clients.get(home.id) ?? { x: 0, y: 0 };
    const radius = homeRadius;
    drawLand(paint, home.id, centre, radius);
    // The bay: a bite of sea out of the island's north shore, with a pier.
    const bay = { x: centre.x, y: centre.y - radius * 0.62 };
    context.save();
    context.beginPath();
    context.arc(bay.x, bay.y, radius * 0.48, 0, Math.PI * 2);
    context.fillStyle = ink.bay;
    context.fill();
    context.strokeStyle = night ? ink.coastInner : ink.coast;
    context.lineWidth = pixels(paint, 1.4);
    context.stroke();
    context.restore();
    context.strokeStyle = ink.pier;
    context.lineWidth = pixels(paint, 2);
    context.beginPath();
    context.moveTo(centre.x - 4, centre.y - radius * 0.22);
    context.lineTo(centre.x - 4, centre.y - radius * 0.62);
    context.stroke();
    // A few houses; at night three of them have a lit window.
    const houses = [
      [-20, 6],
      [-8, 14],
      [8, 8],
      [20, 18],
      [2, 26],
    ] as const;
    context.fillStyle = ink.house;
    for (const [dx, dy] of houses) {
      context.fillRect(centre.x + dx - 3.5, centre.y + dy - 3.5, 7, 7);
    }
    if (night) {
      for (const [dx, dy] of [houses[0], houses[2], houses[4]]) {
        glow(paint, { x: centre.x + dx, y: centre.y + dy }, 9, 0.75, 1.5);
      }
    }
    // A turtle, swimming in the bay.
    const swim = reducedMotion ? 0 : Math.sin(time * 0.4) * 10;
    const turtle = { x: centre.x + 14 + swim, y: centre.y - radius * 0.7 };
    context.fillStyle = ink.turtle;
    context.beginPath();
    context.ellipse(turtle.x, turtle.y, 7, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(turtle.x + 8, turtle.y, 2.4, 0, Math.PI * 2);
    context.fill();
    if (night) {
      // The harbour light at the pier head, and its reflection in the bay.
      const pierHead = { x: centre.x - 4, y: bay.y };
      context.save();
      context.globalCompositeOperation = "lighter";
      const reflection = context.createLinearGradient(
        pierHead.x,
        pierHead.y,
        pierHead.x,
        pierHead.y - radius * 0.42,
      );
      reflection.addColorStop(0, "rgba(255,240,204,0.14)");
      reflection.addColorStop(1, "rgba(255,240,204,0)");
      context.fillStyle = reflection;
      context.fillRect(
        pierHead.x - 1.5,
        pierHead.y - radius * 0.4,
        3,
        radius * 0.4,
      );
      context.restore();
      glow(paint, pierHead, 13, 0.9, 1.9);
    }

    const below =
      centre.y +
      coastRadius(home.id, Math.PI / 2, 0, radius) +
      pixels(paint, 12);
    label(paint, marinerVocabulary.homeName, centre.x, below, {
      size: isFull(paint)
        ? Math.max(11, Math.min(18, (18 * paint.camera.scale) / 0.4))
        : 11,
      font: type.mono,
      colour: palette.ink,
      align: "center",
      baseline: "top",
      italic: true,
    });
    if (isFull(paint)) {
      label(
        paint,
        `Home port · ${home.name}`,
        centre.x,
        below + pixels(paint, 22),
        {
          size: 11,
          font: type.mono,
          colour: palette.mute,
          align: "center",
          baseline: "top",
          italic: true,
        },
      );
    }
  },

  client(paint, client) {
    const { context } = paint;
    const palette = paletteOf(paint);
    const centre = paint.scene.layout.clients.get(client.id);
    if (!centre) return;
    // The sea lane: a faint dashed ring through the client's buoys.
    context.setLineDash([pixels(paint, 4), pixels(paint, 6)]);
    context.strokeStyle = inksOf(paint).orbit;
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.arc(
      centre.x,
      centre.y,
      paint.scene.layout.orbits.get(client.id) ?? smallestOrbit,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.setLineDash([]);
    drawLand(paint, client.id, centre, islandRadius);
    context.strokeStyle = inksOf(paint).hachure;
    context.lineWidth = pixels(paint, 0.8);
    for (let hachure = 0; hachure < 22; hachure++) {
      const angle = (hachure / 22) * Math.PI * 2;
      context.beginPath();
      context.moveTo(
        centre.x + Math.cos(angle) * 18,
        centre.y + Math.sin(angle) * 14,
      );
      context.lineTo(
        centre.x + Math.cos(angle) * 30,
        centre.y + Math.sin(angle) * 24,
      );
      context.stroke();
    }
    const vessels = paint.scene.dataset.agents.filter(
      (agent) =>
        !isVessel(agent) &&
        paint.scene.dataset.groups.find((group) => group.id === agent.groupId)
          ?.clientId === client.id,
    ).length;
    const below =
      centre.y + coastRadius(client.id, Math.PI / 2) + pixels(paint, 12);
    label(paint, client.name.toUpperCase(), centre.x, below, {
      size: isFull(paint)
        ? Math.max(10.5, Math.min(17, (17 * paint.camera.scale) / 0.4))
        : 10.5,
      font: type.display,
      colour: palette.ink,
      align: "center",
      baseline: "top",
      letterSpacing: isFull(paint) ? 2 : 0.6,
    });
    if (isFull(paint)) {
      label(
        paint,
        `${vessels} ${vessels === 1 ? "vessel" : "vessels"}`,
        centre.x,
        below + pixels(paint, 22),
        {
          size: 11,
          font: type.mono,
          colour: palette.mute,
          align: "center",
          baseline: "top",
          italic: true,
        },
      );
    }
  },

  requirement(paint, requirement) {
    const { context } = paint;
    const inks = inksOf(paint);
    const point = paint.scene.layout.fixed.get(requirement.id);
    if (!point) return;
    const done = requirement.state === "done";
    const ink = done ? inks.doneInk : paletteOf(paint).ink;
    context.setLineDash([pixels(paint, 3), pixels(paint, 3)]);
    context.strokeStyle = done ? inks.orbitDone : inks.orbit;
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.arc(point.x, point.y, rings.orbit, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.save();
    context.translate(point.x, point.y);
    context.strokeStyle = ink;
    context.lineWidth = pixels(paint, 1.6);
    context.beginPath();
    context.moveTo(0, -11);
    context.lineTo(0, 10);
    context.moveTo(-6, -5);
    context.lineTo(6, -5);
    context.moveTo(-10, 3);
    context.quadraticCurveTo(-8, 11, 0, 11);
    context.quadraticCurveTo(8, 11, 10, 3);
    context.stroke();
    context.beginPath();
    context.arc(0, -13, 2.6, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(paint, requirement.title, point.x, point.y + 18, {
        size: 12,
        font: type.mono,
        colour: ink,
        align: "center",
        baseline: "top",
      });
    }
  },

  workstream(paint, marker) {
    const { context } = paint;
    const palette = paletteOf(paint);
    const { x, y } = marker.position;
    const unsorted = marker.workstreamId === null;
    // A buoy riding on its wake: a can with a top mark, in the chart's own
    // inks so it never reads as a status. Unsorted work gathers at a plain
    // mooring ring instead.
    context.save();
    context.translate(x, y);
    context.strokeStyle = withAlpha(palette.accent, 0.45);
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.ellipse(0, 9, 15, 4.5, 0, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = palette.ink;
    context.lineWidth = pixels(paint, 1.4);
    if (unsorted) {
      context.beginPath();
      context.arc(0, 2, 7, 0, Math.PI * 2);
      context.stroke();
    } else {
      context.fillStyle = palette.accent;
      context.beginPath();
      context.moveTo(-7, 8);
      context.lineTo(-5, -6);
      context.lineTo(5, -6);
      context.lineTo(7, 8);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle =
        paint.lighting === "night" ? palette.ground : "#f1e8d2";
      context.fillRect(-6, -1, 12, 3);
      context.beginPath();
      context.moveTo(0, -6);
      context.lineTo(0, -13);
      context.stroke();
      context.fillStyle = palette.ink;
      context.beginPath();
      context.arc(0, -15, 2.8, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(
        paint,
        workstreamCaption(marker),
        x - marker.side * captionInset,
        y - workstreamCaptionRise,
        {
          size: 12,
          font: type.mono,
          colour: palette.ink,
          align: labelAlign(marker.side),
          baseline: "bottom",
          italic: unsorted,
        },
      );
    }
  },

  link(paint, item) {
    const { context, scene } = paint;
    const from = item.requirementId
      ? scene.layout.fixed.get(item.requirementId)
      : undefined;
    if (!from) return;
    const to = itemPosition(scene.layout, item);
    context.setLineDash([pixels(paint, 2), pixels(paint, 4)]);
    context.strokeStyle = inksOf(paint).link;
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.setLineDash([]);
  },

  item(paint, item) {
    const { context, scene } = paint;
    const ink = inksOf(paint);
    const point = itemPosition(scene.layout, item);
    const size = item.priority === "high" ? 8 : 6.5;
    context.save();
    context.translate(point.x, point.y);
    context.globalAlpha = item.state === "done" ? 0.45 : 1;
    context.fillStyle =
      item.state === "review"
        ? ink.cargo.review
        : item.state === "todo"
          ? ink.cargo.todo
          : ink.cargo.doing;
    context.strokeStyle = ink.cargoStroke;
    context.lineWidth = pixels(paint, 1.1);
    context.fillRect(-size, -size * 0.75, size * 2, size * 1.5);
    context.strokeRect(-size, -size * 0.75, size * 2, size * 1.5);
    context.beginPath();
    context.moveTo(-size, -size * 0.75);
    context.lineTo(size, size * 0.75);
    context.moveTo(size, -size * 0.75);
    context.lineTo(-size, size * 0.75);
    context.strokeStyle = ink.cargoCross;
    context.stroke();
    if (item.priority === "high") {
      context.fillStyle = paletteOf(paint).status.blocked;
      context.beginPath();
      context.arc(size + 3, -size, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.item) {
      const side = itemSide(paint, item);
      label(paint, itemLabel(item.title), point.x + side * 14, point.y, {
        size: 11.5,
        font: type.mono,
        colour: ink.cargoLabel,
        alpha: 0.9,
        align: labelAlign(side),
      });
    }
  },

  question(paint, question, fade) {
    const { context, scene, time, reducedMotion } = paint;
    const ink = inksOf(paint);
    const point = questionPosition(
      scene.layout,
      scene.dataset,
      question,
      time,
      reducedMotion,
    );
    context.save();
    context.globalAlpha = fade;
    const drift = reducedMotion ? 0 : time * 0.15;
    // By night the fog is moonlit: paler, and a little lighter at the heart.
    const density = isNight(paint) ? 0.15 : 0.38;
    for (let puff = 0; puff < 5; puff++) {
      const angle = puff * 1.3 + drift;
      const radius = 20 + puff * 4;
      const x = point.x + Math.cos(angle) * radius * 0.9;
      const y = point.y + Math.sin(angle * 1.3) * radius * 0.5;
      const fog = context.createRadialGradient(x, y, 0, x, y, 46);
      fog.addColorStop(0, `rgba(${ink.fog},${density})`);
      fog.addColorStop(1, `rgba(${ink.fog},0)`);
      context.fillStyle = fog;
      context.beginPath();
      context.arc(x, y, 46, 0, Math.PI * 2);
      context.fill();
    }
    if (question.asks === "You") {
      const phase = pulsePhase(paint, 0.8);
      context.strokeStyle = withAlpha(
        paletteOf(paint).status.waiting,
        1 - phase,
      );
      context.lineWidth = pixels(paint, 1.5);
      context.beginPath();
      context.arc(point.x, point.y, 14 + phase * 26, 0, Math.PI * 2);
      context.stroke();
    }
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(paint, "Fog", point.x, point.y - pixels(paint, 6), {
        size: 10,
        font: type.display,
        colour: ink.fogTitle,
        align: "center",
        letterSpacing: 2,
      });
      // The question's words run away from the buoy it holds up.
      const side = questionSide(scene.layout, question);
      label(
        paint,
        question.title,
        point.x - side * 30,
        point.y + pixels(paint, 8),
        {
          size: 11.5,
          font: type.mono,
          colour: ink.fogLabel,
          align: labelAlign(side),
        },
      );
    }
    context.restore();
  },

  decision(paint, decision, appear) {
    const { context, scene, time, reducedMotion } = paint;
    const ink = inksOf(paint);
    const palette = paletteOf(paint);
    const night = isNight(paint);
    const made = decision.state === "made";
    const point = decisionPosition(scene.layout, scene.dataset, decision);
    const lamp = { x: point.x, y: point.y - 11 };
    context.save();
    context.globalAlpha = appear;
    if (night) {
      // Every lighthouse is lit after dark. A proposed decision's beam is
      // fainter than a made one's, so the two still read apart.
      beam(
        paint,
        lamp,
        beamAngle(paint, decision.id),
        made ? 190 : 150,
        made ? 1 : 0.55,
      );
    } else if (made) {
      const sweep = reducedMotion ? -0.8 : time * 0.9 + point.x;
      const sweepLight = context.createRadialGradient(
        point.x,
        point.y,
        0,
        point.x,
        point.y,
        150,
      );
      sweepLight.addColorStop(0, `rgba(${ink.beam},0.55)`);
      sweepLight.addColorStop(1, `rgba(${ink.beam},0)`);
      context.fillStyle = sweepLight;
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.arc(point.x, point.y, 150, sweep - 0.22, sweep + 0.22);
      context.closePath();
      context.fill();
    }
    context.fillStyle = ink.tower;
    context.strokeStyle = night ? ink.coast : palette.ink;
    context.lineWidth = pixels(paint, 1.2);
    context.beginPath();
    context.moveTo(point.x - 5, point.y + 8);
    context.lineTo(point.x - 3, point.y - 9);
    context.lineTo(point.x + 3, point.y - 9);
    context.lineTo(point.x + 5, point.y + 8);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = ink.towerBand;
    context.fillRect(point.x - 3.6, point.y - 2, 7.2, 3);
    if (night) {
      glow(paint, lamp, made ? 20 : 15, made ? 1 : 0.75, 2.6);
    } else {
      context.fillStyle = made ? ink.lampLit : ink.lampUnlit;
      context.beginPath();
      context.arc(lamp.x, lamp.y, 2.6, 0, Math.PI * 2);
      context.fill();
    }
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(paint, decision.title, point.x + 12, point.y + 2, {
        size: 11.5,
        font: type.mono,
        colour: palette.ink,
      });
    }
    context.restore();
    if (night && appear < 1) {
      // A decision just made flares as it is lit, then settles to its lamp.
      const flare = Math.sin(Math.PI * appear);
      context.save();
      context.globalCompositeOperation = "lighter";
      glow(paint, lamp, 20 + flare * 46, flare * 0.8);
      context.restore();
    }
  },

  agent(paint, agent, motion, colour) {
    const { context } = paint;
    const ink = inksOf(paint);
    const { position, trail } = motion;
    // A tender is the same boat, smaller, with a finer line and wake.
    const scale = bodyScale(agent);
    if (agent.status === "running" && trail.length > 3) {
      for (let index = 2; index < trail.length; index += 2) {
        const here = trail[index];
        const before = trail[index - 2];
        if (!here || !before) continue;
        const across =
          Math.atan2(here.y - before.y, here.x - before.x) + Math.PI / 2;
        const spread = index * 0.45 * scale;
        context.strokeStyle = `rgba(${ink.wake},${(1 - index / trail.length) * 0.4})`;
        context.lineWidth = pixels(paint, 1);
        context.beginPath();
        for (const side of [1, -1]) {
          context.moveTo(
            here.x + side * Math.cos(across) * spread,
            here.y + side * Math.sin(across) * spread,
          );
          context.lineTo(
            here.x + side * Math.cos(across) * spread * 1.2,
            here.y + side * Math.sin(across) * spread * 1.2,
          );
        }
        context.stroke();
      }
    }
    const size = vesselSize(paint, scale);
    const heading = vesselHeading(agent.status, motion);
    if (agent.status === "running" && motion.work?.arrived)
      drawFishingLine(
        paint,
        {
          x: position.x + Math.cos(heading - Math.PI / 2) * size * 0.55,
          y: position.y + Math.sin(heading - Math.PI / 2) * size * 0.55,
        },
        motion.work.task,
        scale,
        paint.scene.dataset.agents.indexOf(agent),
      );
    drawVessel(paint, position, heading, colour, size);
    if (isNight(paint)) {
      // The masthead light, forward at the bow, clear of the status sail.
      lantern(paint, {
        x: position.x + Math.cos(heading) * size * 1.3,
        y: position.y + Math.sin(heading) * size * 1.3,
      });
    }

    if (agent.status === "waiting") {
      context.strokeStyle = colour;
      context.lineWidth = pixels(paint, 1.3);
      context.beginPath();
      context.moveTo(position.x, position.y + pixels(paint, 10));
      context.lineTo(position.x, position.y + pixels(paint, 19));
      context.moveTo(
        position.x - pixels(paint, 4),
        position.y + pixels(paint, 16),
      );
      context.quadraticCurveTo(
        position.x,
        position.y + pixels(paint, 21),
        position.x + pixels(paint, 4),
        position.y + pixels(paint, 16),
      );
      context.stroke();
    }
    if (paint.scene.needsAttention(agent)) {
      const phase = pulsePhase(
        paint,
        0.9,
        paint.scene.dataset.agents.indexOf(agent) * 0.3,
      );
      context.strokeStyle = withAlpha(colour, 1 - phase);
      context.lineWidth = pixels(paint, 1.4);
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
    const textX = position.x + pixels(paint, 14 * scale);
    if (showsAgentName(paint, agent))
      label(paint, agent.name, textX, position.y - pixels(paint, 8 * scale), {
        size: agentLabelSize(agent, 12),
        font: type.mono,
        colour: paletteOf(paint).ink,
      });
    if (showsAgentStatus(paint, agent)) {
      label(
        paint,
        marinerStatusNames[agent.status],
        textX,
        position.y + pixels(paint, 6),
        {
          size: agentLabelSize(agent, 10.5),
          font: type.mono,
          colour,
          italic: true,
        },
      );
    }
  },

  effect(paint, effect, progress) {
    const { context, scene, reducedMotion } = paint;
    const ink = inksOf(paint);
    const palette = paletteOf(paint);
    const fadeOut = Math.min(1, (1 - progress) * 2);
    if (effect.kind === "message") {
      const from = scene.motions.get(effect.from)?.position;
      const to = scene.motions.get(effect.to)?.position;
      if (!from || !to) return;
      const curve = curveBetween(from, to, 0.15);
      context.setLineDash([pixels(paint, 6), pixels(paint, 5)]);
      context.strokeStyle = `rgba(${ink.signal},${(1 - progress) * 0.75})`;
      context.lineWidth = pixels(paint, 1.3);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.quadraticCurveTo(curve.control.x, curve.control.y, to.x, to.y);
      context.stroke();
      context.setLineDash([]);
      const flag = curve.at(reducedMotion ? 1 : Math.min(1, progress * 1.5));
      const size = pixels(paint, 9);
      ink.flags.forEach((colour, index) => {
        context.fillStyle = colour;
        context.fillRect(
          flag.x + index * size * 0.9 - size * 1.3,
          flag.y - size * 1.6,
          size * 0.85,
          size * 0.85,
        );
      });
      context.strokeStyle = palette.ink;
      context.lineWidth = pixels(paint, 1);
      context.beginPath();
      context.moveTo(flag.x - size * 1.4, flag.y - size * 1.7);
      context.lineTo(flag.x - size * 1.4, flag.y);
      context.stroke();
      if (isFull(paint)) {
        label(paint, `“${effect.text}”`, curve.control.x, curve.control.y, {
          size: 12,
          font: type.mono,
          colour: ink.signalLabel,
          align: "center",
          alpha: fadeOut,
          italic: true,
        });
      }
    } else if (effect.kind === "external") {
      const target = scene.dataset.items.find(
        (item) => item.id === effect.recordId,
      );
      const point = target
        ? itemPosition(scene.layout, target)
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
        x: point.x + Math.cos(angle) * 700,
        y: point.y + Math.sin(angle) * 700,
      };
      const travel = reducedMotion ? 1 : Math.min(1, progress * 1.4);
      const dashes = 26;
      context.strokeStyle = `rgba(${ink.telegram},${(1 - progress) * 0.8})`;
      context.lineWidth = pixels(paint, 1.6);
      for (let dash = 0; dash < dashes * travel; dash++) {
        const from = dash / dashes;
        const to = from + (dash % 3 === 0 ? 0.026 : 0.009);
        context.beginPath();
        context.moveTo(
          start.x + (point.x - start.x) * from,
          start.y + (point.y - start.y) * from,
        );
        context.lineTo(
          start.x + (point.x - start.x) * to,
          start.y + (point.y - start.y) * to,
        );
        context.stroke();
      }
      if (travel >= 1) {
        context.strokeStyle = `rgba(${ink.telegram},${1 - progress})`;
        context.lineWidth = pixels(paint, 1);
        context.beginPath();
        context.arc(
          point.x,
          point.y,
          Math.max(0, (progress - 0.7) * 3.3) * pixels(paint, 40),
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      const head = {
        x: start.x + (point.x - start.x) * travel,
        y: start.y + (point.y - start.y) * travel,
      };
      if (isFull(paint)) {
        label(
          paint,
          `Telegram · ${externalSourceNames[effect.source]}: ${effect.text}`,
          head.x + pixels(paint, 10),
          head.y - pixels(paint, 12),
          {
            size: 12,
            font: type.mono,
            colour: palette.ink,
            alpha: fadeOut,
            italic: true,
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
      context.lineWidth = pixels(paint, 1.6);
      context.beginPath();
      context.arc(
        motion.position.x,
        motion.position.y,
        pixels(paint, 8) + progress * pixels(paint, 36),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  },
};
