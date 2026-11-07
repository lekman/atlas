import { describe, expect, it } from "bun:test";

import {
  matchAgent,
  plan,
  readHookInput,
  safeName,
  vesselId,
  WAITING_NOTE,
  type AtlasAgent,
  type HookInput,
} from "../src/plan";

const agents: AtlasAgent[] = [
  { id: "halcyon", name: "Halcyon", status: "running", note: "Working" },
  { id: "meridian", name: "Meridian Desk", status: "idle", note: "Idle" },
  {
    id: "subagent-a1",
    name: "Explore",
    status: "running",
    parentId: "halcyon",
  },
];

const event = (overrides: Partial<HookInput>): HookInput => ({
  event: "SubagentStart",
  sessionId: "9a2c3a17-1f1f-4e44-8281-947bc8d91990",
  agentId: "aea3d1efa31290936",
  agentType: "general-purpose",
  notificationType: null,
  ...overrides,
});

describe("readHookInput", () => {
  it("keeps only ids and enums from a real SubagentStart input", () => {
    expect(
      readHookInput({
        session_id: "9a2c3a17-1f1f-4e44-8281-947bc8d91990",
        transcript_path: "/Users/someone/.claude/projects/x.jsonl",
        cwd: "/Users/someone/work",
        prompt_id: "3ccbd7af-13a3-4416-94ad-955e6e22a5da",
        agent_id: "aea3d1efa31290936",
        agent_type: "general-purpose",
        hook_event_name: "SubagentStart",
      }),
    ).toEqual(event({}));
  });

  it("ignores events the plugin does not act on", () => {
    expect(
      readHookInput({ hook_event_name: "PreToolUse", session_id: "abc" }),
    ).toBeNull();
  });

  it("refuses a session id that could leave its folder", () => {
    expect(
      readHookInput({ hook_event_name: "SessionEnd", session_id: "../etc" }),
    ).toBeNull();
  });

  it("drops an agent id or type it cannot trust", () => {
    const input = readHookInput({
      hook_event_name: "SubagentStart",
      session_id: "abc",
      agent_id: "a/../b",
      agent_type: "Review the client's contract at https://x?y=1",
    });
    expect(input?.agentId).toBeNull();
    expect(input?.agentType).toBeNull();
  });
});

describe("names", () => {
  it("keeps plugin agent types and refuses free text", () => {
    expect(safeName("commander:commander")).toBe("commander:commander");
    expect(safeName("  Explore ")).toBe("Explore");
    expect(safeName("two\nlines")).toBeNull();
    expect(safeName(42)).toBeNull();
  });

  it("makes a vessel id Atlas accepts", () => {
    expect(vesselId("AEA3d1")).toBe("subagent-aea3d1");
    expect(vesselId("aea3d1")).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it("matches a session by name or prefix, never to a vessel", () => {
    expect(matchAgent("halcyon-69", agents)?.id).toBe("halcyon");
    expect(matchAgent("Meridian Desk", agents)?.id).toBe("meridian");
    expect(matchAgent("Explore", agents)).toBeUndefined();
    expect(matchAgent("Unknown", agents)).toBeUndefined();
  });
});

describe("plan", () => {
  it("launches a vessel from the session's agent", () => {
    expect(plan(event({}), "Halcyon", agents, [])).toEqual({
      calls: [
        {
          tool: "launch_vessel",
          arguments: {
            parentId: "halcyon",
            vesselId: "subagent-aea3d1efa31290936",
            name: "general-purpose",
            note: "Subagent started",
          },
        },
      ],
      track: ["subagent-aea3d1efa31290936"],
      untrack: [],
    });
  });

  it("names a vessel Subagent when its type was dropped", () => {
    const steps = plan(event({ agentType: null }), "Halcyon", agents, []);
    expect(steps.calls[0]?.arguments.name).toBe("Subagent");
  });

  it("does nothing for a session Atlas does not know", () => {
    expect(plan(event({}), "Stranger", agents, []).calls).toEqual([]);
    expect(plan(event({}), null, agents, []).calls).toEqual([]);
  });

  it("does not launch a vessel twice", () => {
    const steps = plan(event({ agentId: "a1" }), "Halcyon", agents, []);
    expect(steps.calls).toEqual([]);
  });

  it("returns a vessel when its subagent stops", () => {
    expect(
      plan(event({ event: "SubagentStop", agentId: "a1" }), null, agents, [
        "subagent-a1",
      ]),
    ).toEqual({
      calls: [
        {
          tool: "return_vessel",
          arguments: { vesselId: "subagent-a1", note: "Subagent finished" },
        },
      ],
      track: [],
      untrack: ["subagent-a1"],
    });
  });

  it("only forgets a vessel Atlas no longer has", () => {
    const steps = plan(
      event({ event: "SubagentStop", agentId: "gone" }),
      null,
      agents,
      ["subagent-gone"],
    );
    expect(steps).toEqual({ calls: [], track: [], untrack: ["subagent-gone"] });
  });

  it("returns every vessel still out when the session ends", () => {
    const steps = plan(event({ event: "SessionEnd" }), null, agents, [
      "subagent-a1",
      "subagent-gone",
    ]);
    expect(steps.calls).toEqual([
      {
        tool: "return_vessel",
        arguments: { vesselId: "subagent-a1", note: "Its session ended" },
      },
    ]);
    expect(steps.untrack).toEqual(["subagent-a1", "subagent-gone"]);
  });

  it("reports a permission prompt as waiting, with the note the collector clears", () => {
    const steps = plan(
      event({ event: "Notification", notificationType: "permission_prompt" }),
      "halcyon-69",
      agents,
      [],
    );
    expect(steps.calls).toEqual([
      {
        tool: "report_status",
        arguments: {
          agentId: "halcyon",
          status: "waiting",
          note: WAITING_NOTE,
        },
      },
    ]);
    expect(WAITING_NOTE).toMatch(/approval in its session$/);
  });

  it("does not report waiting twice, or for other notifications", () => {
    const waiting: AtlasAgent[] = [
      { id: "halcyon", name: "Halcyon", status: "waiting", note: WAITING_NOTE },
    ];
    const prompt = event({
      event: "Notification",
      notificationType: "permission_prompt",
    });
    expect(plan(prompt, "Halcyon", waiting, []).calls).toEqual([]);
    const idle = event({
      event: "Notification",
      notificationType: "idle_prompt",
    });
    expect(plan(idle, "Halcyon", agents, []).calls).toEqual([]);
  });
});
