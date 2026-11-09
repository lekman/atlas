import type { AgentStatus } from "@atlas/core";
import type { SessionReport } from "@atlas/collector";

/** An agent as list_agents returns it. */
export interface AtlasAgent {
  id: string;
  name: string;
  status: AgentStatus;
  note?: string;
}

/** Thirty quiet minutes before the collector calls a running agent idle. */
export const STALE_AFTER_MS = 30 * 60_000;

const APPROVAL = /approval in its session$/;
const USAGE_LIMIT = /usage limit reached/i;

/**
 * What to report for one agent, or null to leave it. Agents report their own
 * status with richer notes, so the collector steps in only where it knows
 * better: a session that hit a usage limit is blocked; a session stuck on
 * approval is waiting; a working session Atlas shows idle is running; a
 * running agent quiet for thirty minutes is idle; and its own "waiting for
 * approval" or usage-limit block is cleared once the cause is gone.
 */
export function decide(
  report: SessionReport,
  agent: AtlasAgent,
  quietMs: number,
): { status: AgentStatus; note: string } | null {
  if (report.status === "blocked")
    return agent.status === "blocked" && agent.note === report.note
      ? null
      : { status: "blocked", note: report.note };
  if (agent.status === "blocked" && USAGE_LIMIT.test(agent.note ?? ""))
    return { status: report.status, note: report.note };
  const ours = APPROVAL.test(agent.note ?? "");
  if (report.status === "waiting")
    return agent.status === "waiting" && agent.note === report.note
      ? null
      : { status: "waiting", note: report.note };
  if (agent.status === "waiting" && ours)
    return { status: report.status, note: report.note };
  if (report.status === "running" && agent.status === "idle")
    return { status: "running", note: report.note };
  if (
    report.status === "idle" &&
    agent.status === "running" &&
    quietMs >= STALE_AFTER_MS
  )
    return { status: "idle", note: "Idle" };
  return null;
}
