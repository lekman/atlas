/**
 * The Gardener's planting plan: a top-down garden plan in watercolour and
 * ink on cream paper. Clients are beds edged with clipped box, requirements
 * are seed rows with their row markers, backlog items are plants that grow
 * from seed to bloom, agents are bees. Open questions are dandelion clocks,
 * decisions are trellises. Home is The Homestead.
 */
import { externalSourceNames, type Agent } from "@atlas/core";

import type { Point } from "../camera";
import {
  decisionPosition,
  itemPosition,
  questionPosition,
  rings,
  workPosition,
} from "../layout";
import {
  curveBetween,
  labelScale,
  pixels,
  pulsePhase,
  setScreenTransform,
  setWorldTransform,
  withAlpha,
  type LabelOptions,
} from "../paint";
import { hashString, seededRandom } from "../random";
import type { PaintContext, WorldPainter } from "../types";
import { bedRadius, bedSize, traceBed, yardSize } from "./beds";
import {
  drawHedgeAndTrees,
  drawLawn,
  drawPaths,
  drawPond,
  gardenOf,
  softBlot,
} from "./garden";
import { drawHomestead, drawYard } from "./homestead";
import {
  gardenerPalette as palette,
  gardenerTypefaces as type,
  washes,
} from "./palette";
import { drawPlant } from "./plants";
import {
  gardenerStatusNames,
  gardenerVocabulary,
  growthStages,
} from "./vocabulary";

const isFull = (paint: PaintContext) => paint.detail === "full";

/** A label with a soft paper halo, so it reads over washes and foliage. */
function lettering(
  paint: PaintContext,
  text: string,
  x: number,
  y: number,
  options: LabelOptions,
): void {
  const { context } = paint;
  context.save();
  context.globalAlpha *= options.alpha ?? 1;
  context.font = `${options.italic ? "italic " : ""}${pixels(paint, options.size ?? 11)}px ${options.font}`;
  context.textAlign = options.align ?? "left";
  context.textBaseline = options.baseline ?? "middle";
  if ("letterSpacing" in context) {
    (
      context as CanvasRenderingContext2D & { letterSpacing: string }
    ).letterSpacing = `${pixels(paint, options.letterSpacing ?? 0)}px`;
  }
  context.lineJoin = "round";
  context.strokeStyle = withAlpha(palette.ground, 0.82);
  context.lineWidth = pixels(paint, 3.2);
  context.strokeText(text, x, y);
  context.fillStyle = options.colour;
  context.fillText(text, x, y);
  context.restore();
}

/** Text in screen space, for the overlay, where the camera does not apply. */
function screenText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  colour: string,
  align: CanvasTextAlign = "left",
) {
  context.font = font;
  context.fillStyle = colour;
  context.textAlign = align;
  context.textBaseline = "alphabetic";
  context.fillText(text, x, y);
}

interface Blot {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

const bedBlots = new Map<string, Blot[]>();

function blotsFor(id: string): Blot[] {
  let found = bedBlots.get(id);
  if (!found) {
    const random = seededRandom(hashString(`soil:${id}`));
    found = Array.from({ length: 11 }, () => {
      const angle = random() * Math.PI * 2;
      const distance = random() * bedSize * 0.85;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        radius: 60 + random() * 140,
        alpha: 0.05 + random() * 0.08,
      };
    });
    bedBlots.set(id, found);
  }
  return found;
}

