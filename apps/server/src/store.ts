/**
 * Reads and writes the dataset. Every change after seeding arrives as an
 * event: the event is added to the log and its effect is written in the same
 * transaction, so the log and the records never disagree.
 */
import { AtlasEvent, Dataset, type Decision } from "@atlas/core";
import { asc, desc, eq, gt } from "drizzle-orm";

import type { AtlasDatabase } from "./database";
import * as schema from "./schema";

/** A row with its empty columns left out, so optional fields read as absent. */
function present<Row extends Record<string, unknown>>(row: Row) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== null),
  );
}

/** The whole dataset, checked against the core schema. */
export function readDataset(database: AtlasDatabase): Dataset {
  return Dataset.parse({
    clients: database.select().from(schema.clients).all().map(present),
    accounts: database.select().from(schema.accounts).all().map(present),
    groups: database.select().from(schema.agentGroups).all().map(present),
    agents: database.select().from(schema.agents).all().map(present),
    requirements: database
      .select()
      .from(schema.requirements)
      .all()
      .map(present),
    workstreams: database.select().from(schema.workstreams).all().map(present),
    items: database.select().from(schema.items).all().map(present),
    questions: database.select().from(schema.questions).all().map(present),
    decisions: database.select().from(schema.decisions).all().map(present),
  });
}

/** The dataset and the last event it includes, read in one transaction. */
export function readSnapshot(database: AtlasDatabase): {
  dataset: Dataset;
  sequence: number;
} {
  return database.transaction((transaction) => {
    const last = transaction
      .select({ sequence: schema.events.sequence })
      .from(schema.events)
      .orderBy(desc(schema.events.sequence))
      .limit(1)
      .get();
    return {
      dataset: readDataset(transaction as unknown as AtlasDatabase),
      sequence: last?.sequence ?? 0,
    };
  });
}

/** Whether the database holds no clients yet. */
export function isEmpty(database: AtlasDatabase): boolean {
  return database.select().from(schema.clients).limit(1).all().length === 0;
}

/**
 * Writes a whole dataset into an empty database. Used to seed the invented
 * dataset; it refuses to run over existing records rather than merge.
 */
export function seedDataset(database: AtlasDatabase, input: Dataset): void {
  const dataset = Dataset.parse(input);
  if (!isEmpty(database)) throw new Error("the database already holds records");
  database.transaction((transaction) => {
    if (dataset.clients.length)
      transaction.insert(schema.clients).values(dataset.clients).run();
    if (dataset.accounts.length)
      transaction.insert(schema.accounts).values(dataset.accounts).run();
    if (dataset.groups.length)
      transaction.insert(schema.agentGroups).values(dataset.groups).run();
    if (dataset.agents.length)
      transaction.insert(schema.agents).values(dataset.agents).run();
    if (dataset.requirements.length)
      transaction
        .insert(schema.requirements)
        .values(dataset.requirements)
        .run();
    if (dataset.workstreams.length)
      transaction.insert(schema.workstreams).values(dataset.workstreams).run();
    if (dataset.items.length)
      transaction.insert(schema.items).values(dataset.items).run();
    if (dataset.questions.length)
      transaction.insert(schema.questions).values(dataset.questions).run();
    if (dataset.decisions.length)
      transaction.insert(schema.decisions).values(dataset.decisions).run();
  });
}

/** Reads a seed file: a whole dataset as JSON, checked against the core schema. */
export async function readSeedFile(path: string): Promise<Dataset> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`no seed file at ${path}`);
  return Dataset.parse(await file.json());
}

export interface StoredEvent {
  sequence: number;
  receivedAt: string;
  event: AtlasEvent;
}

/** Why an event was refused. The API turns it into a 404 or a 409. */
export class EventRejected extends Error {
  constructor(
    message: string,
    readonly reason: "missing" | "conflict",
  ) {
    super(message);
  }
}

/**
 * Checks an event, writes its effect and adds it to the log. Returns the
 * event as stored, with its place in the log.
 */
export function appendEvent(
  database: AtlasDatabase,
  input: unknown,
  now: Date = new Date(),
): StoredEvent {
  const event = AtlasEvent.parse(input);
  return database.transaction((transaction) => {
    switch (event.type) {
      case "status-change": {
        const updated = transaction
          .update(schema.agents)
          .set({ status: event.to, note: event.text })
          .where(eq(schema.agents.id, event.agentId))
          .returning({ id: schema.agents.id })
          .all();
        if (updated.length === 0)
          throw new EventRejected(`no agent ${event.agentId}`, "missing");
        break;
      }
      case "question-answered": {
        const question = transaction
          .select()
          .from(schema.questions)
          .where(eq(schema.questions.id, event.questionId))
          .get();
        if (!question)
          throw new EventRejected(`no question ${event.questionId}`, "missing");
        if (question.state === "answered")
          throw new EventRejected(
            `question ${event.questionId} is already answered`,
            "conflict",
          );
        const taken = transaction
          .select({ id: schema.decisions.id })
          .from(schema.decisions)
          .where(eq(schema.decisions.id, event.decision.id))
          .get();
        if (taken)
          throw new EventRejected(
            `decision ${event.decision.id} already exists`,
            "conflict",
          );
        transaction
          .update(schema.questions)
          .set({ state: "answered", answer: event.answer })
          .where(eq(schema.questions.id, question.id))
          .run();
        const decision: Decision = {
          ...event.decision,
          fromQuestion: question.id,
        };
        transaction.insert(schema.decisions).values(decision).run();
        break;
      }
      case "agent-message":
      case "external":
        // Recorded and drawn; nothing stored changes.
        break;
    }
    const receivedAt = now.toISOString();
    const [row] = transaction
      .insert(schema.events)
      .values({ receivedAt, type: event.type, event })
      .returning({ sequence: schema.events.sequence })
      .all();
    if (!row) throw new Error("the event was not stored");
    return { sequence: row.sequence, receivedAt, event };
  });
}

/** Events after `after` in the log, oldest first. */
export function listEvents(
  database: AtlasDatabase,
  after = 0,
  limit = 200,
): StoredEvent[] {
  return database
    .select()
    .from(schema.events)
    .where(gt(schema.events.sequence, after))
    .orderBy(asc(schema.events.sequence))
    .limit(limit)
    .all()
    .map((row) => ({
      sequence: row.sequence,
      receivedAt: row.receivedAt,
      event: AtlasEvent.parse(row.event),
    }));
}
