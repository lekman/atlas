import type { AgentQuestionInput, AtlasEvent } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { beforeEach, describe, expect, test } from "bun:test";

import {
  appendEvent,
  createApi,
  createQuestionService,
  listEvents,
  openDatabase,
  seedDataset,
  tasksMessages,
  type AtlasDatabase,
  type MessageApi,
  type QuestionService,
} from "../src";

let database: AtlasDatabase;
let clock: Date;
let sent: { to: string; clientId: string; text: string }[];
let delivered: Map<string, string>;
let sendFails: boolean;
let service: QuestionService;

/** A tasks server in memory: it stores what is sent and says what was delivered. */
const messages: MessageApi = {
  async send(message) {
    if (sendFails) throw new Error("the tasks API answered HTTP 503");
    sent.push(message);
    return {
      id: `m-${sent.length}`,
      createdAt: clock.toISOString().replace(/\.\d{3}Z$/, "Z"),
    };
  },
  async inbox(to) {
    return sent
      .map((message, index) => ({ ...message, id: `m-${index + 1}` }))
      .filter((message) => message.to === to)
      .map((message) => ({
        id: message.id,
        ...(delivered.has(message.id)
          ? { deliveredAt: delivered.get(message.id)! }
          : {}),
      }));
  },
};

const everyClient = () => true;
const read = () => sampleDataset;

const asked: AgentQuestionInput = {
  session: { address: "halcyon-builder", account: "ultra-a", host: "studio" },
  clientId: "halcyon",
  taskId: "cut-over",
  questions: [
    {
      question: "Which region should the cut-over use?",
      options: [{ label: "West" }, { label: "North" }],
    },
  ],
};

function events(): AtlasEvent[] {
  return listEvents(database).map((stored) => stored.event);
}

beforeEach(() => {
  database = openDatabase(":memory:");
  seedDataset(database, sampleDataset);
  clock = new Date("2026-03-12T09:00:00.000Z");
  sent = [];
  delivered = new Map();
  sendFails = false;
  let next = 0;
  service = createQuestionService({
    database,
    record: (event) => appendEvent(database, event, clock),
    messages,
    now: () => clock,
    newId: () => `q-${++next}`,
    log: () => {},
  });
});

describe("asking", () => {
  test("stores an open question and records a question signal", () => {
    const result = service.ask(asked, read(), everyClient);
    if ("refusal" in result) throw new Error(result.refusal.message);
    expect(result.question.state).toBe("open");
    expect(service.get("q-1")?.state).toBe("open");
    expect(events()).toEqual([
      {
        type: "signal",
        source: "claude",
        key: "claude:question:q-1",
        kind: "question",
        event: "asked",
        questionId: "q-1",
        session: "halcyon-builder",
        cardOnly: false,
        client: "halcyon",
        recordIds: ["cut-over"],
        at: "2026-03-12T09:00:00.000Z",
        text: "Which region should the cut-over use?",
      },
    ]);
  });

  test("files a question that names no client under the home client", () => {
    const { clientId: _left, ...withoutClient } = asked;
    const result = service.ask(withoutClient, read(), everyClient);
    if ("refusal" in result) throw new Error(result.refusal.message);
    expect(result.question.clientId).toBe("ashgrove");
  });

  test("refuses a client the caller may not see, as if it did not exist", () => {
    const result = service.ask(
      asked,
      read(),
      (clientId) => clientId !== "halcyon",
    );
    expect("refusal" in result && result.refusal.reason).toBe("missing");
    expect(events()).toEqual([]);
  });

  test("links a card to its task's ticket, and keeps no question text", () => {
    const dataset = {
      ...sampleDataset,
      items: sampleDataset.items.map((item) =>
        item.id === "cut-over"
          ? {
              ...item,
              tracker: {
                system: "jira" as const,
                key: "HAL-12",
                url: "https://tracker.example/browse/HAL-12",
              },
            }
          : item,
      ),
    };
    const result = service.ask(
      {
        ...asked,
        cardOnly: true,
        questions: [],
        title: "A question waits in the client's own tools",
      },
      dataset,
      everyClient,
    );
    if ("refusal" in result) throw new Error(result.refusal.message);
    expect(result.question.link).toBe("https://tracker.example/browse/HAL-12");
    expect(JSON.stringify(events())).not.toContain("region");
  });
});

