/**
 * Questions agents ask the person, kept in SQLite, and the delivery of each
 * answer back to the session that asked.
 *
 * - A question is stored `open` and recorded as a question signal.
 * - The first answer (or close) moves it to `answered` and records an
 *   `agent-question` event. Every later answer is refused with when and by
 *   whom it was settled. The write only changes a row that is still open, so
 *   two answers can never both win.
 * - A delivery pass sends each answered question's message to the session's
 *   address through the tasks server, then reads the tasks server back: once
 *   the session's delivery hook has marked the message delivered, the
 *   question moves to `delivered`. A message that could not be sent is sent
 *   on the next pass.
 *
 * The rules themselves are pure, in `@atlas/core` (`agent-questions.ts`).
 */
import {
  answerAgentQuestion,
  AgentQuestion,
  closeAgentQuestion,
  deliveryText,
  homeOf,
  markDelivered,
  newAgentQuestion,
  settledRefusal,
  type AgentQuestionInput,
  type AgentQuestionState,
  type AnswerInput,
  type AtlasEvent,
  type CloseInput,
  type Dataset,
  type QuestionChange,
} from "@atlas/core";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { AtlasDatabase } from "./database";
import { callTool, type HttpConnection } from "./dispatcher-connections";
import * as schema from "./schema";

/** The tasks server's messages, as the questions need them. */
export interface MessageApi {
  send(message: {
    to: string;
    clientId: string;
    text: string;
  }): Promise<{ id: string; createdAt: string }>;
  /** Messages to a session created after `since`, with their delivery time when delivered. */
  inbox(
    to: string,
    since: string,
  ): Promise<{ id: string; deliveredAt?: string }[]>;
}

/** The messages API through the tasks MCP server's HTTP endpoint. */
export function tasksMessages(
  connection: HttpConnection,
  by = "atlas",
): MessageApi {
  return {
    async send({ to, clientId, text }) {
      const answer = (await callTool(connection, "message_send", {
        by,
        to,
        clientId,
        text,
      })) as { id?: unknown; createdAt?: unknown };
      if (
        typeof answer?.id !== "string" ||
        typeof answer.createdAt !== "string"
      )
        throw new Error("message_send gave no id");
      return { id: answer.id, createdAt: answer.createdAt };
    },
    async inbox(to, since) {
      const answer = await callTool(connection, "message_inbox", {
        to,
        since,
        limit: 200,
      });
      if (!Array.isArray(answer)) return [];
      return answer
        .filter(
          (message): message is { id: string; deliveredAt?: unknown } =>
            typeof message?.id === "string",
        )
        .map((message) => ({
          id: message.id,
          ...(typeof message.deliveredAt === "string"
            ? { deliveredAt: message.deliveredAt }
            : {}),
        }));
    },
  };
}

/** Whether the caller may see a client. */
export type ClientFilter = (clientId: string) => boolean;

export interface QuestionServiceOptions {
  database: AtlasDatabase;
  /** Stores an event and streams it to every open view. */
  record(event: AtlasEvent): unknown;
  /** The tasks server. Without it answers are kept and never sent. */
  messages?: MessageApi;
  now?: () => Date;
  newId?: () => string;
  log?: (line: string) => void;
}

export interface QuestionService {
  ask(
    input: AgentQuestionInput,
    dataset: Dataset,
    canSee: ClientFilter,
  ): QuestionChange;
  answer(id: string, input: AnswerInput, canSee: ClientFilter): QuestionChange;
  close(id: string, input: CloseInput, canSee: ClientFilter): QuestionChange;
  get(id: string): AgentQuestion | undefined;
  list(
    filter: { states?: AgentQuestionState[] },
    canSee: ClientFilter,
  ): AgentQuestion[];
  /** Sends answers not yet sent and reads delivery back. Never throws. */
  deliver(): Promise<void>;
  /** Runs `deliver` every `seconds` until `stop`. */
  start(seconds: number): void;
  stop(): void;
}

