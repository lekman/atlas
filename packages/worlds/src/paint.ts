/**
 * The drawing order every world shares, the hit targets it leaves behind for
 * pointer input, and the small helpers painters use.
 */
import { clientOfAgent } from "@atlas/core";

import { worldToScreen, type Point } from "./camera";
import { decisionPosition, itemPosition, questionPosition } from "./layout";
import type { PaintContext, World } from "./types";

export interface HitTarget {
  id: string;
  /** Screen position, in CSS pixels. */
  x: number;
  y: number;
  /** Screen radius, in CSS pixels, before the pointer allowance. */
  radius: number;
  agent: boolean;
}

/** Draw the whole scene and return what can be tapped, topmost last. */
export function paintScene(paint: PaintContext, world: World): HitTarget[] {
  const { scene, time, reducedMotion, camera } = paint;
  const { dataset, layout } = scene;
  const painter = world.painter;
  const hits: HitTarget[] = [];
  const hit = (id: string, point: Point, radius: number, agent = false) => {
    const screen = worldToScreen(camera, point);
    hits.push({
      id,
      x: screen.x,
      y: screen.y,
      radius: radius * camera.scale,
      agent,
    });
  };

  painter.background(paint);
  setWorldTransform(paint);

  for (const client of dataset.clients) {
    if (client.home === true) painter.home(paint, client);
    else painter.client(paint, client);
  }
  for (const item of dataset.items)
    if (item.requirementId) painter.link(paint, item);
  for (const requirement of dataset.requirements) {
    painter.requirement(paint, requirement);
    const point = layout.fixed.get(requirement.id);
    if (point) hit(requirement.id, point, 18);
  }
  for (const decision of dataset.decisions) {
    const appearedAt = scene.decidedAt.get(decision.id);
    const appear =
      appearedAt === undefined ? 1 : Math.min(1, (time - appearedAt) / 1.3);
    painter.decision(paint, decision, appear);
    hit(decision.id, decisionPosition(layout, dataset, decision), 14);
  }
  for (const item of dataset.items) {
    painter.item(paint, item);
    hit(item.id, itemPosition(layout, item, time, reducedMotion), 12);
  }
  for (const question of dataset.questions) {
    const answeredAt = scene.answeredAt.get(question.id);
    if (question.state === "answered" && answeredAt === undefined) continue;
    const fade =
      answeredAt === undefined ? 1 : Math.max(0, 1 - (time - answeredAt) / 2.3);
    if (fade <= 0) continue;
    painter.question(paint, question, fade);
    if (question.state === "open")
      hit(
        question.id,
        questionPosition(layout, dataset, question, time, reducedMotion),
        18,
      );
  }
  for (const agent of dataset.agents) {
    const motion = scene.motions.get(agent.id);
    if (!motion) continue;
    painter.agent(paint, agent, motion, world.palette.status[agent.status]);
    hit(agent.id, motion.position, 16, true);
  }
  for (const { effect, progress } of scene.activeEffects(time))
    painter.effect(paint, effect, progress);

  if (paint.selectedId) {
    const selected = hits.find((target) => target.id === paint.selectedId);
    if (selected) drawSelection(paint, selected, world.palette.accent);
  }
  if (painter.overlay) {
    setScreenTransform(paint);
    painter.overlay(paint);
  }
  return hits;
}

/** The nearest target within reach of a screen point, or null. */
export function hitTest(
  hits: HitTarget[],
  x: number,
  y: number,
): HitTarget | null {
  let best: HitTarget | null = null;
  let bestDistance = Infinity;
  for (const target of hits) {
    const distance = Math.hypot(target.x - x, target.y - y);
    const reach = Math.max(14, target.radius) + (target.agent ? 8 : 4);
    if (distance < reach && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

export function setWorldTransform(paint: PaintContext): void {
  const { context, camera, pixelRatio } = paint;
  context.setTransform(
    camera.scale * pixelRatio,
    0,
    0,
    camera.scale * pixelRatio,
    camera.x * pixelRatio,
    camera.y * pixelRatio,
  );
}

export function setScreenTransform(paint: PaintContext): void {
  paint.context.setTransform(paint.pixelRatio, 0, 0, paint.pixelRatio, 0, 0);
}

/** Screen pixels as world units at the current zoom. */
export function pixels(paint: PaintContext, value: number): number {
  return value / paint.camera.scale;
}

export interface LabelOptions {
  /** Size in screen pixels; stays the same at every zoom. */
  size?: number;
  font: string;
  colour: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  alpha?: number;
  letterSpacing?: number;
  italic?: boolean;
}

export function label(
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
  context.fillStyle = options.colour;
  context.textAlign = options.align ?? "left";
  context.textBaseline = options.baseline ?? "middle";
  if (options.letterSpacing && "letterSpacing" in context) {
    (
      context as CanvasRenderingContext2D & { letterSpacing: string }
    ).letterSpacing = `${pixels(paint, options.letterSpacing)}px`;
  }
  context.fillText(text, x, y);
  context.restore();
}

/** `#rrggbb` with an alpha, as `rgba()`. */
export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${clamped})`;
}

/** A point on a quadratic curve that bows to one side of a straight line. */
export function curveBetween(
  from: Point,
  to: Point,
  bow: number,
): { control: Point; at: (t: number) => Point } {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const control = {
    x: (from.x + to.x) / 2 - ((to.y - from.y) / length) * length * bow,
    y: (from.y + to.y) / 2 + ((to.x - from.x) / length) * length * bow,
  };
  return {
    control,
    at: (t) => ({
      x:
        (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * control.x + t * t * to.x,
      y:
        (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * control.y + t * t * to.y,
    }),
  };
}

/** Labels for work appear only when zoomed in far enough to read them. */
export const labelScale = {
  requirement: 0.6,
  item: 1.05,
  agentStatus: 0.7,
} as const;

/** The repeating 0 → 1 phase of a pulse ring, held still under reduced motion. */
export function pulsePhase(
  paint: PaintContext,
  rate: number,
  offset = 0,
): number {
  return paint.reducedMotion ? 0.5 : (paint.time * rate + offset) % 1;
}

function drawSelection(paint: PaintContext, target: HitTarget, colour: string) {
  const { context } = paint;
  setScreenTransform(paint);
  context.save();
  context.strokeStyle = colour;
  context.lineWidth = 1.5;
  context.setLineDash([4, 3]);
  context.beginPath();
  context.arc(target.x, target.y, 22, 0, Math.PI * 2);
  context.stroke();
  context.restore();
  setWorldTransform(paint);
}

export function clientIdOfAgent(
  paint: PaintContext,
  agentId: string,
): string | null {
  const agent = paint.scene.dataset.agents.find(
    (candidate) => candidate.id === agentId,
  );
  return agent ? clientOfAgent(paint.scene.dataset, agent) : null;
}
