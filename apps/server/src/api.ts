/**
 * The HTTP API and the event stream. Every view and every agent reads the
 * same routes; the web app is served beside them from the same origin.
 *
 * | Route                   | What it does                                          |
 * | ----------------------- | ----------------------------------------------------- |
 * | GET  /api/health        | Whether the server is up, its version and task counts |
 * | GET  /api/dataset       | Every record, and the last event they include         |
 * | GET  /api/events        | The event log after `?after=<sequence>`, oldest first |
 * | POST /api/events        | Adds one event, writes its effect and streams it      |
 * | GET  /api/stream        | Server-sent events after `?after=`, then each new one |
 * | GET  /api/items/:id/log | One item's log from the task database, newest first   |
 * | POST /mcp               | The MCP tools agents call (see `mcp.ts`)              |
 *
 * With a task source, every read lays the task database's clients,
 * workstreams and tasks over SQLite (see `task-source.ts`), and the stream
 * sends a `refresh` event whenever they change. With `fakeDevelopment`,
 * the dataset sent to views carries invented development tracking (see
 * `fake-development.ts`), and health says so.
 */
import { ZodError } from "zod/v4";

import { Identifier, type AtlasEvent, type ItemLog } from "@atlas/core";

import type { AtlasDatabase } from "./database";
import {
  CallerRefused,
  identify,
  tailscaleNodeLookup,
  type Caller,
  type NodeLookup,
} from "./identity";
import { withFakeDevelopment } from "./fake-development";
import { everyClient } from "./machines";
import { handleMcp } from "./mcp";
import {
  appendEvent,
  EventRejected,
  listEvents,
  readDataset,
  readSnapshot,
  type Overlay,
  type StoredEvent,
} from "./store";
import { noTaskSource, type TaskCache } from "./task-cache";
import { mergeTasks, type MergedDataset } from "./task-source";

/** The most a posted event may weigh. Events are a sentence, not a document. */
const maximumBodyBytes = 64 * 1024;
/** How often an idle stream sends a comment, so proxies keep it open. */
const keepAliveMilliseconds = 25_000;

/** The item log route: `/api/items/<id>/log`. */
const itemLogPath = /^\/api\/items\/([^/]+)\/log$/;

/** The last event the dataset in a response already holds. */
export const sequenceHeader = "x-atlas-sequence";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function problem(status: number, message: string, details?: unknown) {
  return json({ error: message, ...(details ? { details } : {}) }, status);
}

function streamFrame(stored: StoredEvent): string {
  return `id: ${stored.sequence}\nevent: atlas\ndata: ${JSON.stringify(stored)}\n\n`;
}

/**
 * Tells every open page that the task database changed, so it reloads the
 * dataset. It carries no id, so a page's place in the event log stays
 * where it was.
 */
function refreshFrame(lastRefresh: string | null): string {
  return `event: refresh\ndata: ${JSON.stringify({ lastRefresh })}\n\n`;
}

export interface ApiOptions {
  database: AtlasDatabase;
  version: string;
  /**
   * Refuse callers that are neither a machine with a token nor a person
   * named by Tailscale Serve. Off until every machine has its token.
   */
  requireTokens?: boolean;
  /** How a caller's address becomes a Tailscale node. `tailscale whois` by default. */
  lookupNode?: NodeLookup;
  /** The task database's clients, workstreams and tasks. Leave out to serve SQLite alone. */
  tasks?: TaskCache;
  /**
   * Names this run of the server. Sent to every page that opens the stream,
   * so a page that reconnects to a newer run reloads itself.
   */
  build?: string;
  /**
   * Lay invented development tracking over items tracked on GitHub in the
   * dataset views read. Off unless `ATLAS_FAKE_DEVELOPMENT=true`.
   */
  fakeDevelopment?: boolean;
}

