import { describe, expect, it } from "bun:test";

import { fitCentredOn, worldToScreen } from "../src";

describe("fitCentredOn", () => {
  const bounds = { left: -100, top: -50, right: 300, bottom: 50 };

  it("puts the centre point in the middle of the viewport", () => {
    const camera = fitCentredOn(bounds, { x: 0, y: 0 }, 400, 200, 0);
    const centre = worldToScreen(camera, { x: 0, y: 0 });
    expect(centre.x).toBeCloseTo(200);
    expect(centre.y).toBeCloseTo(100);
  });

  it("scales so the farthest edge just fits", () => {
    // The right edge is 300 from the centre; half the width is 200.
    const camera = fitCentredOn(bounds, { x: 0, y: 0 }, 400, 200, 0);
    expect(camera.scale).toBeCloseTo(200 / 300);
    expect(worldToScreen(camera, { x: 300, y: 0 }).x).toBeCloseTo(400);
    expect(worldToScreen(camera, { x: -100, y: 0 }).x).toBeGreaterThan(0);
  });

  it("keeps the padding clear", () => {
    const camera = fitCentredOn(bounds, { x: 0, y: 0 }, 400, 200, 20);
    expect(worldToScreen(camera, { x: 300, y: 0 }).x).toBeCloseTo(380);
    expect(worldToScreen(camera, { x: 0, y: 50 }).y).toBeLessThanOrEqual(180);
  });
});
