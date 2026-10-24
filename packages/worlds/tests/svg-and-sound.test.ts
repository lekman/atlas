import { describe, expect, it } from "bun:test";

import { sampleDataset } from "@atlas/fixtures";

import {
  createSoundPlayer,
  defaultSoundSettings,
  renderSnapshot,
  worlds,
  type Synthesiser,
} from "../src";

describe("still map", () => {
  it("draws a still beam or line from a running agent to its task", () => {
    const options = { width: 400, height: 300 };
    const astronomer = renderSnapshot(
      worlds.astronomer,
      sampleDataset,
      options,
    );
    expect(astronomer).toContain('stroke="#e9fdff"');
    const mariner = renderSnapshot(worlds.mariner, sampleDataset, options);
    expect(mariner).toContain('r="7" fill="#f6efde"');
    const night = renderSnapshot(worlds.mariner, sampleDataset, {
      ...options,
      lighting: "night",
    });
    expect(night).toContain('r="7" fill="#d9dde0"');
  });

  for (const world of Object.values(worlds)) {
    it(`draws every agent in the ${world.name} world`, () => {
      const svg = renderSnapshot(world, sampleDataset, {
        width: 400,
        height: 300,
      });
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain(`Atlas, ${world.name} world`);
      expect(svg).toContain(world.vocabulary.homeName);
      for (const agent of sampleDataset.agents)
        expect(svg).toContain(`${agent.name}:`);
      for (const status of new Set(
        sampleDataset.agents.map((agent) => agent.status),
      )) {
        expect(svg).toContain(world.palette.status[status]);
      }
    });
  }

  it("escapes names", () => {
    const dataset = {
      ...sampleDataset,
      agents: sampleDataset.agents.map((agent, index) =>
        index === 0 ? { ...agent, name: "<Smith & Co>" } : agent,
      ),
    };
    const svg = renderSnapshot(worlds.astronomer, dataset, {
      width: 400,
      height: 300,
    });
    expect(svg).toContain("&lt;Smith &amp; Co&gt;");
    expect(svg).not.toContain("<Smith");
  });

  it("picks portrait for a tall frame", () => {
    const svg = renderSnapshot(worlds.mariner, sampleDataset, {
      width: 300,
      height: 600,
    });
    const [, , width, height] = svg
      .match(/viewBox="([^"]+)"/)![1]!
      .split(" ")
      .map(Number);
    expect(height!).toBeGreaterThan(width!);
  });
});

describe("sound", () => {
  const recorder = () => {
    const calls: string[] = [];
    const synthesiser: Synthesiser = {
      tone: () => calls.push("tone"),
      noise: () => calls.push("noise"),
      bell: () => calls.push("bell"),
    };
    return { calls, synthesiser };
  };

  it("voices call the synthesiser", () => {
    const { calls, synthesiser } = recorder();
    worlds.mariner.voices.needs(synthesiser);
    expect(calls).toEqual(["bell", "bell"]);
  });

  it("stays silent until enabled, without even creating an audio context", () => {
    let created = 0;
    const player = createSoundPlayer(() => {
      created++;
      return null;
    });
    player.play(worlds.astronomer, "message", defaultSoundSettings);
    expect(created).toBe(0);
    player.play(worlds.astronomer, "message", {
      ...defaultSoundSettings,
      enabled: true,
    });
    expect(created).toBe(1);
  });

  it("respects a category switched off", () => {
    let created = 0;
    const player = createSoundPlayer(() => {
      created++;
      return null;
    });
    const settings = {
      ...defaultSoundSettings,
      enabled: true,
      categories: { ...defaultSoundSettings.categories, needs: false },
    };
    player.play(worlds.astronomer, "blocked", settings);
    expect(created).toBe(0);
  });
});
