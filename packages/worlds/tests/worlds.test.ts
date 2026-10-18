import { describe, expect, it } from "bun:test";

import { agentStatuses } from "@atlas/core";

import { plannedWorlds, worldIds, worlds } from "../src";

const vocabularyKeys = [
  "homeName",
  "home",
  "client",
  "clients",
  "requirement",
  "item",
  "agent",
  "agents",
  "question",
  "questions",
  "decision",
  "agentMessage",
  "externalEvent",
  "log",
] as const;

describe("every world", () => {
  for (const id of worldIds) {
    const world = worlds[id];

    it(`${world.name} names every record type`, () => {
      for (const key of vocabularyKeys)
        expect(world.vocabulary[key].length).toBeGreaterThan(0);
    });

    it(`${world.name} names and colours every status`, () => {
      for (const status of agentStatuses) {
        expect(world.statusNames[status].length).toBeGreaterThan(0);
        expect(world.palette.status[status]).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it(`${world.name} keeps the shared status hues`, () => {
      // Learning a new world must never mean relearning what is urgent.
      const hue = (hex: string) => {
        const value = Number.parseInt(hex.slice(1), 16);
        const [r, g, b] = [
          (value >> 16) & 255,
          (value >> 8) & 255,
          value & 255,
        ].map((part) => part / 255) as [number, number, number];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max === min) return null;
        const delta = max - min;
        const raw =
          max === r
            ? ((g - b) / delta) % 6
            : max === g
              ? (b - r) / delta + 2
              : (r - g) / delta + 4;
        return (raw * 60 + 360) % 360;
      };
      const within = (value: number | null, from: number, to: number) =>
        value !== null && value >= from && value <= to;
      expect(within(hue(world.palette.status.running), 90, 160)).toBe(true);
      expect(within(hue(world.palette.status.watching), 190, 230)).toBe(true);
      expect(within(hue(world.palette.status.waiting), 25, 50)).toBe(true);
      const red = hue(world.palette.status.blocked);
      expect(red !== null && (red < 10 || red > 340)).toBe(true);
    });

    it(`${world.name} has a voice for every cue`, () => {
      for (const cue of [
        "message",
        "status",
        "external",
        "needs",
        "blocked",
      ] as const) {
        expect(typeof world.voices[cue]).toBe("function");
      }
    });
  }

  it("gives every planned world a home name", () => {
    for (const planned of plannedWorlds)
      expect(planned.homeName.length).toBeGreaterThan(0);
  });

  it("names home Terra and Turtle Bay", () => {
    expect(worlds.astronomer.vocabulary.homeName).toBe("Terra");
    expect(worlds.mariner.vocabulary.homeName).toBe("Turtle Bay");
  });
});
