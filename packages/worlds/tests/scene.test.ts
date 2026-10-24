import { describe, expect, it } from "bun:test";

import {
  isOnMap,
  orderByUrgency,
  type AtlasEvent,
  type Dataset,
} from "@atlas/core";
import { busyClientId, busyDataset, sampleDataset } from "@atlas/fixtures";

import {
  advanceMotion,
  arrivalDistance,
  computeLayout,
  currentTask,
  fitAroundPanels,
  fitCamera,
  focusOn,
  hoverAmplitude,
  itemPosition,
  Scene,
  shownPerWorkstream,
  taskDwellSeconds,
  unsortedTitle,
  vesselArrivalDistance,
  vesselBeamClearance,
  vesselClearance,
  vesselHoverAmplitude,
  vesselStandOff,
  workingSpot,
  workstreamCaption,
  workstreamCaptionRise,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from "../src";

describe("layout", () => {
  it("puts home at the centre and clients around it", () => {
    const layout = computeLayout(sampleDataset, "landscape");
    expect(layout.clients.get("ashgrove")).toEqual({ x: 0, y: 0 });
    const others = sampleDataset.clients.filter(
      (client) => client.home !== true,
    );
    for (const client of others) {
      const point = layout.clients.get(client.id);
      expect(point).toBeDefined();
      expect(Math.hypot(point!.x, point!.y)).toBeGreaterThan(700);
    }
  });

  it("stacks clients tall in portrait", () => {
    const landscape = computeLayout(sampleDataset, "landscape").bounds;
    const portrait = computeLayout(sampleDataset, "portrait").bounds;
    expect(portrait.bottom - portrait.top).toBeGreaterThan(
      portrait.right - portrait.left,
    );
    expect(landscape.right - landscape.left).toBeGreaterThan(
      landscape.bottom - landscape.top,
    );
  });

  it("places every requirement and decision, and gives every item a marker", () => {
    const layout = computeLayout(sampleDataset, "landscape");
    for (const requirement of sampleDataset.requirements)
      expect(layout.fixed.has(requirement.id)).toBe(true);
    for (const decision of sampleDataset.decisions)
      expect(layout.fixed.has(decision.id)).toBe(true);
    for (const item of sampleDataset.items)
      expect(layout.markerOfItem.has(item.id)).toBe(true);
    for (const id of layout.shown) expect(layout.fixed.has(id)).toBe(true);
  });

  it("puts every sample item on the map", () => {
    const layout = computeLayout(sampleDataset, "landscape");
    for (const item of sampleDataset.items)
      expect(layout.shown.has(item.id)).toBe(true);
  });

  it("gives each workstream a marker, and unsorted work one more", () => {
    const layout = computeLayout(sampleDataset, "landscape");
    const halcyon = layout.markers.filter(
      (marker) => marker.clientId === "halcyon",
    );
    expect(halcyon.map((marker) => marker.title)).toEqual([
      "Go-live",
      "Quality",
      "Operations portal",
      unsortedTitle,
    ]);
    expect(halcyon.at(-1)?.workstreamId).toBeNull();
    expect(halcyon.at(-1)?.shown).toEqual(["launch-issuer"]);
    const kestrel = layout.markers.filter(
      (marker) => marker.clientId === "kestrel",
    );
    expect(kestrel.some((marker) => marker.workstreamId === null)).toBe(false);
  });

  it("puts a drawn item at its own place beside its marker", () => {
    const layout = computeLayout(sampleDataset, "landscape");
    const item = sampleDataset.items[0]!;
    expect(layout.fixed.get(item.id)).toBeDefined();
    expect(itemPosition(layout, item)).toEqual(layout.fixed.get(item.id)!);
  });
});

describe("a busy client", () => {
  const items = busyDataset.items.filter(
    (item) => item.clientId === busyClientId,
  );

  it("is busy: about a hundred items, most of them not drawn", () => {
    expect(items.length).toBeGreaterThanOrEqual(90);
    const layout = computeLayout(busyDataset, "landscape");
    const drawn = items.filter((item) => layout.shown.has(item.id));
    expect(drawn.length).toBeLessThan(items.length / 2);
  });

  it("draws only work in progress or planned for a day, never done or unscheduled", () => {
    const layout = computeLayout(busyDataset, "landscape");
    const hidden = items.filter((item) => !isOnMap(item));
    expect(hidden.some((item) => item.state === "done")).toBe(true);
    expect(
      hidden.some(
        (item) => item.state === "todo" && item.scheduledFor === undefined,
      ),
    ).toBe(true);
    for (const item of hidden) expect(layout.shown.has(item.id)).toBe(false);
  });

  it(`draws at most ${shownPerWorkstream} items per workstream, the most urgent, and counts the rest`, () => {
    const layout = computeLayout(busyDataset, "landscape");
    const markers = layout.markers.filter(
      (marker) => marker.clientId === busyClientId,
    );
    expect(markers).toHaveLength(7);
    expect(markers.some((marker) => marker.more > 0)).toBe(true);
    for (const marker of markers) {
      const members = items.filter(
        (item) => layout.markerOfItem.get(item.id) === marker,
      );
      const urgent = orderByUrgency(members.filter(isOnMap));
      expect(marker.shown).toEqual(
        urgent.slice(0, shownPerWorkstream).map((item) => item.id),
      );
      expect(marker.more).toBe(Math.max(0, urgent.length - shownPerWorkstream));
      if (marker.more > 0)
        expect(workstreamCaption(marker)).toBe(
          `${marker.title} · ${marker.more} more`,
        );
    }
  });

  it("puts an item not drawn at its marker, so agents and questions find it", () => {
    const layout = computeLayout(busyDataset, "landscape");
    const hidden = items.find(
      (item) => !layout.shown.has(item.id) && item.workstreamId,
    )!;
    expect(itemPosition(layout, hidden)).toEqual(
      layout.markerOfItem.get(hidden.id)!.position,
    );
  });

  for (const orientation of ["landscape", "portrait"] as const) {
    it(`keeps labels apart, ${orientation}`, () => {
      expect(overlappingLabels(busyDataset, orientation)).toEqual([]);
      expect(overlappingLabels(sampleDataset, orientation)).toEqual([]);
    });
  }
});

interface Box {
  name: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Labels that would overlap, judged at the two zooms that matter: where
 * captions first show (0.6) and where item labels first show (1.05). Text
 * is estimated wide, at 7 pixels a character and 13 pixels high, so the
 * check errs towards finding an overlap.
 */
function overlappingLabels(
  dataset: Dataset,
  orientation: "landscape" | "portrait",
) {
  const layout = computeLayout(dataset, orientation);
  const found: string[] = [];
  for (const scale of [0.61, 1.06]) {
    const width = (text: string) => (text.length * 7) / scale;
    const height = 13 / scale;
    const boxes: Box[] = [];
    for (const marker of layout.markers) {
      const caption = workstreamCaption(marker);
      const { x, y } = marker.position;
      boxes.push({
        name: `caption ${caption}`,
        left: x - width(caption) / 2,
        right: x + width(caption) / 2,
        top: y - workstreamCaptionRise - height,
        bottom: y - workstreamCaptionRise,
      });
      if (scale < 1.05) continue;
      for (const id of marker.shown) {
        const point = layout.fixed.get(id)!;
        const title = dataset.items.find((item) => item.id === id)!.title;
        boxes.push({
          name: `item ${title}`,
          left: point.x + 12,
          right: point.x + 14 + width(title),
          top: point.y - height / 2,
          bottom: point.y + height / 2,
        });
      }
    }
    boxes.forEach((a, index) => {
      for (const b of boxes.slice(index + 1))
        if (
          a.left < b.right &&
          b.left < a.right &&
          a.top < b.bottom &&
          b.top < a.bottom
        )
          found.push(`${a.name} / ${b.name} at ${scale}`);
    });
  }
  return found;
}

describe("scene", () => {
  it("moves agents towards their targets and keeps a trail", () => {
    const scene = new Scene(sampleDataset);
    scene.step(0, 0.016, false);
    for (let frame = 1; frame < 60; frame++)
      scene.step(frame / 60, 1 / 60, false);
    const motion = scene.motions.get("schema")!;
    expect(motion.trail.length).toBeGreaterThan(10);
  });

  it("keeps no trail under reduced motion", () => {
    const scene = new Scene(sampleDataset);
    for (let frame = 0; frame < 30; frame++)
      scene.step(frame / 60, 1 / 60, true);
    expect(scene.motions.get("schema")!.trail).toEqual([]);
  });

  it("turns events into effects that expire", () => {
    const scene = new Scene(sampleDataset);
    scene.apply(
      {
        type: "agent-message",
        from: "schema",
        to: "gaps-watch",
        text: "Hold releases",
      },
      10,
    );
    scene.apply(
      {
        type: "external",
        source: "github",
        recordId: "database-tests",
        text: "Checks passed",
      },
      10,
    );
    scene.apply(
      {
        type: "status-change",
        agentId: "test-runner",
        to: "running",
        text: "Started",
      },
      10,
    );
    expect(scene.activeEffects(10.5)).toHaveLength(3);
    expect(scene.activeEffects(100)).toHaveLength(0);
    expect(
      scene.dataset.agents.find((agent) => agent.id === "test-runner")?.status,
    ).toBe("running");
  });

  it("records when a question was answered and its decision appeared", () => {
    const scene = new Scene(sampleDataset);
    scene.apply(
      {
        type: "question-answered",
        questionId: "drill-window",
        answer: "Saturday",
        decision: {
          id: "drill-saturday",
          clientId: "halcyon",
          title: "Drill Saturday",
          state: "made",
          classification: "client-confidential",
          boundary: "home-server",
        },
      },
      5,
    );
    expect(scene.answeredAt.get("drill-window")).toBe(5);
    expect(scene.decidedAt.get("drill-saturday")).toBe(5);
  });

  it("resets to a dataset and forgets motion", () => {
    const scene = new Scene(sampleDataset);
    scene.step(0, 0.016, false);
    scene.reset(sampleDataset);
    expect(scene.motions.size).toBe(0);
  });
});

describe("agents at work", () => {
  const schema = sampleDataset.agents.find((agent) => agent.id === "schema")!;
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  it("works each task for the dwell time, then the next, round and round", () => {
    expect(schema.workingOn.length).toBeGreaterThanOrEqual(2);
    const [first, second] = schema.workingOn;
    expect(currentTask(schema, 0, false)).toBe(first!);
    expect(currentTask(schema, taskDwellSeconds - 0.01, false)).toBe(first!);
    expect(currentTask(schema, taskDwellSeconds, false)).toBe(second!);
    expect(
      currentTask(schema, taskDwellSeconds * schema.workingOn.length, false),
    ).toBe(first!);
  });

  it("stays on the first task under reduced motion, or when not running", () => {
    const [first] = schema.workingOn;
    expect(currentTask(schema, taskDwellSeconds * 1.5, true)).toBe(first!);
    expect(
      currentTask(
        { ...schema, status: "waiting" },
        taskDwellSeconds * 1.5,
        false,
      ),
    ).toBe(first!);
    expect(currentTask({ ...schema, workingOn: [] }, 5, false)).toBeNull();
  });

  it("holds beside the task, to the right of it and clear of its row", () => {
    const centre = { x: 0, y: 0 };
    const above = workingSpot({ x: -300, y: -60 }, centre);
    expect(above.x).toBeGreaterThan(-300);
    expect(above.y).toBeLessThan(-60 - 40);
    const below = workingSpot({ x: 300, y: 60 }, centre);
    expect(below.x).toBeGreaterThan(300);
    expect(below.y).toBeGreaterThan(60 + 40);
    // A second agent at the same task takes the other side of the row.
    expect(workingSpot({ x: -300, y: -60 }, centre, 1).y).toBeGreaterThan(-60);
  });

  it("flies to its next task, and does not circle", () => {
    const scene = new Scene(sampleDataset);
    const [first, second] = schema.workingOn;
    const at = (time: number) => scene.agentTarget(schema, time, false);
    const work = (time: number) => scene.workTarget(schema, time, false)!;
    expect(work(1).itemId).toBe(first!);
    expect(work(taskDwellSeconds + 1).itemId).toBe(second!);
    for (const time of [1, 4, 9, 15])
      expect(distance(at(time), work(time).spot)).toBeLessThanOrEqual(
        hoverAmplitude * Math.SQRT2,
      );
    expect(
      distance(work(1).spot, work(taskDwellSeconds + 1).spot),
    ).toBeGreaterThan(100);
  });

  it("arrives, faces its task and keeps still under reduced motion", () => {
    const scene = new Scene(sampleDataset);
    for (let frame = 0; frame < 240; frame++)
      scene.step(30 + frame / 60, 1 / 60, true);
    const motion = scene.motions.get("schema")!;
    const work = scene.workTarget(schema, 0, true)!;
    expect(work.itemId).toBe(schema.workingOn[0]!);
    expect(motion.work?.arrived).toBe(true);
    expect(motion.work?.itemId).toBe(work.itemId);
    expect(distance(motion.position, work.spot)).toBeLessThan(arrivalDistance);
    expect(scene.agentTarget(schema, 30, true)).toEqual(work.spot);
    expect(scene.agentTarget(schema, 47, true)).toEqual(work.spot);
    const facing = Math.atan2(
      work.task.y - motion.position.y,
      work.task.x - motion.position.x,
    );
    expect(Math.cos(motion.heading - facing)).toBeGreaterThan(0.99);
    expect(motion.trail).toEqual([]);
  });

  it("is not at work while still flying there", () => {
    const scene = new Scene(sampleDataset);
    scene.step(1, 1 / 60, false);
    const motion = scene.motions.get("schema")!;
    expect(motion.work?.arrived).toBe(true);
    // The next task, a dwell later: one frame in, it is still under way.
    scene.step(taskDwellSeconds + 1, 1 / 60, false);
    expect(motion.work?.itemId).toBe(schema.workingOn[1]!);
    expect(motion.work?.arrived).toBe(false);
  });

  it("parks a waiting agent beside its task, still, and gives a running one the first spot", () => {
    const scene = new Scene(sampleDataset);
    const release = sampleDataset.agents.find(
      (agent) => agent.id === "release",
    )!;
    expect(release.status).toBe("waiting");
    const parked = scene.workTarget(release, 3, false)!;
    expect(scene.agentTarget(release, 3, false)).toEqual(parked.spot);
    expect(scene.agentTarget(release, 11, false)).toEqual(parked.spot);
    const centre = scene.layout.clients.get("halcyon")!;
    const running = scene.workTarget(schema, 3, false)!;
    expect(running.itemId).toBe(parked.itemId);
    expect(running.spot).toEqual(workingSpot(running.task, centre, 0));
    expect(parked.spot).toEqual(workingSpot(parked.task, centre, 1));
  });

  it("leaves watching and idle agents with no task to work", () => {
    const scene = new Scene(sampleDataset);
    scene.step(0, 1 / 60, false);
    for (const id of ["gaps-watch", "test-runner"])
      expect(scene.motions.get(id)!.work).toBeNull();
  });
});

describe("camera", () => {
  it("fits the bounds inside the viewport", () => {
    const camera = fitCamera(
      { left: -100, top: -50, right: 100, bottom: 50 },
      400,
      200,
      0,
    );
    expect(worldToScreen(camera, { x: -100, y: 0 }).x).toBeCloseTo(0);
    expect(worldToScreen(camera, { x: 100, y: 0 }).x).toBeCloseTo(400);
  });

  it("keeps the map clear of a panel in a corner", () => {
    const bounds = { left: -100, top: -100, right: 100, bottom: 100 };
    const panel = { left: 300, top: 0, right: 400, bottom: 120 };
    const camera = fitAroundPanels(bounds, 400, 200, 0, [panel]);
    const right = worldToScreen(camera, { x: 100, y: 100 });
    const top = worldToScreen(camera, { x: 100, y: -100 });
    const clear = right.x <= panel.left || top.y >= panel.bottom;
    expect(clear).toBe(true);
    // Cleared from the side: the square map was height-bound and stays so.
    expect(camera.scale).toBeCloseTo(1);
  });

  it("lets a panel overlap rather than shrink the map too far", () => {
    const bounds = { left: -100, top: -100, right: 100, bottom: 100 };
    const plain = fitCamera(bounds, 200, 200, 0);
    const around = fitAroundPanels(bounds, 200, 200, 0, [
      { left: 0, top: 0, right: 200, bottom: 120 },
    ]);
    expect(around).toEqual(plain);
  });

  it("leaves the fit alone when no panel is in the way", () => {
    const bounds = { left: -100, top: -50, right: 100, bottom: 50 };
    const plain = fitCamera(bounds, 400, 200, 0);
    const around = fitAroundPanels(bounds, 400, 200, 0, [
      { left: 0, top: 0, right: 60, bottom: 40 },
    ]);
    expect(around.scale).toBeLessThanOrEqual(plain.scale);
    expect(around.scale).toBeGreaterThan(0);
  });

  it("zooms about the pointer", () => {
    const camera = { x: 10, y: 20, scale: 0.5 };
    const pointer = { x: 120, y: 80 };
    const before = screenToWorld(camera, pointer);
    const after = screenToWorld(zoomAt(camera, pointer, 2), pointer);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("centres a point", () => {
    const camera = focusOn({ x: 50, y: 50 }, 1, 200, 100);
    expect(worldToScreen(camera, { x: 50, y: 50 })).toEqual({ x: 100, y: 50 });
  });
});

describe("launch vessels", () => {
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const launch = (
    agentId: string,
    workingOn?: string[],
  ): Extract<AtlasEvent, { type: "agent-launched" }> => ({
    type: "agent-launched",
    agentId,
    parentId: "schema",
    name: agentId,
    ...(workingOn ? { workingOn } : {}),
    text: "Launched",
  });
  const back = (agentId: string): AtlasEvent => ({
    type: "agent-returned",
    agentId,
    text: "Done",
  });
  /** A scene stepped long enough for every agent to settle. */
  function settled(reducedMotion = false): Scene {
    const scene = new Scene(sampleDataset);
    for (let frame = 0; frame < 120; frame++)
      scene.step(1 + frame / 60, 1 / 60, reducedMotion);
    return scene;
  }
  const run = (scene: Scene, from: number, frames: number, reduced = false) => {
    for (let frame = 0; frame < frames; frame++)
      scene.step(from + frame / 60, 1 / 60, reduced);
  };

  it("leaves from its parent, flies to its task and works it", () => {
    const scene = settled();
    const parent = { ...scene.motions.get("schema")!.position };
    scene.apply(launch("drill-notes", ["weekend-drill"]), 3);
    const motion = scene.motions.get("drill-notes")!;
    expect(motion.position).toEqual(parent);
    expect(motion.work).toBeNull();
    run(scene, 3, 1);
    expect(motion.work?.arrived).toBe(false);
    run(scene, 3.1, 240);
    const vessel = scene.dataset.agents.at(-1)!;
    const work = scene.workTarget(vessel, 7, false)!;
    expect(work.itemId).toBe("weekend-drill");
    expect(motion.work?.arrived).toBe(true);
    expect(distance(motion.position, work.spot)).toBeLessThanOrEqual(
      vesselArrivalDistance + vesselHoverAmplitude,
    );
  });

  it("rings when it launches, and rings its parent when it returns", () => {
    const scene = settled();
    scene.apply(launch("drill-notes", ["weekend-drill"]), 3);
    scene.apply(back("drill-notes"), 4);
    expect(
      scene.effects.map((effect) => effect.kind === "ring" && effect.agentId),
    ).toEqual(["drill-notes", "schema"]);
  });

  it("does nothing for a launch or a return the dataset refused", () => {
    const scene = settled();
    scene.apply(launch("portal"), 3);
    scene.apply(back("schema"), 3);
    expect(scene.effects).toEqual([]);
    expect(scene.returning.size).toBe(0);
  });

  it("never takes its parent's spot, and moves no agent when it arrives", () => {
    const scene = settled();
    const before = new Map(
      scene.dataset.agents.map((agent) => [
        agent.id,
        scene.workTarget(agent, 3, false)?.spot,
      ]),
    );
    // Schema works the cut-over first; the vessel goes to the same task.
    scene.apply(launch("cut-over-notes", ["cut-over"]), 3);
    for (const agent of sampleDataset.agents)
      expect(scene.workTarget(agent, 3, false)?.spot).toEqual(
        before.get(agent.id),
      );
    // Schema and Release hold the first two spots; the vessel goes further
    // out, even though it runs and Release waits, and keeps clear of every
    // spot an agent keeps, at this task or the next row.
    const vessel = scene.dataset.agents.at(-1)!;
    const work = scene.workTarget(vessel, 3, false)!;
    const centre = scene.layout.clients.get("halcyon")!;
    expect(work.itemId).toBe("cut-over");
    expect(work.spot).not.toEqual(workingSpot(work.task, centre, 0));
    expect(work.spot).not.toEqual(workingSpot(work.task, centre, 1));
    for (const agent of sampleDataset.agents)
      for (const time of [3, 3 + taskDwellSeconds]) {
        const kept = scene.workTarget(agent, time, false);
        if (kept && scene.holdsAtWork(agent))
          expect(distance(kept.spot, work.spot)).toBeGreaterThanOrEqual(
            vesselClearance,
          );
      }
  });

  it("lands clear of every agent, and its beam passes no other agent", () => {
    const scene = settled();
    scene.apply(launch("cut-over-notes", ["cut-over"]), 3);
    const vessel = scene.dataset.agents.at(-1)!;
    const work = scene.workTarget(vessel, 3, false)!;
    const fromBeam = (point: { x: number; y: number }) => {
      const dx = work.task.x - work.spot.x;
      const dy = work.task.y - work.spot.y;
      const along = Math.max(
        0,
        Math.min(
          1,
          ((point.x - work.spot.x) * dx + (point.y - work.spot.y) * dy) /
            (dx * dx + dy * dy),
        ),
      );
      return distance(point, {
        x: work.spot.x + along * dx,
        y: work.spot.y + along * dy,
      });
    };
    for (const agent of sampleDataset.agents) {
      if (!scene.holdsAtWork(agent)) continue;
      for (const time of [3, 3 + taskDwellSeconds]) {
        const kept = scene.workTarget(agent, time, false)?.spot;
        if (!kept) continue;
        expect(distance(kept, work.spot)).toBeGreaterThanOrEqual(
          vesselClearance,
        );
        if (agent.id !== "schema")
          expect(fromBeam(kept)).toBeGreaterThanOrEqual(vesselBeamClearance);
      }
    }
  });

  it("stays close to its parent when it has no task", () => {
    const scene = settled();
    scene.apply(launch("standing-by"), 3);
    run(scene, 3, 240);
    const parent = scene.motions.get("schema")!.position;
    const vessel = scene.motions.get("standing-by")!.position;
    expect(distance(parent, vessel)).toBeLessThan(vesselStandOff + 8);
    expect(scene.motions.get("standing-by")!.work).toBeNull();
  });

  it("is placed at its spot at once under reduced motion", () => {
    const scene = settled(true);
    scene.apply(launch("drill-notes", ["weekend-drill"]), 3);
    run(scene, 3, 1, true);
    const vessel = scene.dataset.agents.at(-1)!;
    const motion = scene.motions.get("drill-notes")!;
    expect(motion.position).toEqual(scene.workTarget(vessel, 3, true)!.spot);
    expect(motion.work?.arrived).toBe(true);
    expect(motion.trail).toEqual([]);
  });

  it("flies home after its record is gone, and leaves when it arrives", () => {
    const scene = settled();
    scene.apply(launch("drill-notes", ["weekend-drill"]), 3);
    run(scene, 3, 240);
    scene.apply(back("drill-notes"), 7);
    expect(
      scene.dataset.agents.some((agent) => agent.id === "drill-notes"),
    ).toBe(false);
    expect(scene.returning.has("drill-notes")).toBe(true);
    const motion = scene.motions.get("drill-notes")!;
    const parent = () => scene.motions.get("schema")!.position;
    const start = distance(motion.position, parent());
    run(scene, 7, 10);
    expect(distance(motion.position, parent())).toBeLessThan(start);
    expect(motion.work).toBeNull();
    run(scene, 7.2, 300);
    expect(scene.returning.has("drill-notes")).toBe(false);
    expect(scene.motions.has("drill-notes")).toBe(false);
  });

  it("leaves at once under reduced motion when it returns", () => {
    const scene = settled(true);
    scene.apply(launch("drill-notes", ["weekend-drill"]), 3);
    run(scene, 3, 1, true);
    scene.apply(back("drill-notes"), 4);
    run(scene, 4, 1, true);
    expect(scene.motions.has("drill-notes")).toBe(false);
    expect(scene.returning.size).toBe(0);
  });

  it("forgets returning vessels on a reset", () => {
    const scene = settled();
    scene.apply(launch("drill-notes", ["weekend-drill"]), 3);
    run(scene, 3, 1);
    scene.apply(back("drill-notes"), 4);
    scene.reset(sampleDataset);
    expect(scene.returning.size).toBe(0);
  });

  it("counts arrival with the distance and hover it is given", () => {
    const work = {
      itemId: "x",
      task: { x: 100, y: 0 },
      spot: { x: 50, y: 0 },
    };
    const motion = {
      position: { x: 40, y: 0 },
      heading: 0,
      trail: [],
      work: null,
    };
    advanceMotion(motion, work.spot, 0, {
      rate: 1,
      reducedMotion: true,
      work,
      arrivalDistance: 5,
      hoverAmplitude: 1,
    });
    expect(motion.work).toMatchObject({ arrived: false });
    advanceMotion(motion, work.spot, 0, { rate: 1, reducedMotion: true, work });
    expect(motion.work).toMatchObject({ arrived: true });
  });
});
