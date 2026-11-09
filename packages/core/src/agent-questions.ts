/**
 * Questions agents ask the person: the record, and the rules that move it
 * from open to answered to delivered.
 *
 * An agent question comes from a Claude Code session, through the hook that
 * converts `AskUserQuestion` or through the ask skill. It holds the 1 to 4
 * questions `AskUserQuestion` takes, with their options, and the session that
 * asked, so the answer goes back to that session as a message. Each question
 * has its own id; a task id is only a field, so a new question on the same
 * task never inherits an old answer.
 *
 * A card is a question from a client whose boundary keeps the text in its
 * own tools. It holds a title written for outside use, the task id and a
 * link back, and no question or answer text.
 *
 * The functions here are pure: they return the changed record, or a refusal
 * with the reason, and the server writes what they return.
 */
import { z } from "zod/v4";

import { Classification, Identifier } from "./model";

/**
 * Where a message reaches a session: its name in the tasks server's form,
 * lower-case words joined by hyphens, at most 96 characters.
 */
export const SessionAddress = z
  .string()
  .max(96)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "use lower-case words joined by hyphens");
export type SessionAddress = z.infer<typeof SessionAddress>;

/** A session name in the tasks server's form, or null when nothing is left. */
export function sessionAddress(name: string): SessionAddress | null {
  const address = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
    .replace(/-+$/, "");
  return address || null;
}

export const AskedOption = z.object({
  label: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
});
export type AskedOption = z.infer<typeof AskedOption>;

/** One question, in the shape `AskUserQuestion` takes. */
export const AskedQuestion = z.object({
  question: z.string().min(1).max(1000),
  header: z.string().min(1).max(60).optional(),
  options: z.array(AskedOption).max(8),
  multiSelect: z.boolean().optional(),
});
export type AskedQuestion = z.infer<typeof AskedQuestion>;

/** The session that asked, so its answer can find it. */
export const AskingSession = z.object({
  address: SessionAddress,
  /** Claude Code's session id. */
  sessionId: z.string().min(1).max(128).optional(),
  /** The Claude account's configuration folder name, such as `ultra-a`. */
  account: z.string().min(1).max(64).optional(),
  /** The machine's short name. */
  host: z.string().min(1).max(128).optional(),
});
export type AskingSession = z.infer<typeof AskingSession>;

export const agentQuestionStates = ["open", "answered", "delivered"] as const;
export const AgentQuestionState = z.enum(agentQuestionStates);
export type AgentQuestionState = z.infer<typeof AgentQuestionState>;

/**
 * How an answered question was settled: answered in Atlas, answered in the
 * client's own tools (a card), or withdrawn by the person.
 */
export const agentQuestionResolutions = [
  "answered",
  "answered-elsewhere",
  "withdrawn",
] as const;
export const AgentQuestionResolution = z.enum(agentQuestionResolutions);
export type AgentQuestionResolution = z.infer<typeof AgentQuestionResolution>;

const HttpsUrl = z.url({ protocol: /^https$/ });
const Instant = z.iso.datetime();

export const AgentQuestion = z.object({
  id: Identifier,
  classification: Classification,
  boundary: Identifier,
  clientId: Identifier,
  /** The first question, or a card's title written for outside use. */
  title: z.string().min(1).max(200),
  cardOnly: z.boolean(),
  /** Empty for a card. */
  questions: z.array(AskedQuestion).max(4),
  session: AskingSession,
  taskId: Identifier.optional(),
  /** For a card: where the question waits in the client's own tools. */
  link: HttpsUrl.optional(),
  state: AgentQuestionState,
  askedAt: Instant,
  resolution: AgentQuestionResolution.optional(),
  /** The answer to each question, keyed by the question's text. */
  answers: z.record(z.string(), z.string()).optional(),
  note: z.string().max(2000).optional(),
  answeredAt: Instant.optional(),
  answeredBy: z.string().min(1).max(128).optional(),
  /** The tasks server's id for the message that carries the answer. */
  messageId: z.string().min(1).max(128).optional(),
  messageSentAt: Instant.optional(),
  deliveredAt: Instant.optional(),
});
export type AgentQuestion = z.infer<typeof AgentQuestion>;

