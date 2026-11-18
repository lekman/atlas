import type { CommanderRequest } from "@atlas/ui/sidebar";
import { describe, expect, it } from "bun:test";

import { relayStateOf } from "../src/console/relay";

const request = (more: Partial<CommanderRequest>): CommanderRequest => ({
  id: "r1",
  ref: "db:1",
  action: "move",
  state: "queued",
  requestedAt: "2026-11-18T09:00:00Z",
  via: "inbox",
  ...more,
});

describe("relay state", () => {
  it("is live while the worklist answered live", () => {
    expect(relayStateOf(Date.now(), [request({})])).toEqual({ kind: "live" });
  });

  it("counts done and move requests waiting in the inbox", () => {
    expect(
      relayStateOf(null, [
        request({}),
        request({ id: "r2", action: "done" }),
        request({ id: "r3", action: "status" }),
        request({ id: "r4", state: "received" }),
        request({ id: "r5", via: undefined }),
      ]),
    ).toEqual({ kind: "queued", count: 2 });
  });

  it("is the stored copy when nothing waits", () => {
    expect(relayStateOf(null, [])).toEqual({ kind: "stored" });
  });
});
