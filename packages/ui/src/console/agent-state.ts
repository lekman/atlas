/** One agent as the dashboard host's `agents` tool reads it from Atlas. */
export interface AgentRecord {
  id: string;
  name: string;
  /** The task database's client id, for messages. */
  clientId: string | null;
  /** The page's client key. */
  customer: string;
  host: string;
  status: string;
  /** What the agent last said it is doing, or its roster note. */
  note: string;
  /** Worklist refs of the tasks it works on. */
  refs?: string[];
  session?: {
    state: "busy" | "waiting" | "idle" | "limited" | "offline";
    since: string;
    activity?: { startedAt?: string; toolCalls?: number; lastCallAt?: string };
  };
}

export interface AgentsDoc {
  agents: AgentRecord[];
  fetchedAt?: string;
}

/** The host's answer, or null when it isn't one. */
export function readAgents(value: unknown): AgentsDoc | null {
  if (typeof value !== "object" || value === null) return null;
  const agents = (value as { agents?: unknown }).agents;
  if (!Array.isArray(agents)) return null;
  return {
    ...(value as AgentsDoc),
    agents: (agents as AgentRecord[]).filter(
      (a) => a && typeof a.id === "string" && typeof a.name === "string",
    ),
  };
}

export type AgentState = "working" | "waiting" | "idle" | "limited" | "offline";

/** What an agent is up to: its live session's state, else Atlas's own status. */
export function agentState(agent: AgentRecord): AgentState {
  const s = agent.session?.state;
  if (s === "busy") return "working";
  if (s === "waiting" || s === "idle" || s === "limited" || s === "offline")
    return s;
  if (agent.status === "running") return "working";
  if (agent.status === "waiting") return "waiting";
  if (/session offline/i.test(agent.note)) return "offline";
  return "idle";
}

export const AGENT_STATE_WORDS: Record<AgentState, string> = {
  working: "Working",
  waiting: "Waiting on you",
  idle: "Idle",
  limited: "Usage limit",
  offline: "Offline",
};

/** Agents grouped by host, busiest first within each, then by name. */
export function agentsByHost(
  agents: readonly AgentRecord[],
): Array<{ host: string; agents: AgentRecord[] }> {
  const rank: Record<AgentState, number> = {
    waiting: 0,
    working: 1,
    limited: 2,
    idle: 3,
    offline: 4,
  };
  const groups = new Map<string, AgentRecord[]>();
  for (const a of agents)
    groups.set(a.host, [...(groups.get(a.host) ?? []), a]);
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([host, list]) => ({
      host,
      agents: list.sort(
        (a, b) =>
          rank[agentState(a)] - rank[agentState(b)] ||
          a.name.localeCompare(b.name),
      ),
    }));
}