/** A watercolour bed: soil wash, pooled edge, raked rows and a clipped box edging. */
function drawBed(paint: PaintContext, id: string, centre: Point) {
  const { context } = paint;
  traceBed(context, id, centre, bedSize, 6);
  context.fillStyle = withAlpha(washes.soil, 0.36);
  context.fill();
  context.save();
  context.clip();
  for (const blot of blotsFor(id))
    softBlot(
      context,
      centre.x + blot.x,
      centre.y + blot.y,
      blot.radius,
      washes.soilDeep,
      blot.alpha,
    );
  if (paint.camera.scale > 0.22) {
    // Raked soil, a plan's hatching, at an angle each bed keeps.
    const angle = ((hashString(id) % 60) - 30) * (Math.PI / 180) + Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    context.strokeStyle = withAlpha(washes.soilDeep, 0.13);
    context.lineWidth = pixels(paint, 0.8);
    context.beginPath();
    for (let offset = -bedSize * 1.5; offset < bedSize * 1.5; offset += 24) {
      context.moveTo(
        centre.x + cos * -bedSize * 1.5 - sin * offset,
        centre.y + sin * -bedSize * 1.5 + cos * offset,
      );
      context.lineTo(
        centre.x + cos * bedSize * 1.5 - sin * offset,
        centre.y + sin * bedSize * 1.5 + cos * offset,
      );
    }
    context.stroke();
  }
  context.restore();
  // Pigment pools at the edge of a wash.
  traceBed(context, id, centre, bedSize, 4);
  context.strokeStyle = withAlpha(washes.soilDeep, 0.28);
  context.lineWidth = 7;
  context.stroke();

  // Box edging: a ribbon of small clipped shrubs along the edge.
  const shrubs = edgingFor(id, centre);
  context.fillStyle = withAlpha(washes.hedge, 0.9);
  context.beginPath();
  for (const shrub of shrubs) {
    context.moveTo(shrub.x + shrub.radius, shrub.y);
    context.arc(shrub.x, shrub.y, shrub.radius, 0, Math.PI * 2);
  }
  context.fill();
  context.strokeStyle = withAlpha(washes.hedgeDeep, 0.6);
  context.lineWidth = pixels(paint, 0.8);
  context.stroke();
  if (paint.camera.scale > 0.3) {
    context.fillStyle = withAlpha(washes.hedgeLight, 0.6);
    context.beginPath();
    for (const shrub of shrubs) {
      const radius = shrub.radius * 0.45;
      const x = shrub.x - shrub.radius * 0.3;
      const y = shrub.y - shrub.radius * 0.3;
      context.moveTo(x + radius, y);
      context.arc(x, y, radius, 0, Math.PI * 2);
    }
    context.fill();
  }
}

const edgings = new Map<
  string,
  Array<{ x: number; y: number; radius: number }>
>();

function edgingFor(id: string, centre: Point) {
  const key = `${id}:${centre.x}:${centre.y}`;
  let found = edgings.get(key);
  if (!found) {
    const random = seededRandom(hashString(`box:${id}`));
    const steps = Math.round((bedSize * 8.4) / 20);
    found = Array.from({ length: steps }, (_, step) => {
      const angle = (step / steps) * Math.PI * 2;
      const distance = bedRadius(id, angle, bedSize, 8) + (random() - 0.5) * 4;
      return {
        x: centre.x + Math.cos(angle) * distance,
        y: centre.y + Math.sin(angle) * distance,
        radius: 9.5 + random() * 4,
      };
    });
    edgings.set(key, found);
  }
  return found;
}

/** A straw skep at the heart of each bed, where idle bees rest. */
function drawSkep(paint: PaintContext, centre: Point) {
  const { context } = paint;
  context.fillStyle = "rgba(60,50,30,0.15)";
  context.beginPath();
  context.arc(centre.x + 4, centre.y + 5, 22, 0, Math.PI * 2);
  context.fill();
  for (const [radius, fill] of [
    [22, washes.straw],
    [16, "#e5d5aa"],
    [10, washes.straw],
    [5, "#e5d5aa"],
  ] as const) {
    context.fillStyle = fill;
    context.beginPath();
    context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = withAlpha(washes.strawDeep, 0.9);
    context.lineWidth = pixels(paint, 0.9);
    context.stroke();
  }
  context.fillStyle = "#3a2c18";
  context.beginPath();
  context.ellipse(centre.x, centre.y + 21, 5, 2.2, 0, 0, Math.PI * 2);
  context.fill();
}

function agentsOf(paint: PaintContext, clientId: string): number {
  const { groups, agents } = paint.scene.dataset;
  return agents.filter(
    (agent) =>
      groups.find((group) => group.id === agent.groupId)?.clientId === clientId,
  ).length;
}

/**
 * A name board on the edge of a bed or the yard, the way a plan labels its
 * beds; in full detail, the number of bees under it.
 */