/** What an asking session sends. */
export const AgentQuestionInput = z.object({
  session: AskingSession,
  /** The client the question is about. The home client when left out. */
  clientId: Identifier.optional(),
  taskId: Identifier.optional(),
  cardOnly: z.boolean().optional(),
  /** Required for a card; for a question, the first question is used. */
  title: z.string().min(1).max(200).optional(),
  questions: z.array(AskedQuestion).max(4),
  link: HttpsUrl.optional(),
});
export type AgentQuestionInput = z.infer<typeof AgentQuestionInput>;

/** Why a change to a question was refused. */
export interface QuestionRefusal {
  reason: "missing" | "conflict" | "invalid";
  message: string;
}

export type QuestionChange =
  { question: AgentQuestion } | { refusal: QuestionRefusal };

function invalid(message: string): { refusal: QuestionRefusal } {
  return { refusal: { reason: "invalid", message } };
}

/** Text cut to `length` characters, ending in an ellipsis when it was cut. */
function cut(text: string, length: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= length ? flat : `${flat.slice(0, length - 1)}…`;
}

/** An instant to the minute, as the refusals and messages show it. */
function minute(instant: string): string {
  return `${instant.slice(0, 16)}Z`;
}

/**
 * A new open question from what a session sent, or why it cannot be one.
 * A question needs 1 to 4 questions; a card needs a title and no question
 * text at all.
 */
export function newAgentQuestion(
  input: AgentQuestionInput,
  governed: { classification: Classification; boundary: string },
  context: { id: string; now: Date; clientId?: string },
): QuestionChange {
  const parsed = AgentQuestionInput.safeParse(input);
  if (!parsed.success)
    return invalid(
      `the question does not match its shape: ${parsed.error.issues
        .map((issue) => issue.path.join(".") || issue.message)
        .join(", ")}`,
    );
  const value = parsed.data;
  const cardOnly = value.cardOnly === true;
  if (cardOnly && value.questions.length > 0)
    return invalid(
      "a card-only question carries no question text: send a title written for outside use, the task id and a link",
    );
  if (cardOnly && !value.title)
    return invalid("a card-only question needs a title");
  if (!cardOnly && value.questions.length === 0)
    return invalid("a question needs one to four questions");
  const clientId = value.clientId ?? context.clientId;
  if (!clientId) return invalid("the question names no client");
  const first = value.questions[0];
  const title = value.title ?? cut(first?.question ?? "", 200);
  return {
    question: {
      id: context.id,
      classification: governed.classification,
      boundary: governed.boundary,
      clientId,
      title,
      cardOnly,
      questions: value.questions,
      session: value.session,
      ...(value.taskId ? { taskId: value.taskId } : {}),
      ...(value.link ? { link: value.link } : {}),
      state: "open",
      askedAt: context.now.toISOString(),
    },
  };
}

/** The refusal for a question that is no longer open: how, when and by whom it was settled. */
export function settledRefusal(question: AgentQuestion): {
  refusal: QuestionRefusal;
} {
  const when = question.answeredAt ? `, at ${minute(question.answeredAt)}` : "";
  const who = question.answeredBy ? ` by ${question.answeredBy}` : "";
  const how =
    question.resolution === "withdrawn"
      ? "withdrawn"
      : question.resolution === "answered-elsewhere"
        ? "answered in the client's own tools"
        : "answered";
  return {
    refusal: {
      reason: "conflict",
      message: `Question ${question.id} is already ${how}${when}${who}`,
    },
  };
}

export interface AnswerInput {
  /** The answer to each question, keyed by the question's text. */
  answers?: Record<string, string>;
  /** One answer, for a question that asks one thing. */
  answer?: string;
  note?: string;
  /** Who answered: a person's login or a machine's name. */
  by: string;
}

