import { describe, expect, it } from "bun:test";

(globalThis as { __SIDEBAR_CONFIG__?: unknown }).__SIDEBAR_CONFIG__ = {
  clients: [],
  trackers: [],
};
const { waitingRows } = await import("../src/waiting");
const { classify } = await import("../src/config");

const config = {
  clients: [
    { key: "acme", name: "Acme", slot: 1, keywords: ["acme", "roadrunner"] },
    { key: "beta", name: "Beta", slot: 2 },
  ],
  trackers: [],
};
const clientOf = (key: string) => ({ name: key, colour: key });
const items = [
  { kind: "task" as const, customer: "acme", ask: "a" },
  { kind: "task" as const, customer: "beta", ask: "b" },
  { kind: "commander" as const, worker: "Roadrunner-3", ask: "c" },
  { kind: "question" as const, ask: "d" },
];
const asks = (focus: string) =>
  waitingRows(items, focus, config, clientOf).map((r) => r.item.ask);

describe("classify", () => {
  it("finds a client by its keywords as whole words, ignoring case", () => {
    expect(classify("Roadrunner-3", null, config)).toBe("acme");
    expect(classify("acmeish", "other", config)).toBe("other");
  });
});

describe("waitingRows", () => {
  it("shows everything for all clients", () => {
    expect(asks("all")).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps a client's tasks and workers, and items that name no client", () => {
    expect(asks("acme")).toEqual(["a", "c", "d"]);
    expect(asks("beta")).toEqual(["b", "d"]);
  });

  it("colours an item that names no client as other", () => {
    expect(waitingRows(items, "all", config, clientOf)[3]?.client.name).toBe(
      "other",
    );
  });
});