/** A question id: `q-`, the time in base 36 and 8 random characters. */
function questionId(now: Date): string {
  const random = crypto.getRandomValues(new Uint8Array(5));
  const tail = Array.from(random, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8);
  return `q-${now.getTime().toString(36)}-${tail}`;
}

type Row = typeof schema.agentQuestions.$inferSelect;

function toQuestion(row: Row): AgentQuestion {
  const present = Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== null),
  );
  const { sessionAddress: _address, ...rest } = present;
  return AgentQuestion.parse(rest);
}

function toRow(
  question: AgentQuestion,
): typeof schema.agentQuestions.$inferInsert {
  return {
    id: question.id,
    classification: question.classification,
    boundary: question.boundary,
    clientId: question.clientId,
    title: question.title,
    cardOnly: question.cardOnly,
    questions: question.questions,
    session: question.session,
    sessionAddress: question.session.address,
    taskId: question.taskId ?? null,
    link: question.link ?? null,
    state: question.state,
    askedAt: question.askedAt,
    resolution: question.resolution ?? null,
    answers: question.answers ?? null,
    note: question.note ?? null,
    answeredAt: question.answeredAt ?? null,
    answeredBy: question.answeredBy ?? null,
    messageId: question.messageId ?? null,
    messageSentAt: question.messageSentAt ?? null,
    deliveredAt: question.deliveredAt ?? null,
  };
}

function missing(id: string): QuestionChange {
  return { refusal: { reason: "missing", message: `no question ${id}` } };
}

/** An instant one second before `instant`, in the form the tasks server takes. */
function secondBefore(instant: string): string {
  return new Date(new Date(instant).getTime() - 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
}

function failureName(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 120) : "unknown";
}

