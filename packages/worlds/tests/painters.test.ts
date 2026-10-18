/**
 * Every world's painter and voices, run without a browser.
 *
 * The drawing itself is checked by eye in Storybook. What a unit test can
 * prove is that each painter draws every record type, at both levels of
 * detail, with and without motion, while each kind of event is running,
 * without throwing, and that every agent is left clickable. A recording
 * 2D context stands in for the canvas.
 */
import { describe, expect, it } from "bun:test";

import { sampleDataset, sampleScript } from "@atlas/fixtures";

import {
  fitCamera,
  paintScene,
  Scene,
  worlds,
  type PaintContext,
  type Synthesiser,
} from "../src";

/** Records every call; anything not listed returns a no-op function. */
function recordingContext(calls: { count: number }): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<string | symbol, unknown> = {
    canvas: { width: 800, height: 600 },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createConicGradient: () => gradient,
    createPattern: () => null,
    measureText: (text: string) => ({
      width: text.length * 6,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    isPointInPath: () => false,
  };
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      return () => {
        calls.count += 1;
      };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

// Woodsman batches its trees into paths; Bun has no Path2D.
const scope = globalThis as { Path2D?: unknown };
scope.Path2D ??= class {
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  rect() {}
  closePath() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  addPath() {}
};

const events = sampleScript.filter((step) => step.type !== "reset");

for (const world of Object.values(worlds)) {
  describe(`${world.name} painter`, () => {
    for (const orientation of ["landscape", "portrait"] as const) {
      for (const detail of ["compact", "full"] as const) {
        for (const [reducedMotion, lighting] of [
          [false, "day"],
          [true, "day"],
          [false, "night"],
          [true, "night"],
        ] as const) {
          const name = `${orientation}, ${detail}, ${lighting}${reducedMotion ? ", reduced motion" : ""}`;
          it(`draws the day's events without throwing, ${name}`, () => {
            const calls = { count: 0 };
            const scene = new Scene(sampleDataset, orientation);
            const width = orientation === "landscape" ? 1200 : 420;
            const height = orientation === "landscape" ? 800 : 900;
            const paint: PaintContext = {
              context: recordingContext(calls),
              camera: fitCamera(scene.layout.bounds, width, height, 40),
              pixelRatio: 2,
              width,
              height,
              detail,
              time: 0,
              reducedMotion,
              lighting,
              scene,
              selectedId: "release",
            };
            let time = 0;
            for (const event of events) {
              scene.apply(event, time);
              // Mid-effect and at its end, so every progress branch runs.
              for (const offset of [0.1, 0.9, 1.7]) {
                paint.time = time + offset;
                scene.step(paint.time, 0.016, reducedMotion);
                const hits = paintScene(paint, world);
                for (const agent of scene.dataset.agents)
                  expect(hits.some((hit) => hit.id === agent.id)).toBe(true);
              }
              time += 2;
            }
            expect(calls.count).toBeGreaterThan(0);
          });
        }
      }
    }
  });

  describe(`${world.name} voices`, () => {
    for (const [cue, voice] of Object.entries(world.voices)) {
      it(`plays "${cue}" with sane frequencies and gains`, () => {
        const played: Array<{ frequency: number; gain: number }> = [];
        const synthesiser: Synthesiser = {
          tone: (frequency, duration, options) => {
            expect(duration).toBeGreaterThan(0);
            played.push({ frequency, gain: options?.gain ?? 0.2 });
          },
          noise: (duration, options) => {
            expect(duration).toBeGreaterThan(0);
            played.push({
              frequency: options?.frequency ?? 1000,
              gain: options?.gain ?? 0.2,
            });
          },
          bell: (frequency, options) =>
            played.push({ frequency, gain: options?.gain ?? 0.2 }),
        };
        voice(synthesiser);
        expect(played.length).toBeGreaterThan(0);
        for (const { frequency, gain } of played) {
          expect(Number.isFinite(frequency)).toBe(true);
          expect(frequency).toBeGreaterThan(20);
          expect(frequency).toBeLessThan(20000);
          // Quiet cues: nothing louder than the master volume asked for.
          expect(gain).toBeGreaterThan(0);
          expect(gain).toBeLessThanOrEqual(1);
        }
      });
    }
  });
}
