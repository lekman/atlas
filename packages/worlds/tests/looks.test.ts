import { describe, expect, it } from "bun:test";

import { worldLooks, worlds } from "../src";

describe("worldLooks", () => {
  it("has a look for every world, the same as the world's own", () => {
    expect(Object.keys(worldLooks)).toEqual(Object.keys(worlds));
    for (const [id, world] of Object.entries(worlds)) {
      const look = worldLooks[id as keyof typeof worlds];
      expect(look.palette).toBe(world.palette);
      expect(look.typefaces).toBe(world.typefaces);
      expect(look.voices).toBe(world.voices);
      expect(look.night).toBe(world.night);
    }
  });
});
