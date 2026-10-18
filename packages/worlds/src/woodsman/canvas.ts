/**
 * The Woodsman's trail map: a printed hiking map with a woodland tint,
 * contours, rivers and dashed trails. Clients are clearings, requirements
 * waymarks on their knolls, backlog items cairns, agents scouts, open
 * questions unmarked forks in the mist, decisions blazed trees. Home is Base
 * Camp, tents around a fire.
 */
import { externalSourceNames, type Agent } from "@atlas/core";

import type { Point } from "../camera";
import {
  decisionPosition,
  itemPosition,
  questionPosition,
  rings,
} from "../layout";
import {
  curveBetween,
  labelScale,
  pixels,
  pulsePhase,
  setScreenTransform,
  setWorldTransform,
  withAlpha,
} from "../paint";
import { hashString, seededRandom } from "../random";
import type { PaintContext, WorldPainter } from "../types";
import {
  terrain as ink,
  woodsmanPalette as palette,
  woodsmanTypefaces as type,
} from "./palette";
import {
  clearingRadius,
  contourCentre,
  homeClearingRadius,
  knollRadius,
  outlineRadius,
  terrainOf,
  traceOutline,
  type Terrain,
} from "./terrain";
import { woodsmanStatusNames, woodsmanVocabulary } from "./vocabulary";

const isFull = (paint: PaintContext) => paint.detail === "full";
const halo = "rgba(247, 244, 230, 0.88)";
const riverNames = ["Alder Water", "Rowan Beck"];

interface TextOptions {
  /** Screen pixels; the same at every zoom. */
  size?: number;
  font: string;
  colour: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  alpha?: number;
  letterSpacing?: number;
  italic?: boolean;
  weight?: number;
  /** A paper-coloured edge so the words read over trees and contours. */
  halo?: boolean;
  rotate?: number;
}

/** A label in map style: like `label` in paint.ts, with a paper halo. */
function text(
  paint: PaintContext,
  value: string,
  x: number,
  y: number,
  options: TextOptions,
): void {
  const { context } = paint;
  context.save();
  context.globalAlpha *= options.alpha ?? 1;
  context.translate(x, y);
  if (options.rotate) context.rotate(options.rotate);
  context.font = `${options.italic ? "italic " : ""}${options.weight ?? 400} ${pixels(paint, options.size ?? 11)}px ${options.font}`;
  context.textAlign = options.align ?? "left";
  context.textBaseline = options.baseline ?? "middle";
  if (options.letterSpacing && "letterSpacing" in context) {
    (
      context as CanvasRenderingContext2D & { letterSpacing: string }
    ).letterSpacing = `${pixels(paint, options.letterSpacing)}px`;
  }
  if (options.halo !== false) {
    context.strokeStyle = halo;
    context.lineWidth = pixels(paint, 3.2);
    context.lineJoin = "round";
    context.strokeText(value, 0, 0);
  }
  context.fillStyle = options.colour;
  context.fillText(value, 0, 0);
  context.restore();
}

function homeIdOf(paint: PaintContext): string | null {
  return (
    paint.scene.dataset.clients.find((client) => client.home === true)?.id ??
    null
  );
}

function terrainFor(paint: PaintContext): Terrain {
  const { dataset, layout } = paint.scene;
  const waymarks = new Map<string, Point[]>();
  for (const requirement of dataset.requirements) {
    const point = layout.fixed.get(requirement.id);
    if (!point) continue;
    const list = waymarks.get(requirement.clientId) ?? [];
    list.push(point);
    waymarks.set(requirement.clientId, list);
  }
  return terrainOf(layout, homeIdOf(paint), waymarks);
}

function radiusOf(paint: PaintContext, id: string): number {
  return id === homeIdOf(paint) ? homeClearingRadius : clearingRadius;
}

/** The part of the world on screen, with a margin. */
function visibleArea(paint: PaintContext, margin: number) {
  const { camera, width, height } = paint;
  return {
    left: -camera.x / camera.scale - margin,
    top: -camera.y / camera.scale - margin,
    right: (width - camera.x) / camera.scale + margin,
    bottom: (height - camera.y) / camera.scale + margin,
  };
}

function strokeLine(context: CanvasRenderingContext2D, points: Point[]) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
}

function drawContours(paint: PaintContext, map: Terrain) {
  const { context, scene, camera } = paint;
  const count = isFull(paint) ? 6 : 4;
  context.strokeStyle = ink.contour;
  for (const [id, centre] of scene.layout.clients) {
    const base = radiusOf(paint, id) + 28;
    for (let ring = 1; ring <= count; ring++) {
      const index = ring % 4 === 0;
      context.lineWidth = pixels(paint, index ? 1.5 : 0.8);
      traceOutline(
        context,
        id,
        contourCentre(id, centre, ring),
        base + ring * 40,
        ring,
      );
      context.stroke();
    }
  }
  for (const hill of map.hills) {
    for (let ring = 0; ring < hill.rings; ring++) {
      context.lineWidth = pixels(paint, ring === 2 ? 1.4 : 0.8);
      traceOutline(
        context,
        hill.id,
        contourCentre(hill.id, hill.centre, ring),
        hill.radius + ring * 34,
        ring,
      );
      context.stroke();
    }
  }
  if (!isFull(paint) || camera.scale < 0.36) return;
  for (const [id, centre] of scene.layout.clients) {
    const top = map.heights.get(id) ?? 300;
    const angle = (hashString(id) % 628) / 100;
    const ring = 4;
    const middle = contourCentre(id, centre, ring);
    const distance = outlineRadius(
      id,
      angle,
      radiusOf(paint, id) + 28 + ring * 40,
      ring,
    );
    text(
      paint,
      String(top - ring * 20),
      middle.x + Math.cos(angle) * distance,
      middle.y + Math.sin(angle) * distance,
      {
        size: 9.5,
        font: type.mono,
        colour: "#7a5530",
        align: "center",
        rotate: angle + Math.PI / 2 + (Math.sin(angle) < 0 ? 0 : Math.PI),
      },
    );
  }
}

