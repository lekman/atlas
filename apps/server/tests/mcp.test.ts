import { sampleDataset } from "@atlas/fixtures";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  createApi,
  listEvents,
  openDatabase,
  readDataset,
  seedDataset,
  type Api,
  type AtlasDatabase,
} from "../src";

let database: AtlasDatabase;
let api: Api;
let client: Client;

/** Calls a tool and returns its text, parsed when it is JSON. */
async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { type: string; text: string }[];
    isError?: boolean;
  };
  const text = result.content[0]?.text ?? "";
  let value: unknown = text;
  try {
    value = JSON.parse(text);
  } catch {
    // A refusal is plain text.
  }
  return { value, isError: result.isError === true };
}

beforeEach(async () => {
  database = openDatabase(":memory:");
  seedDataset(database, sampleDataset);
  api = createApi({ database, version: "0.0.0-test" });
  client = new Client({ name: "atlas-test", version: "0.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("http://atlas.test/mcp"), {
      fetch: async (input, init) => {
        const response = await api.handle(new Request(input, init));
        return response ?? new Response("Not found", { status: 404 });
      },
    }),
  );
});

afterEach(async () => {
  await client.close();
});

describe("the MCP tools", () => {
  test("are listed with their names", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "answer_question",
      "list_agents",
      "list_my_work",
      "list_open_questions",
      "report_status",
      "send_message",
    ]);
  });

  test("list_agents names every agent with its client", async () => {
    const { value } = await call("list_agents");
    const agents = value as { id: string; clientId: string }[];
    expect(agents).toHaveLength(sampleDataset.agents.length);
    expect(agents.find((agent) => agent.id === "test-runner")?.clientId).toBe(
      "halcyon",
    );
  });

  test("report_status changes the agent and logs one event", async () => {
    const { isError } = await call("report_status", {
      agentId: "test-runner",
      status: "waiting",
      note: "Needs the drill window",
    });
    expect(isError).toBe(false);
    const agent = readDataset(database).agents.find(
      (candidate) => candidate.id === "test-runner",
    );
    expect(agent).toMatchObject({
      status: "waiting",
      note: "Needs the drill window",
    });
    expect(listEvents(database)).toHaveLength(1);
  });

  test("report_status for an unknown agent is a tool error", async () => {
    const { value, isError } = await call("report_status", {
      agentId: "nobody",
      status: "idle",
      note: "Gone",
    });
    expect(isError).toBe(true);
    expect(String(value)).toContain("no agent nobody");
    expect(listEvents(database)).toHaveLength(0);
  });

  test("report_status refuses a status the model does not have", async () => {
    const { isError } = await call("report_status", {
      agentId: "test-runner",
      status: "sleeping",
      note: "Zzz",
    });
    expect(isError).toBe(true);
    expect(listEvents(database)).toHaveLength(0);
  });

  test("send_message logs a message between two known agents", async () => {
    expect(
      (
        await call("send_message", {
          from: "schema",
          to: "test-runner",
          text: "Rehearsal at ten",
        })
      ).isError,
    ).toBe(false);
    expect(
      (
        await call("send_message", {
          from: "schema",
          to: "nobody",
          text: "Hello",
        })
      ).isError,
    ).toBe(true);
    expect(listEvents(database).map((stored) => stored.event.type)).toEqual([
      "agent-message",
    ]);
  });

  test("list_my_work puts the agent's own work first, then its client's", async () => {
    const { value } = await call("list_my_work", { agentId: "test-runner" });
    const work = value as {
      clientId: string;
      workingOn: { id: string }[];
      open: { id: string; priority: string }[];
    };
    const agent = sampleDataset.agents.find(
      (candidate) => candidate.id === "test-runner",
    )!;
    expect(work.clientId).toBe("halcyon");
    expect(work.workingOn.map((item) => item.id)).toEqual(agent.workingOn);
    const order = ["high", "normal", "low"];
    const ranks = work.open.map((item) => order.indexOf(item.priority));
    expect(ranks).toEqual([...ranks].sort((left, right) => left - right));
    for (const item of work.open)
      expect(agent.workingOn).not.toContain(item.id);
  });

  test("list_open_questions and answer_question close a question", async () => {
    const before = (await call("list_open_questions", { clientId: "halcyon" }))
      .value as { id: string }[];
    expect(before.map((question) => question.id)).toContain("drill-window");
    const answered = await call("answer_question", {
      questionId: "drill-window",
      answer: "Saturday at ten",
    });
    expect(answered.isError).toBe(false);
    const after = (await call("list_open_questions", { clientId: "halcyon" }))
      .value as { id: string }[];
    expect(after.map((question) => question.id)).not.toContain("drill-window");
    expect(
      readDataset(database).decisions.find(
        (decision) => decision.id === "answered-drill-window",
      )?.fromQuestion,
    ).toBe("drill-window");
    expect(
      (
        await call("answer_question", {
          questionId: "drill-window",
          answer: "Again",
        })
      ).isError,
    ).toBe(true);
  });

  test("a write reaches open streams like a posted event", async () => {
    const controller = new AbortController();
    const stream = await api.handle(
      new Request("http://atlas.test/api/stream", {
        signal: controller.signal,
      }),
    );
    await call("report_status", {
      agentId: "test-runner",
      status: "running",
      note: "Streaming",
    });
    const reader = stream!.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes("Streaming")) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toContain('"agentId":"test-runner"');
    controller.abort();
  });
});

describe("the MCP endpoint", () => {
  test("refuses a browser request from another site", async () => {
    const response = await api.handle(
      new Request("http://atlas.test/mcp", {
        method: "POST",
        headers: {
          origin: "https://elsewhere.example",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(response?.status).toBe(403);
  });
});
