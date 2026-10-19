/**
 * The MCP endpoint. Agents reach Atlas here: they report their status, send
 * messages, answer questions and read their work. Every write is an event,
 * so it lands in the log and on the map exactly as a posted event does.
 *
 * The endpoint is stateless: each request gets a fresh server and transport,
 * so nothing is kept between calls and a restart loses nothing.
 */
import {
  agentStatuses,
  Identifier,
  priorities,
  YOU,
  type AtlasEvent,
  type BacklogItem,
  type Dataset,
} from "@atlas/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";

import type { AtlasDatabase } from "./database";
import { canSee, type Machine } from "./machines";
import { EventRejected, readDataset, type StoredEvent } from "./store";

export interface McpOptions {
  database: AtlasDatabase;
  version: string;
  /** Stores an event and streams it to every open view. */
  record(event: AtlasEvent): StoredEvent;
  /** The calling machine. Its scope limits what the tools show and change. */
  machine?: Machine;
}

/** The most items `list_my_work` returns, so a reply stays readable. */
const workLimit = 40;

function reply(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

function refuse(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

const priorityOrder = Object.fromEntries(
  priorities.map((priority, index) => [priority, index]),
) as Record<BacklogItem["priority"], number>;

/** Open work first by priority, then by the day it is planned for. */
function byUrgency(left: BacklogItem, right: BacklogItem): number {
  return (
    priorityOrder[left.priority] - priorityOrder[right.priority] ||
    (left.scheduledFor ?? "9999").localeCompare(right.scheduledFor ?? "9999")
  );
}

function summary(item: BacklogItem) {
  return {
    id: item.id,
    title: item.title,
    state: item.state,
    priority: item.priority,
    ...(item.scheduledFor ? { scheduledFor: item.scheduledFor } : {}),
    ...(item.blocked ? { blocked: true } : {}),
    ...(item.tracker ? { tracker: item.tracker.key } : {}),
  };
}

/** Runs a write, turning a refused event into a tool error the agent can read. */
function attempt(write: () => CallToolResult): CallToolResult {
  try {
    return write();
  } catch (error) {
    if (error instanceof EventRejected) return refuse(error.message);
    throw error;
  }
}

export function createMcpServer({
  database,
  version,
  record,
  machine,
}: McpOptions): McpServer {
  const server = new McpServer(
    { name: "atlas", version },
    {
      instructions:
        "Atlas is the shared map of agents, clients and work. Call report_status when you start, change what you are doing, wait on someone, or finish. Use your agent id from list_agents.",
    },
  );
  const read = (): Dataset => readDataset(database);
  const clientOfAgent = (dataset: Dataset, agentId: string) => {
    const agent = dataset.agents.find((candidate) => candidate.id === agentId);
    return dataset.groups.find((group) => group.id === agent?.groupId)
      ?.clientId;
  };
  /** An agent the calling machine may see. One outside its scope reads as missing. */
  const agentNamed = (dataset: Dataset, agentId: string) => {
    const clientId = clientOfAgent(dataset, agentId);
    if (clientId === undefined || !canSee(machine, clientId)) return undefined;
    return dataset.agents.find((agent) => agent.id === agentId);
  };

  server.registerTool(
    "list_agents",
    {
      title: "List agents",
      description:
        "Every agent Atlas knows, with its id, client, host and status. Find your own id here.",
      annotations: { readOnlyHint: true },
    },
    () => {
      const dataset = read();
      const clientOf = new Map(
        dataset.groups.map((group) => [group.id, group.clientId]),
      );
      return reply(
        dataset.agents
          .filter((agent) => canSee(machine, clientOf.get(agent.groupId) ?? ""))
          .map((agent) => ({
            id: agent.id,
            name: agent.name,
            clientId: clientOf.get(agent.groupId),
            host: agent.host,
            status: agent.status,
            note: agent.note,
          })),
      );
    },
  );

  server.registerTool(
    "report_status",
    {
      title: "Report status",
      description:
        "Tell Atlas what you are doing. Use waiting when you need the person, blocked when something else stops you, and idle when you are done.",
      inputSchema: {
        agentId: Identifier.describe("Your agent id, from list_agents"),
        status: z.enum(agentStatuses),
        note: z
          .string()
          .min(1)
          .max(280)
          .describe("One line on what you are doing, as the map shows it"),
      },
    },
    ({ agentId, status, note }) =>
      attempt(() => {
        if (!agentNamed(read(), agentId)) return refuse(`no agent ${agentId}`);
        const stored = record({
          type: "status-change",
          agentId,
          to: status,
          text: note,
        });
        return reply({ recorded: stored.sequence });
      }),
  );

  server.registerTool(
    "send_message",
    {
      title: "Send a message",
      description:
        "Send a short message from one agent to another. It is drawn on the map and kept in the log.",
      inputSchema: {
        from: Identifier.describe("Your agent id"),
        to: Identifier.describe("The agent id it is for"),
        text: z.string().min(1).max(280),
      },
    },
    ({ from, to, text }) => {
      const dataset = read();
      for (const agentId of [from, to])
        if (!agentNamed(dataset, agentId)) return refuse(`no agent ${agentId}`);
      return attempt(() =>
        reply({
          recorded: record({ type: "agent-message", from, to, text }).sequence,
        }),
      );
    },
  );

  server.registerTool(
    "list_my_work",
    {
      title: "List my work",
      description:
        "What you are working on, then the open work for your client, most urgent first.",
      inputSchema: { agentId: Identifier.describe("Your agent id") },
      annotations: { readOnlyHint: true },
    },
    ({ agentId }) => {
      const dataset = read();
      const agent = agentNamed(dataset, agentId);
      if (!agent) return refuse(`no agent ${agentId}`);
      const clientId = dataset.groups.find(
        (group) => group.id === agent.groupId,
      )?.clientId;
      const workingOn = agent.workingOn
        .map((id) => dataset.items.find((item) => item.id === id))
        .filter((item): item is BacklogItem => item !== undefined);
      const open = dataset.items
        .filter(
          (item) =>
            item.clientId === clientId &&
            item.state !== "done" &&
            !agent.workingOn.includes(item.id),
        )
        .sort(byUrgency);
      return reply({
        agent: { id: agent.id, name: agent.name, status: agent.status },
        clientId,
        workingOn: workingOn.map(summary),
        open: open.slice(0, workLimit).map(summary),
        ...(open.length > workLimit
          ? { moreOpen: open.length - workLimit }
          : {}),
      });
    },
  );

  server.registerTool(
    "list_open_questions",
    {
      title: "List open questions",
      description:
        "Questions still waiting for an answer, with who must answer and what each one holds up.",
      inputSchema: {
        clientId: Identifier.optional().describe(
          "Only this client's questions",
        ),
      },
      annotations: { readOnlyHint: true },
    },
    ({ clientId }) =>
      reply(
        read()
          .questions.filter(
            (question) =>
              question.state === "open" &&
              canSee(machine, question.clientId) &&
              (!clientId || question.clientId === clientId),
          )
          .map(({ id, clientId: client, title, blocks, asks }) => ({
            id,
            clientId: client,
            title,
            blocks,
            asks,
            needsYou: asks === YOU,
          })),
      ),
  );

  server.registerTool(
    "answer_question",
    {
      title: "Answer a question",
      description:
        "Answer an open question. The answer becomes a decision on what the question held up.",
      inputSchema: {
        questionId: Identifier,
        answer: z.string().min(1).max(1000),
        decision: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe(
            "The decision as a short title. The question is used when left out",
          ),
      },
    },
    ({ questionId, answer, decision }) => {
      const question = read().questions.find(
        (candidate) =>
          candidate.id === questionId && canSee(machine, candidate.clientId),
      );
      if (!question) return refuse(`no question ${questionId}`);
      return attempt(() =>
        reply({
          recorded: record({
            type: "question-answered",
            questionId,
            answer,
            decision: {
              id: `answered-${questionId}`,
              clientId: question.clientId,
              title: decision ?? question.title.replace(/\?$/, ""),
              decides: question.blocks,
              state: "made",
              classification: question.classification,
              boundary: question.boundary,
            },
          }).sequence,
        }),
      );
    },
  );

  return server;
}

function sameHost(origin: string, url: string): boolean {
  try {
    return new URL(origin).host === new URL(url).host;
  } catch {
    return false;
  }
}

/**
 * Answers a request to `/mcp`. A request a browser sends from another site
 * carries an Origin that is not this server's own, and is refused, so a
 * page cannot drive the tools through a browser on the tailnet.
 */
export async function handleMcp(
  request: Request,
  options: McpOptions,
): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && !sameHost(origin, request.url))
    return new Response("Forbidden", { status: 403 });
  const server = createMcpServer(options);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // The JSON reply is complete once handleRequest returns.
    await server.close();
  }
}
