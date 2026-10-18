/**
 * Plants, drawn the way a planting plan draws them: from above, a soft
 * canopy wash with the leaves inked over it. A backlog item grows through
 * four stages: seed (to do), sprout (doing), bud (review), bloom (done).
 *
 * Sizes are in whatever units the context is in, scaled by `unit`, so the
 * same drawing serves the map (world units) and the legend (screen pixels).
 *
 * At night the leaves go deep and a bloom opens pale and glows faintly, as a
 * moonflower does, so done work still stands out from the rest.
 */
import type { BacklogItem } from "@atlas/core";

import { withAlpha } from "../paint";
import type { Lighting } from "../types";
import { gardenLook, lanternLight, type Washes } from "./palette";

type Context = CanvasRenderingContext2D;

function leaf(
  context: Context,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
) {
  context.beginPath();
  context.ellipse(
    x + (Math.cos(angle) * length) / 2,
    y + (Math.sin(angle) * length) / 2,
    length / 2,
    width / 2,
    angle,
    0,
    Math.PI * 2,
  );
}

function canopy(
  context: Context,
  washes: Washes,
  x: number,
  y: number,
  radius: number,
  colour: string,
  alpha: number,
  line: number,
) {
  context.fillStyle = withAlpha(colour, alpha);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  // The scalloped edge a plan uses for a plant's spread.
  context.strokeStyle = withAlpha(washes.leafDeep, alpha * 0.9);
  context.lineWidth = line * 0.8;
  context.beginPath();
  const lobes = 9;
  for (let lobe = 0; lobe < lobes; lobe++) {
    const from = (lobe / lobes) * Math.PI * 2;
    const to = ((lobe + 1) / lobes) * Math.PI * 2;
    const middle = (from + to) / 2;
    context.moveTo(x + Math.cos(from) * radius, y + Math.sin(from) * radius);
    context.quadraticCurveTo(
      x + Math.cos(middle) * radius * 1.16,
      y + Math.sin(middle) * radius * 1.16,
      x + Math.cos(to) * radius,
      y + Math.sin(to) * radius,
    );
  }
  context.stroke();
}

export function drawPlant(
  context: Context,
  x: number,
  y: number,
  state: BacklogItem["state"],
  unit: number,
  line: number,
  twist = 0,
  lighting: Lighting = "day",
): void {
  const u = unit;
  const { palette, washes, night } = gardenLook(lighting);
  context.save();
  context.lineJoin = "round";
  if (state === "todo") {
    // A seed in a drill, inside a dashed ring: planned, not yet up.
    context.fillStyle = withAlpha(washes.soilDeep, 0.28);
    context.beginPath();
    context.arc(x, y, 6.5 * u, 0, Math.PI * 2);
    context.fill();
    context.setLineDash([line * 2.2, line * 2]);
    context.strokeStyle = withAlpha(palette.ink, 0.55);
    context.lineWidth = line;
    context.beginPath();
    context.arc(x, y, 9.5 * u, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = night ? "#2a1c12" : "#6e4a2b";
    context.beginPath();
    context.ellipse(x, y, 3.6 * u, 2.4 * u, 0.6 + twist, 0, Math.PI * 2);
    context.fill();
  } else if (state === "doing") {
    // A sprout: two seed leaves opening.
    canopy(context, washes, x, y, 10 * u, washes.foliage, 0.38, line);
    context.fillStyle = washes.sprout;
    context.strokeStyle = washes.leafDeep;
    context.lineWidth = line;
    for (const side of [-1, 1]) {
      leaf(context, x, y, -Math.PI / 2 + twist + side * 0.95, 10 * u, 5.6 * u);
      context.fill();
      context.stroke();
    }
    context.fillStyle = washes.leafDeep;
    context.beginPath();
    context.arc(x, y, 1.6 * u, 0, Math.PI * 2);
    context.fill();
  } else if (state === "review") {
    // A bud: a rosette of leaves round a closed lavender bud.
    canopy(context, washes, x, y, 12.5 * u, washes.foliage, 0.42, line);
    context.fillStyle = washes.leaf;
    context.strokeStyle = washes.leafDeep;
    context.lineWidth = line;
    for (let index = 0; index < 5; index++) {
      leaf(context, x, y, twist + (index / 5) * Math.PI * 2, 11 * u, 5 * u);
      context.fill();
      context.stroke();
    }
    context.fillStyle = washes.lavender;
    context.strokeStyle = washes.lavenderDeep;
    context.beginPath();
    context.ellipse(x, y, 4.2 * u, 5.6 * u, twist, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(
      x - Math.sin(twist) * 4.8 * u,
      y - Math.cos(twist) * 4.8 * u,
    );
    context.lineTo(
      x + Math.sin(twist) * 4.8 * u,
      y + Math.cos(twist) * 4.8 * u,
    );
    context.stroke();
  } else {
    // A bloom: petals open over the leaves, a golden eye.
    if (night) {
      // The faint glow of a moonflower.
      const glow = context.createRadialGradient(x, y, 4 * u, x, y, 24 * u);
      glow.addColorStop(0, withAlpha(lanternLight.moon, 0.32));
      glow.addColorStop(1, withAlpha(lanternLight.moon, 0));
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, 24 * u, 0, Math.PI * 2);
      context.fill();
    }
    canopy(context, washes, x, y, 14 * u, washes.foliage, 0.36, line);
    context.fillStyle = washes.leaf;
    context.strokeStyle = washes.leafDeep;
    context.lineWidth = line;
    for (let index = 0; index < 5; index++) {
      leaf(
        context,
        x,
        y,
        twist + 0.3 + (index / 5) * Math.PI * 2,
        13 * u,
        4.6 * u,
      );
      context.fill();
      context.stroke();
    }
    context.fillStyle = washes.petal;
    context.strokeStyle = washes.petalDeep;
    for (let index = 0; index < 6; index++) {
      leaf(context, x, y, twist + (index / 6) * Math.PI * 2, 9 * u, 6 * u);
      context.fill();
      context.stroke();
    }
    context.fillStyle = night ? "#f0dc8a" : "#e2b443";
    context.strokeStyle = night ? "#7d6a2c" : "#8c6a1c";
    context.beginPath();
    context.arc(x, y, 2.8 * u, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();
}
