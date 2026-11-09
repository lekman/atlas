/**
 * A stand-in dashboard MCP server over stdio, for the tests of
 * `dashboard-host.ts`: `worklist` echoes its arguments, `task_done` fails
 * as a tool error.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";

const server = new McpServer({ name: "dashboard-fixture", version: "1" });

server.registerTool(
  "worklist",
  { inputSchema: { day: z.string().optional() } },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify({ echoed: args }) }],
    structuredContent: { echoed: args },
  }),
);

server.registerTool("task_done", { inputSchema: {} }, async () => ({
  isError: true,
  content: [{ type: "text", text: "no task with that ref" }],
}));

await server.connect(new StdioServerTransport());
