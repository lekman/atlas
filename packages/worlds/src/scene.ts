/**
 * The live state of a map: the dataset, where everything is, how agents are
 * moving, and the effects events have set off. A world's painter reads a
 * scene; it never changes one.
 */
import {
  applyEvent,
  attentionStatuses,
  clientOfAgent,
  isVessel,
  type Agent,
  type AtlasEvent,
  type Dataset,
  type ExternalSource,
} from "@atlas/core";

import type { Point } from "./camera";
import {
  computeLayout,
  itemStep,
  polar,
  rings,
  taskPlace,
  watchRadius,
  type Layout,
  type Orientation,
  type TaskPlace,
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
  /** How close to the spot counts as arrived. `arrivalDistance` when left out. */
  arrivalDistance?: number;
  /** How far the body drifts about its spot. `hoverAmplitude` when left out. */
  hoverAmplitude?: number;
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
 * How large a launch vessel is drawn beside the agent it came from. Small
 * enough to read as a smaller craft, large enough to show its status hue.
 */
export const vesselScale = 0.55;

/** How far a launch vessel drifts about its spot: less than its parent. */
export const vesselHoverAmplitude = 1.5;

/** How close to its spot a launch vessel must be to count as arrived. */
export const vesselArrivalDistance = 5;

/**
 * How far a launch vessel's spot keeps from any spot an agent holds, in
 * world units. Tasks in one workstream sit in rows close together, so the
 * spot beside one task can fall on the spot beside its neighbour.
 */
export const vesselClearance = 40;

/**
 * How far a launch vessel's beam or line keeps from any spot another agent
 * holds, so it never runs through a neighbour on its way to the task. Its
 * own parent's spots do not count: a launch may work in line with its ship.
 */
export const vesselBeamClearance = 12;

/** The distance from a point to the segment between two others. */
function distanceToSegment(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy || 1;
  const along = Math.max(
    0,
    Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length),
  );
  return Math.hypot(
    point.x - (from.x + along * dx),
    point.y - (from.y + along * dy),
  );
}

/**
 * How far from its parent a vessel with no task holds, in world units:
 * close enough to read as part of its parent, clear of the parent's label.
 */
export const vesselStandOff = 26;

/**
 * The angle, from the horizontal, at which an agent sits from its task.
 * Every world writes a task's label outward along its row, and puts the
 * workstream marker and any open question on the inner side. So the agent
 * sits on the label's side, tipped well above or below the row.
 */
const workingAngle = (55 * Math.PI) / 180;

/**
 * How far along its label's side an agent's spot moves for each row it
 * clears, in world units: more than `vesselClearance`, so agents at
 * neighbouring tasks in one group never share a spot.
 */
const workingRowShift = 45;

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
 * The spot beside a task where an agent holds: on the side its label runs,
 * tipped above or below its group, never on another item's label. The
 * agent goes past the nearer end of the group, the end with fewer items
 * between, or away from the client's centre when both are as near. Each
 * row it clears moves the spot further along, so agents at neighbouring
 * tasks keep apart. `slot` gives a second agent at the same task the other
 * end of the group, and a third and fourth spots further out.
 */
