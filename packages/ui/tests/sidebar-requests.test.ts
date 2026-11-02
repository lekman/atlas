import { describe, expect, it } from "bun:test";

import {
  latestRequest,
  mergeStored,
  openRequest,
  pickUpdate,
  referenceText,
  toStore,
  type CommanderRequest,
} from "../src/sidebar";

const req = (
  id: string,
  more: Partial<CommanderRequest> = {},
): CommanderRequest => ({
  id,
  ref: "db:1",
  action: "status",
  state: "received",
  requestedAt: "2026-03-12T09:00:00Z",
  updatedAt: "2026-03-12T09:00:00Z",
  ...more,
});

describe("pickUpdate", () => {
  it("takes known states and actions, and cuts the summary", () => {
    expect(
      pickUpdate({
        state: "answered",
        action: "plan",
        summary: "x".repeat(400),
        worker: "Ops",
        updatedAt: "t",
      }),
    ).toEqual({
      state: "answered",
      action: "plan",
      summary: "x".repeat(300),
      worker: "Ops",
      updatedAt: "t",
    });
  });

  it("leaves an unknown state out and reads an unknown action as status", () => {
    const update = pickUpdate({ state: "exploded", action: "launch" });
    expect(update.state).toBeUndefined();
    expect(update.action).toBe("status");
  });
});

describe("latestRequest and openRequest", () => {
  const records = {
    a: req("a", { requestedAt: "2026-03-12T08:00:00Z", state: "done" }),
    b: req("b", { requestedAt: "2026-03-12T09:00:00Z", state: "dispatched" }),
    c: req("c", { ref: "db:2", state: "failed" }),
  };

  it("finds a task's newest request", () => {
    expect(latestRequest(records, "db:1")?.id).toBe("b");
    expect(latestRequest(records, undefined)).toBeNull();
  });

  it("calls it open while it is on its way or being worked", () => {
    expect(openRequest(records, "db:1")?.id).toBe("b");
    expect(openRequest(records, "db:2")).toBeNull();
  });
});

describe("mergeStored and toStore", () => {
  it("takes stored requests that are new here or newer", () => {
    const held = { a: req("a", { updatedAt: "2026-03-12T09:00:00Z" }) };
    const merged = mergeStored(held, {
      items: [
        req("a", { updatedAt: "2026-03-12T10:00:00Z", state: "answered" }),
        req("b"),
        { id: 7 },
      ],
    });
    expect(merged?.a?.state).toBe("answered");
    expect(merged?.b).toBeDefined();
    expect(
      mergeStored(merged!, {
        items: [req("a", { updatedAt: "2026-03-12T08:00:00Z" })],
      }),
    ).toBeNull();
    expect(mergeStored(held, null)).toBeNull();
  });

  it("stores the newest 60, none still being sent", () => {
    const records = Object.fromEntries(
      Array.from({ length: 70 }, (_, i) => [
        `r${i}`,
        req(`r${i}`, {
          requestedAt: `2026-03-12T09:${String(i).padStart(2, "0")}:00Z`,
          state: i === 69 ? "sending" : "received",
        }),
      ]),
    );
    const { items } = toStore(records);
    expect(items).toHaveLength(60);
    expect(items[0]!.id).toBe("r68");
    expect(items.some((r) => r.state === "sending")).toBe(false);
  });
});

describe("referenceText", () => {
  it("writes the line to paste into an agent's chat", () => {
    expect(referenceText("Ship it", "PROJ-1")).toBe(
      'Regarding task "Ship it", PROJ-1: ',
    );
    expect(referenceText("Ship it")).toBe('Regarding task "Ship it": ');
  });
});