function drawRivers(paint: PaintContext, map: Terrain) {
  const { context } = paint;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const [width, colour] of [
    [13, ink.waterEdge],
    [9, ink.water],
  ] as const) {
    context.strokeStyle = colour;
    context.lineWidth = Math.max(width, pixels(paint, width / 4));
    for (const line of map.rivers) strokeLine(context, line);
  }
  // A thin bright line down the middle, as the printer's highlight.
  context.strokeStyle = "rgba(220,236,246,0.6)";
  context.lineWidth = Math.max(2, pixels(paint, 0.6));
  for (const line of map.rivers) strokeLine(context, line);
  context.lineCap = "butt";

  for (const bridge of map.bridges) {
    context.save();
    context.translate(bridge.x, bridge.y);
    context.rotate(bridge.angle);
    context.fillStyle = ink.clearing;
    context.fillRect(-12, -5, 24, 10);
    context.strokeStyle = ink.trail;
    context.lineWidth = Math.max(1.6, pixels(paint, 1.1));
    context.beginPath();
    for (const side of [-1, 1]) {
      context.moveTo(-14, side * 5 - side * 3);
      context.lineTo(-11, side * 5);
      context.lineTo(11, side * 5);
      context.lineTo(14, side * 5 - side * 3);
    }
    context.stroke();
    context.restore();
  }

  if (!isFull(paint) || paint.camera.scale < 0.3) return;
  map.rivers.forEach((line, index) => {
    const at = Math.floor(line.length * (index === 0 ? 0.62 : 0.4));
    const a = line[at];
    const b = line[at + 4];
    if (!a || !b) return;
    let angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;
    const offset = pixels(paint, 12);
    text(
      paint,
      riverNames[index] ?? "Stream",
      a.x - Math.sin(angle) * offset,
      a.y + Math.cos(angle) * offset,
      {
        size: 11,
        font: type.body,
        colour: ink.waterInk,
        italic: true,
        align: "center",
        letterSpacing: 1.5,
        rotate: angle,
      },
    );
  });
}

function drawTrails(paint: PaintContext, map: Terrain) {
  const { context } = paint;
  context.strokeStyle = ink.trail;
  context.lineWidth = pixels(paint, 1.6);
  context.setLineDash([pixels(paint, 7), pixels(paint, 4)]);
  for (const line of map.trails) strokeLine(context, line);
  context.lineWidth = pixels(paint, 1.2);
  context.setLineDash([pixels(paint, 1.5), pixels(paint, 3.5)]);
  context.lineCap = "round";
  for (const line of map.spurs) strokeLine(context, line);
  context.lineCap = "butt";
  context.setLineDash([]);
}

interface WoodPaths {
  woodland: Path2D;
  leaves: Path2D;
  needles: Path2D;
  trunks: Path2D;
}

const woodCache = new WeakMap<Terrain, WoodPaths>();

/** The wood never moves, so its paths are built once per layout. */
function woodPaths(map: Terrain): WoodPaths {
  let found = woodCache.get(map);
  if (found) return found;
  const woodland = new Path2D();
  const leaves = new Path2D();
  const needles = new Path2D();
  const trunks = new Path2D();
  for (const tree of map.trees) {
    const size = tree.size;
    woodland.moveTo(tree.x + 36, tree.y);
    woodland.arc(tree.x, tree.y, 36, 0, Math.PI * 2);
    if (tree.conifer) {
      needles.moveTo(tree.x, tree.y - size * 1.3);
      needles.lineTo(tree.x + size * 0.8, tree.y + size * 0.5);
      needles.lineTo(tree.x - size * 0.8, tree.y + size * 0.5);
      needles.closePath();
    } else {
      leaves.moveTo(tree.x + size * 0.85, tree.y - size * 0.3);
      leaves.arc(tree.x, tree.y - size * 0.3, size * 0.85, 0, Math.PI * 2);
    }
    trunks.moveTo(tree.x, tree.y + size * 0.5);
    trunks.lineTo(tree.x, tree.y + size * 1.05);
  }
  found = { woodland, leaves, needles, trunks };
  woodCache.set(map, found);
  return found;
}

function drawWoodland(paint: PaintContext, map: Terrain) {
  paint.context.fillStyle = ink.woodland;
  paint.context.fill(woodPaths(map).woodland);
}

function drawTrees(paint: PaintContext, map: Terrain) {
  const { context, camera } = paint;
  if (camera.scale < 0.16) return;
  const paths = woodPaths(map);
  context.save();
  context.globalAlpha = Math.min(1, (camera.scale - 0.16) / 0.12);
  context.fillStyle = ink.canopy;
  context.fill(paths.leaves);
  context.fillStyle = ink.conifer;
  context.fill(paths.needles);
  if (camera.scale > 0.75) {
    context.strokeStyle = "rgba(90,70,40,0.55)";
    context.lineWidth = pixels(paint, 1);
    context.stroke(paths.trunks);
  }
  context.restore();
}

function drawGrid(paint: PaintContext) {
  const { context } = paint;
  const area = visibleArea(paint, 0);
  const step = 250;
  context.strokeStyle = ink.grid;
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
}

