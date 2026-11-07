import { describe, expect, it } from "bun:test";

import {
  createFakeRuntime,
  openTaskDetails,
  readHost,
  readHostMode,
  Runtime,
  type ClaudeRuntime,
} from "../src";

describe("Runtime.host", () => {
  it("is null without a runtime", async () => {
    expect(await Runtime.fromWindow({}).host()).toBeNull();
  });

  it("is null where the runtime refuses host, as the artifact does", async () => {
    expect(await new Runtime(createFakeRuntime()).host()).toBeNull();
  });

  it("is the sidebar's host in VS Code: no mode, and it opens tabs", async () => {
    const fake = createFakeRuntime({ host: {} });
    const host = await new Runtime(fake).host();
    expect(host?.mode).toBeNull();
    await host?.openDetails("db:7");
    expect(fake.opened).toEqual(["db:7"]);
  });

  it("carries the task a details tab shows", async () => {
    const fake = createFakeRuntime({
      host: { mode: { view: "details", ref: "db:7" } },
    });
    const host = await new Runtime(fake).host();
    expect(host?.mode).toEqual({ view: "details", ref: "db:7" });
  });

  it("gives up on a host that never answers", async () => {
    const silent = {
      use: () => new Promise(() => undefined),
    } as unknown as ClaudeRuntime;
    expect(await new Runtime(silent).host({ timeout: 5 })).toBeNull();
  });

  it("turns a refusal to open into a RuntimeError", async () => {
    const fake = createFakeRuntime({ host: { refuse: "tool_error" } });
    const host = await new Runtime(fake).host();
    await expect(host?.openDetails("db:7")).rejects.toEqual({
      code: "tool_error",
    });
  });
});

describe("readHostMode", () => {
  it("keeps a details mode with a ref", () => {
    expect(readHostMode({ view: "details", ref: "db:1" })).toEqual({
      view: "details",
      ref: "db:1",
    });
  });

  it.each([
    ["nothing", undefined],
    ["another view", { view: "map", ref: "db:1" }],
    ["an empty ref", { view: "details", ref: " " }],
    ["a ref that is not text", { view: "details", ref: 1 }],
  ])("drops %s", (_name, value) => {
    expect(readHostMode(value)).toBeNull();
  });
});

describe("readHost", () => {
  it("is null for an object without openDetails", () => {
    expect(readHost({ mode: { view: "details", ref: "db:1" } })).toBeNull();
    expect(readHost(null)).toBeNull();
  });
});

describe("openTaskDetails", () => {
  const item = "db:3";

  it("opens here without a host", async () => {
    let here = 0;
    const opened = await openTaskDetails(null, item, () => here++);
    expect(opened).toEqual({ where: "here" });
    expect(here).toBe(1);
  });

  it("opens in the host's editor and leaves the page as it is", async () => {
    const fake = createFakeRuntime({ host: {} });
    const host = await new Runtime(fake).host();
    let here = 0;
    const opened = await openTaskDetails(host, item, () => here++);
    expect(opened).toEqual({ where: "host" });
    expect(here).toBe(0);
    expect(fake.opened).toEqual([item]);
  });

  it("opens here when the host refuses", async () => {
    const fake = createFakeRuntime({ host: { refuse: "upstream_error" } });
    const host = await new Runtime(fake).host();
    let here = 0;
    const opened = await openTaskDetails(host, item, () => here++);
    expect(opened).toEqual({
      where: "here",
      error: { code: "upstream_error" },
    });
    expect(here).toBe(1);
  });

  it("opens here for a task without a ref, which the host cannot name", async () => {
    const fake = createFakeRuntime({ host: {} });
    const host = await new Runtime(fake).host();
    let here = 0;
    await openTaskDetails(host, undefined, () => here++);
    expect(here).toBe(1);
    expect(fake.opened).toEqual([]);
  });
});
