/**
 * What each agent's session is doing now, as the collector reads it: the
 * activity from its last tool, and its context size. This is live state.
 * It is kept in memory only, never written as an event, and is lost on a
 * restart, when the collector sends it again within a minute.
 *
 * A reading counts for `freshFor` (30 minutes) after it arrives. The server
 * lays fresh readings over the agents it serves; a stale one is dropped.
 */
import type { Activity, Agent, Dataset } from "@atlas/core";

/** One reading for an agent. `null` means the collector saw none. */
export interface ActivityReading {
  activity: Activity | null;
  contextTokens: number | null;
}

export interface AgentActivity {
  /**
   * Stores a reading. Returns true when it changes what a view shows: a
   * new activity, or a context size that moved by a tenth or more.
   */
  set(agentId: string, reading: ActivityReading): boolean;
  /** The agents with their fresh readings laid over them. */
  overlay(dataset: Dataset): Dataset;
  /**
   * How many readings of each activity an agent's current run of fresh
   * readings holds. The collector sends a reading when the activity or the
   * context changes, and again after 10 minutes without a change, so a
   * count is about how often the agent turned to that activity. A run
   * starts again after a stale gap.
   */
  counts(agentId: string): Partial<Record<Activity, number>>;
}

/** How long a reading counts: the collector's own "stopped" window. */
export const ACTIVITY_FRESH_MS = 30 * 60_000;

/** True when two context sizes differ by a tenth of the larger or more. */
function contextMoved(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return before !== after;
  const larger = Math.max(before, after);
  return larger > 0 && Math.abs(after - before) / larger >= 0.1;
}

export function createAgentActivity({
  now = () => new Date(),
  freshFor = ACTIVITY_FRESH_MS,
}: { now?: () => Date; freshFor?: number } = {}): AgentActivity {
  const readings = new Map<string, ActivityReading & { at: number }>();
  const tallies = new Map<string, Partial<Record<Activity, number>>>();
  const fresh = (at: number) => now().getTime() - at < freshFor;

  return {
    set(agentId, reading) {
      const before = readings.get(agentId);
      const tally =
        before && fresh(before.at) ? (tallies.get(agentId) ?? {}) : {};
      if (reading.activity)
        tally[reading.activity] = (tally[reading.activity] ?? 0) + 1;
      tallies.set(agentId, tally);
      readings.set(agentId, { ...reading, at: now().getTime() });
      if (!before || !fresh(before.at))
        return reading.activity !== null || reading.contextTokens !== null;
      return (
        before.activity !== reading.activity ||
        contextMoved(before.contextTokens, reading.contextTokens)
      );
    },
    overlay(dataset) {
      if (readings.size === 0) return dataset;
      let changed = false;
      const agents = dataset.agents.map((agent): Agent => {
        const reading = readings.get(agent.id);
        if (!reading) return agent;
        if (!fresh(reading.at)) {
          readings.delete(agent.id);
          tallies.delete(agent.id);
          return agent;
        }
        changed = true;
        return {
          ...agent,
          ...(reading.activity ? { activity: reading.activity } : {}),
          ...(reading.contextTokens !== null
            ? { contextTokens: reading.contextTokens }
            : {}),
          activityAt: new Date(reading.at).toISOString(),
        };
      });
      return changed ? { ...dataset, agents } : dataset;
    },
    counts(agentId) {
      const reading = readings.get(agentId);
      return reading && fresh(reading.at)
        ? { ...(tallies.get(agentId) ?? {}) }
        : {};
    },
  };
}
