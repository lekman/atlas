/**
 * A stand-in for `window.claude` backed by the Atlas server, for the
 * sidebar page the server serves at `/sidebar`. It has the same shapes as
 * the artifact runtime, so the sidebar code does not change:
 *
 * - `host:dashboard` tool calls go to `POST /api/host/dashboard/<tool>`,
 *   which the server forwards to the dashboard MCP server it runs.
 * - Stored documents are read and written at `/api/sidebar/doc?path=`, kept
 *   in the server's SQLite. The server's event stream says when one
 *   changes; without a stream the page polls.
 * - Any other server is a claude.ai connector, which this page cannot
 *   reach. Those calls fail with `server_not_connected` without a request.
 * - `host` fails with `not_granted`, as in the artifact.
 */
import { ERROR_CODES } from "./types";
import type {
  ClaudeRuntime,
  DbApi,
  DocSnapshot,
  ErrorCode,
  McpApi,
  RuntimeError,
  ToolEvent,
  WatchOptions,
} from "./types";

/** The one tool server the Atlas server stands in for. */
export const DASHBOARD_SERVER = "host:dashboard";

/** The meta tag the server adds to the page it serves: `<meta name="atlas-runtime" content="server">`. */
export const SERVER_MARKER = 'meta[name="atlas-runtime"]';

/** The part of `EventSource` the runtime uses. */
export interface ServerStream {
  addEventListener(
    type: string,
    listener: (event: { data?: string }) => void,
  ): void;
  close(): void;
}

export interface ServerRuntimeOptions {
  /** The server's origin, as `https://atlas.example`. */
  base: string;
  fetch?: typeof fetch;
  /**
   * Opens the server's event stream, or null where there is none. By
   * default an `EventSource` when the page has one.
   */
  openStream?: (url: string) => ServerStream | null;
  /** How often followed documents are read again when there is no stream. */
  pollMilliseconds?: number;
}

/** Codes after which a watch stops calling: the answer will not change. */
const STOP = new Set<string>([
  "not_granted",
  "not_in_manifest",
  "server_not_connected",
]);

const known = new Set<string>(ERROR_CODES);

/** The runtime error a failed response stands for. */
async function responseError(response: Response): Promise<RuntimeError> {
  let body: { code?: unknown; error?: unknown } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // A body that is not JSON says nothing more than the status.
  }
  const message = typeof body.error === "string" ? body.error : undefined;
  const code: ErrorCode =
    typeof body.code === "string" && known.has(body.code)
      ? (body.code as ErrorCode)
      : response.status === 401 || response.status === 403
        ? "not_granted"
        : response.status === 404
          ? "not_in_manifest"
          : response.status === 503
            ? "server_unavailable"
            : "upstream_error";
  return { code, ...(message ? { message } : {}) };
}

function defaultStream(url: string): ServerStream | null {
  const EventSourceClass = (
    globalThis as { EventSource?: new (url: string) => ServerStream }
  ).EventSource;
  return EventSourceClass ? new EventSourceClass(url) : null;
}

interface StoredAnswer {
  exists: boolean;
  data: unknown;
  version: number;
}

