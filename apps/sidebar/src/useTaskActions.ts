import type { Runtime } from "@atlas/runtime";
import {
  isWorklistDoc,
  type WorkItem,
  type WorklistDoc,
} from "@atlas/ui/sidebar";
import { useCallback, useState } from "react";

import { requestId, type Commander } from "./useCommander";

export type TaskTool = "task_done" | "task_move" | "task_state" | "task_assess";

/** The tools the phone inbox can replay on the Mac mini. */
const INBOX_TOOLS: ReadonlySet<TaskTool> = new Set(["task_done", "task_move"]);

export interface TaskChange {
  to?: string;
  state?: string;
  value?: string | null;
  effort?: string | null;
}

export interface TaskActions {
  /**
   * Marks a task done, or moves it to today, tomorrow or the backlog. Gives
   * the fresh worklist the server answered with, if any. A failure shows in
   * `error`.
   */
  act: (
    item: WorkItem,
    tool: TaskTool,
    extra?: TaskChange,
  ) => Promise<WorklistDoc | null>;
  /**
   * Makes a change and says how it went: null once saved (or queued for the
   * Mac mini), or why it failed, in words, for the control that made it.
   */
  save: (
    item: WorkItem,
    tool: TaskTool,
    extra?: TaskChange,
  ) => Promise<string | null>;
  /** The task being changed now. */
  busyRef: string | null;
  /** Why the last change failed, in words. */
  error: string | null;
  /** Hides the error, from its close button. */
  clearError: () => void;
}

/**
 * Changes a task through the local server, which answers with the fresh
 * worklist; `onFresh` shows and stores it. From the phone, a database
 * task's done or move goes through the inbox for the Mac mini to apply.
 */
export function useTaskActions(
  runtime: Runtime,
  commander: Commander,
  onFresh: (doc: WorklistDoc) => void,
): TaskActions {
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (
      item: WorkItem,
      tool: TaskTool,
      extra: TaskChange = {},
    ): Promise<{ doc: WorklistDoc | null; error: string | null }> => {
      if (!item.ref) return { doc: null, error: "This item can't be changed." };
      const viaInbox = async () => {
        const action = tool === "task_done" ? "done" : "move";
        const id = requestId();
        await commander.queue(
          { id, ref: item.ref!, action, title: item.title },
          tool,
          { id, ref: item.ref, ...extra },
          action === "done"
            ? "Marking it done from the phone; the Mac mini applies it within a minute."
            : `Moving it to ${extra.to}; the Mac mini applies it within a minute.`,
        );
        return { doc: null, error: null };
      };
      const fromDatabase = item.ref.startsWith("db:");
      if (!runtime.present) {
        if (fromDatabase && INBOX_TOOLS.has(tool)) return viaInbox();
        return {
          doc: null,
          error: fromDatabase
            ? "Changing the status or grade works where the Mac's dashboard server answers, not from the phone yet."
            : "Editing items needs live connectors, which aren't available in this view.",
        };
      }
      setBusyRef(item.ref);
      try {
        const answer = (await runtime.call(
          "host:dashboard",
          tool,
          { ref: item.ref, ...extra },
          { cache: false },
        )) as {
          tasks?: unknown;
        } | null;
        if (isWorklistDoc(answer?.tasks)) {
          onFresh(answer.tasks);
          return { doc: answer.tasks, error: null };
        }
        return { doc: null, error: null };
      } catch (err) {
        const { code, message } = err as { code?: string; message?: string };
        if (
          code === "server_not_connected" &&
          fromDatabase &&
          INBOX_TOOLS.has(tool)
        ) {
          return viaInbox();
        }
        return {
          doc: null,
          error:
            code === "tool_error"
              ? `Couldn't update ${fromDatabase ? "the task" : "Dashboard.md"}: ${(message || "the edit was refused").replace(/[.\s]+$/, "")}.`
              : code === "not_in_manifest"
                ? "This change isn't switched on for this page yet."
                : code === "server_not_connected" || code === "not_granted"
                  ? 'Editing items works in the Claude desktop app on your Mac, with the local "dashboard" server running.'
                  : `Couldn't confirm the edit (${code || "unknown error"}). It may or may not have changed.`,
        };
      } finally {
        setBusyRef(null);
      }
    },
    [runtime, commander, onFresh],
  );

  const act: TaskActions["act"] = useCallback(
    async (item, tool, extra) => {
      setError(null);
      const result = await run(item, tool, extra);
      if (result.error) setError(result.error);
      return result.doc;
    },
    [run],
  );

  const save: TaskActions["save"] = useCallback(
    async (item, tool, extra) => (await run(item, tool, extra)).error,
    [run],
  );

  return { act, save, busyRef, error, clearError: () => setError(null) };
}

/** Copies text to the clipboard; a sandboxed frame may refuse the API, where a selected textarea still works. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("aria-hidden", "true");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