export interface Api {
  /**
   * Answers a request under `/api/` or to `/mcp`, or returns `undefined` for
   * any other path. `socketAddress` is the connection's remote address.
   */
  handle(
    request: Request,
    socketAddress?: string,
  ): Promise<Response | undefined>;
  /** How many streams are open. */
  listeners(): number;
  /** Ends every open stream, for a clean shutdown. */
  close(): void;
}

/** Whether a caller may use the whole API: a person, or a machine that sees every client. */
function seesEverything(caller: Caller): boolean {
  return (
    caller.kind === "person" ||
    (caller.kind === "machine" && caller.machine.clients.includes(everyClient))
  );
}

export function createApi({
  database,
  version,
  requireTokens = false,
  lookupNode = tailscaleNodeLookup(),
  tasks,
  build,
  fakeDevelopment = false,
}: ApiOptions): Api {
  const streams = new Set<(text: string) => void>();
  const closers = new Set<() => void>();

  /** The task database's records laid over SQLite, once there has been a good read. */
  const overlay: Overlay | undefined = tasks
    ? (dataset) => {
        const current = tasks.current();
        return current ? mergeTasks(dataset, current).dataset : dataset;
      }
    : undefined;

  const stopRefreshes = tasks?.subscribe(() => {
    const frame = refreshFrame(tasks.health().lastRefresh);
    for (const write of streams) write(frame);
  });

  /** Stores an event and streams it to every open view. */
  function record(event: AtlasEvent): StoredEvent {
    const stored = appendEvent(database, event, new Date(), overlay);
    const frame = streamFrame(stored);
    for (const write of streams) write(frame);
    return stored;
  }

  /** The merge as of now, for its counts, or `undefined` before a good read. */
  function merged(): MergedDataset | undefined {
    const current = tasks?.current();
    return current ? mergeTasks(readDataset(database), current) : undefined;
  }

  /**
   * Health: counts only. It is open without a token, so it never names a
   * client, a task or a claimer; the unknown claimers' names are in the
   * list_agents reply, which needs a token.
   */
  function health() {
    const development = fakeDevelopment ? { development: "fake" } : {};
    if (!tasks)
      return {
        status: "ok",
        version,
        ...(build ? { build } : {}),
        ...development,
        tasks: {
          ...noTaskSource,
          dangling: 0,
          ambiguousClaims: 0,
          unknownClaimers: 0,
        },
      };
    const merge = merged();
    return {
      status: "ok",
      version,
      ...(build ? { build } : {}),
      ...development,
      tasks: {
        ...tasks.health(),
        dangling: merge?.dangling ?? 0,
        ambiguousClaims: merge?.ambiguousClaims ?? 0,
        unknownClaimers: merge?.unknownClaimers.count ?? 0,
      },
    };
  }

  function stream(request: Request): Response {
    // A reconnecting browser names the last event it saw in Last-Event-ID; a
    // page opening the stream for the first time names it in ?after=.
    const named =
      request.headers.get("last-event-id") ??
      new URL(request.url).searchParams.get("after");
    const after = named && /^\d+$/.test(named) ? Number(named) : undefined;
    const encoder = new TextEncoder();
    let finish = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (text: string) => {
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            finish();
          }
        };
        // A browser that reconnects names the last event it saw; send what
        // it missed before anything new.
        if (after !== undefined)
          for (const missed of listEvents(database, after))
            write(streamFrame(missed));
        if (build)
          write(`event: build\ndata: ${JSON.stringify({ build })}\n\n`);
        write(": connected\n\n");
        const timer = setInterval(
          () => write(": keep-alive\n\n"),
          keepAliveMilliseconds,
        );
        finish = () => {
          clearInterval(timer);
          streams.delete(write);
          closers.delete(finish);
          try {
            controller.close();
          } catch {
            // Already closed by the client.
          }
        };
        streams.add(write);
        closers.add(finish);
        request.signal.addEventListener("abort", () => finish());
      },
      cancel() {
        finish();
      },
    });
    return new Response(body, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  /**
   * One item's log. Empty without a task source, and for an item the task
   * source does not hold. The log line names the failure only.
   */
  async function itemLog(rawId: string): Promise<Response> {
    let id: string;
    try {
      id = decodeURIComponent(rawId);
    } catch {
      return problem(400, "the item id is not a valid identifier");
    }
    if (!Identifier.safeParse(id).success)
      return problem(400, "the item id is not a valid identifier");
    if (!tasks) return json({ entries: [] } satisfies ItemLog);
    try {
      return json({ entries: await tasks.readItemLog(id) } satisfies ItemLog);
    } catch {
      return problem(503, "the task database did not answer");
    }
  }

  async function postEvent(request: Request): Promise<Response> {
    // A JSON content type makes a cross-site form or script send a preflight,
    // which this server never answers, so another site cannot post here
    // through a browser on the tailnet.
    const type = request.headers.get("content-type") ?? "";
    if (!type.toLowerCase().startsWith("application/json"))
      return problem(415, "send the event as application/json");
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > maximumBodyBytes)
      return problem(413, "the event is too large");
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maximumBodyBytes)
      return problem(413, "the event is too large");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return problem(400, "the body is not JSON");
    }
    try {
      return json(record(body as AtlasEvent), 201);
    } catch (error) {
      if (error instanceof ZodError)
        return problem(400, "the event does not match the model", error.issues);
      if (error instanceof EventRejected)
        return problem(error.reason === "missing" ? 404 : 409, error.message);
      throw error;
    }
  }

  return {
    async handle(request, socketAddress) {
      const url = new URL(request.url);
      const isMcp = url.pathname === "/mcp";
      if (!isMcp && !url.pathname.startsWith("/api/")) return undefined;
      if (url.pathname === "/api/health" && request.method === "GET")
        return json(health());

      let caller: Caller;
      try {
        caller = await identify(request, socketAddress, database, lookupNode);
      } catch (error) {
        if (error instanceof CallerRefused) return problem(401, error.message);
        throw error;
      }
      if (isMcp) {
        if (requireTokens && caller.kind !== "machine")
          return problem(401, "MCP needs a machine token");
        return handleMcp(request, {
          database,
          version,
          record,
          ...(overlay
            ? {
                overlay,
                unknownClaims: () => merged()?.unknownClaims ?? [],
              }
            : {}),
          ...(caller.kind === "machine" ? { machine: caller.machine } : {}),
        });
      }
      // The API returns every client's records, so a machine limited to some
      // clients uses MCP, which filters by its scope.
      if (
        (requireTokens || caller.kind === "machine") &&
        !seesEverything(caller)
      )
        return problem(
          caller.kind === "anonymous" ? 401 : 403,
          caller.kind === "anonymous"
            ? "sign in through Tailscale Serve or send a machine token"
            : "this machine may not see every client; use MCP",
        );

      const route = `${request.method} ${url.pathname}`;
      const itemLogMatch = itemLogPath.exec(url.pathname);
      if (itemLogMatch?.[1] && request.method === "GET")
        return itemLog(itemLogMatch[1]);
      switch (route) {
        case "GET /api/dataset": {
          // Read together, so the page knows which events the dataset holds.
          const { dataset, sequence } = readSnapshot(database, overlay);
          const response = json(
            fakeDevelopment ? withFakeDevelopment(dataset) : dataset,
          );
          response.headers.set(sequenceHeader, String(sequence));
          return response;
        }
        case "GET /api/events": {
          const after = url.searchParams.get("after") ?? "0";
          if (!/^\d+$/.test(after))
            return problem(400, "after must be a sequence number");
          return json(listEvents(database, Number(after)));
        }
        case "POST /api/events":
          return postEvent(request);
        case "GET /api/stream":
          return stream(request);
        default:
          return problem(404, `no route ${route}`);
      }
    },
    listeners: () => streams.size,
    close() {
      stopRefreshes?.();
      for (const finish of [...closers]) finish();
    },
  };
}
