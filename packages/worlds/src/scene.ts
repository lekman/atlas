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
  /** Radians. The direction of travel, or towards the task once beside it. */
  heading: number;
  /** Most recent first. Empty under reduced motion. */
  trail: Point[];
  /**
   * The task the agent is beside or flying to, and whether it has arrived.
   * Null when the agent has no task on the map, or its status keeps it
   * elsewhere (watching, idle).
   */
  work: WorkState | null;
}

/** Where an agent works a task, and the spot beside it where it holds. */
export interface WorkTarget {
  itemId: string;
  /** Where the task is drawn. */
  task: Point;
  /** Where the agent holds while it works the task, before any hover. */
  spot: Point;
}

export interface WorkState extends WorkTarget {
  /** True once the agent holds at its spot; painters draw the work then. */
  arrived: boolean;
}

/** How a body moves towards a target; an agent and a smaller vessel alike. */
export interface MotionOptions {
  /** How quickly the body closes on its target, per second. */
  rate: number;
  reducedMotion: boolean;
  /** Turn to face this point once at the work spot, if given. */
  work?: WorkTarget | null;
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

/** Seconds an agent with several tasks works each one before moving on. */
export const taskDwellSeconds = 20;

/**
 * How far from its task an agent holds, in world units. It is far enough
 * to clear the task and the agent's own nose, so the work between them
 * shows at overview zoom.
 */
export const workingDistance = 70;

/** How close to its spot an agent must be to count as arrived. */
export const arrivalDistance = 8;

/** How far a working agent drifts about its spot. None under reduced motion. */
export const hoverAmplitude = 2.5;

/**
 * The angle, from the horizontal, at which an agent sits from its task.
 * Every world writes a task's label to its right, along its row, and puts
 * the workstream marker, its caption and any open question to its left. So
 * the agent sits to the right, tipped well above or below the row, which
 * keeps it clear of the label and of the marker's caption.
 */
const workingAngle = (55 * Math.PI) / 180;

/**
 * The task an agent works at `time`, as an item id. A running agent with
 * several tasks works each for `taskDwellSeconds`, then the next, round and
 * round. Any other status, and reduced motion, keep it at the first.
 */
export function currentTask(
  agent: Pick<Agent, "status" | "workingOn">,
  time: number,
  reducedMotion: boolean,
): string | null {
  const { workingOn } = agent;
  if (workingOn.length === 0) return null;
  if (agent.status !== "running" || reducedMotion || workingOn.length === 1)
    return workingOn[0] ?? null;
  const turn = Math.floor(Math.max(0, time) / taskDwellSeconds);
  return workingOn[turn % workingOn.length] ?? null;
}

/**
 * The spot beside a task where an agent holds. It is to the right of the
 * task, above its row when the task is in the upper half of its client and
 * below it in the lower half, so the agent stays on the side away from the
 * client's centre. `slot` gives a second agent at the same task the other
 * side of the row, and a third and fourth spots further out.
 */
export function workingSpot(
  task: Point,
  centre: Point,
  slot = 0,
  distance = workingDistance,
): Point {
  const away = task.y > centre.y ? 1 : -1;
  const side = slot % 2 === 0 ? away : -away;
  const reach = distance * (1 + Math.floor(slot / 2) * 0.45);
  return {
    x: task.x + Math.cos(workingAngle) * reach,
    y: task.y + side * Math.sin(workingAngle) * reach,
  };
}

/**
 * One step of a body easing towards its target: position, heading and
 * trail. Shared by every agent, and meant for anything else that flies to
 * a task and works it.
 */
export function advanceMotion(
  motion: Motion,
  target: Point,
  seconds: number,
  options: MotionOptions,
): void {
  const blend = Math.min(1, seconds * options.rate);
  const next = {
    x: motion.position.x + (target.x - motion.position.x) * blend,
    y: motion.position.y + (target.y - motion.position.y) * blend,
  };
  const dx = next.x - motion.position.x;
  const dy = next.y - motion.position.y;
  motion.position = next;
  const work = options.work ?? null;
  const arrived =
    work !== null &&
    Math.hypot(next.x - work.spot.x, next.y - work.spot.y) <=
      arrivalDistance + hoverAmplitude;
  motion.work = work ? { ...work, arrived } : null;
  if (work && arrived) {
    const facing = Math.atan2(work.task.y - next.y, work.task.x - next.x);
    motion.heading = options.reducedMotion
      ? facing
      : turnTowards(motion.heading, facing, Math.min(1, seconds * 5));
  } else if (Math.hypot(dx, dy) > 0.05) {
    motion.heading = Math.atan2(dy, dx);
  }
  if (options.reducedMotion) motion.trail = [];
  else {
    motion.trail.unshift(next);
    if (motion.trail.length > trailLength) motion.trail.pop();
  }
}

/** An angle turned part of the shortest way towards another. */
function turnTowards(from: number, to: number, share: number): number {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + difference * share;
}

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
      const work = this.holdsAtWork(agent)
        ? this.workTarget(agent, time, reducedMotion)
        : null;
      const motion = this.motions.get(agent.id);
      if (!motion) {
        this.motions.set(agent.id, {
          position: target,
          heading: work
            ? Math.atan2(work.task.y - target.y, work.task.x - target.x)
            : -Math.PI / 2,
          trail: [],
          work: work ? { ...work, arrived: true } : null,
        });
        continue;
      }
      advanceMotion(motion, target, seconds, {
        rate: agent.status === "running" ? 3 : 2.2,
        reducedMotion,
        work,
      });
    }
  }

  /**
   * Where an agent works its current task: the task and the spot beside
   * it. Null when the agent has no task. Agents sharing a task each get a
   * spot of their own, running agents first and then in the order the
   * dataset lists them.
   */
  workTarget(
    agent: Pick<Agent, "id" | "status" | "workingOn">,
    time: number,
    reducedMotion: boolean,
    distance = workingDistance,
  ): WorkTarget | null {
    const itemId = currentTask(agent, time, reducedMotion);
    const item = this.dataset.items.find(
      (candidate) => candidate.id === itemId,
    );
    if (!itemId || !item) return null;
    const task = itemPosition(this.layout, item);
    const centre = this.layout.clients.get(item.clientId) ?? { x: 0, y: 0 };
    // Every agent that works this task keeps its spot here while it is
    // away at another, so no agent moves because a neighbour did. Running
    // agents take the first spots, so a beam or a line never has to cross a
    // neighbour's label to reach the task.
    const sharing = this.dataset.agents
      .filter(
        (other) => this.holdsAtWork(other) && other.workingOn.includes(itemId),
      )
      .sort(
        (left, right) =>
          Number(right.status === "running") -
          Number(left.status === "running"),
      );
    const slot = Math.max(
      0,
      sharing.findIndex((other) => other.id === agent.id),
    );
    return { itemId, task, spot: workingSpot(task, centre, slot, distance) };
  }

  /** Whether this status puts an agent beside its task. */
  holdsAtWork(agent: Pick<Agent, "status">): boolean {
    return (
      agent.status === "running" ||
      agent.status === "waiting" ||
      agent.status === "blocked" ||
      agent.status === "error"
    );
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
    const work = this.holdsAtWork(agent)
      ? this.workTarget(agent, time, reducedMotion)
      : null;

    switch (agent.status) {
      case "running": {
        if (!work)
          return polar(centre, time * (reducedMotion ? 0 : 0.25) + phase, 150);
        if (reducedMotion) return work.spot;
        return {
          x: work.spot.x + Math.cos(time * 0.8 + phase) * hoverAmplitude,
          y: work.spot.y + Math.sin(time * 1.3 + phase) * hoverAmplitude,
        };
      }
      case "watching":
        return polar(
          centre,
          time * (reducedMotion ? 0 : 0.12) + phase,
          isHome ? rings.homeWatch : rings.watch,
        );
      case "waiting":
        return work ? work.spot : { x: centre.x + 40, y: centre.y - 40 };
      case "blocked":
      case "error":
        return work ? work.spot : { x: centre.x + 40, y: centre.y + 40 };
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
