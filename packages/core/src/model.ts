/**
 * The Atlas data model.
 *
 * Every record carries two fields beyond its content: a classification (how
 * sensitive it is) and a boundary (where it is allowed to live). The boundary
 * rules in `boundaries.ts` read both before anything moves between places,
 * so a record that is missing either is not a valid record.
 */
import { z } from "zod/v4";

export const classifications = [
  "public",
  "internal",
  "client-confidential",
  "restricted",
] as const;
export const Classification = z.enum(classifications);
export type Classification = z.infer<typeof Classification>;

/** Lower-case words joined by hyphens: stable, readable in a URL and a log. */
export const Identifier = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "use lower-case words joined by hyphens");
export type Identifier = z.infer<typeof Identifier>;

const governed = {
  id: Identifier,
  classification: Classification,
  boundary: Identifier,
};

export const Client = z.object({
  ...governed,
  name: z.string().min(1),
  /**
   * Your own business. Exactly one client is home: the place admin work
   * lives, drawn at the centre of every world (Terra for the Astronomer,
   * the home port for the Mariner).
   */
  home: z.boolean().optional(),
});
export type Client = z.infer<typeof Client>;

export const runtimes = ["claude", "gemini", "n8n", "script"] as const;
export const Runtime = z.enum(runtimes);
export type Runtime = z.infer<typeof Runtime>;

/** A login an agent runs under. Several Claude accounts are normal. */
export const Account = z.object({
  id: Identifier,
  label: z.string().min(1),
  runtime: Runtime,
});
export type Account = z.infer<typeof Account>;

export const agentStatuses = [
  "running",
  "watching",
  "waiting",
  "blocked",
  "error",
  "idle",
] as const;
export const AgentStatus = z.enum(agentStatuses);
export type AgentStatus = z.infer<typeof AgentStatus>;

/** The statuses that put an agent on the reader's "needs you" list. */
export const attentionStatuses: readonly AgentStatus[] = [
  "waiting",
  "blocked",
  "error",
];

/**
 * How a person can reach the session. Remote Control works only for a
 * subscription sign-in, so an agent on an API key is `ssh` or `none`.
 */
export const reaches = ["remote-control", "ssh", "local", "none"] as const;
export const Reach = z.enum(reaches);
export type Reach = z.infer<typeof Reach>;

/** A group of agents, all working for one client (or for home). */
export const AgentGroup = z.object({
  ...governed,
  clientId: Identifier,
  name: z.string().min(1),
});
export type AgentGroup = z.infer<typeof AgentGroup>;

export const Agent = z.object({
  ...governed,
  groupId: Identifier,
  name: z.string().min(1),
  accountId: Identifier,
  host: z.string().min(1),
  reach: Reach,
  status: AgentStatus,
  /** Backlog item ids. The first is the one the agent is drawn beside. */
  workingOn: z.array(Identifier),
  note: z.string(),
});
export type Agent = z.infer<typeof Agent>;

export const Requirement = z.object({
  ...governed,
  clientId: Identifier,
  title: z.string().min(1),
  state: z.enum(["open", "done"]),
});
export type Requirement = z.infer<typeof Requirement>;

/**
 * A subject a client's work is grouped under, such as "Billing" or "Data
 * platform". The map draws each one as a marker beside its client, with
 * the most urgent open items around it, so a client with a hundred items
 * still reads as a handful of groups.
 */
export const Workstream = z.object({
  ...governed,
  clientId: Identifier,
  title: z.string().min(1),
  /** A sentence on what the workstream covers. */
  summary: z.string().optional(),
  /** Where it sits among its client's workstreams: lower comes first. */
  order: z.number().optional(),
});
export type Workstream = z.infer<typeof Workstream>;

/** A calendar date, `2026-10-18`. Days are the unit of planning. */
export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

export const priorities = ["high", "normal", "low"] as const;
export const Priority = z.enum(priorities);
export type Priority = z.infer<typeof Priority>;

export const trackerSystems = ["jira", "monday", "github", "other"] as const;
/**
 * Where a task is tracked outside Atlas. The key is the task's identity
 * when it has one; the importer never invents a key.
 */
export const TrackerReference = z.object({
  system: z.enum(trackerSystems),
  key: z.string().min(1),
  url: z.url(),
});
export type TrackerReference = z.infer<typeof TrackerReference>;

/** T-shirt sizes. The weight of each is in `effortWeights`. */
export const efforts = ["XS", "S", "M", "L", "XL"] as const;
export const Effort = z.enum(efforts);
export type Effort = z.infer<typeof Effort>;

/** Business value, on a short Fibonacci scale so a guess cannot be precise. */
export const taskValues = [1, 2, 3, 5, 8, 13] as const;
export const TaskValue = z.literal(taskValues);
export type TaskValue = z.infer<typeof TaskValue>;

/** One line of a task's past: when it was added, and each move. */
export const TaskHistoryEntry = z.object({
  kind: z.enum(["added", "moved"]),
  on: IsoDate,
  /** For a move, the day it was scheduled for before. */
  from: IsoDate.optional(),
});
export type TaskHistoryEntry = z.infer<typeof TaskHistoryEntry>;

export const backlogStates = ["todo", "doing", "review", "done"] as const;
/**
 * A backlog item, which the day plan calls a task. Every planning field is
 * optional, so the items the map already draws stay valid.
 */
