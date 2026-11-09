import { describe, expect, it } from "bun:test";

import {
  AgentQuestion,
  AtlasEvent,
  answerAgentQuestion,
  applyEvent,
  closeAgentQuestion,
  Dataset,
  deliveryText,
  markDelivered,
  newAgentQuestion,
  sessionAddress,
  type AgentQuestionInput,
} from "../src";

const now = new Date("2026-03-12T09:00:00.000Z");
const later = new Date("2026-03-12T09:05:00.000Z");
const governed = { classification: "internal", boundary: "local" } as const;

const input: AgentQuestionInput = {
  session: { address: "halcyon-builder", account: "ultra-a", host: "studio" },
  clientId: "halcyon",
  taskId: "halcyon-cutover",
  questions: [
    {
      question: "Which region should the cut-over use?",
      header: "Region",
      options: [{ label: "West" }, { label: "North", description: "Slower" }],
    },
    {
      question: "Which checks run first?",
      options: [{ label: "Smoke" }, { label: "Load" }],
      multiSelect: true,
    },
  ],
};

function open(overrides: Partial<AgentQuestionInput> = {}): AgentQuestion {
  const made = newAgentQuestion({ ...input, ...overrides }, governed, {
    id: "q-1",
    now,
  });
  if ("refusal" in made) throw new Error(made.refusal.message);
  return made.question;
}

describe("a new agent question", () => {
  it("is open, keyed by its own id, and titled by its first question", () => {
    const question = open();
    expect(question.state).toBe("open");
    expect(question.id).toBe("q-1");
    expect(question.taskId).toBe("halcyon-cutover");
    expect(question.title).toBe("Which region should the cut-over use?");
    expect(question.askedAt).toBe(now.toISOString());
    expect(AgentQuestion.parse(question)).toEqual(question);
  });

  it("needs one to four questions unless it is a card", () => {
    const none = newAgentQuestion({ ...input, questions: [] }, governed, {
      id: "q-2",
      now,
    });
    expect("refusal" in none && none.refusal.reason).toBe("invalid");
    const five = newAgentQuestion(
      {
        ...input,
        questions: Array.from({ length: 5 }, (_, index) => ({
          question: `Question ${index}?`,
          options: [],
        })),
      },
      governed,
      { id: "q-3", now },
    );
    expect("refusal" in five).toBe(true);
  });

  it("as a card, holds a title, a task and a link, and no question text", () => {
    const card = newAgentQuestion(
      {
        ...input,
        cardOnly: true,
        questions: [],
        title: "A question waits in the client's own tools",
        link: "https://tracker.example/browse/HAL-12",
      },
      governed,
      { id: "q-4", now },
    );
    if ("refusal" in card) throw new Error(card.refusal.message);
    expect(card.question.cardOnly).toBe(true);
    expect(card.question.questions).toEqual([]);
    expect(card.question.link).toBe("https://tracker.example/browse/HAL-12");
  });

  it("as a card, is refused when it carries question text or has no title", () => {
    const withText = newAgentQuestion(
      { ...input, cardOnly: true, title: "A question waits" },
      governed,
      { id: "q-5", now },
    );
    expect("refusal" in withText && withText.refusal.message).toContain(
      "no question text",
    );
    const untitled = newAgentQuestion(
      { ...input, cardOnly: true, questions: [] },
      governed,
      { id: "q-6", now },
    );
    expect("refusal" in untitled).toBe(true);
  });
});

describe("answering an agent question", () => {
  it("closes it on the first answer, with the answers keyed by question", () => {
    const answered = answerAgentQuestion(
      open(),
      {
        answers: {
          "Which region should the cut-over use?": "west",
          "Which checks run first?": "Smoke, Load",
        },
        by: "you",
      },
      later,
    );
    if ("refusal" in answered) throw new Error(answered.refusal.message);
    expect(answered.question.state).toBe("answered");
    expect(answered.question.resolution).toBe("answered");
    expect(answered.question.answeredAt).toBe(later.toISOString());
    expect(answered.question.answeredBy).toBe("you");
    // A label is kept in the option's own spelling.
    expect(answered.question.answers).toEqual({
      "Which region should the cut-over use?": "West",
      "Which checks run first?": "Smoke, Load",
    });
  });

  it("takes a single answer for a one-question ask, and free text as Other", () => {
    const single = open({ questions: [input.questions[0]!] });
    const answered = answerAgentQuestion(
      single,
      { answer: "Neither: wait a week", by: "you" },
      later,
    );
    if ("refusal" in answered) throw new Error(answered.refusal.message);
    expect(answered.question.answers).toEqual({
      "Which region should the cut-over use?": "Neither: wait a week",
    });
  });

  it("refuses a second answer, saying when and by whom it was answered", () => {
    const first = answerAgentQuestion(
      open(),
      { note: "Go with the defaults", by: "you" },
      later,
    );
    if ("refusal" in first) throw new Error(first.refusal.message);
    const second = answerAgentQuestion(
      first.question,
      { note: "Changed my mind", by: "phone" },
      later,
    );
    expect("refusal" in second && second.refusal).toEqual({
      reason: "conflict",
      message: "Question q-1 is already answered, at 2026-03-12T09:05Z by you",
    });
  });

  it("refuses an answer to a question that was not asked", () => {
    const refused = answerAgentQuestion(
      open(),
      { answers: { "Something else?": "Yes" }, by: "you" },
      later,
    );
    expect("refusal" in refused && refused.refusal.reason).toBe("invalid");
  });

  it("refuses an empty answer", () => {
    const refused = answerAgentQuestion(open(), { by: "you" }, later);
    expect("refusal" in refused && refused.refusal.reason).toBe("invalid");
  });

  it("refuses answer text on a card, which is answered in the client's tools", () => {
    const card = open({
      cardOnly: true,
      questions: [],
      title: "A question waits in the client's own tools",
    });
    const refused = answerAgentQuestion(
      card,
      { answer: "West", by: "you" },
      later,
    );
    expect("refusal" in refused && refused.refusal.message).toContain(
      "card-only",
    );
  });
});