export function workingSpot(
  place: TaskPlace,
  slot = 0,
  distance = workingDistance,
): Point {
  const nearer =
    place.above < place.below ? -1 : place.above > place.below ? 1 : place.away;
  const vertical = slot % 2 === 0 ? nearer : -nearer;
  const rows = vertical < 0 ? place.above : place.below;
  const reach = distance * (1 + Math.floor(slot / 2) * 0.45);
  return {
    x:
      place.task.x +
      place.side * (Math.cos(workingAngle) * reach + rows * workingRowShift),
    y:
      place.task.y +
      vertical * (Math.sin(workingAngle) * reach + rows * itemStep),
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
      (options.arrivalDistance ?? arrivalDistance) +
        (options.hoverAmplitude ?? hoverAmplitude);
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

/** A body placed at its target at once, facing its task if it has one. */
function settledMotion(target: Point, work: WorkTarget | null): Motion {
  return {
    position: target,
    heading: work
      ? Math.atan2(work.task.y - target.y, work.task.x - target.x)
      : -Math.PI / 2,
    trail: [],
    work: work ? { ...work, arrived: true } : null,
  };
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
  /**
   * Vessels flying home after their return. Their records are gone from
   * the dataset, so the last one is kept here until the vessel reaches its
   * parent and leaves the map.
   */
  readonly returning = new Map<string, Agent>();

  constructor(dataset: Dataset, orientation: Orientation = "landscape") {
    this.dataset = dataset;
    this.layout = computeLayout(dataset, orientation);
  }

  setOrientation(orientation: Orientation): void {
    if (orientation === this.layout.orientation) return;
    this.layout = computeLayout(this.dataset, orientation);
    this.motions.clear();
    this.returning.clear();
  }

  /** Start over from a dataset, keeping the orientation. */
  reset(dataset: Dataset): void {
    this.dataset = dataset;
    this.layout = computeLayout(dataset, this.layout.orientation);
    this.motions.clear();
    this.returning.clear();
    this.effects = [];
    this.answeredAt.clear();
    this.decidedAt.clear();
  }

  apply(event: AtlasEvent, now: number): void {
    const before = this.dataset;
    this.dataset = applyEvent(this.dataset, event);
    const changed = this.dataset !== before;
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
      case "agent-launched": {
        if (!changed) break;
        // The vessel leaves from its parent: the launch bay. `step` flies
        // it to its spot, or places it there under reduced motion.
        this.returning.delete(event.agentId);
        const parent = this.motions.get(event.parentId);
        if (parent)
          this.motions.set(event.agentId, {
            position: { ...parent.position },
            heading: parent.heading,
            trail: [],
            work: null,
          });
        else this.motions.delete(event.agentId);
        this.effects.push({
          kind: "ring",
          agentId: event.agentId,
          start: now,
          duration: 1.4,
        });
        break;
      }
      case "agent-returned": {
        const vessel = before.agents.find(
          (agent) => agent.id === event.agentId,
        );
        if (!changed || !vessel?.parentId) break;
        this.returning.set(vessel.id, { ...vessel, workingOn: [] });
        // The ring is on the parent, where the vessel comes home.
        this.effects.push({
          kind: "ring",
          agentId: vessel.parentId,
          start: now,
          duration: 1.4,
        });
        break;
      }
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

  /**
   * Move every agent a step towards where its status puts it, and every
   * returning vessel a step towards its parent. A vessel is placed at once
   * under reduced motion: it does not fly out, and it does not fly home.
   */
  step(time: number, seconds: number, reducedMotion: boolean): void {
    for (const agent of this.dataset.agents) {
      const target = this.agentTarget(agent, time, reducedMotion);
      const work = this.holdsAtWork(agent)
        ? this.workTarget(agent, time, reducedMotion)
        : null;
      const motion = this.motions.get(agent.id);
      const vessel = isVessel(agent);
      if (!motion || (vessel && reducedMotion)) {
        this.motions.set(agent.id, settledMotion(target, work));
        continue;
      }
      advanceMotion(motion, target, seconds, {
        rate: agent.status === "running" ? 3 : 2.2,
        reducedMotion,
        work,
        ...(vessel
          ? {
              arrivalDistance: vesselArrivalDistance,
              hoverAmplitude: vesselHoverAmplitude,
            }
          : {}),
      });
    }
    for (const [id, vessel] of this.returning) {
      const motion = this.motions.get(id);
      const home = this.motions.get(vessel.parentId ?? "")?.position;
      if (!motion || !home || reducedMotion) {
        this.returning.delete(id);
        this.motions.delete(id);
        continue;
      }
      advanceMotion(motion, home, seconds, { rate: 2.6, reducedMotion });
      const distance = Math.hypot(
        motion.position.x - home.x,
        motion.position.y - home.y,
      );
      if (distance <= vesselArrivalDistance) {
        this.returning.delete(id);
        this.motions.delete(id);
      }
    }
  }

  /**
   * Where an agent works its current task: the task and the spot beside
   * it. Null when the agent has no task. Agents sharing a task each get a
   * spot of their own, running agents first and then in the order the
   * dataset lists them.
   */
  workTarget(
    agent: Pick<Agent, "id" | "status" | "workingOn" | "parentId">,
    time: number,
    reducedMotion: boolean,
    distance = workingDistance,
  ): WorkTarget | null {
    const itemId = currentTask(agent, time, reducedMotion);
    if (!itemId) return null;
    return this.workTargetAt(agent, itemId, time, reducedMotion, distance);
  }

  /**
   * Where an agent works one of its tasks. A vessel takes the first spot
   * from its own slot on that is clear of every spot an agent keeps and of
   * the vessels listed before it, so it never lands on its parent.
   */
  private workTargetAt(
    agent: Pick<Agent, "id" | "status" | "workingOn" | "parentId">,
    itemId: string,
    time: number,
    reducedMotion: boolean,
    distance: number,
  ): WorkTarget | null {
    const item = this.dataset.items.find(
      (candidate) => candidate.id === itemId,
    );
    if (!item) return null;
    const place = taskPlace(this.layout, item);
    const { task } = place;
    // Every agent that works this task keeps its spot here while it is
    // away at another, so no agent moves because a neighbour did. Agents
    // take spots before vessels, so a launch never moves an agent. Within
    // each, running ones come first, so a beam or a line never has to
    // cross a neighbour's label to reach the task.
    const sharing = this.dataset.agents
      .filter(
        (other) => this.holdsAtWork(other) && other.workingOn.includes(itemId),
      )
      .sort(
        (left, right) =>
          Number(isVessel(left)) - Number(isVessel(right)) ||
          Number(right.status === "running") -
            Number(left.status === "running"),
      );
    const slot = Math.max(
      0,
      sharing.findIndex((other) => other.id === agent.id),
    );
    if (!isVessel(agent))
      return { itemId, task, spot: workingSpot(place, slot, distance) };
    const kept = this.keptSpots(agent, time, reducedMotion, distance);
    const candidates = Array.from({ length: 8 }, (_, index) =>
      workingSpot(place, slot + index, distance),
    );
    const clear = (spot: Point) =>
      kept.every(
        (other) =>
          Math.hypot(other.x - spot.x, other.y - spot.y) >= vesselClearance,
      );
    const others = this.keptSpots(
      agent,
      time,
      reducedMotion,
      distance,
      agent.parentId,
    );
    const beamRoom = (spot: Point) =>
      Math.min(
        Number.POSITIVE_INFINITY,
        ...others.map((other) => distanceToSegment(other, spot, task)),
      );
    // The first spot that lands clear and whose beam passes no neighbour.
    // Failing that, of the spots that land clear, the one whose beam passes
    // furthest from any neighbour; failing that, its own slot.
    let spot: Point | null = null;
    let room = -1;
    for (const candidate of candidates.filter(clear)) {
      const candidateRoom = beamRoom(candidate);
      if (candidateRoom >= vesselBeamClearance) {
        spot = candidate;
        break;
      }
      if (candidateRoom > room) {
        spot = candidate;
        room = candidateRoom;
      }
    }
    return {
      itemId,
      task,
      spot: spot ?? workingSpot(place, slot, distance),
    };
  }

  /**
   * The spots a vessel must keep clear of: every spot each agent keeps at
   * each of its tasks, and the spots of the vessels listed before it.
   * `except` leaves one agent's spots out.
   */
  private keptSpots(
    vessel: Pick<Agent, "id">,
    time: number,
    reducedMotion: boolean,
    distance: number,
    except?: string,
  ): Point[] {
    const spots: Point[] = [];
    let after = false;
    for (const other of this.dataset.agents) {
      if (other.id === vessel.id) after = true;
      if ((after && isVessel(other)) || other.id === except) continue;
      if (!this.holdsAtWork(other)) continue;
      if (isVessel(other)) {
        const work = this.workTarget(other, time, reducedMotion, distance);
        if (work) spots.push(work.spot);
        continue;
      }
      for (const itemId of other.workingOn) {
        const work = this.workTargetAt(
          other,
          itemId,
          time,
          reducedMotion,
          distance,
        );
        if (work) spots.push(work.spot);
      }
    }
    return spots;
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
    if (isVessel(agent)) return this.vesselTarget(agent, time, reducedMotion);
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
          isHome ? rings.homeWatch : watchRadius(this.layout, clientId),
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

  /**
   * Where a launch vessel holds: beside its task as an agent does, with a
   * smaller hover, or, with no task or while watching or idle, close
   * behind its parent.
   */
  vesselTarget(agent: Agent, time: number, reducedMotion: boolean): Point {
    const work = this.holdsAtWork(agent)
      ? this.workTarget(agent, time, reducedMotion)
      : null;
    const phase = this.dataset.agents.indexOf(agent) * 1.7;
    const hover = (point: Point): Point =>
      reducedMotion || agent.status !== "running"
        ? point
        : {
            x: point.x + Math.cos(time * 0.9 + phase) * vesselHoverAmplitude,
            y: point.y + Math.sin(time * 1.4 + phase) * vesselHoverAmplitude,
          };
    if (work) return hover(work.spot);
    const parent = this.dataset.agents.find(
      (candidate) => candidate.id === agent.parentId,
    );
    const at =
      this.motions.get(agent.parentId ?? "")?.position ??
      (parent && !isVessel(parent)
        ? this.agentTarget(parent, time, reducedMotion)
        : (this.layout.clients.get(clientOfAgent(this.dataset, agent)) ?? {
            x: 0,
            y: 0,
          }));
    // Behind and below the parent, which writes its label to its right.
    // Each sibling takes the next place round.
    const siblings = this.dataset.agents.filter(
      (candidate) => candidate.parentId === agent.parentId,
    );
    const angle = 2.3 + siblings.indexOf(agent) * 0.75;
    return hover(polar(at, angle, vesselStandOff));
  }

  needsAttention(agent: Agent): boolean {
    return attentionStatuses.includes(agent.status);
  }
}