/** A clearing's edge, printed as the dotted line maps use for a boundary of woodland. */
function drawClearingEdge(
  paint: PaintContext,
  id: string,
  centre: Point,
  radius: number,
) {
  const { context } = paint;
  traceOutline(context, id, centre, radius);
  context.strokeStyle = "rgba(59,42,26,0.6)";
  context.lineWidth = pixels(paint, 1.4);
  context.lineCap = "round";
  context.setLineDash([pixels(paint, 0.5), pixels(paint, 3.5)]);
  context.stroke();
  context.setLineDash([]);
  context.lineCap = "butt";
}

function drawGrass(
  paint: PaintContext,
  id: string,
  centre: Point,
  radius: number,
) {
  if (paint.camera.scale < 0.3) return;
  const { context } = paint;
  const random = seededRandom(hashString(id) + 5);
  context.strokeStyle = "rgba(80,110,60,0.55)";
  context.lineWidth = pixels(paint, 1);
  context.beginPath();
  for (let tuft = 0; tuft < 9; tuft++) {
    const angle = random() * Math.PI * 2;
    const distance = radius * (0.45 + random() * 0.4);
    const x = centre.x + Math.cos(angle) * distance;
    const y = centre.y + Math.sin(angle) * distance;
    for (const lean of [-1, 0, 1]) {
      context.moveTo(x + lean * 2.4, y);
      context.lineTo(x + lean * 3.6, y - 5 + Math.abs(lean));
    }
  }
  context.stroke();
}

function drawTent(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  line: number,
) {
  context.beginPath();
  context.moveTo(x, y - size * 0.8);
  context.lineTo(x + size * 0.62, y + size * 0.32);
  context.lineTo(x - size * 0.62, y + size * 0.32);
  context.closePath();
  context.fillStyle = ink.canvas;
  context.fill();
  context.beginPath();
  context.moveTo(x, y - size * 0.8);
  context.lineTo(x + size * 0.62, y + size * 0.32);
  context.lineTo(x, y + size * 0.32);
  context.closePath();
  context.fillStyle = ink.canvasShade;
  context.fill();
  context.beginPath();
  context.moveTo(x, y - size * 0.8);
  context.lineTo(x + size * 0.62, y + size * 0.32);
  context.lineTo(x - size * 0.62, y + size * 0.32);
  context.closePath();
  context.strokeStyle = ink.trail;
  context.lineWidth = line;
  context.stroke();
  context.beginPath();
  context.moveTo(x, y - size * 0.25);
  context.lineTo(x + size * 0.17, y + size * 0.32);
  context.lineTo(x - size * 0.17, y + size * 0.32);
  context.closePath();
  context.fillStyle = "#4a3a24";
  context.fill();
  // The ridge pole sticks out at the top.
  context.beginPath();
  context.moveTo(x, y - size * 0.8);
  context.lineTo(x, y - size * 0.98);
  context.stroke();
}