describe("closing an agent question", () => {
  it("closes a card as answered elsewhere, and refuses a second close", () => {
    const card = open({
      cardOnly: true,
      questions: [],
      title: "A question waits in the client's own tools",
      link: "https://tracker.example/browse/HAL-12",
    });
    const closed = closeAgentQuestion(
      card,
      { resolution: "answered-elsewhere", by: "you" },
      later,
    );
    if ("refusal" in closed) throw new Error(closed.refusal.message);
    expect(closed.question.state).toBe("answered");
    expect(closed.question.resolution).toBe("answered-elsewhere");
    expect(deliveryText(closed.question)).toBe(
      "Question q-1 was answered in the client's own tools. Read the answer there: https://tracker.example/browse/HAL-12",
    );
    const again = closeAgentQuestion(
      closed.question,
      { resolution: "withdrawn", by: "you" },
      later,
    );
    expect("refusal" in again && again.refusal.reason).toBe("conflict");
  });

  it("withdraws a question, with a note for the agent", () => {
    const closed = closeAgentQuestion(
      open(),
      { resolution: "withdrawn", note: "Out of date", by: "you" },
      later,
    );
    if ("refusal" in closed) throw new Error(closed.refusal.message);
    expect(deliveryText(closed.question)).toBe(
      "Question q-1 was withdrawn by the owner: Out of date. Decide with what you know, or ask again.",
    );
  });
});

describe("delivery", () => {
  it("writes the answer as a message that names the question and each answer", () => {
    const answered = answerAgentQuestion(
      open(),
      {
        answers: { "Which region should the cut-over use?": "West" },
        note: "Load checks can wait",
        by: "you",
      },
      later,
    );
    if ("refusal" in answered) throw new Error(answered.refusal.message);
    expect(deliveryText(answered.question)).toBe(
      [
        "Answer to your question q-1 (task halcyon-cutover), from the owner through Atlas:",
        "- Which region should the cut-over use? → West",
        "Note: Load checks can wait",
      ].join("\n"),
    );
  });

  it("moves an answered question to delivered, once", () => {
    const answered = answerAgentQuestion(
      open(),
      { note: "Yes", by: "you" },
      later,
    );
    if ("refusal" in answered) throw new Error(answered.refusal.message);
    const delivered = markDelivered(
      { ...answered.question, messageId: "m-1" },
      "2026-03-12T09:06:00Z",
    );
    expect(delivered?.state).toBe("delivered");
    expect(delivered?.deliveredAt).toBe("2026-03-12T09:06:00Z");
    expect(markDelivered(delivered!, "2026-03-12T09:07:00Z")).toBeNull();
    expect(markDelivered(open(), "2026-03-12T09:07:00Z")).toBeNull();
  });
});

describe("session addresses", () => {
  it("use the tasks server's form of a name: lower case, words joined by hyphens", () => {
    expect(sessionAddress("Ops Portal")).toBe("ops-portal");
    expect(sessionAddress("  Builder_2 ")).toBe("builder-2");
    expect(sessionAddress("")).toBeNull();
  });

  it("handle a long run of hyphens at once", () => {
    const started = performance.now();
    expect(sessionAddress("-".repeat(100_000))).toBeNull();
    expect(sessionAddress(`a${"-".repeat(100_000)}b`)).toBe("a-b");
    expect(performance.now() - started).toBeLessThan(100);
  });
});

describe("question events", () => {
  it("accepts a question signal and a lifecycle event, and neither changes the dataset", () => {
    const dataset = Dataset.parse({
      clients: [],
      accounts: [],
      groups: [],
      agents: [],
      requirements: [],
      items: [],
      questions: [],
      decisions: [],
    });
    const signal = AtlasEvent.parse({
      type: "signal",
      source: "claude",
      key: "claude:question:q-1",
      kind: "question",
      event: "asked",
      questionId: "q-1",
      session: "halcyon-builder",
      cardOnly: false,
      client: "halcyon",
      recordIds: ["halcyon-cutover"],
      at: now.toISOString(),
      text: "Which region should the cut-over use?",
    });
    const lifecycle = AtlasEvent.parse({
      type: "agent-question",
      questionId: "q-1",
      phase: "delivered",
      session: "halcyon-builder",
      client: "halcyon",
      recordIds: ["halcyon-cutover"],
      text: "Answer delivered to halcyon-builder",
    });
    expect(applyEvent(dataset, signal)).toBe(dataset);
    expect(applyEvent(dataset, lifecycle)).toBe(dataset);
  });
});
