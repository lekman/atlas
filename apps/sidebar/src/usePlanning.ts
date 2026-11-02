import type { Runtime } from "@atlas/runtime";
import {
  isWorklistDoc,
  quadrantOf,
  QUADRANTS,
  skippedText,
  type AssessChange,
  type TriageGrade,
  type WorkItem,
  type WorklistDoc,
} from "@atlas/ui/sidebar";
import { useCallback, useEffect, useState } from "react";

import { requestId, type Commander } from "./useCommander";

interface Answer {
  tasks?: unknown;
  moved?: unknown[];
  graded?: unknown[];
  skipped?: Array<{ why?: string }>;
}

/** What a refused or failed change says, by the runtime's error. */
function failureText(err: unknown, what: string, nothing: string): string {
  const { code, message } = (err ?? {}) as { code?: string; message?: string };
  if (/right after you act/i.test(message ?? "")) {
    return `The Claude app didn't send it, because it only runs a change straight after a click in the page. ${nothing}: try again.`;
  }
  if (code === "cancelled") return `Declined in the Claude app. ${nothing}.`;
  if (code === "not_in_manifest" || code === "not_granted")
    return `${what} isn't switched on for this page yet.`;
  return `Couldn't confirm it (${message || code || "unknown error"}). The worklist refreshes on the next sync.`;
}

export interface Planning {
  /** Moves several database tasks at once, so the app asks once. */
  moveMany: (refs: string[], to: string) => Promise<void>;
  /** Saves grades from Triage. */
  grade: (grades: TriageGrade[]) => Promise<void>;
  /** Saves one task's value, effort or due date. */
  assess: (item: WorkItem, change: AssessChange) => Promise<void>;
  busy: boolean;
  /** What the last move said; it closes by itself after a minute. */
  note: string | null;
  clearNote: () => void;
  /** What the last grading said, shown in Triage. */
  triageNote: string | null;
  /** What the last assessment said, and for which task. */
  assessNote: { ref: string; text: string } | null;
}

export function usePlanning(
  runtime: Runtime,
  commander: Commander,
  items: readonly WorkItem[] | null,
  onFresh: (doc: WorklistDoc) => void,
): Planning {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [triageNote, setTriageNote] = useState<string | null>(null);
  const [assessNote, setAssessNote] = useState<{
    ref: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!note || busy) return;
    const timer = setTimeout(() => setNote(null), 60000);
    return () => clearTimeout(timer);
  }, [note, busy]);

  const call = useCallback(
    async (tool: string, args: Record<string, unknown>) => {
      const answer = ((await runtime.call("host:dashboard", tool, args, {
        cache: false,
      })) ?? {}) as Answer;
      if (isWorklistDoc(answer.tasks)) onFresh(answer.tasks);
      return answer;
    },
    [runtime, onFresh],
  );

  const moveMany: Planning["moveMany"] = useCallback(
    async (refs, to) => {
      if (!refs.length || busy) return;
      setBusy(true);
      setNote(`Moving ${refs.length} to ${to}…`);
      try {
        if (!runtime.present) throw { code: "server_not_connected" };
        const answer = await call("task_move_many", { refs, to });
        setNote(
          `Moved ${(answer.moved ?? []).length} to ${to}${skippedText(answer.skipped ?? [])}.`,
        );
      } catch (err) {
        if ((err as { code?: string }).code === "server_not_connected") {
          for (const ref of refs) {
            const id = requestId();
            const title = items?.find((t) => t.ref === ref)?.title ?? ref;
            await commander.queue(
              { id, ref, action: "move", title },
              "task_move",
              { id, ref, to },
              `Moving it to ${to}; the Mac mini applies it within a minute.`,
            );
          }
          setNote(
            `Queued ${refs.length} moves to ${to}; the Mac mini applies them within a minute.`,
          );
        } else {
          setNote(
            failureText(err, "Moving several tasks at once", "Nothing moved"),
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, runtime, call, commander, items],
  );

  const grade: Planning["grade"] = useCallback(
    async (grades) => {
      if (!grades.length || busy) return;
      if (!runtime.present) {
        setTriageNote(
          "Grading needs the Claude desktop app on your Mac, with the local dashboard server running.",
        );
        return;
      }
      setBusy(true);
      setTriageNote(`Saving ${grades.length}…`);
      try {
        const answer = await call("task_grade_many", { grades });
        setTriageNote(
          `Graded ${(answer.graded ?? []).length}${skippedText(answer.skipped ?? [])}.`,
        );
      } catch (err) {
        setTriageNote(
          failureText(
            err,
            "Grading",
            "Nothing was saved and your choices are kept",
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, runtime, call],
  );

  const assess: Planning["assess"] = useCallback(
    async (item, change) => {
      if (!item.ref) return;
      const before = QUADRANTS.find((q) => q.key === quadrantOf(item))!.short;
      setAssessNote({ ref: item.ref, text: "Saving…" });
      try {
        const answer = await call("task_assess", { ref: item.ref, ...change });
        const fresh = isWorklistDoc(answer.tasks)
          ? answer.tasks.items.find((t) => t.ref === item.ref)
          : undefined;
        const after = fresh
          ? QUADRANTS.find((q) => q.key === quadrantOf(fresh))!.short
          : before;
        setAssessNote({
          ref: item.ref,
          text:
            after === before
              ? `Saved. Still ${after}.`
              : `Saved. ${before} → ${after}.`,
        });
      } catch (err) {
        const message = (err as { message?: string }).message ?? "";
        const claim = /claimed by ([\w.-]+)/i.exec(message);
        setAssessNote({
          ref: item.ref,
          text: claim
            ? `The ${claim[1]} session has claimed this task, so the task database refuses changes from anyone else until it releases it. Nothing changed.`
            : failureText(
                err,
                "Changing value, effort and due date",
                "Nothing changed",
              ),
        });
      }
    },
    [call],
  );

  return {
    moveMany,
    grade,
    assess,
    busy,
    note,
    clearNote: () => setNote(null),
    triageNote,
    assessNote,
  };
}
