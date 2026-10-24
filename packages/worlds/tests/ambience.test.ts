import { describe, expect, test } from "bun:test";

import {
  backgroundIds,
  backgrounds,
  createAmbiencePlayer,
  defaultSoundSettings,
  isBackgroundChoice,
} from "../src";

describe("background sound", () => {
  test("offers three named backgrounds, each with a description", () => {
    expect(backgrounds.map((background) => background.name)).toEqual([
      "Android Rain",
      "Nexus Tower",
      "Outer Worlds",
    ]);
    expect(backgrounds.map((background) => background.id)).toEqual([
      ...backgroundIds,
    ]);
    for (const background of backgrounds)
      expect(background.description.length).toBeGreaterThan(10);
  });

  test("is off by default, with its own volume", () => {
    expect(defaultSoundSettings.background).toBe("off");
    expect(defaultSoundSettings.backgroundVolume).toBeGreaterThan(0);
    expect(defaultSoundSettings.backgroundVolume).toBeLessThanOrEqual(1);
  });

  test("accepts only known choices from storage", () => {
    expect(isBackgroundChoice("off")).toBe(true);
    expect(isBackgroundChoice("nexus-tower")).toBe(true);
    expect(isBackgroundChoice("blade-runner")).toBe(false);
    expect(isBackgroundChoice(3)).toBe(false);
  });

  test("does nothing, and never throws, where there is no audio", () => {
    const player = createAmbiencePlayer(() => null);
    expect(() => player.play("android-rain", 0.5)).not.toThrow();
    expect(player.current()).toBe("off");
    expect(() => player.setVolume(0.2)).not.toThrow();
    expect(() => player.stop()).not.toThrow();
  });
});
