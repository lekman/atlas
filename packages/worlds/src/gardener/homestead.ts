/**
 * The Homestead, seen from above: a fenced yard, a cottage with a hipped
 * terracotta roof and a weathervane on the ridge, a kitchen garden, a well,
 * and a hen who wanders the yard. The hen and the chimney smoke move; under
 * reduced motion both hold still.
 *
 * At night the windows are lit and spill warm light into the yard, a lantern
 * burns by the door, and the hen has gone to roost.
 */
import type { Point } from "../camera";
import { pixels, withAlpha } from "../paint";
import type { PaintContext } from "../types";
import { traceBed, yardSize } from "./beds";
import { flicker, lanternBody, lanternPool } from "./night";
import { gardenLook, lanternLight } from "./palette";

export function drawYard(paint: PaintContext, id: string, centre: Point) {
  const { context } = paint;
  const { washes } = gardenLook(paint.lighting);
  traceBed(context, id, centre, yardSize, 0, 6);
  context.fillStyle = withAlpha(washes.lawn, 0.3);
  context.fill();
  context.strokeStyle = withAlpha(washes.lawnDeep, 0.25);
  context.lineWidth = 8;
  context.stroke();
  // A picket fence: a rail, and the pickets as short ticks along it.
  context.strokeStyle = withAlpha(washes.wood, 0.75);
  context.lineWidth = pixels(paint, 1.1);
  context.stroke();
  if (paint.camera.scale > 0.2) {
    traceBed(context, id, centre, yardSize, 0, 6);
    context.setLineDash([2.5, 9]);
    context.lineWidth = 7;
    context.strokeStyle = withAlpha(washes.wood, 0.6);
    context.stroke();
    context.setLineDash([]);
  }
}

/** Where the cottage's windows are, on its walls, and which way each faces. */
const windows = [
  { x: -24, y: 26, facing: Math.PI / 2 },
  { x: 24, y: 26, facing: Math.PI / 2 },
  { x: -20, y: -30, facing: -Math.PI / 2 },
  { x: 20, y: -30, facing: -Math.PI / 2 },
  { x: -40, y: -2, facing: Math.PI },
  { x: 40, y: 0, facing: 0 },
] as const;

