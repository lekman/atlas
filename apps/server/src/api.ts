/**
 * The HTTP API and the event stream. Every view and every agent reads the
 * same routes; the web app is served beside them from the same origin.
 *
 * | Route              | What it does                                            |
 * | ------------------ | ------------------------------------------------------- |
 * | GET  /api/health   | Whether the server is up, and its version               |
 * | GET  /api/dataset  | Every record, checked against the core schema           |
 * | GET  /api/events   | The event log after `?after=<sequence>`, oldest first   |
 * | POST /api/events   | Adds one event, writes its effect and streams it        |
 * | GET  /api/stream   | Server-sent events: each new event as it is stored      |
 */
import { ZodError } from "zod/v4";

import type { AtlasDatabase } from "./database";
import {
  appendEvent,
  EventRejected,
  listEvents,
  readDataset,
  type StoredEvent,
} from "./store";

/** The most a posted event may weigh. Events are a sentence, not a document. */
const maximumBodyBytes = 64 * 1024;
/** How often an idle stream sends a comment, so proxies keep it open. */
const keepAliveMilliseconds = 25_000;

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

export interface ApiOptions {
  database: AtlasDatabase;
  version: string;
}

export interface Api {
  /** Answers a request under `/api/`, or returns `undefined` for any other path. */
  handle(request: Request): Promise<Response | undefined>;
  /** How many streams are open. */
  listeners(): number;
  /** Ends every open stream, for a clean shutdown. */
  close(): void;
}

export function createApi({ database, version }: ApiOptions): Api {
  const streams = new Set<(stored: StoredEvent) => void>();
  const closers = new Set<() => void>();

  function broadcast(stored: StoredEvent) {
    for (const send of streams) send(stored);
  }

  function stream(request: Request): Response {
    const header = request.headers.get("last-event-id");
    const after = header && /^\d+$/.test(header) ? Number(header) : undefined;
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
        const send = (stored: StoredEvent) => write(streamFrame(stored));
        // A browser that reconnects names the last event it saw; send what
        // it missed before anything new.
        if (after !== undefined)
          for (const missed of listEvents(database, after)) send(missed);
        write(": connected\n\n");
        const timer = setInterval(
          () => write(": keep-alive\n\n"),
          keepAliveMilliseconds,
        );
        finish = () => {
          clearInterval(timer);
          streams.delete(send);
          closers.delete(finish);
          try {
            controller.close();
          } catch {
            // Already closed by the client.
          }
        };
        streams.add(send);
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
      const stored = appendEvent(database, body);
      broadcast(stored);
      return json(stored, 201);
    } catch (error) {
      if (error instanceof ZodError)
        return problem(400, "the event does not match the model", error.issues);
      if (error instanceof EventRejected)
        return problem(error.reason === "missing" ? 404 : 409, error.message);
      throw error;
    }
  }

  return {
    async handle(request) {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/") && url.pathname !== "/api")
        return undefined;
      const route = `${request.method} ${url.pathname}`;
      switch (route) {
        case "GET /api/health":
          return json({ status: "ok", version });
        case "GET /api/dataset":
          return json(readDataset(database));
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
      for (const finish of [...closers]) finish();
    },
  };
}
