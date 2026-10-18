import { describe, expect, it } from "bun:test";

import { sampleDataset } from "@atlas/fixtures";

import {
  computeLayout,
  fitCamera,
  focusOn,
  itemPosition,
  Scene,
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

  it("places every requirement, decision and item", () => {
    const layout = computeLayout(sampleDataset, "landscape");
    for (const requirement of sampleDataset.requirements)
      expect(layout.fixed.has(requirement.id)).toBe(true);
    for (const decision of sampleDataset.decisions)
      expect(layout.fixed.has(decision.id)).toBe(true);
    for (const item of sampleDataset.items) {
      expect(layout.fixed.has(item.id) || layout.orbits.has(item.id)).toBe(
        true,
      );
    }
  });

  it("holds orbits still under reduced motion", () => {
    const layout = computeLayout(sampleDataset, "landscape");
    const item = sampleDataset.items.find(
      (candidate) => candidate.requirementId,
    )!;
    expect(itemPosition(layout, item, 0, true)).toEqual(
      itemPosition(layout, item, 100, true),
    );
    expect(itemPosition(layout, item, 0, false)).not.toEqual(
      itemPosition(layout, item, 100, false),
    );
  });
});

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