function placeName(
  paint: PaintContext,
  centre: Point,
  edge: number,
  name: string,
  colour: string,
  second: string,
  hang = false,
) {
  const { context } = paint;
  const full = isFull(paint);
  const size = full
    ? Math.max(12.5, Math.min(19, (19 * paint.camera.scale) / 0.4))
    : 11.5;
  context.save();
  context.font = `${pixels(paint, size)}px ${type.display}`;
  const width = context.measureText(name).width + pixels(paint, full ? 26 : 14);
  const height = pixels(paint, size * 1.7);
  const left = centre.x - width / 2;
  // A hanging board sits just outside the edge instead of across it.
  const middle = hang ? edge + height / 2 + pixels(paint, 4) : edge;
  const top = middle - height / 2;
  context.fillStyle = "rgba(60,50,30,0.18)";
  context.fillRect(
    left + pixels(paint, 2),
    top + pixels(paint, 2),
    width,
    height,
  );
  context.fillStyle = withAlpha(washes.paperLight, 0.96);
  context.fillRect(left, top, width, height);
  context.strokeStyle = withAlpha(palette.ink, 0.7);
  context.lineWidth = pixels(paint, 1);
  context.strokeRect(left, top, width, height);
  if (full) {
    context.strokeStyle = withAlpha(palette.ink, 0.25);
    context.strokeRect(
      left + pixels(paint, 3),
      top + pixels(paint, 3),
      width - pixels(paint, 6),
      height - pixels(paint, 6),
    );
  }
  context.fillStyle = colour;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(name, centre.x, middle + pixels(paint, 1));
  context.restore();
  if (full) {
    lettering(paint, second, centre.x, top + height + pixels(paint, 5), {
      size: 11.5,
      font: type.body,
      colour: palette.mute,
      align: "center",
      baseline: "top",
      italic: true,
    });
  }
}

/** Where a bee is drawn: on its path, with a small looping wobble when tending. */
function beeLoop(agent: Agent, index: number, time: number): Point {
  if (agent.status !== "running") return { x: 0, y: 0 };
  return {
    x: Math.cos(time * 6.1 + index) * 5,
    y: Math.sin(time * 6.1 + index) * 5 * 0.7,
  };
}

