import type { Runtime } from "@atlas/runtime";
import {
  isWorklistDoc,
  type WorkItem,
  type WorklistDoc,
} from "@atlas/ui/sidebar";
import { useCallback, useState } from "react";

import { requestId, type Commander } from "./useCommander";

export type TaskTool = "task_done" | "task_move";

export interface TaskActions {
  /**
   * Marks a task done, or moves it to today, tomorrow or the backlog. Gives
   * the fresh worklist the server answered with, if any.
   */
  act: (
    item: WorkItem,
    tool: TaskTool,
    extra?: { to?: string },
  ) => Promise<WorklistDoc | null>;
  /** The task being changed now. */
  busyRef: string | null;
  /** Why the last change failed, in words. */
  error: string | null;
}

/**
 * Changes a task through the local server, which answers with the fresh
 * worklist; `onFresh` shows and stores it. From the phone, a database
 * task's change goes through the inbox for the Mac mini to apply.
 */
export function useTaskActions(
  runtime: Runtime,
  commander: Commander,
  onFresh: (doc: WorklistDoc) => void,
): TaskActions {
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act: TaskActions["act"] = useCallback(
    async (item, tool, extra = {}) => {
      if (!item.ref) return null;
      setError(null);
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
      };
      const fromDatabase = item.ref.startsWith("db:");
      if (!runtime.present) {
        if (fromDatabase) await viaInbox();
        else
          setError(
            "Editing items needs live connectors, which aren't available in this view.",
          );
        return null;
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
          return answer.tasks;
        }
        return null;
      } catch (err) {
        const { code, message } = err as { code?: string; message?: string };
        if (code === "server_not_connected" && fromDatabase) {
          await viaInbox();
        } else {
          setError(
            code === "tool_error"
              ? `Couldn't update Dashboard.md: ${message || "the edit was refused"}.`
              : code === "not_in_manifest"
                ? "Done and Move aren't switched on for this page yet."
                : code === "server_not_connected" || code === "not_granted"
                  ? 'Editing items works in the Claude desktop app on your Mac, with the local "dashboard" server running.'
                  : `Couldn't confirm the edit (${code || "unknown error"}). Check Dashboard.md before trying again; it may or may not have changed.`,
          );
        }
      } finally {
        setBusyRef(null);
      }
      return null;
    },
    [runtime, commander, onFresh],
  );

  return { act, busyRef, error };
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