/** Lamplight falling out of each window onto the ground, under the eaves. */
function drawWindowLight(paint: PaintContext, centre: Point) {
  const { context } = paint;
  context.save();
  context.globalCompositeOperation = "screen";
  windows.forEach((pane, index) => {
    const bright = flicker(paint, index * 1.9);
    const x = centre.x + pane.x + Math.cos(pane.facing) * 10;
    const y = centre.y + pane.y + Math.sin(pane.facing) * 10;
    context.save();
    context.translate(x, y);
    context.rotate(pane.facing);
    const spill = context.createRadialGradient(0, 0, 0, 0, 0, 30);
    spill.addColorStop(0, withAlpha(lanternLight.glow, 0.42 * bright));
    spill.addColorStop(1, withAlpha(lanternLight.glow, 0));
    context.fillStyle = spill;
    context.beginPath();
    context.ellipse(4, 0, 26, 15, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
  context.restore();
}

/** The lit windows themselves, as bright slips at the eaves. */
function drawWindows(paint: PaintContext, centre: Point) {
  const { context } = paint;
  context.fillStyle = lanternLight.paper;
  context.strokeStyle = withAlpha(lanternLight.frame, 0.9);
  context.lineWidth = pixels(paint, 0.6);
  for (const pane of windows) {
    const across = Math.abs(Math.sin(pane.facing)) > 0.5;
    const width = across ? 9 : 2.6;
    const height = across ? 2.6 : 9;
    const x = centre.x + pane.x + Math.cos(pane.facing) * 1.3 - width / 2;
    const y = centre.y + pane.y + Math.sin(pane.facing) * 1.3 - height / 2;
    context.fillRect(x, y, width, height);
    context.strokeRect(x, y, width, height);
  }
}

function drawCottage(paint: PaintContext, centre: Point) {
  const { context, time, reducedMotion } = paint;
  const { palette, washes, night, shadow } = gardenLook(paint.lighting);
  const { x, y } = centre;
  const line = pixels(paint, 1.2);
  if (night) drawWindowLight(paint, centre);
  // Shadow, then the roof.
  context.fillStyle = night ? shadow : "rgba(60,50,30,0.16)";
  context.fillRect(x - 36, y - 24, 80, 56);
  context.fillStyle = withAlpha(washes.terracotta, 0.92);
  context.fillRect(x - 40, y - 30, 80, 56);
  // Tiles: faint courses across each roof plane.
  context.strokeStyle = withAlpha(washes.terracottaDeep, 0.3);
  context.lineWidth = pixels(paint, 0.7);
  context.beginPath();
  for (let course = -24; course <= 20; course += 6) {
    context.moveTo(x - 38, y + course);
    context.lineTo(x + 38, y + course);
  }
  context.stroke();
  context.strokeStyle = night ? withAlpha(palette.ink, 0.6) : palette.ink;
  context.lineWidth = line;
  context.strokeRect(x - 40, y - 30, 80, 56);
  context.strokeStyle = washes.terracottaDeep;
  context.beginPath();
  context.moveTo(x - 40, y - 30);
  context.lineTo(x - 16, y - 2);
  context.lineTo(x + 16, y - 2);
  context.lineTo(x + 40, y - 30);
  context.moveTo(x - 40, y + 26);
  context.lineTo(x - 16, y - 2);
  context.moveTo(x + 16, y - 2);
  context.lineTo(x + 40, y + 26);
  context.stroke();
  // Chimney and smoke.
  context.fillStyle = washes.terracottaDeep;
  context.fillRect(x + 20, y - 22, 9, 9);
  context.strokeStyle = palette.ink;
  context.strokeRect(x + 20, y - 22, 9, 9);
  for (let puff = 0; puff < 3; puff++) {
    const age = reducedMotion ? puff / 3 + 0.15 : (time * 0.25 + puff / 3) % 1;
    context.fillStyle = night
      ? `rgba(170,185,195,${0.22 * (1 - age)})`
      : `rgba(150,150,160,${0.35 * (1 - age)})`;
    context.beginPath();
    context.arc(
      x + 25 + age * 22,
      y - 22 - age * 26,
      3 + age * 7,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  // The weathervane on the ridge, swinging a little in the wind.
  const swing = reducedMotion ? 0.5 : 0.5 + Math.sin(time * 0.3) * 0.5;
  context.strokeStyle = palette.ink;
  context.lineWidth = pixels(paint, 1);
  context.beginPath();
  context.moveTo(x - 5, y - 2);
  context.lineTo(x + 5, y - 2);
  context.moveTo(x, y - 7);
  context.lineTo(x, y + 3);
  context.stroke();
  context.save();
  context.translate(x, y - 2);
  context.rotate(swing);
  context.beginPath();
  context.moveTo(-9, 0);
  context.lineTo(9, 0);
  context.moveTo(9, 0);
  context.lineTo(5, -3);
  context.moveTo(9, 0);
  context.lineTo(5, 3);
  context.stroke();
  context.fillStyle = palette.ink;
  context.beginPath();
  context.moveTo(-9, 0);
  context.lineTo(-12, -3.5);
  context.lineTo(-11, 0);
  context.lineTo(-12, 3.5);
  context.closePath();
  context.fill();
  context.restore();
  // A door step and a short path to the gate.
  context.fillStyle = withAlpha(washes.gravel, 0.95);
  context.fillRect(x - 7, y + 26, 14, 40);
  context.strokeStyle = withAlpha(washes.gravelStone, 0.6);
  context.lineWidth = pixels(paint, 0.8);
  context.strokeRect(x - 7, y + 26, 14, 40);
  if (night) drawWindows(paint, centre);
}

/** The lantern by the door, for after the cottage is drawn. */
function drawDoorLantern(paint: PaintContext, centre: Point) {
  const lantern = { x: centre.x + 14, y: centre.y + 34, seed: 4.2 };
  lanternPool(paint, lantern, 62, 1.1);
  lanternBody(paint, lantern);
}

function drawKitchenGarden(paint: PaintContext, centre: Point) {
  const { context } = paint;
  const { washes } = gardenLook(paint.lighting);
  for (const [dx, dy] of [
    [52, -34],
    [80, -34],
    [52, -2],
    [80, -2],
  ] as const) {
    const x = centre.x + dx;
    const y = centre.y + dy;
    context.fillStyle = withAlpha(washes.soil, 0.75);
    context.fillRect(x, y, 22, 26);
    context.strokeStyle = withAlpha(washes.wood, 0.9);
    context.lineWidth = pixels(paint, 1);
    context.strokeRect(x, y, 22, 26);
    context.fillStyle = withAlpha(washes.leaf, 0.9);
    context.beginPath();
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 2; column++) {
        const plantX = x + 6 + column * 10;
        const plantY = y + 5 + row * 8;
        context.moveTo(plantX + 3, plantY);
        context.arc(plantX, plantY, 3, 0, Math.PI * 2);
      }
    }
    context.fill();
  }
}

function drawWell(paint: PaintContext, centre: Point) {
  const { context } = paint;
  const { palette, washes } = gardenLook(paint.lighting);
  const x = centre.x - 70;
  const y = centre.y + 48;
  context.fillStyle = withAlpha(washes.stone, 0.9);
  context.beginPath();
  context.arc(x, y, 14, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = palette.ink;
  context.lineWidth = pixels(paint, 1);
  context.stroke();
  context.fillStyle = washes.water;
  context.beginPath();
  context.arc(x, y, 9, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = washes.waterDeep;
  context.stroke();
  context.fillStyle = "rgba(255,255,255,0.6)";
  context.beginPath();
  context.ellipse(x - 3, y - 3, 3, 1.6, -0.6, 0, Math.PI * 2);
  context.fill();
  // The winch across the top.
  context.strokeStyle = washes.wood;
  context.lineWidth = 2.6;
  context.beginPath();
  context.moveTo(x - 17, y);
  context.lineTo(x + 17, y);
  context.stroke();
}

function drawHen(paint: PaintContext, centre: Point) {
  const { context, time } = paint;
  const { palette, washes, night } = gardenLook(paint.lighting);
  // At night she has gone to roost, and holds still.
  const reducedMotion = paint.reducedMotion || night;
  const at = (t: number) => ({
    x: centre.x - 26 + Math.sin(t * 0.21) * 34,
    y: centre.y + 80 + Math.sin(t * 0.34) * 10,
  });
  const now = reducedMotion ? 9 : time;
  const here = at(now);
  const before = at(now - 0.2);
  const heading = Math.atan2(here.y - before.y, here.x - before.x);
  // A peck now and then: the head dips forward.
  const peck = reducedMotion ? 0 : Math.max(0, Math.sin(time * 2.4)) ** 8 * 2.5;
  context.save();
  context.translate(here.x, here.y);
  context.rotate(heading);
  context.fillStyle = "#fbf6ea";
  context.strokeStyle = palette.ink;
  context.lineWidth = pixels(paint, 0.9);
  context.beginPath();
  context.ellipse(0, 0, 6.5, 4.6, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = washes.wood;
  context.beginPath();
  context.moveTo(-6, 0);
  context.lineTo(-10, -2.6);
  context.lineTo(-10, 2.6);
  context.closePath();
  context.fill();
  context.fillStyle = "#fbf6ea";
  context.beginPath();
  context.arc(6.5 + peck, 0, 2.8, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#b5402c";
  context.beginPath();
  context.arc(6.5 + peck, -0.4, 1.3, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#d9a441";
  context.beginPath();
  context.moveTo(9 + peck, -0.9);
  context.lineTo(11.5 + peck, 0);
  context.lineTo(9 + peck, 0.9);
  context.closePath();
  context.fill();
  context.restore();
}

/** How much larger than life the Homestead is drawn, so it reads at the overview. */
export const homesteadScale = 1.4;

export function drawHomestead(paint: PaintContext, centre: Point): void {
  const { context } = paint;
  context.save();
  context.translate(centre.x, centre.y);
  context.scale(homesteadScale, homesteadScale);
  const origin = { x: 0, y: 0 };
  drawKitchenGarden(paint, origin);
  drawWell(paint, origin);
  drawCottage(paint, origin);
  drawHen(paint, origin);
  if (paint.lighting === "night") drawDoorLantern(paint, origin);
  context.restore();
}