describe("answering", () => {
  beforeEach(() => {
    service.ask(asked, read(), everyClient);
  });

  test("closes the question on its first answer and sends the answer to the session", async () => {
    clock = new Date("2026-03-12T09:05:00.000Z");
    const result = service.answer(
      "q-1",
      { answer: "west", by: "you" },
      everyClient,
    );
    if ("refusal" in result) throw new Error(result.refusal.message);
    expect(result.question.state).toBe("answered");
    await service.deliver();
    expect(sent).toEqual([
      {
        to: "halcyon-builder",
        clientId: "halcyon",
        text: [
          "Answer to your question q-1 (task cut-over), from the owner through Atlas:",
          "- Which region should the cut-over use? → West",
        ].join("\n"),
      },
    ]);
    expect(service.get("q-1")?.messageId).toBe("m-1");
    expect(events().at(-1)).toMatchObject({
      type: "agent-question",
      questionId: "q-1",
      phase: "answered",
    });
  });

  test("refuses a second answer with when and by whom, and sends nothing more", async () => {
    clock = new Date("2026-03-12T09:05:00.000Z");
    service.answer("q-1", { answer: "West", by: "you" }, everyClient);
    const second = service.answer(
      "q-1",
      { answer: "North", by: "phone" },
      everyClient,
    );
    expect("refusal" in second && second.refusal).toEqual({
      reason: "conflict",
      message: "Question q-1 is already answered, at 2026-03-12T09:05Z by you",
    });
    await service.deliver();
    expect(sent).toHaveLength(1);
    expect(service.get("q-1")?.answers).toEqual({
      "Which region should the cut-over use?": "West",
    });
  });

  test("keeps an answer whose message could not be sent, and sends it on the next pass", async () => {
    sendFails = true;
    service.answer("q-1", { answer: "West", by: "you" }, everyClient);
    await service.deliver();
    expect(service.get("q-1")?.state).toBe("answered");
    expect(service.get("q-1")?.messageId).toBeUndefined();
    sendFails = false;
    await service.deliver();
    expect(sent).toHaveLength(1);
    expect(service.get("q-1")?.messageId).toBe("m-1");
  });

  test("moves the question to delivered once the session has read the message", async () => {
    service.answer("q-1", { answer: "West", by: "you" }, everyClient);
    await service.deliver();
    expect(service.get("q-1")?.state).toBe("answered");
    delivered.set("m-1", "2026-03-12T09:07:00Z");
    await service.deliver();
    expect(service.get("q-1")?.state).toBe("delivered");
    expect(service.get("q-1")?.deliveredAt).toBe("2026-03-12T09:07:00Z");
    expect(events().at(-1)).toMatchObject({
      type: "agent-question",
      phase: "delivered",
      text: "Answer delivered to halcyon-builder",
    });
    // A delivered question refuses an answer too.
    const late = service.answer(
      "q-1",
      { answer: "North", by: "you" },
      everyClient,
    );
    expect("refusal" in late && late.refusal.reason).toBe("conflict");
  });

  test("lists open questions only, and drops them once answered", () => {
    expect(service.list({ states: ["open"] }, everyClient)).toHaveLength(1);
    service.answer("q-1", { answer: "West", by: "you" }, everyClient);
    expect(service.list({ states: ["open"] }, everyClient)).toEqual([]);
    expect(
      service.list({ states: ["answered"] }, everyClient)[0]?.answers,
    ).toEqual({ "Which region should the cut-over use?": "West" });
  });

  test("withdraws a question and tells the session", async () => {
    service.close(
      "q-1",
      { resolution: "withdrawn", note: "Out of date", by: "you" },
      everyClient,
    );
    await service.deliver();
    expect(sent[0]?.text).toBe(
      "Question q-1 was withdrawn by the owner: Out of date. Decide with what you know, or ask again.",
    );
  });

  test("answers nothing it cannot find", () => {
    const result = service.answer(
      "q-9",
      { answer: "West", by: "you" },
      everyClient,
    );
    expect("refusal" in result && result.refusal.reason).toBe("missing");
  });
});

