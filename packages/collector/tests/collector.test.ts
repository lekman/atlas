import { describe, expect, it } from "bun:test";

import {
  activityOf,
  matchAgent,
  nameFromArgs,
  readSessionRecord,
  readTail,
  reportFor,
  safeName,
} from "../src";

const now = new Date("2026-03-12T10:00:00Z");
const line = (o: object) => JSON.stringify(o);
const assistant = (at: string, content: object[], usage = {}) =>
  line({ type: "assistant", timestamp: at, message: { content, usage } });

describe("session names", () => {
  it("keeps plain names and refuses anything else", () => {
    expect(safeName("Ops Portal")).toBe("Ops Portal");
    expect(safeName("halcyon-69")).toBe("halcyon-69");
    expect(safeName("rm -rf /; echo")).toBeNull();
    expect(safeName("x".repeat(80))).toBeNull();
  });
  it("reads --name, then --remote-control, from a command line", () => {
    expect(
      nameFromArgs("claude --name Commander --remote-control Commander hi"),
    ).toBe("Commander");
    expect(
      nameFromArgs("claude --resume abc --remote-control Ops Portal"),
    ).toBe("Ops Portal");
    expect(nameFromArgs("claude --resume abc")).toBeNull();
  });
  it("keeps only the record fields it needs", () => {
    expect(
      readSessionRecord({
        pid: 7,
        sessionId: "s",
        name: "Halcyon",
        status: "requires_action",
        cwd: "/x",
        messagingToken: "secret",
      }),
    ).toEqual({
      pid: 7,
      sessionId: "s",
      name: "Halcyon",
      state: "requires_action",
      cwd: "/x",
    });
    expect(readSessionRecord({ name: "x" })).toBeNull();
  });
});

describe("activity", () => {
  it("names a tool's activity, and tells git from other shell work", () => {
    expect(activityOf("Read")).toBe("reading");
    expect(activityOf("Edit")).toBe("editing");
    expect(activityOf("Bash", { command: "git push origin main" })).toBe("git");
    expect(activityOf("Bash", { command: "bun test" })).toBe("shell");
    expect(activityOf("Agent")).toBe("delegating");
    expect(activityOf("mcp__x__y")).toBe("other");
  });
});

describe("transcript tail", () => {
  const lines = [
    line({
      type: "user",
      timestamp: "2026-03-12T09:50:00Z",
      message: { content: "Tell me the client's secret plan" },
    }),
    assistant(
      "2026-03-12T09:51:00Z",
      [
        {
          type: "tool_use",
          name: "Read",
          input: { file_path: "/clients/kestrel/plan.md" },
        },
      ],
      {
        input_tokens: 10,
        cache_read_input_tokens: 90_000,
        cache_creation_input_tokens: 2_000,
      },
    ),
    assistant(
      "2026-03-12T09:58:00Z",
      [
        {
          type: "tool_use",
          name: "Bash",
          input: { command: "git commit -m 'Kestrel pricing'" },
        },
      ],
      {
        input_tokens: 5,
        cache_read_input_tokens: 95_000,
      },
    ),
    "{not json",
  ];
  it("finds the last tool, the last write and the context size", () => {
    expect(readTail(lines)).toEqual({
      lastToolAt: "2026-03-12T09:58:00Z",
      lastActivity: "git",
      lastWriteAt: "2026-03-12T09:58:00Z",
      contextTokens: 95_005,
      openToolSince: null,
    });
  });
  it("lets no message text, tool input or path into the report", () => {
    const report = reportFor(
      {
        pid: 1,
        sessionId: "s",
        name: "Halcyon",
        state: "idle",
        cwd: "/clients/kestrel",
      },
      readTail(lines),
      now,
    );
    const sent = JSON.stringify(report);
    for (const leak of [
      "secret",
      "Kestrel",
      "kestrel",
      "plan.md",
      "commit",
      "pricing",
      "/clients",
    ])
      expect(sent).not.toContain(leak);
  });
});

describe("status", () => {
  const record = {
    pid: 1,
    sessionId: "s",
    name: "Halcyon",
    state: "idle",
    cwd: null,
  };
  const tail = (lastToolAt: string | null) => ({
    lastToolAt,
    lastActivity: lastToolAt ? ("editing" as const) : null,
    lastWriteAt: lastToolAt,
    contextTokens: null,
    openToolSince: null,
  });
  it("shows a session stuck on approval as waiting", () => {
    expect(
      reportFor({ ...record, state: "requires_action" }, tail(null), now),
    ).toMatchObject({
      status: "waiting",
      note: "Waiting for approval in its session",
    });
  });
  it("is running with its activity within five minutes of a tool call", () => {
    expect(reportFor(record, tail("2026-03-12T09:57:00Z"), now)).toMatchObject({
      status: "running",
      note: "Editing files",
    });
  });
  it("turns idle after five quiet minutes, and skips a session without a safe name", () => {
    expect(reportFor(record, tail("2026-03-12T09:50:00Z"), now)?.status).toBe(
      "idle",
    );
    expect(reportFor({ ...record, name: null }, tail(null), now)).toBeNull();
  });
});

describe("sessions without a record", () => {
  const open = [
    assistant("2026-03-12T09:40:00Z", [
      { type: "tool_use", id: "t1", name: "Read", input: {} },
    ]),
    line({
      type: "user",
      timestamp: "2026-03-12T09:40:01Z",
      message: { content: [{ type: "tool_result", tool_use_id: "t1" }] },
    }),
    assistant("2026-03-12T09:45:00Z", [
      { type: "tool_use", id: "t2", name: "Bash", input: { command: "ls" } },
    ]),
  ];
  const record = {
    pid: 1,
    sessionId: "s",
    name: "Gaps",
    state: null,
    cwd: null,
  };
  it("finds a tool call with no result", () => {
    expect(readTail(open).openToolSince).toBe("2026-03-12T09:45:00Z");
  });
  it("calls a call open for ten minutes possibly waiting", () => {
    expect(reportFor(record, readTail(open), now)).toMatchObject({
      status: "waiting",
      note: "Possibly waiting for approval in its session",
    });
    expect(
      reportFor(record, readTail(open), new Date("2026-03-12T09:50:00Z"))
        ?.status,
    ).toBe("running");
  });
  it("matches a session to its Atlas agent by name or prefix", () => {
    const agents = [
      { id: "a1", name: "Halcyon" },
      { id: "a2", name: "Ops Portal" },
    ];
    expect(matchAgent("halcyon-69", agents)?.id).toBe("a1");
    expect(matchAgent("Ops Portal", agents)?.id).toBe("a2");
    expect(matchAgent("Atlas", agents)).toBeUndefined();
  });
});
