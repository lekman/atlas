/**
 * The live state of a map: the dataset, where everything is, how agents are
 * moving, and the effects events have set off. A world's painter reads a
 * scene; it never changes one.
 */
import {
  applyEvent,
  attentionStatuses,
  clientOfAgent,
  type Agent,
  type AtlasEvent,
  type Dataset,
  type ExternalSource,
} from "@atlas/core";

import type { Point } from "./camera";
import {
  computeLayout,
  itemPosition,
  polar,
  rings,
  type Layout,
  type Orientation,
} from "./layout";

export interface Motion {
  position: Point;
  /** Radians. Drawn as the direction of travel. */
  heading: number;
  /** Most recent first. Empty under reduced motion. */
  trail: Point[];
}

export type Effect =
  | {
      kind: "message";
      from: string;
      to: string;
      text: string;
      start: number;
      duration: number;
    }
  | {
      kind: "external";
      recordId: string;
      source: ExternalSource;
      text: string;
      start: number;
      duration: number;
    }
  | { kind: "ring"; agentId: string; start: number; duration: number };

const trailLength = 40;

export class Scene {
  dataset: Dataset;
  layout: Layout;
  readonly motions = new Map<string, Motion>();
  effects: Effect[] = [];
  /** When each question was answered, for the fade. */
  readonly answeredAt = new Map<string, number>();
  /** When each decision appeared, for the flare. */
  readonly decidedAt = new Map<string, number>();

  constructor(dataset: Dataset, orientation: Orientation = "landscape") {
    this.dataset = dataset;
    this.layout = computeLayout(dataset, orientation);
  }

  setOrientation(orientation: Orientation): void {
    if (orientation === this.layout.orientation) return;
    this.layout = computeLayout(this.dataset, orientation);
    this.motions.clear();
  }

  /** Start over from a dataset, keeping the orientation. */
  reset(dataset: Dataset): void {
    this.dataset = dataset;
    this.layout = computeLayout(dataset, this.layout.orientation);
    this.motions.clear();
    this.effects = [];
    this.answeredAt.clear();
    this.decidedAt.clear();
  }

  apply(event: AtlasEvent, now: number): void {
    this.dataset = applyEvent(this.dataset, event);
    switch (event.type) {
      case "agent-message":
        this.effects.push({
          kind: "message",
          from: event.from,
          to: event.to,
          text: event.text,
          start: now,
          duration: 1.8,
        });
        break;
      case "external":
        this.effects.push({
          kind: "external",
          recordId: event.recordId,
          source: event.source,
          text: event.text,
          start: now,
          duration: 2.6,
        });
        break;
      case "status-change":
        this.effects.push({
          kind: "ring",
          agentId: event.agentId,
          start: now,
          duration: 1.4,
        });
        break;
      case "question-answered":
        this.answeredAt.set(event.questionId, now);
        this.decidedAt.set(event.decision.id, now);
        break;
    }
  }

  /** Effects still running at `now`, with their progress from 0 to 1. */
  activeEffects(now: number): Array<{ effect: Effect; progress: number }> {
    this.effects = this.effects.filter(
      (effect) => now - effect.start <= effect.duration,
    );
    return this.effects.map((effect) => ({
      effect,
      progress: Math.max(0, (now - effect.start) / effect.duration),
    }));
  }

  /** Move every agent a step towards where its status puts it. */
  step(time: number, seconds: number, reducedMotion: boolean): void {
    for (const agent of this.dataset.agents) {
      const target = this.agentTarget(agent, time, reducedMotion);
      const motion = this.motions.get(agent.id);
      if (!motion) {
        this.motions.set(agent.id, {
          position: target,
          heading: -Math.PI / 2,
          trail: [],
        });
        continue;
      }
      const rate = agent.status === "running" ? 6 : 2.2;
      const blend = Math.min(1, seconds * rate);
      const next = {
        x: motion.position.x + (target.x - motion.position.x) * blend,
        y: motion.position.y + (target.y - motion.position.y) * blend,
      };
      const dx = next.x - motion.position.x;
      const dy = next.y - motion.position.y;
      if (Math.hypot(dx, dy) > 0.05) motion.heading = Math.atan2(dy, dx);
      motion.position = next;
      if (reducedMotion) motion.trail = [];
      else {
        motion.trail.unshift(next);
        if (motion.trail.length > trailLength) motion.trail.pop();
      }
    }
  }

  /** Where the agent's status puts it, before easing. */
  agentTarget(agent: Agent, time: number, reducedMotion: boolean): Point {
    const clientId = clientOfAgent(this.dataset, agent);
    const centre = this.layout.clients.get(clientId) ?? { x: 0, y: 0 };
    const isHome =
      this.dataset.clients.find((client) => client.id === clientId)?.home ===
      true;
    const index = this.dataset.agents.indexOf(agent);
    const phase = index * 1.7;
    const firstItem = this.dataset.items.find(
      (item) => item.id === agent.workingOn[0],
    );
    const near = firstItem ? itemPosition(this.layout, firstItem) : null;

    switch (agent.status) {
      case "running": {
        const speed = reducedMotion ? 0 : 0.9;
        return near
          ? polar(near, time * speed + phase, 34)
          : polar(centre, time * (reducedMotion ? 0 : 0.25) + phase, 150);
      }
      case "watching":
        return polar(
          centre,
          time * (reducedMotion ? 0 : 0.12) + phase,
          isHome ? rings.homeWatch : rings.watch,
        );
      case "waiting":
        return near
          ? { x: near.x + 30, y: near.y - 30 }
          : { x: centre.x + 40, y: centre.y - 40 };
      case "blocked":
      case "error":
        return near
          ? { x: near.x + 32, y: near.y + 28 }
          : { x: centre.x + 40, y: centre.y + 40 };
      case "idle": {
        const siblings = this.dataset.agents.filter(
          (candidate) => clientOfAgent(this.dataset, candidate) === clientId,
        );
        return polar(
          centre,
          siblings.indexOf(agent) * 1.25 + 0.4,
          isHome ? 70 : rings.dock,
        );
      }
    }
  }

  needsAttention(agent: Agent): boolean {
    return attentionStatuses.includes(agent.status);
  }
}
