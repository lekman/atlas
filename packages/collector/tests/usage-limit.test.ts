import { describe, expect, it } from "bun:test";

import {
  readTail,
  reportFor,
  usageLimitIsActive,
  usageLimitNote,
  type UsageLimit,
} from "../src";

const line = (o: object) => JSON.stringify(o);

/** A usage-limit line as Claude Code 2.1.317 writes it, with the text it shows. */
function limitLine(
  at: string,
  rateLimitType: string,
  resetsAt: number | undefined,
) {
  const limits = {
    status: "rejected",
    ...(resetsAt === undefined ? {} : { resetsAt }),
    rateLimitType,
    overageStatus: "rejected",
    isUsingOverage: false,
  };
  return line({
    type: "assistant",
    timestamp: at,
    message: {
      model: "<synthetic>",
      content: [
        {
          type: "text",
          text: "You've hit your weekly limit · resets Mar 13 at 6pm (Europe/London)",
        },
      ],
      usage: { input_tokens: 0, output_tokens: 0 },
    },
    apiError: "usage_limit_reached",
    apiErrorParams: { rate_limit_info: limits },
    quotaLimits: limits,
    error: "rate_limit",
    isApiErrorMessage: true,
    apiErrorStatus: 429,
  });
}

/** The older shape (2.1.280): no apiError, the rest the same. */
function olderLimitLine(at: string, resetsAt: number) {
  return line({
    type: "assistant",
    timestamp: at,
    message: {
      model: "<synthetic>",
      content: [{ type: "text", text: "You've hit your session limit" }],
    },
    quotaLimits: { status: "rejected", resetsAt, rateLimitType: "five_hour" },
    error: "rate_limit",
    isApiErrorMessage: true,
    apiErrorStatus: 429,
  });
}

const reply = (at: string) =>
  line({
    type: "assistant",
    timestamp: at,
    message: {
      model: "claude-example",
      content: [{ type: "text", text: "Kestrel's plan is ready" }],
      usage: { input_tokens: 3, cache_read_input_tokens: 40_000 },
    },
  });

const user = (at: string) =>
  line({ type: "user", timestamp: at, message: { content: "carry on" } });

// 13 Mar 2026 18:00 UTC, as Unix seconds.
const resetsAt = Date.parse("2026-03-13T18:00:00Z") / 1000;

describe("usage limit in the transcript tail", () => {
  it("reads the kind and the reset time, and nothing else", () => {
    expect(
      readTail([
        reply("2026-03-12T09:00:00Z"),
        limitLine("2026-03-12T09:10:00Z", "seven_day", resetsAt),
      ]).usageLimit,
    ).toEqual({
      kind: "weekly",
      resetsAt: "2026-03-13T18:00:00.000Z",
      at: "2026-03-12T09:10:00Z",
    });
  });
  it("reads the older shape without apiError, and the five-hour kind", () => {
    expect(
      readTail([olderLimitLine("2026-03-12T09:10:00Z", resetsAt)]).usageLimit,
    ).toMatchObject({ kind: "session" });
  });
  it("keeps an unknown kind as other, and a missing reset time as null", () => {
    expect(
      readTail([limitLine("2026-03-12T09:10:00Z", "something_new", undefined)])
        .usageLimit,
    ).toEqual({ kind: "other", resetsAt: null, at: "2026-03-12T09:10:00Z" });
  });
  it("is cleared by a later real reply, not by a user line", () => {
    const limited = limitLine("2026-03-12T09:10:00Z", "seven_day", resetsAt);
    expect(
      readTail([limited, user("2026-03-12T09:20:00Z")]).usageLimit,
    ).not.toBeNull();
    expect(
      readTail([
        limited,
        user("2026-03-12T09:20:00Z"),
        reply("2026-03-12T09:21:00Z"),
      ]).usageLimit,
    ).toBeNull();
  });
  it("does not count another API error as a usage limit", () => {
    const overloaded = line({
      type: "assistant",
      timestamp: "2026-03-12T09:10:00Z",
      message: { model: "<synthetic>", content: [] },
      error: "overloaded",
      isApiErrorMessage: true,
      apiErrorStatus: 529,
    });
    expect(readTail([overloaded]).usageLimit).toBeNull();
  });
  it("does not let the limit change the context size", () => {
    expect(
      readTail([
        reply("2026-03-12T09:00:00Z"),
        limitLine("2026-03-12T09:10:00Z", "seven_day", resetsAt),
      ]).contextTokens,
    ).toBe(40_003);
  });
});