function drawFire(paint: PaintContext, centre: Point) {
  const { context, time, reducedMotion } = paint;
  const flicker = reducedMotion
    ? 0
    : Math.sin(time * 9.1) * 0.5 + Math.sin(time * 13.7) * 0.35;
  const glow = context.createRadialGradient(
    centre.x,
    centre.y,
    2,
    centre.x,
    centre.y,
    40,
  );
  glow.addColorStop(0, `rgba(240,150,40,${0.32 + flicker * 0.06})`);
  glow.addColorStop(1, "rgba(240,150,40,0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(centre.x, centre.y, 40, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = ink.stoneDark;
  for (let stone = 0; stone < 9; stone++) {
    const angle = (stone / 9) * Math.PI * 2;
    context.beginPath();
    context.ellipse(
      centre.x + Math.cos(angle) * 11,
      centre.y + 3 + Math.sin(angle) * 6,
      2.6,
      2,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.strokeStyle = ink.trunk;
  context.lineWidth = 2.6;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(centre.x - 7, centre.y + 6);
  context.lineTo(centre.x + 7, centre.y + 1);
  context.moveTo(centre.x + 7, centre.y + 6);
  context.lineTo(centre.x - 7, centre.y + 1);
  context.stroke();
  context.lineCap = "butt";
  const height = 15 + flicker * 2.4;
  const sway = reducedMotion ? 0 : Math.sin(time * 5.3) * 1.6;
  for (const [scale, colour] of [
    [1, ink.flame],
    [0.55, ink.flameCore],
  ] as const) {
    context.fillStyle = colour;
    context.beginPath();
    context.moveTo(centre.x + sway * scale, centre.y + 3 - height * scale);
    context.quadraticCurveTo(
      centre.x + 7 * scale,
      centre.y - 2,
      centre.x + 4.5 * scale,
      centre.y + 3,
    );
    context.quadraticCurveTo(
      centre.x,
      centre.y + 6,
      centre.x - 4.5 * scale,
      centre.y + 3,
    );
    context.quadraticCurveTo(
      centre.x - 7 * scale,
      centre.y - 2,
      centre.x + sway * scale,
      centre.y + 3 - height * scale,
    );
    context.fill();
  }
}

/** A hiker pictogram in a status-coloured disc, as on a waymarked trail sign. */
function drawScout(
  context: CanvasRenderingContext2D,
  agent: Agent,
  facing: number,
  radius: number,
  colour: string,
  edge: number,
) {
  context.fillStyle = colour;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = palette.ground;
  context.lineWidth = edge * 1.6;
  context.stroke();
  context.strokeStyle = palette.ink;
  context.lineWidth = edge * 0.8;
  context.beginPath();
  context.arc(0, 0, radius + edge * 0.9, 0, Math.PI * 2);
  context.stroke();

  const r = radius;
  context.save();
  context.scale(facing, 1);
  context.strokeStyle = "#fbf8ee";
  context.fillStyle = "#fbf8ee";
  context.lineWidth = r * 0.17;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.arc(r * 0.04, -r * 0.5, r * 0.15, 0, Math.PI * 2);
  context.fill();
  const walking = agent.status === "running" || agent.status === "error";
  context.beginPath();
  // Body
  context.moveTo(r * 0.02, -r * 0.28);
  context.lineTo(-r * 0.04, r * 0.18);
  // Legs
  if (walking) {
    context.moveTo(-r * 0.04, r * 0.18);
    context.lineTo(r * 0.24, r * 0.58);
    context.moveTo(-r * 0.04, r * 0.18);
    context.lineTo(-r * 0.3, r * 0.58);
  } else {
    context.moveTo(-r * 0.04, r * 0.18);
    context.lineTo(r * 0.1, r * 0.6);
    context.moveTo(-r * 0.04, r * 0.18);
    context.lineTo(-r * 0.16, r * 0.6);
  }
  // Arms
  context.moveTo(r * 0.0, -r * 0.18);
  if (agent.status === "waiting") {
    context.lineTo(r * 0.3, -r * 0.62);
  } else if (agent.status === "watching") {
    context.lineTo(r * 0.24, -r * 0.3);
    context.lineTo(r * 0.12, -r * 0.5);
  } else if (walking) {
    context.lineTo(r * 0.3, r * 0.02);
  } else {
    context.lineTo(r * 0.18, r * 0.18);
  }
  context.stroke();
  // The pack
  context.beginPath();
  context.ellipse(-r * 0.2, -r * 0.1, r * 0.12, r * 0.2, 0.2, 0, Math.PI * 2);
  context.fill();
  if (walking) {
    // A walking stick
    context.lineWidth = r * 0.09;
    context.beginPath();
    context.moveTo(r * 0.36, -r * 0.08);
    context.lineTo(r * 0.44, r * 0.62);
    context.stroke();
  }
  context.restore();
}

function drawBootPrints(paint: PaintContext, trail: Point[], colour: string) {
  const { context } = paint;
  const spacing = Math.max(5, pixels(paint, 5));
  const size = Math.max(1.6, pixels(paint, 1.7));
  let travelled = 0;
  let next = spacing;
  let step = 0;
  for (let index = 1; index < trail.length; index++) {
    const here = trail[index];
    const before = trail[index - 1];
    if (!here || !before) continue;
    travelled += Math.hypot(here.x - before.x, here.y - before.y);
    if (travelled < next) continue;
    next += spacing;
    step++;
    const angle = Math.atan2(before.y - here.y, before.x - here.x);
    const side = step % 2 ? 1 : -1;
    const offset = size * 1.3 * side;
    context.fillStyle = withAlpha(colour, (1 - index / trail.length) * 0.7);
    context.beginPath();
    context.ellipse(
      here.x - Math.sin(angle) * offset,
      here.y + Math.cos(angle) * offset,
      size,
      size * 0.55,
      angle,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function drawBird(
  context: CanvasRenderingContext2D,
  point: Point,
  size: number,
  flap: number,
) {
  const lift = size * (0.25 + flap * 0.45);
  context.beginPath();
  context.moveTo(point.x - size, point.y - lift);
  context.quadraticCurveTo(
    point.x - size * 0.45,
    point.y - lift * 0.2,
    point.x,
    point.y,
  );
  context.quadraticCurveTo(
    point.x + size * 0.45,
    point.y - lift * 0.2,
    point.x + size,
    point.y - lift,
  );
  context.stroke();
}

function drawRunner(
  context: CanvasRenderingContext2D,
  point: Point,
  radius: number,
  edge: number,
  facing: number,
) {
  context.save();
  context.translate(point.x, point.y);
  context.fillStyle = palette.ground;
  context.strokeStyle = palette.ink;
  context.lineWidth = edge;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  const r = radius;
  context.scale(facing, 1);
  context.lineCap = "round";
  context.lineWidth = r * 0.16;
  context.fillStyle = palette.ink;
  context.beginPath();
  context.arc(r * 0.18, -r * 0.48, r * 0.14, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(r * 0.1, -r * 0.28);
  context.lineTo(-r * 0.12, r * 0.12);
  context.lineTo(r * 0.2, r * 0.32);
  context.lineTo(r * 0.12, r * 0.62);
  context.moveTo(-r * 0.12, r * 0.12);
  context.lineTo(-r * 0.44, r * 0.5);
  context.moveTo(r * 0.04, -r * 0.18);
  context.lineTo(r * 0.38, -r * 0.02);
  context.moveTo(r * 0.04, -r * 0.18);
  context.lineTo(-r * 0.3, -r * 0.1);
  context.stroke();
  context.restore();
}

function northArrow(paint: PaintContext, x: number, y: number, size: number) {
  const { context } = paint;
  context.save();
  context.translate(x, y);
  context.fillStyle = palette.ink;
  context.strokeStyle = palette.ink;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, -size);
  context.lineTo(size * 0.38, size * 0.55);
  context.lineTo(0, size * 0.28);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(0, -size);
  context.lineTo(-size * 0.38, size * 0.55);
  context.lineTo(0, size * 0.28);
  context.closePath();
  context.fillStyle = palette.ground;
  context.fill();
  context.stroke();
  context.font = `600 ${Math.round(size * 0.75)}px ${type.display}`;
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillStyle = palette.ink;
  context.fillText("N", 0, -size - 2);
  context.restore();
}

function scaleBar(paint: PaintContext, x: number, y: number) {
  const { context, camera } = paint;
  const lengths = [25, 50, 100, 200, 250, 500, 1000, 2000];
  const length =
    lengths.find((candidate) => candidate * camera.scale >= 70) ?? 2000;
  const width = length * camera.scale;
  const segment = width / 4;
  context.save();
  context.strokeStyle = palette.ink;
  context.lineWidth = 1;
  for (let part = 0; part < 4; part++) {
    context.fillStyle = part % 2 ? palette.ground : palette.ink;
    context.fillRect(x + part * segment, y, segment, 4);
  }
  context.strokeRect(x + 0.5, y + 0.5, width, 4);
  context.font = `400 10px ${type.mono}`;
  context.fillStyle = palette.ink;
  context.textBaseline = "top";
  context.textAlign = "center";
  context.fillText("0", x, y + 7);
  context.fillText(String(length / 2), x + width / 2, y + 7);
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(`${length} metres`, x + width + 6, y + 2.5);
  context.restore();
}

export const woodsmanPainter: WorldPainter = {
  background(paint) {
    const { context, width, height, scene } = paint;
    setScreenTransform(paint);
    context.fillStyle = palette.ground;
    context.fillRect(0, 0, width, height);

    setWorldTransform(paint);
    const map = terrainFor(paint);
    drawWoodland(paint, map);
    drawGrid(paint);
    drawContours(paint, map);

    // Clearings and the knolls under each waymark are knocked out of the wood.
    context.fillStyle = ink.clearing;
    for (const [id, centre] of scene.layout.clients) {
      traceOutline(context, id, centre, radiusOf(paint, id));
      context.fill();
    }
    for (const requirement of scene.dataset.requirements) {
      const point = scene.layout.fixed.get(requirement.id);
      if (!point) continue;
      traceOutline(context, requirement.id, point, knollRadius - 24);
      context.fillStyle = "rgba(247,244,230,0.55)";
      context.fill();
    }
    drawRivers(paint, map);
    drawTrails(paint, map);
    drawTrees(paint, map);

    setScreenTransform(paint);
    const vignette = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.8,
    );
    vignette.addColorStop(0, "rgba(255,250,235,0)");
    vignette.addColorStop(1, "rgba(120,100,60,0.14)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  },

  overlay(paint) {
    const { context, width, height, camera } = paint;
    const full = isFull(paint);
    context.strokeStyle = "rgba(35,38,28,0.75)";
    context.lineWidth = 1.2;
    context.strokeRect(8.5, 8.5, width - 17, height - 17);
    context.lineWidth = 0.8;
    context.strokeRect(14.5, 14.5, width - 29, height - 29);

    // Grid ticks across the border, labelled on the right and bottom edges.
    const step = 250;
    context.fillStyle = "rgba(35,38,28,0.75)";
    context.font = `400 9px ${type.mono}`;
    const left = -camera.x / camera.scale;
    const top = -camera.y / camera.scale;
    for (let x = Math.ceil(left / step) * step; ; x += step) {
      const screen = x * camera.scale + camera.x;
      if (screen > width - 15) break;
      if (screen < 15) continue;
      context.fillRect(screen, 8, 1, 7);
      context.fillRect(screen, height - 15, 1, 7);
      if (full && camera.scale > 0.2) {
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(String(50 + x / step), screen + 3, height - 17);
      }
    }
    for (let y = Math.ceil(top / step) * step; ; y += step) {
      const screen = y * camera.scale + camera.y;
      if (screen > height - 15) break;
      if (screen < 15) continue;
      context.fillRect(8, screen, 7, 1);
      context.fillRect(width - 15, screen, 7, 1);
      if (full && camera.scale > 0.2) {
        context.textAlign = "left";
        context.textBaseline = "top";
        context.fillText(String(50 - y / step), 18, screen + 2);
      }
    }

    if (full) {
      northArrow(paint, 36, 88, 16);
      scaleBar(paint, 62, 96);
    } else {
      northArrow(paint, width - 30, height - 32, 9);
    }
  },

  home(paint, home) {
    const { context } = paint;
    const centre = paint.scene.layout.clients.get(home.id) ?? { x: 0, y: 0 };
    drawClearingEdge(paint, home.id, centre, homeClearingRadius);
    drawGrass(paint, home.id, centre, homeClearingRadius);
    const line = Math.max(1.2, pixels(paint, 1));
    for (const [angle, distance] of [
      [-2.35, 50],
      [-1.57, 56],
      [-0.79, 50],
      [2.5, 50],
      [0.64, 50],
    ] as const) {
      drawTent(
        context,
        centre.x + Math.cos(angle) * distance,
        centre.y + Math.sin(angle) * distance + 6,
        34,
        line,
      );
    }
    // A flag on a pole by the fire marks the home camp.
    context.strokeStyle = ink.trail;
    context.lineWidth = line;
    context.beginPath();
    context.moveTo(centre.x + 26, centre.y + 26);
    context.lineTo(centre.x + 26, centre.y - 6);
    context.stroke();
    context.fillStyle = palette.accent;
    context.beginPath();
    context.moveTo(centre.x + 26, centre.y - 6);
    context.lineTo(centre.x + 42, centre.y - 1);
    context.lineTo(centre.x + 26, centre.y + 4);
    context.closePath();
    context.fill();
    drawFire(paint, centre);

    // The name sits above the camp: the home waymark is below it.
    const above =
      centre.y -
      outlineRadius(home.id, -Math.PI / 2, homeClearingRadius) -
      pixels(paint, 8);
    text(
      paint,
      woodsmanVocabulary.homeName.toUpperCase(),
      centre.x,
      above - (isFull(paint) ? pixels(paint, 18) : 0),
      {
        size: isFull(paint)
          ? Math.max(12, Math.min(20, (20 * paint.camera.scale) / 0.4))
          : 11.5,
        font: type.display,
        weight: 600,
        colour: palette.accent,
        align: "center",
        baseline: "bottom",
        letterSpacing: isFull(paint) ? 2.5 : 1,
      },
    );
    if (isFull(paint)) {
      text(paint, `Home camp · ${home.name}`, centre.x, above, {
        size: 11,
        font: type.body,
        colour: palette.mute,
        align: "center",
        baseline: "bottom",
        italic: true,
      });
    }
  },

  client(paint, client) {
    const { context, scene } = paint;
    const centre = scene.layout.clients.get(client.id);
    if (!centre) return;
    drawClearingEdge(paint, client.id, centre, clearingRadius);
    drawGrass(paint, client.id, centre, clearingRadius);

    // A signpost where the trail from camp comes in, one arm pointing back.
    const toward = Math.atan2(-centre.y, -centre.x);
    const post = {
      x: centre.x + Math.cos(toward) * (clearingRadius - 34),
      y: centre.y + Math.sin(toward) * (clearingRadius - 34),
    };
    const line = Math.max(1.4, pixels(paint, 1.1));
    context.strokeStyle = ink.trail;
    context.lineWidth = line * 1.6;
    context.beginPath();
    context.moveTo(post.x, post.y + 14);
    context.lineTo(post.x, post.y - 20);
    context.stroke();
    context.fillStyle = ink.canvas;
    context.lineWidth = line;
    for (const [height, direction] of [
      [-16, Math.cos(toward) < 0 ? -1 : 1],
      [-7, Math.cos(toward) < 0 ? 1 : -1],
    ] as const) {
      context.beginPath();
      context.moveTo(post.x, post.y + height - 3.5);
      context.lineTo(post.x + direction * 17, post.y + height - 3.5);
      context.lineTo(post.x + direction * 21, post.y + height);
      context.lineTo(post.x + direction * 17, post.y + height + 3.5);
      context.lineTo(post.x, post.y + height + 3.5);
      context.closePath();
      context.fill();
      context.stroke();
    }

    const scouts = scene.dataset.agents.filter(
      (agent) =>
        scene.dataset.groups.find((group) => group.id === agent.groupId)
          ?.clientId === client.id,
    ).length;
    // The name is printed in the clearing itself, where the paper is clear.
    const middle = centre.y - pixels(paint, isFull(paint) ? 14 : 0);
    text(paint, client.name.toUpperCase(), centre.x, middle, {
      size: isFull(paint)
        ? Math.max(11.5, Math.min(19, (19 * paint.camera.scale) / 0.4))
        : 11,
      font: type.display,
      weight: 600,
      colour: palette.ink,
      align: "center",
      letterSpacing: isFull(paint) ? 2.2 : 0.8,
    });
    if (isFull(paint)) {
      text(
        paint,
        `${woodsmanVocabulary.client} · ${scouts} ${scouts === 1 ? woodsmanVocabulary.agent : woodsmanVocabulary.agents}`,
        centre.x,
        middle + pixels(paint, 17),
        {
          size: 11,
          font: type.body,
          colour: palette.mute,
          align: "center",
          italic: true,
        },
      );
    }
  },

  requirement(paint, requirement) {
    const { context } = paint;
    const point = paint.scene.layout.fixed.get(requirement.id);
    if (!point) return;
    const done = requirement.state === "done";
    const stroke = done ? "rgba(35,38,28,0.4)" : palette.ink;
    // The ring the cairns stand on.
    context.setLineDash([pixels(paint, 2), pixels(paint, 4)]);
    context.strokeStyle = done ? "rgba(95,63,34,0.22)" : "rgba(95,63,34,0.5)";
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.arc(point.x, point.y, rings.orbit, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    // A summit marker: a triangle with a dot, on a short post.
    const size = Math.max(13, pixels(paint, 8.5));
    context.save();
    context.translate(point.x, point.y);
    context.fillStyle = done ? "#ebe7d6" : "#fbf8ee";
    context.strokeStyle = stroke;
    context.lineWidth = Math.max(1.8, pixels(paint, 1.5));
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(0, -size);
    context.lineTo(size * 0.95, size * 0.62);
    context.lineTo(-size * 0.95, size * 0.62);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = stroke;
    context.beginPath();
    context.arc(0, size * 0.08, size * 0.2, 0, Math.PI * 2);
    context.fill();
    if (done) {
      // A tick: this waymark has been reached.
      context.strokeStyle = palette.mute;
      context.lineWidth = Math.max(2, pixels(paint, 1.6));
      context.beginPath();
      context.moveTo(-size * 0.45, -size * 1.45);
      context.lineTo(-size * 0.1, -size * 1.1);
      context.lineTo(size * 0.5, -size * 1.8);
      context.stroke();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      text(
        paint,
        requirement.title,
        point.x,
        point.y + size * 0.62 + pixels(paint, 4),
        {
          size: 12,
          font: type.body,
          colour: done ? palette.mute : palette.ink,
          align: "center",
          baseline: "top",
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
    const to = itemPosition(
      scene.layout,
      item,
      paint.time,
      paint.reducedMotion,
    );
    context.setLineDash([pixels(paint, 1), pixels(paint, 3)]);
    context.strokeStyle = "rgba(59,42,26,0.4)";
    context.lineWidth = pixels(paint, 1);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.lineCap = "butt";
    context.setLineDash([]);
  },

  item(paint, item) {
    const { context, scene } = paint;
    const point = itemPosition(
      scene.layout,
      item,
      paint.time,
      paint.reducedMotion,
    );
    const unit =
      (item.priority === "high" ? 1.2 : 1) *
      Math.max(1.25, pixels(paint, 0.48));
    const line = Math.max(1, pixels(paint, 0.9));
    context.save();
    context.translate(point.x, point.y);
    context.globalAlpha = item.state === "done" ? 0.5 : 1;
    context.strokeStyle = "#3b3326";
    context.lineWidth = line;
    const stone = (
      x: number,
      y: number,
      rx: number,
      ry: number,
      filled: boolean,
    ) => {
      context.beginPath();
      context.ellipse(
        x * unit,
        y * unit,
        rx * unit,
        ry * unit,
        0,
        0,
        Math.PI * 2,
      );
      context.fillStyle = filled ? ink.stone : "#fbf8ee";
      context.fill();
      context.stroke();
    };
    if (item.state === "todo") {
      // Stones gathered but not yet stacked.
      stone(-6, 4, 4.2, 3, false);
      stone(3, 5, 4.6, 3.2, false);
      stone(-1, -1, 3.6, 2.6, false);
    } else {
      stone(0, 5, 8, 3.6, true);
      stone(0.5, -0.5, 6.2, 3.2, true);
      if (item.state === "review" || item.state === "done")
        stone(-0.2, -5.6, 4.4, 2.8, true);
      else stone(-0.2, -5.6, 4.4, 2.8, false);
    }
    if (item.priority === "high") {
      // A pennant on a stick: this cairn is wanted soon.
      const top = item.state === "todo" ? -6 : -9;
      context.beginPath();
      context.moveTo(0, top * unit);
      context.lineTo(0, (top - 9) * unit);
      context.stroke();
      context.fillStyle = palette.ink;
      context.beginPath();
      context.moveTo(0, (top - 9) * unit);
      context.lineTo(7 * unit, (top - 7) * unit);
      context.lineTo(0, (top - 5) * unit);
      context.closePath();
      context.fill();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.item) {
      text(paint, item.title, point.x + 13 * unit, point.y, {
        size: 11.5,
        font: type.body,
        colour: "#3b3326",
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
    const drift = reducedMotion ? 0 : time * 0.12;
    for (let puff = 0; puff < 6; puff++) {
      const angle = puff * 1.1 + drift;
      const radius = 16 + puff * 4;
      const x = point.x + Math.cos(angle) * radius;
      const y = point.y + Math.sin(angle * 1.4) * radius * 0.45;
      const mist = context.createRadialGradient(x, y, 0, x, y, 42);
      mist.addColorStop(0, "rgba(232,236,236,0.85)");
      mist.addColorStop(0.55, "rgba(200,208,210,0.35)");
      mist.addColorStop(1, "rgba(200,208,210,0)");
      context.fillStyle = mist;
      context.beginPath();
      context.arc(x, y, 42, 0, Math.PI * 2);
      context.fill();
    }
    // The fork: one trail in, two out, and no sign to say which.
    const line = Math.max(1.6, pixels(paint, 1.4));
    context.strokeStyle = palette.ink;
    context.lineWidth = line;
    context.setLineDash([line * 2.2, line * 1.6]);
    context.beginPath();
    context.moveTo(point.x, point.y + 16);
    context.lineTo(point.x, point.y + 2);
    context.lineTo(point.x - 12, point.y - 12);
    context.moveTo(point.x, point.y + 2);
    context.lineTo(point.x + 12, point.y - 12);
    context.stroke();
    context.setLineDash([]);
    text(paint, "?", point.x, point.y - 6, {
      size: 13,
      font: type.display,
      weight: 600,
      colour: palette.ink,
      align: "center",
    });
    if (question.asks === "You") {
      const phase = pulsePhase(paint, 0.8);
      context.strokeStyle = withAlpha(palette.status.waiting, 1 - phase * 0.85);
      context.lineWidth = pixels(paint, 1.8);
      context.beginPath();
      context.arc(point.x, point.y, 20 + phase * 24, 0, Math.PI * 2);
      context.stroke();
    }
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      text(paint, question.title, point.x, point.y + 22, {
        size: 11.5,
        font: type.body,
        colour: "#34382e",
        align: "center",
        baseline: "top",
        italic: true,
      });
    }
    context.restore();
  },

  decision(paint, decision, appear) {
    const { context, scene } = paint;
    const point = decisionPosition(scene.layout, scene.dataset, decision);
    const made = decision.state === "made";
    context.save();
    context.globalAlpha = Math.min(1, appear * 1.5);
    if (appear < 1) {
      context.strokeStyle = withAlpha(palette.accent, 1 - appear);
      context.lineWidth = pixels(paint, 1.6);
      context.beginPath();
      context.arc(point.x, point.y, 12 + appear * 40, 0, Math.PI * 2);
      context.stroke();
    }
    // A tall pine, larger than the wood around it, with a bare trunk.
    context.fillStyle = ink.trunk;
    context.fillRect(point.x - 3, point.y - 4, 6, 22);
    context.fillStyle = "#2f5a36";
    for (const [top, half] of [
      [-30, 7],
      [-22, 10],
      [-13, 13],
    ] as const) {
      context.beginPath();
      context.moveTo(point.x, point.y + top);
      context.lineTo(point.x + half, point.y + top + 14);
      context.lineTo(point.x - half, point.y + top + 14);
      context.closePath();
      context.fill();
    }
    // The blaze: a stripe of white paint on the trunk, painted as it appears.
    const blaze = 8 * Math.min(1, appear * 1.2);
    if (made) {
      context.fillStyle = "#fbf8ee";
      context.fillRect(point.x - 1.8, point.y + 5, 3.6, blaze);
    } else {
      context.strokeStyle = "#fbf8ee";
      context.lineWidth = 1;
      context.setLineDash([1.5, 1.2]);
      context.strokeRect(point.x - 1.4, point.y + 5.5, 2.8, blaze - 1);
      context.setLineDash([]);
    }
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      text(paint, decision.title, point.x + 16, point.y - 2, {
        size: 11.5,
        font: type.body,
        colour: palette.ink,
        italic: !made,
      });
    }
    context.restore();
  },

  agent(paint, agent, motion, colour) {
    const { context } = paint;
    const { position, trail } = motion;
    if (agent.status === "running" && trail.length > 3)
      drawBootPrints(paint, trail, ink.trail);
    const radius =
      pixels(paint, isFull(paint) ? 9.5 : 6.5) *
      Math.max(1, paint.camera.scale * 1.2);
    const facing =
      agent.status === "running"
        ? Math.cos(motion.heading) < 0
          ? -1
          : 1
        : agent.status === "error"
          ? -1
          : 1;
    if (paint.scene.needsAttention(agent)) {
      const phase = pulsePhase(
        paint,
        0.9,
        paint.scene.dataset.agents.indexOf(agent) * 0.3,
      );
      context.strokeStyle = withAlpha(colour, 1 - phase * 0.85);
      context.lineWidth = pixels(paint, 1.8);
      context.beginPath();
      context.arc(
        position.x,
        position.y,
        radius + pixels(paint, 4) + phase * pixels(paint, 16),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    context.save();
    context.translate(position.x, position.y);
    drawScout(context, agent, facing, radius, colour, pixels(paint, 1));
    context.restore();

    if (!isFull(paint)) return;
    text(
      paint,
      agent.name,
      position.x + radius + pixels(paint, 6),
      position.y - pixels(paint, 6),
      { size: 12, font: type.body, colour: palette.ink },
    );
    if (paint.camera.scale > labelScale.agentStatus) {
      text(
        paint,
        woodsmanStatusNames[agent.status],
        position.x + radius + pixels(paint, 6),
        position.y + pixels(paint, 8),
        { size: 10.5, font: type.body, colour, italic: true },
      );
    }
  },

  effect(paint, effect, progress) {
    const { context, scene, time, reducedMotion } = paint;
    const fadeOut = Math.min(1, (1 - progress) * 2);
    if (effect.kind === "message") {
      const from = scene.motions.get(effect.from)?.position;
      const to = scene.motions.get(effect.to)?.position;
      if (!from || !to) return;
      const curve = curveBetween(from, to, 0.2);
      context.setLineDash([pixels(paint, 1), pixels(paint, 5)]);
      context.lineCap = "round";
      context.strokeStyle = withAlpha(palette.accent, (1 - progress) * 0.8);
      context.lineWidth = pixels(paint, 1.8);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.quadraticCurveTo(curve.control.x, curve.control.y, to.x, to.y);
      context.stroke();
      context.setLineDash([]);
      const flight = reducedMotion ? 1 : Math.min(1, progress * 1.5);
      const flap = reducedMotion ? 0.5 : (Math.sin(time * 22) + 1) / 2;
      context.strokeStyle = palette.ink;
      context.lineWidth = pixels(paint, 1.8);
      drawBird(context, curve.at(flight), pixels(paint, 10), flap);
      if (!reducedMotion && flight < 1) {
        context.lineWidth = pixels(paint, 1.2);
        context.strokeStyle = withAlpha(palette.ink, 0.6);
        drawBird(
          context,
          curve.at(Math.max(0, flight - 0.08)),
          pixels(paint, 5),
          1 - flap,
        );
      }
      context.lineCap = "butt";
      if (isFull(paint)) {
        text(paint, `“${effect.text}”`, curve.control.x, curve.control.y, {
          size: 12,
          font: type.body,
          colour: palette.accent,
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
        x: point.x + Math.cos(angle) * 700,
        y: point.y + Math.sin(angle) * 700,
      };
      const travel = reducedMotion ? 1 : Math.min(1, progress * 1.4);
      const head = {
        x: start.x + (point.x - start.x) * travel,
        y: start.y + (point.y - start.y) * travel,
      };
      context.setLineDash([pixels(paint, 7), pixels(paint, 4)]);
      context.strokeStyle = withAlpha(palette.ink, (1 - progress) * 0.85);
      context.lineWidth = pixels(paint, 1.8);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(head.x, head.y);
      context.stroke();
      context.setLineDash([]);
      if (travel >= 1) {
        context.strokeStyle = withAlpha(palette.ink, 1 - progress);
        context.lineWidth = pixels(paint, 1.4);
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
      context.save();
      context.globalAlpha = fadeOut;
      drawRunner(
        context,
        head,
        pixels(paint, 9),
        pixels(paint, 1.2),
        point.x < start.x ? -1 : 1,
      );
      context.restore();
      if (isFull(paint)) {
        text(
          paint,
          `Runner from ${externalSourceNames[effect.source]}: ${effect.text}`,
          head.x + pixels(paint, 14),
          head.y - pixels(paint, 14),
          {
            size: 12,
            font: type.body,
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
      context.lineWidth = pixels(paint, 2);
      context.beginPath();
      context.arc(
        motion.position.x,
        motion.position.y,
        pixels(paint, 10) + progress * pixels(paint, 36),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  },
};
