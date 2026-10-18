/**
 * The Mariner's sea chart: an engraved chart with soundings, depth contours
 * and rhumb lines. Clients are islands, agents ships, open questions fog
 * banks, decisions lighthouses. Home is Turtle Bay, a harbour island beside
 * the compass rose.
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
import { seededRandom } from "../random";
import type { PaintContext, WorldPainter } from "../types";
import { coastRadius, islandRadius, traceCoast } from "./coast";

const homeRadius = 70;
import { marinerPalette as palette, marinerTypefaces as type } from "./palette";
import { marinerStatusNames, marinerVocabulary } from "./vocabulary";

const isFull = (paint: PaintContext) => paint.detail === "full";

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
  context.save();
  context.translate(centre.x, centre.y);
  context.strokeStyle = "rgba(60,48,30,0.7)";
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
      [1, "#f6efde", "#2a2116"],
      [-1, "#7a1f16", "#f6efde"],
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
    colour: palette.ink,
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
  traceCoast(context, id, centre, 70, radius);
  context.fillStyle = "rgba(150,190,205,0.28)";
  context.fill();
  [28, 70, 120, 190].forEach((offset, index) => {
    traceCoast(context, id, centre, offset, radius);
    context.strokeStyle = `rgba(45,95,135,${0.34 - index * 0.06})`;
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
  traceCoast(context, id, centre, 0, radius);
  context.fillStyle = "#e7d29b";
  context.fill();
  context.strokeStyle = "#5a3f22";
  context.lineWidth = pixels(paint, 1.6);
  context.stroke();
  traceCoast(context, id, centre, -7, radius);
  context.strokeStyle = "rgba(90,63,34,0.35)";
  context.lineWidth = pixels(paint, 0.8);
  context.stroke();
}

export const marinerPainter: WorldPainter = {
  background(paint) {
    const { context, width, height, scene } = paint;
    setScreenTransform(paint);
    context.fillStyle = palette.ground;
    context.fillRect(0, 0, width, height);
    const vignette = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.3,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    vignette.addColorStop(0, "rgba(255,250,235,0)");
    vignette.addColorStop(1, "rgba(150,115,60,0.18)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);

    setWorldTransform(paint);
    const rose = rosePosition(paint);
    context.strokeStyle = "rgba(60,48,30,0.10)";
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
      context.fillStyle = "rgba(40,70,100,0.32)";
      context.textAlign = "center";
      for (const sounding of soundings(paint))
        context.fillText(String(sounding.depth), sounding.x, sounding.y);
      context.restore();
    }
    drawRose(paint, rose, 78);
  },

  overlay(paint) {
    const { context, width, height } = paint;
    context.strokeStyle = "rgba(60,48,30,0.55)";
    context.lineWidth = 1;
    context.strokeRect(8.5, 8.5, width - 17, height - 17);
    context.strokeRect(12.5, 12.5, width - 25, height - 25);
    context.fillStyle = "rgba(60,48,30,0.55)";
    for (let x = 12; x < width - 12; x += 80) {
      context.fillRect(x, 9, Math.min(40, width - 12 - x), 3);
      context.fillRect(x, height - 12, Math.min(40, width - 12 - x), 3);
    }
  },

  home(paint, home) {
    const { context, time, reducedMotion } = paint;
    const centre = paint.scene.layout.clients.get(home.id) ?? { x: 0, y: 0 };
    const radius = homeRadius;
    drawLand(paint, home.id, centre, radius);
    // The bay: a bite of sea out of the island's north shore, with a pier.
    context.save();
    context.beginPath();
    context.arc(
      centre.x,
      centre.y - radius * 0.62,
      radius * 0.48,
      0,
      Math.PI * 2,
    );
    context.fillStyle = "#d9e6e6";
    context.fill();
    context.strokeStyle = "#5a3f22";
    context.lineWidth = pixels(paint, 1.4);
    context.stroke();
    context.restore();
    context.strokeStyle = "#5a3f22";
    context.lineWidth = pixels(paint, 2);
    context.beginPath();
    context.moveTo(centre.x - 4, centre.y - radius * 0.22);
    context.lineTo(centre.x - 4, centre.y - radius * 0.62);
    context.stroke();
    // A few houses
    context.fillStyle = "#7a1f16";
    for (const [dx, dy] of [
      [-20, 6],
      [-8, 14],
      [8, 8],
      [20, 18],
      [2, 26],
    ] as const) {
      context.fillRect(centre.x + dx - 3.5, centre.y + dy - 3.5, 7, 7);
    }
    // A turtle, swimming in the bay.
    const swim = reducedMotion ? 0 : Math.sin(time * 0.4) * 10;
    const turtle = { x: centre.x + 14 + swim, y: centre.y - radius * 0.7 };
    context.fillStyle = "#4b6b3a";
    context.beginPath();
    context.ellipse(turtle.x, turtle.y, 7, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(turtle.x + 8, turtle.y, 2.4, 0, Math.PI * 2);
    context.fill();

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
    const centre = paint.scene.layout.clients.get(client.id);
    if (!centre) return;
    drawLand(paint, client.id, centre, islandRadius);
    context.strokeStyle = "rgba(90,63,34,0.45)";
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
    const point = paint.scene.layout.fixed.get(requirement.id);
    if (!point) return;
    const done = requirement.state === "done";
    const ink = done ? "rgba(60,48,30,0.4)" : palette.ink;
    context.setLineDash([pixels(paint, 3), pixels(paint, 3)]);
    context.strokeStyle = done ? "rgba(60,48,30,0.25)" : "rgba(31,79,122,0.55)";
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
    context.setLineDash([pixels(paint, 2), pixels(paint, 4)]);
    context.strokeStyle = "rgba(60,48,30,0.3)";
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
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
    const size = item.priority === "high" ? 8 : 6.5;
    context.save();
    context.translate(point.x, point.y);
    context.globalAlpha = item.state === "done" ? 0.45 : 1;
    context.fillStyle =
      item.state === "review"
        ? "#d8c08a"
        : item.state === "todo"
          ? "#f6efde"
          : "#b8925a";
    context.strokeStyle = "#4a3520";
    context.lineWidth = pixels(paint, 1.1);
    context.fillRect(-size, -size * 0.75, size * 2, size * 1.5);
    context.strokeRect(-size, -size * 0.75, size * 2, size * 1.5);
    context.beginPath();
    context.moveTo(-size, -size * 0.75);
    context.lineTo(size, size * 0.75);
    context.moveTo(size, -size * 0.75);
    context.lineTo(-size, size * 0.75);
    context.strokeStyle = "rgba(74,53,32,0.5)";
    context.stroke();
    if (item.priority === "high") {
      context.fillStyle = palette.status.blocked;
      context.beginPath();
      context.arc(size + 3, -size, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.item) {
      label(paint, item.title, point.x + 14, point.y, {
        size: 11.5,
        font: type.mono,
        colour: "#3d3020",
        alpha: 0.9,
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
    const drift = reducedMotion ? 0 : time * 0.15;
    for (let puff = 0; puff < 5; puff++) {
      const angle = puff * 1.3 + drift;
      const radius = 20 + puff * 4;
      const x = point.x + Math.cos(angle) * radius * 0.9;
      const y = point.y + Math.sin(angle * 1.3) * radius * 0.5;
      const fog = context.createRadialGradient(x, y, 0, x, y, 46);
      fog.addColorStop(0, "rgba(150,150,150,0.38)");
      fog.addColorStop(1, "rgba(150,150,150,0)");
      context.fillStyle = fog;
      context.beginPath();
      context.arc(x, y, 46, 0, Math.PI * 2);
      context.fill();
    }
    if (question.asks === "You") {
      const phase = pulsePhase(paint, 0.8);
      context.strokeStyle = withAlpha(palette.status.waiting, 1 - phase);
      context.lineWidth = pixels(paint, 1.5);
      context.beginPath();
      context.arc(point.x, point.y, 14 + phase * 26, 0, Math.PI * 2);
      context.stroke();
    }
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(paint, "Fog", point.x, point.y - pixels(paint, 6), {
        size: 10,
        font: type.display,
        colour: "#4b4b4b",
        align: "center",
        letterSpacing: 2,
      });
      label(paint, question.title, point.x, point.y + pixels(paint, 8), {
        size: 11.5,
        font: type.mono,
        colour: "#3a3a3a",
        align: "center",
      });
    }
    context.restore();
  },

  decision(paint, decision, appear) {
    const { context, scene, time, reducedMotion } = paint;
    const point = decisionPosition(scene.layout, scene.dataset, decision);
    context.save();
    context.globalAlpha = appear;
    if (decision.state === "made") {
      const sweep = reducedMotion ? -0.8 : time * 0.9 + point.x;
      const beam = context.createRadialGradient(
        point.x,
        point.y,
        0,
        point.x,
        point.y,
        150,
      );
      beam.addColorStop(0, "rgba(255,214,120,0.55)");
      beam.addColorStop(1, "rgba(255,214,120,0)");
      context.fillStyle = beam;
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.arc(point.x, point.y, 150, sweep - 0.22, sweep + 0.22);
      context.closePath();
      context.fill();
    }
    context.fillStyle = "#f6efde";
    context.strokeStyle = palette.ink;
    context.lineWidth = pixels(paint, 1.2);
    context.beginPath();
    context.moveTo(point.x - 5, point.y + 8);
    context.lineTo(point.x - 3, point.y - 9);
    context.lineTo(point.x + 3, point.y - 9);
    context.lineTo(point.x + 5, point.y + 8);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = palette.status.blocked;
    context.fillRect(point.x - 3.6, point.y - 2, 7.2, 3);
    context.fillStyle = decision.state === "made" ? "#e8a300" : "#b8ad99";
    context.beginPath();
    context.arc(point.x, point.y - 11, 2.6, 0, Math.PI * 2);
    context.fill();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(paint, decision.title, point.x + 12, point.y + 2, {
        size: 11.5,
        font: type.mono,
        colour: palette.ink,
      });
    }
    context.restore();
  },

  agent(paint, agent, motion, colour) {
    const { context } = paint;
    const { position, trail } = motion;
    if (agent.status === "running" && trail.length > 3) {
      for (let index = 2; index < trail.length; index += 2) {
        const here = trail[index];
        const before = trail[index - 2];
        if (!here || !before) continue;
        const across =
          Math.atan2(here.y - before.y, here.x - before.x) + Math.PI / 2;
        const spread = index * 0.45;
        context.strokeStyle = `rgba(31,79,122,${(1 - index / trail.length) * 0.4})`;
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
    const size =
      pixels(paint, isFull(paint) ? 9 : 6) *
      Math.max(1, paint.camera.scale * 1.5);
    const heading =
      agent.status === "running" ? motion.heading : -Math.PI / 2 + 0.2;
    context.save();
    context.translate(position.x, position.y);
    context.rotate(heading + Math.PI / 2);
    context.fillStyle = "#3d2a17";
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
    if (!isFull(paint)) return;
    label(
      paint,
      agent.name,
      position.x + pixels(paint, 14),
      position.y - pixels(paint, 8),
      { size: 12, font: type.mono, colour: palette.ink },
    );
    if (paint.camera.scale > labelScale.agentStatus) {
      label(
        paint,
        marinerStatusNames[agent.status],
        position.x + pixels(paint, 14),
        position.y + pixels(paint, 6),
        { size: 10.5, font: type.mono, colour, italic: true },
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
      const curve = curveBetween(from, to, 0.15);
      context.setLineDash([pixels(paint, 6), pixels(paint, 5)]);
      context.strokeStyle = `rgba(122,31,22,${(1 - progress) * 0.75})`;
      context.lineWidth = pixels(paint, 1.3);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.quadraticCurveTo(curve.control.x, curve.control.y, to.x, to.y);
      context.stroke();
      context.setLineDash([]);
      const flag = curve.at(reducedMotion ? 1 : Math.min(1, progress * 1.5));
      const size = pixels(paint, 9);
      (["#b3261e", "#e8a300", "#1f4f7a"] as const).forEach((colour, index) => {
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
          colour: "#5a1810",
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
      const dashes = 26;
      context.strokeStyle = `rgba(42,33,22,${(1 - progress) * 0.8})`;
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
        context.strokeStyle = `rgba(42,33,22,${1 - progress})`;
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