export const BacklogItem = z.object({
  ...governed,
  clientId: Identifier,
  requirementId: Identifier.optional(),
  /** The workstream it is grouped under. Absent means unsorted. */
  workstreamId: Identifier.optional(),
  title: z.string().min(1),
  /** The prose after the title: what the task is, in a sentence or two. */
  summary: z.string().optional(),
  state: z.enum(backlogStates),
  /** As imported, or as set by hand. Effort and value replace it once both are set. */
  priority: Priority,
  tracker: TrackerReference.optional(),
  effort: Effort.optional(),
  value: TaskValue.optional(),
  /** The day it is planned for. Absent means unscheduled. */
  scheduledFor: IsoDate.optional(),
  blocked: z.boolean().optional(),
  /** The day it was ticked off. */
  doneOn: IsoDate.optional(),
  /** The details document that explains it. */
  detailsId: Identifier.optional(),
  history: z.array(TaskHistoryEntry).optional(),
});
export type BacklogItem = z.infer<typeof BacklogItem>;

/**
 * What a client's day opens with: an overview of where things stand, or
 * the intention for the day, and what to keep an eye on.
 */
export const DayNote = z.object({
  clientId: Identifier,
  on: IsoDate,
  kind: z.enum(["overview", "intention"]),
  text: z.string().min(1),
  /** One line on what to watch today. */
  watch: z.string().optional(),
});
export type DayNote = z.infer<typeof DayNote>;

/**
 * A longer note a task links to, imported from the vault so it reads on
 * any device. It keeps its client's classification and its source path.
 */
export const DetailsDocument = z.object({
  ...governed,
  clientId: Identifier,
  title: z.string().min(1),
  /** The note as written. Rendered through `parseMarkdown`, never as HTML. */
  markdown: z.string(),
  /** Where the note lives in the vault, for Open in Obsidian. */
  sourcePath: z.string().min(1),
  updatedOn: IsoDate,
});
export type DetailsDocument = z.infer<typeof DetailsDocument>;

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use a 24-hour time, 09:15");

/** A meeting on a client's day. Read only, and never scored. */
export const CalendarEntry = z.object({
  clientId: Identifier,
  on: IsoDate,
  start: clockTime,
  end: clockTime,
  title: z.string().min(1),
});
export type CalendarEntry = z.infer<typeof CalendarEntry>;

export const bands = ["today", "tomorrow", "future", "unscheduled"] as const;
export const Band = z.enum(bands);
export type Band = z.infer<typeof Band>;

/**
 * What a dry run of the dashboard import found, before anything is written.
 * A line that looks like a credential is named by its number only: its
 * text never leaves the importer.
 */
export const ImportReport = z.object({
  /** Where the dashboard was read from. */
  sourcePath: z.string().min(1),
  /** The day the dry run was made. */
  readOn: IsoDate,
  counts: z.array(
    z.object({
      clientId: Identifier,
      band: Band,
      tasks: z.number().int().nonnegative(),
    }),
  ),
  unplaced: z.array(
    z.object({
      line: z.number().int().positive(),
      reason: z.string().min(1),
      excerpt: z.string(),
    }),
  ),
  heldBack: z.array(z.number().int().positive()),
  waitingForSize: z.array(
    z.object({ clientId: Identifier, title: z.string().min(1) }),
  ),
});
export type ImportReport = z.infer<typeof ImportReport>;

/** A day's plan: the tasks, the notes and meetings, and the documents they link to. */
export const DayPlan = z.object({
  today: IsoDate,
  items: z.array(BacklogItem),
  notes: z.array(DayNote),
  calendar: z.array(CalendarEntry),
  documents: z.array(DetailsDocument),
});
export type DayPlan = z.infer<typeof DayPlan>;

export const Question = z.object({
  ...governed,
  clientId: Identifier,
  title: z.string().min(1),
  /** The backlog item or requirement this question holds up. */
  blocks: Identifier,
  /** Who must answer. "You" puts the question on the needs-you list. */
  asks: z.string().min(1),
  state: z.enum(["open", "answered"]),
  answer: z.string().optional(),
});
export type Question = z.infer<typeof Question>;

export const Decision = z.object({
  ...governed,
  clientId: Identifier,
  title: z.string().min(1),
  /** The requirement or backlog item the decision settles. */
  decides: Identifier.optional(),
  /** Set when the decision came from answering a question. */
  fromQuestion: Identifier.optional(),
  state: z.enum(["made", "proposed"]),
});
export type Decision = z.infer<typeof Decision>;

export const Dataset = z.object({
  clients: z.array(Client),
  accounts: z.array(Account),
  groups: z.array(AgentGroup),
  agents: z.array(Agent),
  requirements: z.array(Requirement),
  /**
   * Empty when absent, so a seed file or a server written before
   * workstreams existed still reads.
   */
  workstreams: z.array(Workstream).default([]),
  items: z.array(BacklogItem),
  questions: z.array(Question),
  decisions: z.array(Decision),
});
export type Dataset = z.infer<typeof Dataset>;

/** The answerer who means "the person reading Atlas". */
export const YOU = "You";

/** The one client marked as home. */
export function homeOf(dataset: Dataset): Client {
  const home = dataset.clients.find((client) => client.home === true);
  if (!home) throw new Error("the dataset has no home client");
  return home;
}
