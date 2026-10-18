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

    it(`${world.name} writes every kind of log line`, () => {
      const lines = [
        world.phrases.message("Schema", "Gaps watch", "Hold releases"),
        world.phrases.external("GitHub", "Database tests", "Checks passed"),
        world.phrases.status("Tracking", "a", "b", "Needs a call"),
        world.phrases.answered("Drill on Saturday", "Halcyon Labs"),
      ];
      for (const line of lines) expect(line.length).toBeGreaterThan(5);
      expect(lines[0]).toContain("Hold releases");
    });

    it(`${world.name} has a readout with something needing attention`, () => {
      const readout = world.readout({
        clients: 4,
        agents: 15,
        active: 9,
        needsYou: 8,
        openQuestions: 7,
        x: 0,
        y: 0,
        scale: 0.4,
        time: "10:00",
      });
      expect(readout.lines.length).toBeGreaterThan(0);
      expect(readout.attention).toContain("8");
    });

    it(`${world.name} draws home and clients on the still map`, () => {
      expect(world.stillMap.home({ x: 0, y: 0 }, "home")).toContain("<");
      expect(world.stillMap.client({ x: 100, y: 100 }, "acme")).toContain("<");
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
