import { afterEach, describe, expect, it } from "bun:test";

import {
  defaultRailSide,
  layoutFor,
  rememberedRailSide,
  rememberRailSide,
  relayWords,
} from "../src/console/layout";

describe("console layout", () => {
  it("is one pane in the sidebar and on a closed folding phone", () => {
    expect(layoutFor(360)).toBe("single");
    expect(layoutFor(420)).toBe("single");
    expect(layoutFor(466)).toBe("single");
    expect(layoutFor(759)).toBe("single");
  });

  it("is two panes on an open folding phone", () => {
    expect(layoutFor(760)).toBe("split");
    expect(layoutFor(890)).toBe("split");
  });

  it("is a list and a wide item on a laptop", () => {
    expect(layoutFor(1200)).toBe("wide");
    expect(layoutFor(1440)).toBe("wide");
  });

  it("puts the rail right for a thumb and left for two hands", () => {
    expect(defaultRailSide("single")).toBe("right");
    expect(defaultRailSide("split")).toBe("left");
    expect(defaultRailSide("wide")).toBe("left");
  });

  it("says the relay state in words", () => {
    expect(relayWords({ kind: "live" })).toBe("Live");
    expect(relayWords({ kind: "stored" })).toBe("Stored copy");
    expect(relayWords({ kind: "queued", count: 3 })).toBe("Queued 3");
  });
});

describe("remembered rail side", () => {
  const original = globalThis.localStorage;
  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: original,
      configurable: true,
    });
  });

  it("keeps the choice per layout", () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    });
    rememberRailSide("single", "left");
    expect(rememberedRailSide("single")).toBe("left");
    expect(rememberedRailSide("split")).toBe("left");
    rememberRailSide("split", "right");
    expect(rememberedRailSide("split")).toBe("right");
  });

  it("falls back to the default when storage is blocked", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    expect(rememberedRailSide("single")).toBe("right");
    expect(() => rememberRailSide("single", "left")).not.toThrow();
  });
});
