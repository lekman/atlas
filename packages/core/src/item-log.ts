/**
 * A backlog item's log in the task database: what an agent did or said
 * about the item, and when. It is read on demand for one item at a time
 * and never joins the dataset, because an item's log can be long and
 * only the selected item's log is shown.
 */
import { z } from "zod/v4";

/** The states an item log entry records, as the task database spells them. */
export const itemLogStatuses = [
  "todo",
  "doing",
  "review",
  "done",
  "dropped",
  "blocked",
] as const;
export const ItemLogStatus = z.enum(itemLogStatuses);
export type ItemLogStatus = z.infer<typeof ItemLogStatus>;

export const ItemLogEntry = z.object({
  /** When it was written, ISO 8601. */
  at: z.iso.datetime({ offset: true }),
  /** The item's state the entry records. */
  status: ItemLogStatus,
  /** What the agent wrote. May be empty when only the status moved. */
  note: z.string(),
  /** Who wrote it: an agent's id or name. Absent when the row names nobody. */
  by: z.string().min(1).optional(),
});
export type ItemLogEntry = z.infer<typeof ItemLogEntry>;

/** What `GET /api/items/:id/log` answers: the entries, newest first. */
export const ItemLog = z.object({ entries: z.array(ItemLogEntry) });
export type ItemLog = z.infer<typeof ItemLog>;
