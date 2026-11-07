/**
 * The plugin's pure half: which Atlas MCP calls one Claude Code hook event
 * makes. It reads only enums and ids from the event, so nothing an author
 * wrote reaches Atlas: no prompt, no tool input, no file path.
 *
 * - SubagentStart launches a vessel from the session's own agent.
 * - SubagentStop returns it.
 * - SessionEnd returns every vessel this session launched that is still out.
 * - A permission prompt reports the session's agent as waiting, with the
 *   note the collector already clears once the prompt is answered.
 *
 * The idea of reading subagents from hooks instead of asking agents to
 * report them comes from apiarius (github.com/yusuflkq/apiarius, MIT).
 */

/** The hook events the plugin acts on. */
export const hookEvents = [
  "SubagentStart",
  "SubagentStop",
  "SessionEnd",
  "Notification",
] as const;
export type HookEvent = (typeof hookEvents)[number];

/** The fields kept from a hook's input. Everything else is dropped on parse. */
export interface HookInput {
  event: HookEvent;
  sessionId: string;
  agentId: string | null;
  agentType: string | null;
  notificationType: string | null;
}

/** An agent as list_agents returns it. */
export interface AtlasAgent {
  id: string;
  name: string;
  status: string;
  note?: string;
  parentId?: string;
}

/** One MCP tool call to make. */
export interface ToolCall {
  tool: "launch_vessel" | "return_vessel" | "report_status";
  arguments: Record<string, string>;
}

/** What one event needs: the calls, and the vessel ids it starts or stops tracking. */
export interface Plan {
  calls: ToolCall[];
  track: string[];
  untrack: string[];
}

/** The note the collector's decide() clears once the session is no longer waiting. */
export const WAITING_NOTE = "Waiting for approval in its session";

const SESSION_ID = /^[A-Za-z0-9-]{1,64}$/;
const AGENT_ID = /^[a-z0-9]{1,48}$/i;
const NAME = /^[A-Za-z0-9][A-Za-z0-9 ._:-]{0,63}$/;

const text = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/** The fields the plugin keeps from a hook's JSON input, or null for an event it ignores. */
export function readHookInput(json: unknown): HookInput | null {
  const input = json as Record<string, unknown> | null;
  if (!input || typeof input !== "object") return null;
  const event = text(input.hook_event_name);
  const sessionId = text(input.session_id);
  if (!hookEvents.includes(event as HookEvent)) return null;
  if (!sessionId || !SESSION_ID.test(sessionId)) return null;
  const agentId = text(input.agent_id);
  return {
    event: event as HookEvent,
    sessionId,
    agentId: agentId && AGENT_ID.test(agentId) ? agentId : null,
    agentType: safeName(input.agent_type),
    notificationType: text(input.notification_type),
  };
}

/** A name safe to send: letters, digits, spaces, dots, colons, hyphens, underscores. */
export function safeName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return NAME.test(trimmed) ? trimmed : null;
}

/** The Atlas id of the vessel for a subagent. */
export function vesselId(agentId: string): string {
  return `subagent-${agentId.toLowerCase()}`;
}

/**
 * The Atlas agent a session name belongs to: the same name, without case,
 * or a name the session's name starts with ("Halcyon" for "halcyon-69").
 * The same rule as matchAgent in @atlas/collector, kept here because an
 * installed plugin holds only its own folder. Vessels never match.
 */
export function matchAgent(
  session: string,
  agents: readonly AtlasAgent[],
): AtlasAgent | undefined {
  const normal = (name: string) =>
    name.trim().toLowerCase().replace(/\s+/g, "-");
  const wanted = normal(session);
  const roots = agents.filter((agent) => !agent.parentId);
  return (
    roots.find((agent) => normal(agent.name) === wanted) ??
    roots.find((agent) => wanted.startsWith(`${normal(agent.name)}-`))
  );
}

const none: Plan = { calls: [], track: [], untrack: [] };

/**
 * The calls for one hook event.
 *
 * @param input - The event, as readHookInput kept it.
 * @param sessionName - The session's name from its record, or null.
 * @param agents - Every agent Atlas lists.
 * @param tracked - The vessel ids this session launched and has not returned.
 */
export function plan(
  input: HookInput,
  sessionName: string | null,
  agents: readonly AtlasAgent[],
  tracked: readonly string[],
): Plan {
  const exists = (id: string) => agents.some((agent) => agent.id === id);
  switch (input.event) {
    case "SubagentStart": {
      if (!input.agentId || !sessionName) return none;
      const parent = matchAgent(sessionName, agents);
      const id = vesselId(input.agentId);
      if (!parent || exists(id)) return none;
      return {
        calls: [
          {
            tool: "launch_vessel",
            arguments: {
              parentId: parent.id,
              vesselId: id,
              name: input.agentType ?? "Subagent",
              note: "Subagent started",
            },
          },
        ],
        track: [id],
        untrack: [],
      };
    }
    case "SubagentStop": {
      if (!input.agentId) return none;
      const id = vesselId(input.agentId);
      return {
        calls: exists(id)
          ? [
              {
                tool: "return_vessel",
                arguments: { vesselId: id, note: "Subagent finished" },
              },
            ]
          : [],
        track: [],
        untrack: [id],
      };
    }
    case "SessionEnd":
      return {
        calls: tracked.filter(exists).map((id) => ({
          tool: "return_vessel",
          arguments: { vesselId: id, note: "Its session ended" },
        })),
        track: [],
        untrack: [...tracked],
      };
    case "Notification": {
      if (input.notificationType !== "permission_prompt" || !sessionName)
        return none;
      const agent = matchAgent(sessionName, agents);
      if (!agent || (agent.status === "waiting" && agent.note === WAITING_NOTE))
        return none;
      return {
        calls: [
          {
            tool: "report_status",
            arguments: {
              agentId: agent.id,
              status: "waiting",
              note: WAITING_NOTE,
            },
          },
        ],
        track: [],
        untrack: [],
      };
    }
  }
}