describe("the tasks server connection", () => {
  test("sends message_send and reads message_inbox as JSON-RPC tool calls", async () => {
    const calls: { name: string; arguments: Record<string, unknown> }[] = [];
    const api = tasksMessages({
      url: "http://tasks.test/mcp",
      token: async () => "secret",
      fetch: async (_url, init) => {
        const body = JSON.parse(String(init.body)) as {
          params: { name: string; arguments: Record<string, unknown> };
        };
        calls.push(body.params);
        const answer =
          body.params.name === "message_send"
            ? { id: "m-7", createdAt: "2026-03-12T09:00:00Z" }
            : {
                messages: [
                  { id: "m-7", deliveredAt: "2026-03-12T09:01:00Z" },
                  { id: "m-8" },
                ],
              };
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              content: [{ type: "text", text: JSON.stringify(answer) }],
            },
          }),
        );
      },
    });
    expect(
      await api.send({ to: "builder", clientId: "halcyon", text: "Hi" }),
    ).toEqual({ id: "m-7", createdAt: "2026-03-12T09:00:00Z" });
    expect(await api.inbox("builder", "2026-03-12T08:59:59Z")).toEqual([
      { id: "m-7", deliveredAt: "2026-03-12T09:01:00Z" },
      { id: "m-8" },
    ]);
    expect(calls).toEqual([
      {
        name: "message_send",
        arguments: {
          by: "atlas",
          to: "builder",
          clientId: "halcyon",
          text: "Hi",
        },
      },
      {
        name: "message_inbox",
        arguments: { to: "builder", since: "2026-03-12T08:59:59Z", limit: 200 },
      },
    ]);
  });
});

describe("the REST routes", () => {
  async function send(
    api: ReturnType<typeof createApi>,
    method: string,
    path: string,
    body?: unknown,
  ) {
    const response = await api.handle(
      new Request(`http://atlas.test${path}`, {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }),
      }),
      "127.0.0.1",
    );
    if (!response) throw new Error(`no response for ${path}`);
    return { status: response.status, body: await response.json() };
  }

  test("show open questions on the digest, answer the first time, and refuse the second with 409", async () => {
    const api = createApi({ database, version: "0.0.0-test" });
    const result = api.questions.ask(asked, read(), everyClient);
    if ("refusal" in result) throw new Error(result.refusal.message);
    const id = result.question.id;

    const digest = await send(api, "GET", "/api/digest");
    expect(digest.body).toEqual([
      {
        kind: "question",
        id,
        clientId: "halcyon",
        title: "Which region should the cut-over use?",
        session: "halcyon-builder",
        taskId: "cut-over",
        cardOnly: false,
        askedAt: result.question.askedAt,
      },
    ]);

    const first = await send(api, "POST", `/api/questions/${id}/answer`, {
      answer: "North",
    });
    expect(first.status).toBe(200);
    expect(first.body.state).toBe("answered");
    const second = await send(api, "POST", `/api/questions/${id}/answer`, {
      answer: "West",
    });
    expect(second.status).toBe(409);
    expect(second.body.error).toContain("is already answered");

    expect((await send(api, "GET", "/api/digest")).body).toEqual([]);
    const answered = await send(api, "GET", "/api/questions?state=answered");
    expect(
      answered.body.map((question: { id: string }) => question.id),
    ).toEqual([id]);
    api.close();
  });

  test("refuse an unknown question with 404 and a bad body with 400", async () => {
    const api = createApi({ database, version: "0.0.0-test" });
    expect(
      (await send(api, "POST", "/api/questions/q-none/answer", { answer: "x" }))
        .status,
    ).toBe(404);
    expect(
      (
        await send(api, "POST", "/api/questions/q-none/close", {
          resolution: "lost",
        })
      ).status,
    ).toBe(400);
    api.close();
  });
});
