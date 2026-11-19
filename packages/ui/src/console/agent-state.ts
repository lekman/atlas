import { activities, type Activity } from "@atlas/core";

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
  /** What its last tool call was for, as its hooks reported it. */
  activity?: Activity;
  /** Tokens in its context at the last turn. */
  contextTokens?: number;
  /** When it last reported an activity. */
  activityAt?: string;
  /** How often it switched to each activity in this run of readings. */
  activityCounts?: Partial<Record<Activity, number>>;
  /** Its questions still waiting for an answer in Atlas. */
  openQuestions?: number;
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
  if (s === "offline" || s === "limited") return s;
  // An open question waits on the person, whatever the session is doing.
  if ((agent.openQuestions ?? 0) > 0) return "waiting";
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

/** Agents grouped by system, in the given order, then busiest first. */
export function agentsBySystem(
  agents: readonly AgentRecord[],
  order: readonly string[] = [],
): Array<{ system: string; agents: AgentRecord[] }> {
  const rank: Record<AgentState, number> = {
    waiting: 0,
    working: 1,
    limited: 2,
    idle: 3,
    offline: 4,
  };
  const at = (system: string) => {
    const i = order.indexOf(system);
    return i < 0 ? order.length : i;
  };
  const groups = new Map<string, AgentRecord[]>();
  for (const a of agents)
    groups.set(a.customer, [...(groups.get(a.customer) ?? []), a]);
  return [...groups.entries()]
    .sort(([a], [b]) => at(a) - at(b) || a.localeCompare(b))
    .map(([system, list]) => ({
      system,
      agents: list.sort(
        (a, b) =>
          rank[agentState(a)] - rank[agentState(b)] ||
          a.name.localeCompare(b.name),
      ),
    }));
}

/** The stations of the live view, one per activity, with the word shown. */
export const STATIONS: ReadonlyArray<{ activity: Activity; word: string }> =
  activities.map((activity) => ({
    activity,
    word: {
      reading: "Files",
      editing: "Edits",
      shell: "Shell",
      git: "Git",
      web: "Web",
      delegating: "Agents",
      asking: "You",
      other: "Other",
    }[activity],
  }));

/** One thing an agent told Atlas: a status report, or a question. */
export interface AgentFeedItem {
  kind: "status" | "question";
  at: string;
  /** A report's status: running, watching, waiting, blocked, error, idle. */
  to?: string;
  text?: string;
  /** A question's id, title, state and answer. */
  id?: string;
  title?: string;
  state?: "open" | "answered" | "delivered" | "withdrawn";
  answer?: string;
  answeredAt?: string;
  /** A report's full account, such as what a finished piece of work did. */
  detail?: string;
}

export interface AgentFeedDoc {
  agentId: string;
  items: AgentFeedItem[];
  fetchedAt?: string;
}

/** The host's answer, or null when it isn't one. */
export function readAgentFeed(value: unknown): AgentFeedDoc | null {
  if (typeof value !== "object" || value === null) return null;
  const { agentId, items, fetchedAt } = value as Partial<AgentFeedDoc>;
  if (typeof agentId !== "string" || !Array.isArray(items)) return null;
  return {
    agentId,
    items: items.filter(
      (i) =>
        i &&
        (i.kind === "status" || i.kind === "question") &&
        typeof i.at === "string",
    ),
    ...(fetchedAt ? { fetchedAt } : {}),
  };
}

/** A question that is no longer open; a report is never closed. */
export const isClosed = (item: AgentFeedItem): boolean =>
  item.kind === "question" && item.state !== "open";

/** The badge word and tone for one feed item. */
export function feedBadge(item: AgentFeedItem): {
  word: string;
  tone: "moving" | "blocked" | "waiting" | "done";
} {
  if (item.kind === "question")
    return item.state === "open"
      ? { word: "Question", tone: "blocked" }
      : item.state === "withdrawn"
        ? { word: "Withdrawn", tone: "waiting" }
        : { word: "Answered", tone: "done" };
  switch (item.to) {
    case "error":
      return { word: "Error", tone: "blocked" };
    case "blocked":
      return { word: "Blocked", tone: "blocked" };
    case "waiting":
      return { word: "Waiting", tone: "blocked" };
    case "idle":
      return { word: "Done", tone: "done" };
    case "running":
      return { word: "Started", tone: "moving" };
    default:
      return { word: "Report", tone: "waiting" };
  }
}

/** A reading is live for two minutes after the agent sent it. */
export const isLive = (agent: AgentRecord, now: Date): boolean =>
  !!agent.activityAt &&
  now.getTime() - new Date(agent.activityAt).getTime() < 120_000;