function drawBee(
  paint: PaintContext,
  position: Point,
  heading: number,
  colour: string,
  size: number,
  flutter: number,
  resting: boolean,
) {
  const { context } = paint;
  const glow = context.createRadialGradient(
    position.x,
    position.y,
    size * 0.6,
    position.x,
    position.y,
    size * 2.2,
  );
  glow.addColorStop(0, withAlpha(palette.ground, 0.85));
  glow.addColorStop(1, withAlpha(palette.ground, 0));
  context.fillStyle = glow;
  context.beginPath();
  context.arc(position.x, position.y, size * 2.2, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.translate(position.x, position.y);
  context.rotate(heading);
  const line = pixels(paint, 0.9);
  // Wings, angled back from the thorax.
  const spread = resting ? 0.35 : 0.95 + flutter;
  context.fillStyle = "rgba(255,255,255,0.82)";
  context.strokeStyle = withAlpha(palette.ink, 0.75);
  context.lineWidth = line;
  for (const side of [-1, 1]) {
    context.save();
    context.translate(size * 0.15, side * size * 0.3);
    context.rotate(Math.PI + side * -spread);
    context.beginPath();
    context.ellipse(size * 0.6, 0, size * 0.72, size * 0.4, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }
  // Body in the status colour, banded in cream.
  context.fillStyle = colour;
  context.beginPath();
  context.ellipse(-size * 0.1, 0, size * 0.95, size * 0.62, 0, 0, Math.PI * 2);
  context.fill();
  context.save();
  context.clip();
  context.strokeStyle = withAlpha(palette.ground, 0.85);
  context.lineWidth = size * 0.2;
  context.beginPath();
  for (const band of [-0.55, -0.05]) {
    context.moveTo(size * band, -size);
    context.lineTo(size * band, size);
  }
  context.stroke();
  context.restore();
  context.strokeStyle = palette.ink;
  context.lineWidth = line;
  context.beginPath();
  context.ellipse(-size * 0.1, 0, size * 0.95, size * 0.62, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = palette.ink;
  context.beginPath();
  context.arc(size * 0.98, 0, size * 0.36, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export const gardenerPainter: WorldPainter = {
  background(paint) {
    const { context, width, height, scene, time, reducedMotion } = paint;
    setScreenTransform(paint);
    context.fillStyle = palette.ground;
    context.fillRect(0, 0, width, height);
    const vignette = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.78,
    );
    vignette.addColorStop(0, "rgba(255,252,240,0)");
    vignette.addColorStop(1, "rgba(160,140,90,0.14)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);

    setWorldTransform(paint);
    const garden = gardenOf(scene.layout);
    drawLawn(paint, garden);
    drawPaths(paint, garden);
    if (garden.pond) drawPond(paint, garden.pond, time, reducedMotion);
    drawHedgeAndTrees(paint, garden);
  },

  overlay(paint) {
    const { context, width, height } = paint;
    // A plan's border: a fine double rule.
    context.strokeStyle = withAlpha(palette.ink, 0.45);
    context.lineWidth = 1;
    context.strokeRect(8.5, 8.5, width - 17, height - 17);
    context.lineWidth = 0.6;
    context.strokeRect(12.5, 12.5, width - 25, height - 25);
    if (!isFull(paint) || width < 900 || height < 600) return;

    // The cartouche: a title, a north point, and a key to the growth stages.
    const boxWidth = 232;
    const boxHeight = 100;
    const left = width - 24 - boxWidth;
    const top = height - 24 - boxHeight;
    context.fillStyle = withAlpha(washes.paperLight, 0.94);
    context.fillRect(left, top, boxWidth, boxHeight);
    context.strokeStyle = withAlpha(palette.ink, 0.6);
    context.lineWidth = 1;
    context.strokeRect(left + 0.5, top + 0.5, boxWidth - 1, boxHeight - 1);
    context.strokeStyle = withAlpha(palette.ink, 0.3);
    context.strokeRect(left + 4.5, top + 4.5, boxWidth - 9, boxHeight - 9);
    screenText(
      context,
      "Planting plan",
      left + 14,
      top + 25,
      `16px ${type.display}`,
      palette.ink,
    );
    const north = { x: left + boxWidth - 24, y: top + 21 };
    context.strokeStyle = palette.ink;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(north.x, north.y, 8.5, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = palette.ink;
    context.beginPath();
    context.moveTo(north.x, north.y - 12);
    context.lineTo(north.x + 3.6, north.y + 5);
    context.lineTo(north.x, north.y + 2);
    context.lineTo(north.x - 3.6, north.y + 5);
    context.closePath();
    context.fill();
    screenText(
      context,
      "N",
      north.x - 16,
      north.y - 3,
      `10px ${type.display}`,
      palette.ink,
      "center",
    );
    context.strokeStyle = withAlpha(palette.ink, 0.2);
    context.beginPath();
    context.moveTo(left + 12, top + 35.5);
    context.lineTo(left + boxWidth - 12, top + 35.5);
    context.stroke();
    (["todo", "doing", "review", "done"] as const).forEach((state, index) => {
      const x = left + 34 + index * 55;
      const y = top + 54;
      drawPlant(context, x, y, state, 0.9, 1, 0);
      screenText(
        context,
        growthStages[state],
        x,
        y + 26,
        `11.5px ${type.display}`,
        palette.ink,
        "center",
      );
      screenText(
        context,
        state === "todo" ? "to do" : state,
        x,
        y + 38,
        `italic 10px ${type.body}`,
        palette.mute,
        "center",
      );
    });
  },

  home(paint, home) {
    const centre = paint.scene.layout.clients.get(home.id) ?? { x: 0, y: 0 };
    drawYard(paint, home.id, centre);
    drawHomestead(paint, centre);
    // On the yard's south edge, by the gate: home's loose work grows to the north.
    const bottom = centre.y + bedRadius(home.id, Math.PI / 2, yardSize, 0, 6);
    placeName(
      paint,
      centre,
      bottom,
      gardenerVocabulary.homeName,
      palette.accent,
      `Home garden · ${home.name}`,
      paint.scene.layout.orientation === "landscape",
    );
  },

  client(paint, client) {
    const centre = paint.scene.layout.clients.get(client.id);
    if (!centre) return;
    drawBed(paint, client.id, centre);
    drawSkep(paint, centre);
    const bees = agentsOf(paint, client.id);
    const top = centre.y - bedRadius(client.id, -Math.PI / 2, bedSize, 8);
    placeName(
      paint,
      centre,
      top,
      client.name,
      palette.ink,
      `${bees} ${bees === 1 ? "bee" : "bees"}`,
    );
  },

  requirement(paint, requirement) {
    const { context } = paint;
    const point = paint.scene.layout.fixed.get(requirement.id);
    if (!point) return;
    const done = requirement.state === "done";
    context.save();
    context.globalAlpha = done ? 0.5 : 1;
    // The seed row: a ring of tilled earth with a sown drill along it.
    context.strokeStyle = withAlpha(washes.soilDeep, 0.2);
    context.lineWidth = 18;
    context.beginPath();
    context.arc(point.x, point.y, rings.orbit, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([pixels(paint, 1.5), pixels(paint, 4)]);
    context.strokeStyle = withAlpha(washes.soilDeep, 0.65);
    context.lineWidth = pixels(paint, 1.2);
    context.stroke();
    context.setLineDash([]);
    // The row marker: a cream label pushed into the soil.
    context.translate(point.x, point.y);
    context.rotate(-0.12);
    context.fillStyle = "rgba(60,50,30,0.18)";
    context.fillRect(-5, -9, 13, 22);
    context.fillStyle = washes.paperLight;
    context.strokeStyle = palette.ink;
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.moveTo(-7, -12);
    context.lineTo(7, -12);
    context.lineTo(7, 7);
    context.lineTo(0, 13);
    context.lineTo(-7, 7);
    context.closePath();
    context.fill();
    context.stroke();
    context.strokeStyle = withAlpha(palette.ink, 0.55);
    context.beginPath();
    context.moveTo(-4, -6);
    context.lineTo(4, -6);
    context.moveTo(-4, -1);
    context.lineTo(2, -1);
    context.stroke();
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      lettering(paint, requirement.title, point.x, point.y + 18, {
        size: 12,
        font: type.display,
        colour: done ? palette.mute : palette.ink,
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
    // A gardener's string line, from the row marker to the plant.
    context.strokeStyle = withAlpha(washes.wood, 0.38);
    context.lineWidth = pixels(paint, 0.8);
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
    const high = item.priority === "high";
    const twist = (hashString(item.id) % 628) / 100;
    // Plants stay large enough to tell apart at the overview zoom.
    const unit =
      (high ? 2 : 1.7) * Math.min(2, Math.max(1, 0.5 / paint.camera.scale));
    context.save();
    context.globalAlpha = item.state === "done" ? 0.8 : 1;
    drawPlant(
      context,
      point.x,
      point.y,
      item.state,
      unit,
      pixels(paint, 0.9),
      twist,
    );
    context.restore();
    if (high) {
      // A red-topped stake: this one first.
      const x = point.x + 9 * unit;
      const y = point.y - 4 * unit;
      context.strokeStyle = palette.ink;
      context.lineWidth = pixels(paint, 1);
      context.beginPath();
      context.moveTo(x, y + 8);
      context.lineTo(x, y - 8);
      context.stroke();
      context.fillStyle = palette.status.blocked;
      context.beginPath();
      context.moveTo(x, y - 9);
      context.lineTo(x + 8, y - 6);
      context.lineTo(x, y - 3);
      context.closePath();
      context.fill();
    }
    if (isFull(paint) && paint.camera.scale > labelScale.item) {
      lettering(paint, item.title, point.x + 10 * unit + 6, point.y + 2, {
        size: 11.5,
        font: type.body,
        colour: palette.ink,
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
    const blocked = workPosition(
      scene.layout,
      scene.dataset,
      question.blocks,
      time,
      reducedMotion,
    );
    const blown = 1 - fade;
    context.save();
    context.globalAlpha = fade;
    if (blocked) {
      // The stalk leans in from beside the plant it holds up.
      const base = {
        x: point.x + (blocked.x - point.x) * 0.55,
        y: point.y + (blocked.y - point.y) * 0.55,
      };
      context.strokeStyle = withAlpha(washes.leafDeep, 0.7);
      context.lineWidth = pixels(paint, 1.2);
      context.beginPath();
      context.moveTo(base.x, base.y);
      context.quadraticCurveTo(
        (base.x + point.x) / 2 + 8,
        (base.y + point.y) / 2 - 8,
        point.x,
        point.y,
      );
      context.stroke();
    }
    // The clock: a soft grey-lavender sphere of seeds on fine stalks.
    context.fillStyle = withAlpha(washes.lavender, 0.22 * fade);
    context.beginPath();
    context.arc(point.x, point.y, 19, 0, Math.PI * 2);
    context.fill();
    const random = seededRandom(hashString(question.id));
    const seeds = 22;
    context.lineWidth = pixels(paint, 0.7);
    for (let seed = 0; seed < seeds; seed++) {
      const angle = (seed / seeds) * Math.PI * 2 + random() * 0.2;
      const length = 14 + random() * 4;
      // Answered: the seeds lift away on the wind.
      const away = blown * (40 + random() * 50);
      const drift = blown * blown * 30;
      const tip = {
        x: point.x + Math.cos(angle) * (length + away) + drift,
        y: point.y + Math.sin(angle) * (length + away) - drift * 0.4,
      };
      context.strokeStyle = withAlpha(palette.ink, 0.5);
      if (blown === 0) {
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(tip.x, tip.y);
        context.stroke();
      }
      context.fillStyle = withAlpha(palette.mute, 0.85);
      context.beginPath();
      context.arc(tip.x, tip.y, 1.6, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = withAlpha(palette.mute, 0.45);
      context.beginPath();
      for (const fan of [-0.5, 0, 0.5]) {
        context.moveTo(tip.x, tip.y);
        context.lineTo(
          tip.x + Math.cos(angle + fan) * 4,
          tip.y + Math.sin(angle + fan) * 4,
        );
      }
      context.stroke();
    }
    context.fillStyle = "#8b8a52";
    context.beginPath();
    context.arc(point.x, point.y, 3, 0, Math.PI * 2);
    context.fill();
    if (question.asks === "You" && question.state === "open") {
      const phase = pulsePhase(paint, 0.8, question.id.length * 0.13);
      context.strokeStyle = withAlpha(palette.status.waiting, 1 - phase);
      context.lineWidth = pixels(paint, 1.6);
      context.beginPath();
      context.arc(point.x, point.y, 22 + phase * 26, 0, Math.PI * 2);
      context.stroke();
    }
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      lettering(paint, question.title, point.x, point.y + 26, {
        size: 11.5,
        font: type.body,
        colour: palette.mute,
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
    const grow = 0.4 + 0.6 * appear;
    context.save();
    context.globalAlpha = Math.min(1, appear * 1.5);
    context.translate(point.x, point.y);
    context.scale(grow * 1.3, grow * 1.3);
    // A fan trellis: slats spreading from the foot, two cross rails.
    const foot = { x: 0, y: 14 };
    context.strokeStyle = washes.wood;
    context.lineCap = "round";
    context.lineWidth = 2.4;
    context.beginPath();
    for (let slat = -2; slat <= 2; slat++) {
      const angle = -Math.PI / 2 + slat * 0.3;
      context.moveTo(foot.x, foot.y);
      context.lineTo(
        foot.x + Math.cos(angle) * 30,
        foot.y + Math.sin(angle) * 30,
      );
    }
    context.stroke();
    context.lineWidth = 1.8;
    context.beginPath();
    for (const radius of [14, 24]) {
      context.moveTo(
        foot.x + Math.cos(-Math.PI / 2 - 0.66) * radius,
        foot.y + Math.sin(-Math.PI / 2 - 0.66) * radius,
      );
      context.arc(
        foot.x,
        foot.y,
        radius,
        -Math.PI / 2 - 0.66,
        -Math.PI / 2 + 0.66,
      );
    }
    context.stroke();
    if (made) {
      // A clematis has taken to it: leaves and lavender flowers.
      context.fillStyle = washes.leaf;
      for (const [x, y] of [
        [-8, -2],
        [6, -9],
        [-3, -14],
        [9, 3],
      ] as const) {
        context.beginPath();
        context.ellipse(x, y, 3.6, 2, x * 0.2, 0, Math.PI * 2);
        context.fill();
      }
      for (const [x, y] of [
        [-6, -10],
        [5, -2],
        [2, -16],
      ] as const) {
        context.fillStyle = washes.lavender;
        context.strokeStyle = washes.lavenderDeep;
        context.lineWidth = 0.8;
        context.beginPath();
        for (let petal = 0; petal < 4; petal++) {
          const angle = (petal / 4) * Math.PI * 2 + 0.4;
          context.moveTo(x, y);
          context.ellipse(
            x + Math.cos(angle) * 2.4,
            y + Math.sin(angle) * 2.4,
            2.6,
            1.6,
            angle,
            0,
            Math.PI * 2,
          );
        }
        context.fill();
        context.stroke();
        context.fillStyle = "#e2b443";
        context.beginPath();
        context.arc(x, y, 1, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      lettering(paint, decision.title, point.x + 26, point.y + 2, {
        size: 11.5,
        font: type.body,
        colour: palette.ink,
        alpha: appear,
      });
    }
  },

  agent(paint, agent, motion, colour) {
    const { context, scene, time, reducedMotion } = paint;
    const index = scene.dataset.agents.indexOf(agent);
    const moving = agent.status === "running" || agent.status === "watching";
    const loop = (at: number) =>
      reducedMotion ? { x: 0, y: 0 } : beeLoop(agent, index, at);
    const offset = loop(time);
    const position = {
      x: motion.position.x + offset.x,
      y: motion.position.y + offset.y,
    };

    // The flight path: a dotted line along where the bee has been.
    let heading = -Math.PI / 2 + 0.35;
    if (moving && !reducedMotion) {
      const now = scene.agentTarget(agent, time, false);
      const lag = {
        x: motion.position.x - now.x,
        y: motion.position.y - now.y,
      };
      const path: Point[] = [];
      if (Math.hypot(lag.x, lag.y) < 24) {
        const span = agent.status === "running" ? 2.4 : 3.2;
        const steps = 40;
        for (let step = 0; step <= steps; step++) {
          const at = time - (step / steps) * span;
          const target = scene.agentTarget(agent, at, false);
          const wobble = loop(at);
          path.push({
            x: target.x + lag.x + wobble.x,
            y: target.y + lag.y + wobble.y,
          });
        }
      } else {
        path.push(position, ...motion.trail);
      }
      const first = path[0];
      const second = path[1];
      if (first && second)
        heading = Math.atan2(first.y - second.y, first.x - second.x);
      context.fillStyle = colour;
      for (let step = 2; step < path.length; step += 1) {
        const point = path[step];
        if (!point) continue;
        const fade = 1 - step / path.length;
        context.globalAlpha = fade * 0.55;
        context.beginPath();
        context.arc(
          point.x,
          point.y,
          pixels(paint, 0.7 + fade * 0.9),
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      context.globalAlpha = 1;
    } else if (moving) {
      heading = motion.heading;
    }

    const size =
      pixels(paint, isFull(paint) ? 8.5 : 5.5) *
      Math.max(1, paint.camera.scale * 1.4);
    const flutter =
      agent.status === "running" && !reducedMotion
        ? Math.sin(time * 38 + index) * 0.28
        : 0;
    drawBee(
      paint,
      position,
      heading,
      colour,
      size,
      flutter,
      agent.status === "idle",
    );

    if (scene.needsAttention(agent)) {
      const phase = pulsePhase(paint, 0.9, index * 0.3);
      context.strokeStyle = withAlpha(colour, 1 - phase);
      context.lineWidth = pixels(paint, 1.6);
      context.beginPath();
      context.arc(
        position.x,
        position.y,
        size * 1.6 + phase * pixels(paint, 20),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    if (!isFull(paint)) return;
    lettering(
      paint,
      agent.name,
      position.x + size * 1.5 + pixels(paint, 4),
      position.y - pixels(paint, 7),
      { size: 12.5, font: type.display, colour: palette.ink },
    );
    if (paint.camera.scale > labelScale.agentStatus) {
      lettering(
        paint,
        gardenerStatusNames[agent.status],
        position.x + size * 1.5 + pixels(paint, 4),
        position.y + pixels(paint, 8),
        { size: 11, font: type.body, colour, italic: true },
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
      // Pollen drifting on a curve from one bee to the other.
      const curve = curveBetween(from, to, 0.2);
      const reach = reducedMotion ? 1 : Math.min(1, progress * 1.5);
      const grain = pixels(paint, 1.9);
      context.fillStyle = withAlpha(washes.pollen, fadeOut);
      context.strokeStyle = withAlpha(washes.pollenDeep, fadeOut * 0.9);
      context.lineWidth = pixels(paint, 0.7);
      for (let along = 0.04; along < reach; along += 0.045) {
        const point = curve.at(along);
        const sway = reducedMotion ? 0 : Math.sin(along * 30 + time * 3) * 3;
        context.beginPath();
        context.arc(
          point.x + sway,
          point.y - sway,
          grain * 0.75,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.stroke();
      }
      const head = curve.at(reach);
      for (let index = 0; index < 7; index++) {
        const angle = index * 0.9 + (reducedMotion ? 0 : time * 2);
        const distance = pixels(paint, 3 + (index % 3) * 2.5);
        context.beginPath();
        context.arc(
          head.x + Math.cos(angle) * distance,
          head.y + Math.sin(angle) * distance,
          grain,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.stroke();
      }
      if (isFull(paint)) {
        lettering(paint, `“${effect.text}”`, curve.control.x, curve.control.y, {
          size: 12,
          font: type.body,
          colour: palette.ink,
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
      // Weather comes in from beyond the hedge, over the bed, and rains on the record.
      const angle = Math.atan2(centre.y || -1, centre.x);
      const start = {
        x: point.x + Math.cos(angle) * 700,
        y: point.y + Math.sin(angle) * 700,
      };
      const travel = reducedMotion ? 1 : Math.min(1, progress * 1.5);
      const eased = 1 - Math.pow(1 - travel, 2);
      const cloud = {
        x: start.x + (point.x - start.x) * eased,
        y: start.y + (point.y - start.y) * eased - pixels(paint, 26),
      };
      const unit = pixels(paint, 1);
      if (travel > 0.55) {
        context.strokeStyle = withAlpha(washes.waterDeep, 0.6 * fadeOut);
        context.lineWidth = pixels(paint, 1);
        context.beginPath();
        for (let drop = 0; drop < 9; drop++) {
          const fall = reducedMotion ? 0.5 : (time * 2.2 + drop * 0.37) % 1;
          const x = cloud.x + (drop - 4) * 4 * unit - fall * 5 * unit;
          const y = cloud.y + (8 + fall * 22) * unit;
          context.moveTo(x, y);
          context.lineTo(x - 2 * unit, y + 6 * unit);
        }
        context.stroke();
      }
      context.fillStyle = withAlpha(washes.cloud, 0.85 * fadeOut);
      context.strokeStyle = withAlpha(washes.cloudDeep, 0.8 * fadeOut);
      context.lineWidth = pixels(paint, 1);
      context.beginPath();
      for (const [dx, dy, radius] of [
        [-13, 2, 8],
        [-4, -5, 11],
        [8, -3, 9],
        [15, 3, 7],
        [1, 4, 8],
      ] as const) {
        context.moveTo(cloud.x + (dx + radius) * unit, cloud.y + dy * unit);
        context.arc(
          cloud.x + dx * unit,
          cloud.y + dy * unit,
          radius * unit,
          0,
          Math.PI * 2,
        );
      }
      context.fill();
      context.stroke();
      if (travel >= 1) {
        for (const lag of [0, 0.18]) {
          const ripple = Math.max(0, (progress - 0.62 - lag) * 3);
          if (ripple <= 0 || ripple >= 1) continue;
          context.strokeStyle = withAlpha(washes.waterDeep, 1 - ripple);
          context.lineWidth = pixels(paint, 1.2);
          context.beginPath();
          context.ellipse(
            point.x,
            point.y,
            ripple * pixels(paint, 34),
            ripple * pixels(paint, 22),
            0,
            0,
            Math.PI * 2,
          );
          context.stroke();
        }
      }
      if (isFull(paint)) {
        lettering(
          paint,
          `Weather · ${externalSourceNames[effect.source]}: ${effect.text}`,
          cloud.x + pixels(paint, 26),
          cloud.y - pixels(paint, 4),
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
      context.lineWidth = pixels(paint, 1.8);
      context.beginPath();
      context.arc(
        motion.position.x,
        motion.position.y,
        pixels(paint, 8) + progress * pixels(paint, 38),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  },
};
