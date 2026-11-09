/**
 * The dashboard MCP server, for the sidebar page the server serves. In the
 * Claude desktop app the sidebar reaches it as the local server
 * `host:dashboard`; here the Atlas server starts it over stdio and forwards
 * the sidebar's calls, only for the tools the sidebar uses.
 *
 * The process starts on the first call and again on the next call after it
 * exits. Its stderr is dropped, so nothing it prints reaches this log.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { splitCommand } from "./task-database";

/**
 * The tools the sidebar calls on `host:dashboard`, from `apps/sidebar/src`.
 * Any other name is refused before it reaches the dashboard server.
 */
export const dashboardTools = [
  "commander_answer",
  "commander_plan",
  "commander_requests",
  "commander_send",
  "details_read",
  "host_stats",
  "release_status",
  "sync_now",
  "task_assess",
  "task_done",
  "task_grade_many",
  "task_move",
  "task_move_many",
  "task_prs",
  "waiting_on_you",
  "worklist",
] as const;

export type DashboardTool = (typeof dashboardTools)[number];

const allowed = new Set<string>(dashboardTools);

export function isDashboardTool(name: string): name is DashboardTool {
  return allowed.has(name);
}

/** A call's outcome: the tool's result as MCP sent it, or why there is none. */
export type DashboardAnswer =
  | { ok: true; result: unknown }
  | {
      ok: false;
      code: "server_unavailable" | "tool_error";
      message: string;
    };

export interface DashboardHost {
  call(
    tool: DashboardTool,
    args: Record<string, unknown>,
  ): Promise<DashboardAnswer>;
  close(): Promise<void>;
}

/** How a host reaches an MCP client; tests pass their own. */
export type DashboardConnector = () => Promise<{
  callTool(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<{ isError?: unknown; content?: unknown }>;
  close(): Promise<void>;
  /** Called when the connection ends by itself. */
  onClose(listener: () => void): void;
}>;

/** Starts the command with the MCP SDK's stdio transport. */
export function stdioConnector(
  command: string,
  timeoutMilliseconds = 120_000,
): DashboardConnector {
  const [program, ...programArguments] = splitCommand(command);
  if (!program) throw new Error("ATLAS_DASHBOARD_MCP_COMMAND is empty");
  return async () => {
    const transport = new StdioClientTransport({
      command: program,
      args: programArguments,
      stderr: "ignore",
    });
    const client = new Client({ name: "atlas-server", version: "1" });
    await client.connect(transport);
    return {
      callTool: async (tool, args) =>
        (await client.callTool({ name: tool, arguments: args }, undefined, {
          timeout: timeoutMilliseconds,
        })) as { isError?: unknown; content?: unknown },
      close: () => client.close(),
      onClose(listener) {
        client.onclose = listener;
      },
    };
  };
}

/** The text of an error result, which the dashboard server writes for a person. */
function errorText(content: unknown): string {
  if (!Array.isArray(content)) return "the dashboard server reported an error";
  const text = content
    .map((part: unknown) => {
      const value = (part as { text?: unknown } | null)?.text;
      return typeof value === "string" ? value : "";
    })
    .join(" ")
    .trim();
  return text.slice(0, 500) || "the dashboard server reported an error";
}

export function createDashboardHost(
  connect: DashboardConnector,
): DashboardHost {
  let connection: ReturnType<DashboardConnector> | null = null;

  function connected() {
    if (!connection) {
      const opening = connect();
      connection = opening;
      opening.then(
        (open) =>
          open.onClose(() => {
            if (connection === opening) connection = null;
          }),
        () => {
          if (connection === opening) connection = null;
        },
      );
    }
    return connection;
  }

  return {
    async call(tool, args) {
      let open: Awaited<ReturnType<DashboardConnector>>;
      try {
        open = await connected();
      } catch {
        return {
          ok: false,
          code: "server_unavailable",
          message: "the dashboard server did not start",
        };
      }
      try {
        const result = await open.callTool(tool, args);
        if (result.isError)
          return {
            ok: false,
            code: "tool_error",
            message: errorText(result.content),
          };
        return { ok: true, result };
      } catch {
        // A failed call may mean the process is gone; start it next time.
        connection = null;
        await open.close().catch(() => undefined);
        return {
          ok: false,
          code: "server_unavailable",
          message: "the dashboard server did not answer",
        };
      }
    },
    async close() {
      const open = connection;
      connection = null;
      if (open) await (await open.catch(() => null))?.close();
    },
  };
}