export function createServerRuntime(
  options: ServerRuntimeOptions,
): ClaudeRuntime {
  let base = options.base;
  while (base.endsWith("/")) base = base.slice(0, -1);
  const send = options.fetch ?? fetch;
  const openStream = options.openStream ?? defaultStream;
  const pollMilliseconds = options.pollMilliseconds ?? 30_000;

  /** A JSON request; rejects with a `RuntimeError`. */
  async function request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await send(`${base}${path}`, {
        method,
        headers:
          body === undefined ? {} : { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        credentials: "same-origin",
      });
    } catch {
      throw {
        code: "server_unavailable",
        message: "the Atlas server did not answer",
      } satisfies RuntimeError;
    }
    if (!response.ok) throw await responseError(response);
    return response.json() as Promise<unknown>;
  }

  const mcp: McpApi = {
    async callTool(server, tool, args = null) {
      if (server !== DASHBOARD_SERVER)
        throw { code: "server_not_connected" } satisfies RuntimeError;
      return request(
        "POST",
        `/api/host/dashboard/${encodeURIComponent(tool)}`,
        args ?? {},
      );
    },
    watchTool(server, tool, args, onEvent, watch?: WatchOptions) {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const schedule = (again: boolean) => {
        if (!stopped && again && watch?.refetchInterval)
          timer = setTimeout(run, watch.refetchInterval);
      };
      const run = () => {
        mcp.callTool(server, tool, args).then(
          (result) => {
            if (stopped) return;
            onEvent({ type: "data", result } satisfies ToolEvent);
            schedule(true);
          },
          (error: unknown) => {
            if (stopped) return;
            onEvent({ type: "error", error });
            const code = (error as { code?: unknown } | null)?.code;
            schedule(!(typeof code === "string" && STOP.has(code)));
          },
        );
      };
      run();
      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
      };
    },
  };

  // Stored documents: who follows each path, and the version last seen.
  const followers = new Map<string, Set<(snapshot: DocSnapshot) => void>>();
  const versions = new Map<string, number>();
  let stream: ServerStream | null = null;
  let streamTried = false;
  let poller: ReturnType<typeof setInterval> | null = null;

  const docPath = (path: string) =>
    `/api/sidebar/doc?path=${encodeURIComponent(path)}`;

  const snapshot = (path: string, exists: boolean, data: unknown) => {
    const copy = exists ? (JSON.parse(JSON.stringify(data)) as unknown) : null;
    return { id: path, exists, data: () => copy } satisfies DocSnapshot;
  };

  async function fetchDoc(path: string): Promise<StoredAnswer> {
    const answer = (await request("GET", docPath(path))) as StoredAnswer;
    return {
      exists: answer.exists === true,
      data: answer.data ?? null,
      version: typeof answer.version === "number" ? answer.version : 0,
    };
  }

  const tell = (path: string, exists: boolean, data: unknown) => {
    for (const follower of [...(followers.get(path) ?? [])])
      follower(snapshot(path, exists, data));
  };

  /** Reads a followed document and tells its followers when it changed. */
  async function refresh(path: string, newer?: number): Promise<void> {
    if (!followers.get(path)?.size) return;
    const seen = versions.get(path);
    if (newer !== undefined && seen !== undefined && newer <= seen) return;
    try {
      const answer = await fetchDoc(path);
      if (versions.get(path) === answer.version) return;
      versions.set(path, answer.version);
      tell(path, answer.exists, answer.data);
    } catch {
      // The next event or poll reads it again.
    }
  }

  const refreshAll = () => {
    for (const path of followers.keys()) void refresh(path);
  };

  function listen() {
    if (streamTried) return;
    streamTried = true;
    stream = openStream(`${base}/api/stream`);
    if (stream) {
      stream.addEventListener("sidebar-doc", (event) => {
        try {
          const { path, version } = JSON.parse(event.data ?? "") as {
            path?: unknown;
            version?: unknown;
          };
          if (typeof path === "string" && typeof version === "number")
            void refresh(path, version);
        } catch {
          // Not a document event this page understands.
        }
      });
      // A reconnect may have missed changes: read everything followed.
      stream.addEventListener("open", refreshAll);
      return;
    }
    poller = setInterval(refreshAll, pollMilliseconds);
  }

  function quietWhenUnfollowed() {
    if ([...followers.values()].some((set) => set.size)) return;
    stream?.close();
    stream = null;
    streamTried = false;
    if (poller) clearInterval(poller);
    poller = null;
  }

  const db: DbApi = {
    doc(path) {
      return {
        async get() {
          const answer = await fetchDoc(path);
          return snapshot(path, answer.exists, answer.data);
        },
        async set(data) {
          const { version } = (await request("PUT", docPath(path), data)) as {
            version: number;
          };
          versions.set(path, version);
          tell(path, data !== undefined && data !== null, data);
          return null;
        },
        async delete() {
          const { version } = (await request("DELETE", docPath(path))) as {
            version: number;
          };
          versions.set(path, version);
          tell(path, false, null);
          return null;
        },
        onSnapshot(onNext, onError) {
          let set = followers.get(path);
          if (!set) followers.set(path, (set = new Set()));
          set.add(onNext);
          listen();
          fetchDoc(path).then(
            (answer) => {
              if (!set.has(onNext)) return;
              versions.set(path, answer.version);
              onNext(snapshot(path, answer.exists, answer.data));
            },
            (error: unknown) => {
              if (set.has(onNext)) onError?.(error);
            },
          );
          return () => {
            set.delete(onNext);
            quietWhenUnfollowed();
          };
        },
      };
    },
  };

  const use = ((name: string) =>
    name === "mcp"
      ? Promise.resolve(mcp)
      : name === "db"
        ? Promise.resolve(db)
        : Promise.reject({ code: "not_granted" })) as ClaudeRuntime["use"];

  return { use };
}

/**
 * The server runtime when the Atlas server served this page, which it marks
 * with a meta tag; null anywhere else. The artifact and the VS Code view
 * never carry the tag, and have `window.claude` besides.
 */
export function serverRuntimeFor(target: unknown): ClaudeRuntime | null {
  if (typeof target !== "object" || target === null) return null;
  const page = target as {
    document?: {
      querySelector?: (
        selector: string,
      ) => { getAttribute(name: string): string | null } | null;
    };
    location?: { origin?: unknown };
    fetch?: typeof fetch;
  };
  const marker = page.document?.querySelector?.(SERVER_MARKER);
  if (marker?.getAttribute("content") !== "server") return null;
  const origin = page.location?.origin;
  if (typeof origin !== "string" || typeof page.fetch !== "function")
    return null;
  return createServerRuntime({
    base: origin,
    fetch: page.fetch.bind(target) as typeof fetch,
  });
}
