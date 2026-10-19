import { describe, expect, it } from "bun:test";

import { isOnMap, orderByUrgency, type Dataset } from "@atlas/core";
import { busyClientId, busyDataset, sampleDataset } from "@atlas/fixtures";

import {
  computeLayout,
  fitAroundPanels,
  fitCamera,
  focusOn,
  itemPosition,
  Scene,
  shownPerWorkstream,
  unsortedTitle,
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
