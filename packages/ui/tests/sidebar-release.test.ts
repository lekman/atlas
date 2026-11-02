import { describe, expect, it } from "bun:test";

import {
  drifts,
  ENVIRONMENTS,
  envStates,
  envText,
  isReleaseDoc,
  releaseCount,
  releaseLevel,
  type ReleaseDoc,
} from "../src/sidebar";

const doc = (drifted: ReleaseDoc["drifted"]): ReleaseDoc => ({
  drifted,
  total: 9,
  branch: "release/x",
  checkedAt: "2026-03-12T09:00:00Z",
});

describe("envStates", () => {
  it("uses the per-environment states when sent", () => {
    expect(envStates({ repo: "a", envs: { staging: "behind" } })).toEqual({
      staging: "behind",
    });
  });

  it("reads the older check's reasons for staging and production", () => {
    expect(
      envStates({
        repo: "a",
        reasons: [
          "staging runs abc, release is def",
          "production last deploy failed",
        ],
      }),
    ).toEqual({ staging: "behind", production: "failed" });
    expect(envStates({ repo: "a", reasons: ["staging deploying"] })).toEqual({
      staging: "deploying",
      production: "ok",
    });
  });

  it("has no states for a repository it could not read", () => {
    expect(
      envStates({ repo: "a", reasons: ["could not read deployments"] }),
    ).toEqual({});
  });
});

describe("drifts, releaseLevel and releaseCount", () => {
  it("drops a repository whose environments are all on their head", () => {
    expect(
      drifts(doc([{ repo: "a", envs: { staging: "ok", production: "ok" } }])),
    ).toEqual([]);
  });

  it("is red for a failure or a broken check, yellow for a gap, green when synced", () => {
    expect(
      releaseLevel(doc([{ repo: "a", envs: { production: "failed" } }])),
    ).toBe("bad");
    expect(
      releaseLevel(doc([{ repo: "a", reasons: ["release branch missing"] }])),
    ).toBe("bad");
    expect(
      releaseLevel(doc([{ repo: "a", envs: { staging: "behind" } }])),
    ).toBe("yellow");
    expect(releaseLevel(doc([]))).toBe("ok");
  });

  it("counts drifted repositories for the tab, or ticks", () => {
    expect(releaseCount(null)).toBeUndefined();
    expect(releaseCount(doc([]))).toBe("✓");
    expect(releaseCount(doc([{ repo: "a", envs: { staging: "none" } }]))).toBe(
      "1",
    );
  });
});

describe("envText", () => {
  const [dev, stg] = ENVIRONMENTS;
  it("names what the environment is judged against", () => {
    expect(envText(dev!, "ok", "release/x")).toBe("Development: on main");
    expect(envText(stg!, "ok", "release/x")).toBe("Staging: on release/x");
    expect(envText(stg!, "none", "release/x")).toBe("Staging: never deployed");
    expect(envText(stg!, undefined, "release/x")).toBe(
      "Staging: not deployed here",
    );
  });
});

describe("isReleaseDoc", () => {
  it("accepts the answer, which is also the stored copy", () => {
    expect(isReleaseDoc(doc([]))).toBe(true);
    expect(isReleaseDoc({ items: [] })).toBe(false);
  });
});
