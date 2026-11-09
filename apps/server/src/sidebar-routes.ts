/**
 * The sidebar as a web page: the page itself at `/sidebar`, and the routes
 * its server runtime (`packages/runtime/src/server.ts`) calls in place of
 * the artifact runtime.
 *
 * | Route                            | What it does                                           |
 * | -------------------------------- | ------------------------------------------------------ |
 * | GET    /sidebar                  | The built sidebar page, marked as served by Atlas      |
 * | POST   /api/host/dashboard/:tool | Calls one allowed tool on the dashboard MCP server     |
 * | GET    /api/sidebar/doc?path=    | One stored document, with its version                  |
 * | PUT    /api/sidebar/doc?path=    | Replaces it, and tells open pages its new version      |
 * | DELETE /api/sidebar/doc?path=    | Deletes it, and tells open pages                       |
 *
 * The page may be shown in a frame inside another app, so it is served
 * without `X-Frame-Options` or a `frame-ancestors` rule. Its requests are
 * same-origin with the frame (the runtime uses the frame's own
 * `location.origin`), so they work framed as they do on their own.
 *
 * A document's path is in the query, not the route, so the request log,
 * which holds the path only, never names a page or a task.
 */
import { closeSync, fstatSync, openSync, readFileSync } from "node:fs";

import { eq, sql } from "drizzle-orm";

import { isDashboardTool, type DashboardHost } from "./dashboard-host";
import type { AtlasDatabase } from "./database";
import { sidebarDocuments } from "./schema";

/** The paths the sidebar stores: `board/<name>`, `details/<key>` and `prs/<key>`. */
const documentPath = /^(board|details|prs)\/[a-z0-9_.-]{1,180}$/;

/** The most a tool's arguments may weigh. They are a few ids and a date. */
const maximumArgumentBytes = 64 * 1024;
/** The most a stored document may weigh. A worklist or details page fits well under it. */
const maximumDocumentBytes = 2 * 1024 * 1024;

/** The tag the server runtime looks for; see `SERVER_MARKER` in the runtime. */
const marker = '<meta name="atlas-runtime" content="server" />';

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

/** An answer the server runtime reads: a runtime error code and a sentence. */
function refusal(status: number, code: string, error: string): Response {
  return new Response(JSON.stringify({ code, error }), {
    status,
    headers: jsonHeaders,
  });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: jsonHeaders });
}

/** Adds the server marker to the page's head. */
export function markPage(html: string): string {
  return html.includes("<head>")
    ? html.replace("<head>", `<head>\n    ${marker}`)
    : `${marker}\n${html}`;
}

/**
 * The built page, read again only when the file changes. The file is
 * opened once per request, and its time and text come from that one open
 * file, so a rebuild between the two cannot mix them.
 */
export function sidebarPageFile(path: string): () => string | undefined {
  let cached: { modified: number; html: string } | undefined;
  return () => {
    let descriptor: number;
    try {
      descriptor = openSync(path, "r");
    } catch {
      return undefined;
    }
    try {
      const modified = fstatSync(descriptor).mtimeMs;
      if (cached?.modified !== modified)
        cached = {
          modified,
          html: markPage(readFileSync(descriptor, "utf8")),
        };
      return cached.html;
    } finally {
      closeSync(descriptor);
    }
  };
}

export interface SidebarRoutesOptions {
  database: AtlasDatabase;
  /** The dashboard MCP server. Leave out when it is not configured here. */
  dashboard?: DashboardHost;
  /** The marked page, or undefined when there is none to serve. */
  page?: () => string | undefined;
  /** Sends a stream frame to every open page. */
  broadcast: (frame: string) => void;
}

export interface SidebarRoutes {
  /** Answers a sidebar route, or returns `undefined` for any other path. */
  handle(request: Request, url: URL): Promise<Response | undefined>;
}

