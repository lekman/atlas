import { describe, expect, it } from "bun:test";

(globalThis as { __SIDEBAR_CONFIG__?: unknown }).__SIDEBAR_CONFIG__ = {
  clients: [],
};
const { clientColour } = await import("../src/config");

const config = {
  clients: [
    { key: "acme", name: "Acme", slot: 1 },
    { key: "odd", name: "Odd", slot: 9 },
  ],
};

describe("clientColour", () => {
  it("uses the client's slot", () => {
    expect(clientColour("acme", config)).toBe("var(--client-1)");
  });

  it("uses the other colour for an unknown client or a bad slot", () => {
    expect(clientColour("nobody", config)).toBe("var(--client-other)");
    expect(clientColour("odd", config)).toBe("var(--client-other)");
  });
});
