import type { Runtime } from "@atlas/runtime";
import {
  mergeStored,
  OPEN_STATES,
  openRequest,
  latestRequest,
  pickUpdate,
  toStore,
  type CommanderRequest,
  askKey,
  type AskAnswer,
  type RequestAction,
  type WaitingItem,
  type WorkItem,
} from "@atlas/ui/sidebar";
import { useCallback, useEffect, useRef, useState } from "react";

import type { InboxConfig } from "./config";

/** An id the local server, the inbox and Commander all use for one request. */
export const requestId = (): string =>
  `dash-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;

/** The task as a request carries it, so the relay, which has no Dashboard.md, can forward it. */
const itemOf = (t: WorkItem) => ({
  customer: t.customer,
  title: t.title,
  key: t.key ?? null,
  link: t.link ?? null,
  band: t.band ?? null,
  day: t.day ?? null,
});

/** The rows of a D1 query answer, in either of the connector's shapes. */
function d1Rows(result: unknown): Array<Record<string, unknown>> {
  const first = Array.isArray(result)
    ? result[0]
    : Array.isArray((result as { result?: unknown } | null)?.result)
      ? (result as { result: unknown[] }).result[0]
      : result;
  const rows = (first as { results?: unknown } | null)?.results;
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

/** A tracker item, as a plan request carries it. */
export interface TrackerItem {
  system: "monday" | "jira" | "github";
  key: string;
  title: string;
  customer: string;
  url?: string | null;
  status?: string | null;
  priority?: string | null;
}

export interface Commander {
  records: Readonly<Record<string, CommanderRequest>>;
  latest: (ref: string | undefined) => CommanderRequest | null;
  open: (ref: string | undefined) => CommanderRequest | null;
  /** Asks Commander about a task: where it stands, or to dispatch it. */
  send: (item: WorkItem, action: "status" | "execute") => Promise<void>;
  /** Asks Commander to plan a task: a details page with a test plan, or a refusal with the reason. */
  plan: (item: WorkItem) => Promise<void>;
  /**
   * Asks Commander to plan a tracker item that has no task yet: it becomes
   * a task with a details page, a test plan and a priority, or is refused
   * with the reason. Its requests are kept under `<system>:<key>`.
   */
  planTracker: (item: TrackerItem) => Promise<void>;
  /**
   * Answers an ask that waits on the operator. Commander hands the answer to
   * the worker that asked, or to the task's owner, and closes the ask. Kept
   * under the task's ref, or `ask:<kind>:<id>`.
   */
  answer: (item: WaitingItem, answer: AskAnswer) => Promise<void>;
  /**
   * Leaves a request in the phone inbox for the Mac mini; false when there
   * is no inbox. Done and move go this way from the phone.
   */
  queue: (
    record: Omit<CommanderRequest, "state" | "requestedAt" | "updatedAt">,
    tool: string,
    args: Record<string, unknown>,
    queuedSummary: string,
  ) => Promise<boolean>;
  /** Why the last request could not be sent at all, in words. */
  error: string | null;
  /** Hides the error, from its close button. */
  clearError: () => void;
}

/**
 * Commander requests: sent through the local server, or through the phone
 * inbox where there is no server; followed every minute while one is
 * open; kept for other devices at `board/commander`.
 */
export function useCommander(
  runtime: Runtime,
  inbox: InboxConfig | undefined,
): Commander {
  const [records, setRecords] = useState<Record<string, CommanderRequest>>({});
  const [error, setError] = useState<string | null>(null);
  const current = useRef(records);
  current.current = records;

  const update = useCallback(
    (
      change: (
        held: Record<string, CommanderRequest>,
      ) => Record<string, CommanderRequest>,
      store = true,
    ) => {
      const next = change(current.current);
      current.current = next;
      setRecords(next);
      if (store)
        runtime.write("board/commander", toStore(next)).catch(() => undefined);
    },
    [runtime],
  );
  const patch = useCallback(
    (id: string, part: Partial<CommanderRequest>, store = true) =>
      update(
        (held) =>
          held[id] ? { ...held, [id]: { ...held[id], ...part } } : held,
        store,
      ),
    [update],
  );

  // Requests another device made, or newer news of ours.
  useEffect(
    () =>
      runtime.subscribe("board/commander", (doc) => {
        const merged = mergeStored(current.current, doc);
        if (merged) update(() => merged, false);
      }),
    [runtime, update],
  );

  const d1 = useCallback(
    (sql: string, params: unknown[]) =>
      runtime.call(
        inbox!.server,
        inbox!.tool,
        { database_id: inbox!.databaseId, sql, params },
        { cache: false },
      ),
    [runtime, inbox],
  );

  const queue: Commander["queue"] = useCallback(
    async (record, tool, args, queuedSummary) => {
      const now = new Date().toISOString();
      update(
        (held) => ({
          ...held,
          [record.id]: {
            ...held[record.id],
            ...record,
            state: "sending",
            via: "inbox",
            requestedAt: now,
            updatedAt: now,
          },
        }),
        false,
      );
      if (!inbox) {
        patch(record.id, {
          state: "failed",
          summary:
            "Not sent: this view has neither the local server nor the Cloudflare connector.",
        });
        return true;
      }
      try {
        await d1(
          "INSERT INTO requests (id, tool, args, ref, action, title, requested_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(id) DO NOTHING",
          [
            record.id,
            tool,
            JSON.stringify(args),
            record.ref,
            record.action,
            String(record.title ?? "").slice(0, 300),
            now,
          ],
        );
        patch(record.id, {
          state: "queued",
          summary: queuedSummary,
          updatedAt: now,
        });
      } catch (err) {
        const code = (err as { code?: string }).code;
        patch(record.id, {
          state: "failed",
          updatedAt: new Date().toISOString(),
          summary:
            code === "server_not_connected" ||
            code === "not_granted" ||
            code === "not_in_manifest"
              ? "Not sent: allow the Cloudflare connector for this page, then try again."
              : `Not sent (${code || "unknown error"}). Try again.`,
        });
      }
      return true;
    },
    [inbox, d1, update, patch],
  );

  const request = useCallback(
    async (
      subject: {
        ref: string;
        title: string;
        answer?: CommanderRequest["answer"];
      },
      action: RequestAction,
      tool: string,
      buildArgs: (id: string) => Record<string, unknown>,
    ) => {
      const id = requestId();
      const now = new Date().toISOString();
      setError(null);
      update(
        (held) => ({
          ...held,
          [id]: {
            id,
            ref: subject.ref,
            action,
            title: subject.title,
            ...(subject.answer ? { answer: subject.answer } : {}),
            state: "sending",
            summary: "",
            worker: null,
            requestedAt: now,
            updatedAt: now,
          },
        }),
        false,
      );
      const args = buildArgs(id);
      const viaInbox = () =>
        queue(
          { id, ref: subject.ref, action, title: subject.title },
          tool,
          args,
          "In the inbox; the Mac mini picks it up within a minute.",
        );
      if (!runtime.present) {
        await viaInbox();
        return;
      }
      try {
        const answer = (await runtime.call("host:dashboard", tool, args, {
          cache: false,
        })) as {
          request?: Record<string, unknown>;
        } | null;
        const update_ = pickUpdate(answer?.request ?? {});
        patch(id, {
          ...update_,
          state: update_.state ?? "received",
          id,
          ref: subject.ref,
          title: subject.title,
        });
      } catch (err) {
        const { code, message } = err as { code?: string; message?: string };
        if (code === "server_not_connected") {
          await viaInbox();
          return;
        }
        // An answer keeps its record, so the form says why it wasn't sent.
        if (
          action === "answer" &&
          (code === "not_in_manifest" || code === "not_granted")
        ) {
          patch(id, {
            state: "failed",
            updatedAt: new Date().toISOString(),
            summary:
              code === "not_in_manifest"
                ? "Not sent: this page can't answer yet. Quit Claude (Cmd+Q), reopen it, allow it, and send again."
                : 'Not sent: answering works in the Claude desktop app on your Mac, with the local "dashboard" server running.',
          });
          return;
        }
        if (code === "not_in_manifest" || code === "not_granted") {
          update((held) => {
            const { [id]: _gone, ...rest } = held;
            return rest;
          }, false);
          setError(
            code === "not_in_manifest"
              ? "Commander requests aren't switched on for this page yet: quit Claude (Cmd+Q) and reopen it, then allow them."
              : 'Commander requests work in the Claude desktop app on your Mac, with the local "dashboard" server running.',
          );
          return;
        }
        patch(id, {
          state: "failed",
          updatedAt: new Date().toISOString(),
          summary:
            code === "tool_error"
              ? `Not sent: ${message || "the local server refused"}${
                  action === "answer" &&
                  /unknown tool|not found/i.test(message ?? "")
                    ? ". The local server is older than this page: quit Claude (Cmd+Q) and reopen it."
                    : ""
                }`
              : `Couldn't confirm it was sent (${code || "unknown error"}). Check Commander before sending again.`,
        });
      }
    },
    [runtime, update, patch, queue],
  );

  // While a request is open, ask about it once a minute: the inbox for the
  // ones it carries, the local server for the rest.
  const anyOpen = Object.values(records).some(
    (r) => OPEN_STATES.has(r.state) && r.state !== "sending",
  );
  useEffect(() => {
    if (!anyOpen) return;
    const tick = async () => {
      const open = Object.values(current.current).filter(
        (r) => OPEN_STATES.has(r.state) && r.state !== "sending",
      );
      const viaInbox = open.filter((r) => r.via === "inbox");
      if (viaInbox.length && inbox) {
        try {
          const rows = d1Rows(
            await d1(
              "SELECT id, action, state, summary, worker, updated_at FROM requests WHERE id IN (SELECT value FROM json_each(?1))",
              [JSON.stringify(viaInbox.map((r) => r.id))],
            ),
          );
          for (const x of rows) {
            const held = current.current[String(x.id)];
            if (
              !held ||
              String(x.updated_at ?? "") <= String(held.updatedAt ?? "")
            )
              continue;
            patch(held.id, pickUpdate({ ...x, updatedAt: x.updated_at }));
          }
        } catch {
          // Offline, or the connector asleep: next minute.
        }
      }
      const direct = open.filter((r) => r.via !== "inbox");
      if (direct.length && runtime.present) {
        const since = direct.map((r) => r.requestedAt).sort()[0];
        try {
          const answer = (await runtime.call(
            "host:dashboard",
            "commander_requests",
            { since },
            { cache: false },
          )) as {
            items?: Array<Record<string, unknown>>;
          } | null;
          for (const x of answer?.items ?? []) {
            const held = current.current[String(x.id)];
            if (
              !held ||
              String(x.updatedAt ?? "") < String(held.updatedAt ?? "")
            )
              continue;
            if (
              x.updatedAt === held.updatedAt &&
              x.state === held.state &&
              String(x.summary ?? "") === String(held.summary ?? "")
            )
              continue;
            patch(held.id, pickUpdate(x));
          }
        } catch {
          // Another device, or Commander asleep: next minute.
        }
      }
    };
    tick().catch(() => undefined);
    const timer = setInterval(() => tick().catch(() => undefined), 60000);
    return () => clearInterval(timer);
  }, [anyOpen, runtime, inbox, d1, patch]);

  return {
    records,
    latest: (ref) => latestRequest(records, ref),
    open: (ref) => openRequest(records, ref),
    send: async (item, action) => {
      if (!item.ref) return;
      await request(
        { ref: item.ref, title: item.title },
        action,
        "commander_send",
        (id) => ({
          ref: item.ref,
          action,
          id,
          item: itemOf(item),
        }),
      );
    },
    plan: async (item) => {
      if (!item.ref) return;
      await request(
        { ref: item.ref, title: item.title },
        "plan",
        "commander_plan",
        (id) => ({
          id,
          ref: item.ref,
          item: itemOf(item),
        }),
      );
    },
    planTracker: async (item) => {
      const ref = `${item.system}:${item.key}`;
      await request(
        { ref, title: item.title },
        "plan",
        "commander_plan",
        (id) => ({
          id,
          system: item.system,
          key: item.key,
          customer: item.customer,
          title: item.title,
          url: item.url ?? "",
          status: item.status ?? "",
          priority: item.priority ?? "",
        }),
      );
    },
    answer: async (item, answer) => {
      const ref = askKey(item);
      if (!ref) return;
      await request(
        { ref, title: item.ask ?? item.title ?? "", answer },
        "answer",
        "commander_answer",
        (id) => ({
          id,
          ref,
          ask: {
            kind: item.kind,
            ...(item.id ? { id: item.id } : {}),
            ...(item.ref ? { ref: item.ref } : {}),
            ...(item.worker ? { worker: item.worker } : {}),
            ...(item.customer ? { customer: item.customer } : {}),
            ask: String(item.ask ?? "").slice(0, 300),
            ...(item.title ? { title: item.title } : {}),
          },
          answer: {
            ...(answer.choice ? { choice: answer.choice.slice(0, 80) } : {}),
            ...(answer.always ? { always: true } : {}),
            ...(answer.text ? { text: answer.text.slice(0, 2000) } : {}),
          },
        }),
      );
    },
    queue,
    error,
    clearError: () => setError(null),
  };
}
