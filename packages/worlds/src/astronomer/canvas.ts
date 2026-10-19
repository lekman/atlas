/**
 * The Astronomer's star chart: a tactical display in the spirit of a ship's
 * navigation console. Clients are star systems, requirements planets,
 * backlog items moons, agents probes with ion trails. Home is Terra.
 */
import { externalSourceNames } from "@atlas/core";

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
  setWorldTransform,
  withAlpha,
  workstreamCaption,
  workstreamCaptionRise,
} from "../paint";
import { seededRandom } from "../random";
import type { PaintContext, WorldPainter } from "../types";
import {
  astronomerPalette as palette,
  astronomerTypefaces as type,
} from "./palette";
import { astronomerStatusNames, astronomerVocabulary } from "./vocabulary";

interface Star {
  x: number;
  y: number;
  size: number;
  twinkle: number;
  layer: number;
}

const stars: Star[] = (() => {
  const random = seededRandom(7);
  return Array.from({ length: 700 }, () => ({
    x: random() * 4000 - 2000,
    y: random() * 3600 - 1800,
    size: random() * 1.3 + 0.2,
    twinkle: random(),
    layer: Math.floor(random() * 3),
  }));
})();

/** Rough continents, as angles and widths around Terra's disc. */
const continents = (() => {
  const random = seededRandom(1969);
  return Array.from({ length: 7 }, () => ({
    angle: random() * Math.PI * 2,
    distance: random() * 0.62,
    size: 0.18 + random() * 0.26,
    stretch: 0.6 + random() * 0.8,
  }));
})();

const isFull = (paint: PaintContext) => paint.detail === "full";