/**
 * The question answered, or why it cannot be. The first answer wins: a
 * question that is no longer open refuses every later answer, with when and
 * by whom it was settled. A label that matches an option without regard to
 * case is kept in the option's spelling; any other text is an Other answer.
 */
export function answerAgentQuestion(
  question: AgentQuestion,
  input: AnswerInput,
  now: Date,
): QuestionChange {
  if (question.state !== "open") return settledRefusal(question);
  if (question.cardOnly)
    return invalid(
      `Question ${question.id} is card-only: answer it in the client's own tools, then close it as answered elsewhere`,
    );
  const given: Record<string, string> = { ...input.answers };
  if (input.answer !== undefined) {
    if (question.questions.length !== 1)
      return invalid(
        `Question ${question.id} asks ${question.questions.length} things: answer each by its question text`,
      );
    given[question.questions[0]!.question] = input.answer;
  }
  const answers: Record<string, string> = {};
  for (const [text, raw] of Object.entries(given)) {
    const asked = question.questions.find((item) => item.question === text);
    if (!asked)
      return invalid(`Question ${question.id} did not ask "${cut(text, 80)}"`);
    const value = raw.trim();
    if (!value) continue;
    const labels = value.split(",").map((part) => part.trim());
    const spelled = labels.map(
      (label) =>
        asked.options.find(
          (option) => option.label.toLowerCase() === label.toLowerCase(),
        )?.label ?? label,
    );
    const known = spelled.every((label) =>
      asked.options.some((option) => option.label === label),
    );
    answers[text] = known ? spelled.join(", ") : value;
  }
  const note = input.note?.trim();
  if (Object.keys(answers).length === 0 && !note)
    return invalid("an answer needs at least one answer or a note");
  return {
    question: {
      ...question,
      state: "answered",
      resolution: "answered",
      ...(Object.keys(answers).length ? { answers } : {}),
      ...(note ? { note } : {}),
      answeredAt: now.toISOString(),
      answeredBy: input.by,
    },
  };
}

export interface CloseInput {
  resolution: Exclude<AgentQuestionResolution, "answered">;
  note?: string;
  by: string;
}

/**
 * The question closed without an answer in Atlas: answered in the client's
 * own tools (a card), or withdrawn. Closing is an answer, so it is refused
 * the same way once the question is settled.
 */
export function closeAgentQuestion(
  question: AgentQuestion,
  input: CloseInput,
  now: Date,
): QuestionChange {
  if (question.state !== "open") return settledRefusal(question);
  const note = input.note?.trim();
  return {
    question: {
      ...question,
      state: "answered",
      resolution: input.resolution,
      ...(note ? { note } : {}),
      answeredAt: now.toISOString(),
      answeredBy: input.by,
    },
  };
}

/**
 * The message that carries an answered question back to the session that
 * asked. A card's message holds no client text: it says where to read the
 * answer.
 */
export function deliveryText(question: AgentQuestion): string {
  if (question.resolution === "answered-elsewhere")
    return `Question ${question.id} was answered in the client's own tools. Read the answer there${
      question.link ? `: ${question.link}` : "."
    }`;
  if (question.resolution === "withdrawn")
    return `Question ${question.id} was withdrawn by the owner${
      question.note ? `: ${question.note}` : ""
    }. Decide with what you know, or ask again.`;
  const task = question.taskId ? ` (task ${question.taskId})` : "";
  const lines = [
    `Answer to your question ${question.id}${task}, from the owner through Atlas:`,
  ];
  for (const asked of question.questions) {
    const answer = question.answers?.[asked.question];
    if (answer) lines.push(`- ${asked.question} → ${answer}`);
  }
  if (question.note) lines.push(`Note: ${question.note}`);
  return lines.join("\n");
}

/**
 * The question delivered at `at`, or null when it is not an answered
 * question whose message was sent.
 */
export function markDelivered(
  question: AgentQuestion,
  at: string,
): AgentQuestion | null {
  if (question.state !== "answered" || !question.messageId) return null;
  return { ...question, state: "delivered", deliveredAt: at };
}