describe("usage limit state and note", () => {
  const limit: UsageLimit = {
    kind: "weekly",
    resetsAt: "2026-03-13T18:00:00.000Z",
    at: "2026-03-12T09:10:00Z",
  };
  it("is active until the reset time", () => {
    expect(usageLimitIsActive(limit, new Date("2026-03-13T17:59:00Z"))).toBe(
      true,
    );
    expect(usageLimitIsActive(limit, new Date("2026-03-13T18:00:00Z"))).toBe(
      false,
    );
    expect(
      usageLimitIsActive(
        { ...limit, resetsAt: null },
        new Date("2026-03-20T00:00:00Z"),
      ),
    ).toBe(true);
  });
  it("gives a fixed note with the day and time, in the zone asked for", () => {
    expect(usageLimitNote(limit, new Date("2026-03-12T10:00:00Z"), "UTC")).toBe(
      "Weekly usage limit reached, resets 13 Mar 18:00",
    );
    expect(
      usageLimitNote(limit, new Date("2026-03-12T10:00:00Z"), "Asia/Tokyo"),
    ).toBe("Weekly usage limit reached, resets 14 Mar 03:00");
  });
  it("gives only the time when the reset is the same day", () => {
    expect(
      usageLimitNote(
        { ...limit, kind: "session", resetsAt: "2026-03-12T14:00:00.000Z" },
        new Date("2026-03-12T10:00:00Z"),
        "UTC",
      ),
    ).toBe("Session usage limit reached, resets 14:00");
    expect(
      usageLimitNote(
        { ...limit, kind: "other", resetsAt: null },
        new Date("2026-03-12T10:00:00Z"),
        "UTC",
      ),
    ).toBe("Usage limit reached");
  });
});

describe("usage limit status", () => {
  const record = {
    pid: 1,
    sessionId: "s",
    name: "Halcyon",
    state: "idle",
    cwd: null,
  };
  const now = new Date("2026-03-12T10:00:00Z");
  it("shows a limited session as blocked with the fixed note", () => {
    const tail = readTail([
      reply("2026-03-12T09:58:00Z"),
      limitLine("2026-03-12T09:59:00Z", "seven_day", resetsAt),
    ]);
    const report = reportFor(record, tail, now, "UTC");
    expect(report).toMatchObject({
      status: "blocked",
      note: "Weekly usage limit reached, resets 13 Mar 18:00",
      usageLimit: { kind: "weekly", resetsAt: "2026-03-13T18:00:00.000Z" },
    });
    expect(JSON.stringify(report)).not.toContain("hit your");
    expect(JSON.stringify(report)).not.toContain("Kestrel");
  });
  it("is blocked even while a permission prompt is open", () => {
    const tail = readTail([
      limitLine("2026-03-12T09:59:00Z", "seven_day", resetsAt),
    ]);
    expect(
      reportFor({ ...record, state: "requires_action" }, tail, now, "UTC")
        ?.status,
    ).toBe("blocked");
  });
  it("is no longer blocked after the reset time", () => {
    const tail = readTail([
      limitLine("2026-03-12T09:59:00Z", "seven_day", resetsAt),
    ]);
    expect(
      reportFor(record, tail, new Date("2026-03-13T18:01:00Z"), "UTC")?.status,
    ).toBe("idle");
  });
});
