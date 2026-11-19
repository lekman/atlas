import { describe, expect, it } from "bun:test";

import {
  agentsBySystem,
  agentState,
  readAgents,
  type AgentRecord,
} from "../src/console";

const agent = (over: Partial<AgentRecord>): AgentRecord => ({
  id: "a",
  name: "A",
  clientId: "acme-co",
  customer: "acme",
  host: "Mac mini",
  status: "idle",
  note: "",
  ...over,
});

describe("agentState", () => {
  it("follows the live session first", () => {
    expect(agentState(agent({ session: { state: "busy", since: "" } }))).toBe(
      "working",
    );
    expect(
      agentState(agent({ session: { state: "offline", since: "" } })),
    ).toBe("offline");
  });

  it("falls back to Atlas's status and its offline note", () => {
    expect(agentState(agent({ status: "running" }))).toBe("working");
    expect(agentState(agent({ status: "waiting" }))).toBe("waiting");
    expect(agentState(agent({ note: "Session offline" }))).toBe("offline");
    expect(agentState(agent({}))).toBe("idle");
  });
});

describe("agentsBySystem", () => {
  it("groups by system in the page's order, waiting and working before idle", () => {
    const groups = agentsBySystem(
      [
        agent({ id: "1", name: "Zed", customer: "beta" }),
        agent({ id: "2", name: "Idle one" }),
        agent({ id: "3", name: "Busy one", status: "running" }),
        agent({ id: "4", name: "Asks", status: "waiting" }),
      ],
      ["beta", "acme"],
    );
    expect(groups.map((g) => g.system)).toEqual(["beta", "acme"]);
    expect(groups[1]!.agents.map((a) => a.name)).toEqual([
      "Asks",
      "Busy one",
      "Idle one",
    ]);
  });
});

describe("an open question", () => {
  it("makes an idle or busy agent wait on you, but not an offline one", () => {
    expect(agentState(agent({ openQuestions: 1 }))).toBe("waiting");
    expect(
      agentState(
        agent({ openQuestions: 1, session: { state: "busy", since: "" } }),
      ),
    ).toBe("waiting");
    expect(
      agentState(
        agent({ openQuestions: 1, session: { state: "offline", since: "" } }),
      ),
    ).toBe("offline");
  });
});

describe("readAgents", () => {
  it("keeps agents with an id and a name", () => {
    expect(readAgents({ agents: [agent({}), { id: 3 }] })?.agents).toHaveLength(
      1,
    );
    expect(readAgents({})).toBeNull();
  });
});