export function createQuestionService({
  database,
  record,
  messages,
  now = () => new Date(),
  newId,
  log = (line) => console.error(line),
}: QuestionServiceOptions): QuestionService {
  const table = schema.agentQuestions;
  let timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | undefined;

  function get(id: string): AgentQuestion | undefined {
    const row = database.select().from(table).where(eq(table.id, id)).get();
    return row ? toQuestion(row) : undefined;
  }

  function eventFor(question: AgentQuestion, phase: "answered" | "delivered") {
    const address = question.session.address;
    const text =
      phase === "delivered"
        ? `Answer delivered to ${address}`
        : question.resolution === "withdrawn"
          ? `Withdrawn; telling ${address}`
          : question.resolution === "answered-elsewhere"
            ? `Answered in the client's own tools; telling ${address}`
            : `Answered; sending to ${address}`;
    return {
      type: "agent-question",
      questionId: question.id,
      phase,
      session: address,
      client: question.clientId,
      recordIds: question.taskId ? [question.taskId] : [],
      text,
    } satisfies AtlasEvent;
  }

  /** Writes a settled question over a row that is still open, or refuses. */
  function settle(id: string, change: QuestionChange): QuestionChange {
    if ("refusal" in change) return change;
    const written = database
      .update(table)
      .set(toRow(change.question))
      .where(and(eq(table.id, id), eq(table.state, "open")))
      .returning({ id: table.id })
      .all();
    if (written.length === 0) {
      const current = get(id);
      return current ? settledRefusal(current) : missing(id);
    }
    record(eventFor(change.question, "answered"));
    void service.deliver();
    return change;
  }

  async function send(question: AgentQuestion): Promise<void> {
    if (!messages) return;
    try {
      const message = await messages.send({
        to: question.session.address,
        clientId: question.clientId,
        text: deliveryText(question),
      });
      database
        .update(table)
        .set({ messageId: message.id, messageSentAt: message.createdAt })
        .where(eq(table.id, question.id))
        .run();
    } catch (error) {
      log(
        `question ${question.id}: the answer was not sent (${failureName(error)})`,
      );
    }
  }

  /** Reads delivery back for the answered questions of one session. */
  async function readBack(address: string, waiting: AgentQuestion[]) {
    if (!messages) return;
    const since = waiting
      .map((question) => question.messageSentAt ?? question.answeredAt ?? "")
      .sort()[0];
    if (!since) return;
    let inbox: { id: string; deliveredAt?: string }[];
    try {
      inbox = await messages.inbox(address, secondBefore(since));
    } catch (error) {
      log(
        `questions for ${address}: delivery was not read (${failureName(error)})`,
      );
      return;
    }
    const deliveredAt = new Map(
      inbox.flatMap((message) =>
        message.deliveredAt ? [[message.id, message.deliveredAt] as const] : [],
      ),
    );
    for (const question of waiting) {
      const at = question.messageId
        ? deliveredAt.get(question.messageId)
        : undefined;
      const next = at ? markDelivered(question, at) : null;
      if (!next) continue;
      const written = database
        .update(table)
        .set({ state: "delivered", deliveredAt: next.deliveredAt ?? null })
        .where(and(eq(table.id, question.id), eq(table.state, "answered")))
        .returning({ id: table.id })
        .all();
      if (written.length) record(eventFor(next, "delivered"));
    }
  }

  async function pass(): Promise<void> {
    const answered = database
      .select()
      .from(table)
      .where(eq(table.state, "answered"))
      .orderBy(asc(table.answeredAt))
      .all()
      .map(toQuestion);
    for (const question of answered.filter((item) => !item.messageId))
      await send(question);
    const sentQuestions = database
      .select()
      .from(table)
      .where(eq(table.state, "answered"))
      .all()
      .map(toQuestion)
      .filter((question) => question.messageId);
    const bySession = new Map<string, AgentQuestion[]>();
    for (const question of sentQuestions) {
      const list = bySession.get(question.session.address) ?? [];
      list.push(question);
      bySession.set(question.session.address, list);
    }
    for (const [address, waiting] of bySession)
      await readBack(address, waiting);
  }

  const service: QuestionService = {
    ask(input, dataset, canSee) {
      const clientId = input.clientId ?? homeOf(dataset).id;
      const client = dataset.clients.find(
        (candidate) => candidate.id === clientId,
      );
      if (!client || !canSee(client.id))
        return {
          refusal: { reason: "missing", message: `no client ${clientId}` },
        };
      const task = input.taskId
        ? dataset.items.find((item) => item.id === input.taskId)
        : undefined;
      const link =
        input.link ??
        (input.cardOnly && task?.tracker?.url.startsWith("https://")
          ? task.tracker.url
          : undefined);
      const at = now();
      const change = newAgentQuestion(
        { ...input, clientId, ...(link ? { link } : {}) },
        { classification: client.classification, boundary: client.boundary },
        { id: newId?.() ?? questionId(at), now: at },
      );
      if ("refusal" in change) return change;
      const question = change.question;
      database.insert(table).values(toRow(question)).run();
      record({
        type: "signal",
        source: "claude",
        key: `claude:question:${question.id}`,
        kind: "question",
        event: "asked",
        questionId: question.id,
        session: question.session.address,
        cardOnly: question.cardOnly,
        client: question.clientId,
        recordIds: question.taskId ? [question.taskId] : [],
        at: question.askedAt,
        text: question.title,
      });
      return change;
    },
    answer(id, input, canSee) {
      const current = get(id);
      if (!current || !canSee(current.clientId)) return missing(id);
      return settle(id, answerAgentQuestion(current, input, now()));
    },
    close(id, input, canSee) {
      const current = get(id);
      if (!current || !canSee(current.clientId)) return missing(id);
      return settle(id, closeAgentQuestion(current, input, now()));
    },
    get,
    list({ states }, canSee) {
      return database
        .select()
        .from(table)
        .where(states?.length ? inArray(table.state, states) : undefined)
        .orderBy(asc(table.askedAt))
        .all()
        .map(toQuestion)
        .filter((question) => canSee(question.clientId));
    },
    deliver() {
      // One pass at a time; a call during a pass waits for that pass, then runs.
      const next = (running ?? Promise.resolve())
        .then(pass)
        .catch((error: unknown) => {
          log(`question delivery failed (${failureName(error)})`);
        });
      running = next;
      return next;
    },
    start(seconds) {
      if (timer) return;
      timer = setInterval(() => void service.deliver(), seconds * 1000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
  return service;
}