/** A body of at most `limit` bytes, parsed; or the refusal to send. */
async function readJson(
  request: Request,
  limit: number,
): Promise<{ body: unknown } | { refused: Response }> {
  // A JSON content type makes a cross-site request send a preflight, which
  // this server never answers.
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json"))
    return {
      refused: refusal(415, "tool_error", "send the body as application/json"),
    };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > limit)
    return { refused: refusal(413, "tool_error", "the body is too large") };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { refused: refusal(400, "tool_error", "the body is not JSON") };
  }
}

export function createSidebarRoutes({
  database,
  dashboard,
  page,
  broadcast,
}: SidebarRoutesOptions): SidebarRoutes {
  function readDocument(path: string) {
    const row = database
      .select()
      .from(sidebarDocuments)
      .where(eq(sidebarDocuments.path, path))
      .get();
    return {
      path,
      exists: row?.data !== null && row?.data !== undefined,
      data:
        row?.data !== null && row?.data !== undefined
          ? (JSON.parse(row.data) as unknown)
          : null,
      version: row?.version ?? 0,
    };
  }

  /** Writes a document, or its deletion with null, and tells open pages its version. */
  function store(path: string, data: unknown): number {
    const text =
      data === null || data === undefined ? null : JSON.stringify(data);
    const updatedAt = new Date().toISOString();
    const version = database
      .insert(sidebarDocuments)
      .values({ path, data: text, version: 1, updatedAt })
      .onConflictDoUpdate({
        target: sidebarDocuments.path,
        set: {
          data: text,
          updatedAt,
          version: sql`${sidebarDocuments.version} + 1`,
        },
      })
      .returning({ version: sidebarDocuments.version })
      .get()?.version;
    if (version === undefined) throw new Error("the document was not stored");
    broadcast(
      `event: sidebar-doc\ndata: ${JSON.stringify({ path, version })}\n\n`,
    );
    return version;
  }

  async function document(request: Request, url: URL): Promise<Response> {
    const path = url.searchParams.get("path") ?? "";
    if (!documentPath.test(path))
      return refusal(
        400,
        "tool_error",
        "the document path is not one the sidebar stores",
      );
    switch (request.method) {
      case "GET":
        return json(readDocument(path));
      case "PUT": {
        const read = await readJson(request, maximumDocumentBytes);
        if ("refused" in read) return read.refused;
        return json({ path, version: store(path, read.body) });
      }
      case "DELETE":
        return json({ path, version: store(path, null) });
      default:
        return refusal(405, "tool_error", "use GET, PUT or DELETE");
    }
  }

  async function tool(request: Request, name: string): Promise<Response> {
    if (request.method !== "POST")
      return refusal(405, "tool_error", "call a tool with POST");
    if (!isDashboardTool(name))
      return refusal(
        404,
        "not_in_manifest",
        "the sidebar does not use that tool",
      );
    if (!dashboard)
      return refusal(
        503,
        "server_not_connected",
        "the dashboard server is not set up on this Atlas server",
      );
    const read = await readJson(request, maximumArgumentBytes);
    if ("refused" in read) return read.refused;
    const args = read.body ?? {};
    if (typeof args !== "object" || Array.isArray(args))
      return refusal(400, "tool_error", "the arguments must be an object");
    const answer = await dashboard.call(name, args as Record<string, unknown>);
    if (answer.ok) return json(answer.result);
    return refusal(
      answer.code === "tool_error" ? 502 : 503,
      answer.code,
      answer.message,
    );
  }

  return {
    async handle(request, url) {
      if (url.pathname === "/sidebar") {
        if (request.method !== "GET" && request.method !== "HEAD")
          return refusal(405, "tool_error", "the page is read with GET");
        const html = page?.();
        if (html === undefined)
          return new Response("The sidebar is not built on this server.", {
            status: 404,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        return new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer",
          },
        });
      }
      if (url.pathname === "/api/sidebar/doc") return document(request, url);
      const toolName = url.pathname.startsWith("/api/host/dashboard/")
        ? url.pathname.slice("/api/host/dashboard/".length)
        : undefined;
      if (toolName !== undefined) return tool(request, toolName);
      return undefined;
    },
  };
}