export const astronomerPainter: WorldPainter = {
  background(paint) {
    const { context, width, height, camera, time, reducedMotion } = paint;
    context.setTransform(paint.pixelRatio, 0, 0, paint.pixelRatio, 0, 0);
    context.fillStyle = palette.ground;
    context.fillRect(0, 0, width, height);
    const glow = context.createRadialGradient(
      width * 0.5,
      height * 0.45,
      0,
      width * 0.5,
      height * 0.45,
      Math.max(width, height) * 0.8,
    );
    glow.addColorStop(0, "rgba(30,60,100,0.25)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    for (const star of stars) {
      const parallax = [0.35, 0.6, 0.85][star.layer] ?? 0.6;
      const x =
        star.x * camera.scale * parallax +
        camera.x * parallax +
        (width * (1 - parallax)) / 2;
      const y =
        star.y * camera.scale * parallax +
        camera.y * parallax +
        (height * (1 - parallax)) / 2;
      if (x < -2 || y < -2 || x > width + 2 || y > height + 2) continue;
      const shimmer = reducedMotion
        ? 0.5
        : Math.abs(Math.sin(time * 0.4 + star.twinkle * 20));
      context.globalAlpha = 0.3 + shimmer * 0.45;
      context.fillStyle = star.twinkle > 0.9 ? "#ffd9a8" : "#cfe8ff";
      context.fillRect(x, y, star.size, star.size);
    }
    context.globalAlpha = 1;

    setWorldTransform(paint);
    const bounds = paint.scene.layout.bounds;
    const step = 200;
    context.strokeStyle = "rgba(94,220,255,0.06)";
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    for (
      let x = Math.floor(bounds.left / step) * step;
      x <= bounds.right;
      x += step
    ) {
      context.moveTo(x, bounds.top);
      context.lineTo(x, bounds.bottom);
    }
    for (
      let y = Math.floor(bounds.top / step) * step;
      y <= bounds.bottom;
      y += step
    ) {
      context.moveTo(bounds.left, y);
      context.lineTo(bounds.right, y);
    }
    context.stroke();
    if (isFull(paint) && camera.scale > 0.25) {
      for (
        let x = Math.floor(bounds.left / step) * step;
        x <= bounds.right;
        x += step
      ) {
        label(
          paint,
          (x / 1000).toFixed(1),
          x + pixels(paint, 3),
          bounds.top + pixels(paint, 10),
          {
            size: 9,
            font: type.mono,
            colour: "rgba(94,220,255,0.35)",
          },
        );
      }
    }
  },

  home(paint, home) {
    const { context, time, reducedMotion } = paint;
    const centre = paint.scene.layout.clients.get(home.id) ?? { x: 0, y: 0 };
    const radius = 34;
    for (const [ring, alpha, dashed] of [
      [rings.requirement, 0.18, false],
      [rings.homeWatch, 0.12, true],
    ] as const) {
      context.beginPath();
      context.arc(centre.x, centre.y, ring, 0, Math.PI * 2);
      context.strokeStyle = `rgba(94,220,255,${alpha})`;
      context.lineWidth = pixels(paint, 1);
      if (dashed) context.setLineDash([pixels(paint, 2), pixels(paint, 8)]);
      context.stroke();
      context.setLineDash([]);
    }

    // Atmosphere
    const atmosphere = context.createRadialGradient(
      centre.x,
      centre.y,
      radius * 0.9,
      centre.x,
      centre.y,
      radius * 1.9,
    );
    atmosphere.addColorStop(0, "rgba(120,190,255,0.45)");
    atmosphere.addColorStop(1, "rgba(120,190,255,0)");
    context.fillStyle = atmosphere;
    context.beginPath();
    context.arc(centre.x, centre.y, radius * 1.9, 0, Math.PI * 2);
    context.fill();

    // Ocean, continents, then the night side
    context.save();
    context.beginPath();
    context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    context.clip();
    const ocean = context.createRadialGradient(
      centre.x - radius * 0.35,
      centre.y - radius * 0.35,
      radius * 0.1,
      centre.x,
      centre.y,
      radius,
    );
    ocean.addColorStop(0, "#4fa3e0");
    ocean.addColorStop(1, "#123a6b");
    context.fillStyle = ocean;
    context.fillRect(
      centre.x - radius,
      centre.y - radius,
      radius * 2,
      radius * 2,
    );
    const spin = reducedMotion ? 0 : time * 0.06;
    context.fillStyle = "#4f9a5c";
    for (const land of continents) {
      const along = Math.cos(land.angle + spin) * land.distance;
      const x = centre.x + along * radius * 1.4;
      const y = centre.y + Math.sin(land.angle) * land.distance * radius;
      const visible = Math.cos(land.angle + spin);
      if (visible < -0.2) continue;
      context.beginPath();
      context.ellipse(
        x,
        y,
        land.size * radius * land.stretch * Math.max(0.3, visible),
        land.size * radius,
        land.angle,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.fillStyle = "rgba(255,255,255,0.35)";
    context.beginPath();
    context.ellipse(
      centre.x,
      centre.y - radius * 0.93,
      radius * 0.45,
      radius * 0.12,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    const night = context.createLinearGradient(
      centre.x - radius,
      centre.y,
      centre.x + radius,
      centre.y,
    );
    night.addColorStop(0.45, "rgba(2,6,14,0)");
    night.addColorStop(1, "rgba(2,6,14,0.78)");
    context.fillStyle = night;
    context.fillRect(
      centre.x - radius,
      centre.y - radius,
      radius * 2,
      radius * 2,
    );
    context.restore();

    context.strokeStyle = "rgba(160,220,255,0.6)";
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    context.stroke();

    label(
      paint,
      isFull(paint)
        ? `[ ${astronomerVocabulary.homeName.toUpperCase()} ]`
        : astronomerVocabulary.homeName.toUpperCase(),
      centre.x,
      centre.y + radius + pixels(paint, 16),
      {
        size: isFull(paint)
          ? Math.max(10, Math.min(14, (14 * paint.camera.scale) / 0.4))
          : 9.5,
        font: type.display,
        colour: palette.accent,
        align: "center",
        letterSpacing: isFull(paint) ? 2.5 : 1,
      },
    );
    if (isFull(paint)) {
      label(
        paint,
        `HOME · ${home.name.toUpperCase()}`,
        centre.x,
        centre.y + radius + pixels(paint, 32),
        {
          size: 9.5,
          font: type.mono,
          colour: palette.mute,
          align: "center",
          letterSpacing: 1.2,
        },
      );
    }
  },

  client(paint, client) {
    const { context } = paint;
    const centre = paint.scene.layout.clients.get(client.id);
    if (!centre) return;
    const probes = paint.scene.dataset.agents.filter(
      (agent) =>
        paint.scene.dataset.groups.find((group) => group.id === agent.groupId)
          ?.clientId === client.id,
    ).length;

    const glow = context.createRadialGradient(
      centre.x,
      centre.y,
      0,
      centre.x,
      centre.y,
      90,
    );
    glow.addColorStop(0, "rgba(255,236,190,0.95)");
    glow.addColorStop(0.12, "rgba(255,200,120,0.55)");
    glow.addColorStop(0.4, "rgba(255,140,60,0.08)");
    glow.addColorStop(1, "rgba(255,140,60,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(centre.x, centre.y, 90, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff4dc";
    context.beginPath();
    context.arc(centre.x, centre.y, 9, 0, Math.PI * 2);
    context.fill();

    for (const [ring, alpha, dashed] of [
      [rings.requirement, 0.2, false],
      [rings.watch, 0.1, true],
    ] as const) {
      context.beginPath();
      context.arc(centre.x, centre.y, ring, 0, Math.PI * 2);
      context.strokeStyle = `rgba(94,220,255,${alpha})`;
      context.lineWidth = pixels(paint, 1);
      if (dashed) context.setLineDash([pixels(paint, 3), pixels(paint, 6)]);
      context.stroke();
      context.setLineDash([]);
    }
    context.strokeStyle = "rgba(94,220,255,0.18)";
    for (let tick = 0; tick < 72; tick++) {
      const angle = (tick / 72) * Math.PI * 2;
      const length = tick % 6 ? 6 : 14;
      context.beginPath();
      context.moveTo(
        centre.x + Math.cos(angle) * rings.watch,
        centre.y + Math.sin(angle) * rings.watch,
      );
      context.lineTo(
        centre.x + Math.cos(angle) * (rings.watch + length),
        centre.y + Math.sin(angle) * (rings.watch + length),
      );
      context.stroke();
    }

    const index =
      paint.scene.dataset.clients
        .filter((candidate) => candidate.home !== true)
        .indexOf(client) + 1;
    label(
      paint,
      isFull(paint)
        ? `[ ${client.name.toUpperCase()} ]`
        : client.name.toUpperCase(),
      centre.x,
      centre.y - (isFull(paint) ? 360 : 250),
      {
        size: isFull(paint)
          ? Math.max(10, Math.min(15, (15 * paint.camera.scale) / 0.4))
          : 9.5,
        font: type.display,
        colour: palette.ink,
        align: "center",
        letterSpacing: isFull(paint) ? 2.5 : 1,
      },
    );
    if (isFull(paint)) {
      label(
        paint,
        `SYS-${String(index).padStart(2, "0")} · ${probes} ${probes === 1 ? "PROBE" : "PROBES"}`,
        centre.x,
        centre.y - 360 + pixels(paint, 17),
        {
          size: 9.5,
          font: type.mono,
          colour: palette.mute,
          align: "center",
          letterSpacing: 1.2,
        },
      );
    }
  },

  requirement(paint, requirement) {
    const { context } = paint;
    const point = paint.scene.layout.fixed.get(requirement.id);
    if (!point) return;
    const done = requirement.state === "done";
    context.beginPath();
    context.arc(point.x, point.y, rings.orbit, 0, Math.PI * 2);
    context.strokeStyle = "rgba(94,220,255,0.12)";
    context.lineWidth = pixels(paint, 1);
    context.stroke();
    const shade = context.createRadialGradient(
      point.x - 5,
      point.y - 5,
      1,
      point.x,
      point.y,
      16,
    );
    shade.addColorStop(0, done ? "#6f8ea3" : "#bde8ff");
    shade.addColorStop(1, done ? "#1b2633" : "#1c4f7a");
    context.fillStyle = shade;
    context.beginPath();
    context.arc(point.x, point.y, 15, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(189,232,255,0.5)";
    context.stroke();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(paint, requirement.title.toUpperCase(), point.x, point.y + 22, {
        size: 9.5,
        font: type.mono,
        colour: done ? "#4f6474" : "#9fd6ef",
        align: "center",
        baseline: "top",
        letterSpacing: 0.6,
      });
    }
  },

  workstream(paint, marker) {
    const { context } = paint;
    const { x, y } = marker.position;
    const unsorted = marker.workstreamId === null;
    // A space station: a ring on four spokes, with a panel either side.
    // Work with no workstream gathers at a bare, dashed ring instead.
    context.save();
    context.translate(x, y);
    context.strokeStyle = unsorted ? "rgba(159,214,239,0.6)" : "#9fd6ef";
    context.lineWidth = pixels(paint, 1.4);
    if (unsorted) context.setLineDash([pixels(paint, 3), pixels(paint, 3)]);
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    if (!unsorted) {
      context.beginPath();
      for (let spoke = 0; spoke < 4; spoke++) {
        const angle = Math.PI / 4 + (spoke * Math.PI) / 2;
        context.moveTo(Math.cos(angle) * 3, Math.sin(angle) * 3);
        context.lineTo(Math.cos(angle) * 11, Math.sin(angle) * 11);
      }
      context.moveTo(-11, 0);
      context.lineTo(-16, 0);
      context.moveTo(11, 0);
      context.lineTo(16, 0);
      context.stroke();
      context.fillStyle = "rgba(94,220,255,0.35)";
      context.fillRect(-25, -5, 9, 10);
      context.fillRect(16, -5, 9, 10);
      context.strokeRect(-25, -5, 9, 10);
      context.strokeRect(16, -5, 9, 10);
      context.fillStyle = "#e5fbff";
      context.beginPath();
      context.arc(0, 0, 2.6, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(
        paint,
        workstreamCaption(marker).toUpperCase(),
        x,
        y - workstreamCaptionRise,
        {
          size: 9.5,
          font: type.mono,
          colour: "#bde8ff",
          align: "center",
          baseline: "bottom",
          letterSpacing: 0.6,
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
    context.strokeStyle = "rgba(94,220,255,0.12)";
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  },

  item(paint, item) {
    const { context, scene } = paint;
    const point = itemPosition(scene.layout, item);
    if (!item.requirementId) {
      const centre = scene.layout.clients.get(item.clientId);
      if (centre) {
        context.strokeStyle = "rgba(94,220,255,0.07)";
        context.lineWidth = pixels(paint, 1);
        context.beginPath();
        context.moveTo(centre.x, centre.y);
        context.lineTo(point.x, point.y);
        context.stroke();
      }
    }
    context.globalAlpha = item.state === "done" ? 0.45 : 1;
    context.fillStyle =
      item.state === "review"
        ? "#a7f3ff"
        : item.state === "todo"
          ? "#557a92"
          : "#e5fbff";
    context.beginPath();
    context.arc(
      point.x,
      point.y,
      item.priority === "high" ? 6.5 : 5,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.globalAlpha = 1;
    if (item.priority === "high") {
      context.strokeStyle = palette.status.blocked;
      context.lineWidth = pixels(paint, 1.2);
      context.beginPath();
      context.arc(point.x, point.y, 10, 0, Math.PI * 2);
      context.stroke();
    }
    if (isFull(paint) && paint.camera.scale > labelScale.item) {
      label(paint, item.title, point.x + 12, point.y, {
        size: 10,
        font: type.mono,
        colour: "#8fb4c8",
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
    const centre = scene.layout.clients.get(question.clientId) ?? {
      x: 0,
      y: 0,
    };
    const angle = Math.atan2(point.y - centre.y, point.x - centre.x);
    const across = angle + Math.PI / 2;
    const tail = 70;
    context.save();
    context.globalAlpha = fade;
    const gradient = context.createLinearGradient(
      point.x,
      point.y,
      point.x + Math.cos(angle) * tail,
      point.y + Math.sin(angle) * tail,
    );
    gradient.addColorStop(0, "rgba(255,200,120,0.75)");
    gradient.addColorStop(1, "rgba(255,200,120,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(
      point.x + Math.cos(across) * 6,
      point.y + Math.sin(across) * 6,
    );
    context.lineTo(
      point.x + Math.cos(angle) * tail + Math.cos(across) * 18,
      point.y + Math.sin(angle) * tail + Math.sin(across) * 18,
    );
    context.lineTo(
      point.x + Math.cos(angle) * tail - Math.cos(across) * 18,
      point.y + Math.sin(angle) * tail - Math.sin(across) * 18,
    );
    context.lineTo(
      point.x - Math.cos(across) * 6,
      point.y - Math.sin(across) * 6,
    );
    context.fill();
    context.fillStyle = "#fff1d6";
    context.beginPath();
    context.arc(point.x, point.y, 5, 0, Math.PI * 2);
    context.fill();
    if (question.asks === "You") {
      const phase = pulsePhase(paint, 1.2);
      context.strokeStyle = withAlpha(palette.status.waiting, 1 - phase);
      context.lineWidth = pixels(paint, 1.5);
      context.beginPath();
      context.arc(point.x, point.y, 10 + phase * 14, 0, Math.PI * 2);
      context.stroke();
    }
    const blocked = scene.dataset.items.find(
      (item) => item.id === question.blocks,
    );
    if (blocked) {
      const to = itemPosition(scene.layout, blocked);
      context.setLineDash([pixels(paint, 2), pixels(paint, 4)]);
      context.strokeStyle = withAlpha(palette.status.waiting, 0.5);
      context.lineWidth = pixels(paint, 1);
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.setLineDash([]);
    }
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(
        paint,
        `? ${question.title}`,
        point.x - pixels(paint, 8),
        point.y - pixels(paint, 14),
        {
          size: 10,
          font: type.mono,
          colour: "#ffcf8a",
          align: "right",
        },
      );
    }
    context.restore();
  },

  decision(paint, decision, appear) {
    const { context, scene } = paint;
    const point = decisionPosition(scene.layout, scene.dataset, decision);
    context.save();
    context.globalAlpha = appear;
    const size = 7 + (appear < 1 ? (1 - appear) * 30 : 0);
    context.fillStyle = decision.state === "made" ? "#e9f9ff" : "#7f9db1";
    context.beginPath();
    for (let corner = 0; corner < 8; corner++) {
      const radius = corner % 2 ? size * 0.28 : size;
      const angle = (corner / 8) * Math.PI * 2 - Math.PI / 2;
      context.lineTo(
        point.x + Math.cos(angle) * radius,
        point.y + Math.sin(angle) * radius,
      );
    }
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(233,249,255,0.35)";
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.arc(point.x, point.y, 13, 0, Math.PI * 2);
    context.stroke();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(
        paint,
        `CHARTED · ${decision.title.toUpperCase()}`,
        point.x + 16,
        point.y,
        {
          size: 9,
          font: type.mono,
          colour: "#bfe3f1",
          letterSpacing: 0.6,
        },
      );
    }
    context.restore();
  },

  agent(paint, agent, motion, colour) {
    const { context } = paint;
    const { position, heading, trail } = motion;
    if (trail.length > 2) {
      context.lineWidth = pixels(paint, 1.4);
      for (let index = 1; index < trail.length; index++) {
        const from = trail[index - 1];
        const to = trail[index];
        if (!from || !to) continue;
        context.strokeStyle = withAlpha(
          colour,
          (1 - index / trail.length) * 0.55,
        );
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }
    }
    const size =
      pixels(paint, isFull(paint) ? 7 : 5) *
      Math.max(1, paint.camera.scale * 1.6);
    context.save();
    context.translate(position.x, position.y);
    context.rotate(heading + Math.PI / 2);
    context.fillStyle = colour;
    context.beginPath();
    context.moveTo(0, -size * 1.4);
    context.lineTo(size, size);
    context.lineTo(0, size * 0.45);
    context.lineTo(-size, size);
    context.closePath();
    context.fill();
    context.restore();

    if (paint.scene.needsAttention(agent)) {
      const phase = pulsePhase(
        paint,
        1.1,
        paint.scene.dataset.agents.indexOf(agent) * 0.3,
      );
      context.strokeStyle = withAlpha(colour, 1 - phase);
      context.lineWidth = pixels(paint, 1.5);
      context.beginPath();
      context.arc(
        position.x,
        position.y,
        pixels(paint, 10) + phase * pixels(paint, 18),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    if (!isFull(paint)) return;
    context.strokeStyle = withAlpha(colour, 0.6);
    context.lineWidth = pixels(paint, 1);
    const bracket = pixels(paint, 12);
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      context.beginPath();
      context.moveTo(
        position.x + sx * bracket,
        position.y + sy * bracket * 0.5,
      );
      context.lineTo(position.x + sx * bracket, position.y + sy * bracket);
      context.lineTo(
        position.x + sx * bracket * 0.5,
        position.y + sy * bracket,
      );
      context.stroke();
    }
    label(
      paint,
      agent.name.toUpperCase(),
      position.x + pixels(paint, 16),
      position.y - pixels(paint, 9),
      {
        size: 10,
        font: type.display,
        colour,
        letterSpacing: 1.2,
      },
    );
    if (paint.camera.scale > labelScale.agentStatus) {
      label(
        paint,
        astronomerStatusNames[agent.status].toUpperCase(),
        position.x + pixels(paint, 16),
        position.y + pixels(paint, 4),
        {
          size: 8.5,
          font: type.mono,
          colour: palette.mute,
          letterSpacing: 0.8,
        },
      );
    }
  },

  effect(paint, effect, progress) {
    const { context, scene, reducedMotion } = paint;
    const fadeOut = Math.min(1, (1 - progress) * 2);
    if (effect.kind === "message") {
      const from = scene.motions.get(effect.from)?.position;
      const to = scene.motions.get(effect.to)?.position;
      if (!from || !to) return;
      const curve = curveBetween(from, to, 0.18);
      context.strokeStyle = `rgba(94,220,255,${(1 - progress) * 0.7})`;
      context.lineWidth = pixels(paint, 1.2);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.quadraticCurveTo(curve.control.x, curve.control.y, to.x, to.y);
      context.stroke();
      const packet = curve.at(reducedMotion ? 1 : Math.min(1, progress * 1.6));
      context.fillStyle = "#ffffff";
      context.shadowColor = palette.accent;
      context.shadowBlur = 12;
      context.beginPath();
      context.arc(packet.x, packet.y, pixels(paint, 3.5), 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      if (isFull(paint)) {
        label(paint, effect.text, curve.control.x, curve.control.y, {
          size: 10,
          font: type.mono,
          colour: "#bfefff",
          align: "center",
          alpha: fadeOut,
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
      const travel = reducedMotion ? 1 : Math.min(1, progress * 1.5);
      const head = {
        x: start.x + (point.x - start.x) * travel,
        y: start.y + (point.y - start.y) * travel,
      };
      const beam = context.createLinearGradient(
        start.x,
        start.y,
        head.x,
        head.y,
      );
      beam.addColorStop(0, "rgba(255,179,64,0)");
      beam.addColorStop(1, `rgba(255,179,64,${(1 - progress) * 0.9})`);
      context.strokeStyle = beam;
      context.lineWidth = pixels(paint, 1.6);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(head.x, head.y);
      context.stroke();
      if (travel >= 1) {
        context.strokeStyle = `rgba(255,179,64,${1 - progress})`;
        context.beginPath();
        context.arc(
          point.x,
          point.y,
          Math.max(0, (progress - 0.66) * 3) * pixels(paint, 40),
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      if (isFull(paint)) {
        label(
          paint,
          `INBOUND // ${externalSourceNames[effect.source].toUpperCase()} :: ${effect.text}`,
          head.x + pixels(paint, 10),
          head.y - pixels(paint, 12),
          {
            size: 10,
            font: type.mono,
            colour: "#ffcf8a",
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
        pixels(paint, 8) + progress * pixels(paint, 40),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  },
};
