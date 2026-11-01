/**
 * The one place the sidebar touches `window.claude`. Components get a
 * `Runtime` and never the host object, so stories and tests run against
 * `createFakeRuntime` instead.
 */
import {
  ERROR_CODES,
  type CallOptions,
  type ClaudeRuntime,
  type DbApi,
  type DocSnapshot,
  type ErrorCode,
  type McpApi,
  type RuntimeError,
  type ToolEvent,
  type WatchOptions,
} from "./types";

const KNOWN = new Set<string>(ERROR_CODES);

/**
 * Codes that mean the connector is not usable here at all, as opposed to
 * a failed call. Live data from it is dropped, not kept as last known.
 */
export const UNAUTHORISED = new Set<ErrorCode>([
  "needs_reauth",
  "server_not_connected",
  "blocked_by_policy",
  "approval_required",
  "not_in_manifest",
  "selection_required",
  "not_granted",
  "capability_disabled",
  "capability_removed",
]);

/** Turns anything a runtime call rejected with into a `RuntimeError`. */
export function toRuntimeError(error: unknown): RuntimeError {
  if (typeof error === "object" && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    const text = typeof message === "string" && message ? message : undefined;
    const known = typeof code === "string" && KNOWN.has(code);
    return {
      code: known ? (code as ErrorCode) : "upstream_error",
      ...(text ? { message: text } : {}),
    };
  }
  return {
    code: "upstream_error",
    ...(typeof error === "string" && error ? { message: error } : {}),
  };
}

/** The sentence the sidebar shows for an error from `server`. */
export function describeError(error: RuntimeError, server: string): string {
  switch (error.code) {
    case "needs_reauth":
      return `${server} needs reconnecting. Reconnect it in claude.ai Settings → Connectors.`;
    case "server_not_connected":
      return `${server} isn't connected for you. Add it in claude.ai Settings → Connectors.`;
    case "selection_required":
      return `You have more than one ${server} connector. Pick one in the prompt above the page.`;
    case "not_in_manifest":
      return `${server} is turned off for this page. Allow it from the page's Permissions menu.`;
    case "blocked_by_policy":
      return `Your organisation's policy blocks ${server} here.`;
    case "approval_required":
      return `${server} needs per-call approval, which this page can't request.`;
    case "server_unavailable":
    case "rate_limited":
      return `${server} didn't answer. Showing the last data received; it tries again on the next refresh.`;
    case "tool_error":
      return `${server} reported an error: ${error.message || "no details"}.`;
    case "not_granted":
    case "capability_disabled":
    case "capability_removed":
      return "Live connectors aren't available in this view.";
    default:
      return `${server} returned an unexpected error${error.message ? `: ${error.message}` : ""}.`;
  }
}

/**
 * The data inside a tool result. The artifact host puts it in `payload`,
 * an MCP result in `structuredContent`; without either, the text content
 * parsed as JSON, or the text itself.
 */
export function toolData(result: unknown): unknown {
  if (typeof result !== "object" || result === null) return result;
  const { structuredContent, payload, content } = result as {
    structuredContent?: unknown;
    payload?: unknown;
    content?: unknown;
  };
  if (structuredContent !== undefined && structuredContent !== null) {
    return structuredContent;
  }
  if (payload !== undefined) return payload;
  if (!Array.isArray(content)) return result;
  const text = content
    .map((part: unknown) => {
      const value = (part as { text?: unknown } | null)?.text;
      return typeof value === "string" ? value : "";
    })
    .join("");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** When the host answered from its cache, the time that answer was stored. */
export function cachedAt(result: unknown): number | null {
  const at = (result as { cache?: { storedAt?: unknown } } | null)?.cache
    ?.storedAt;
  if (typeof at === "number") return at;
  if (typeof at === "string" && !Number.isNaN(Date.parse(at))) {
    return Date.parse(at);
  }
  return null;
}

/** What a feed knows at any moment. Panels show `live ?? stored`. */
export interface FeedState<T> {
  live: T | null;
  /** When the live data was read, in epoch milliseconds. */
  liveAt: number | null;
  stored: T | null;
  error: RuntimeError | null;
}

export interface FeedOptions<T> {
  server: string;
  tool: string;
  args?: Record<string, unknown> | null;
  /** The stored copy's path, `board/<name>`. Without one, nothing is stored. */
  path?: string;
  /** Checks a tool result's data or a stored copy; null when it is not one. */
  accept: (data: unknown) => T | null;
  /** The copy is rewritten only when this changes. Default: the JSON. */
  signature?: (data: T) => string;
  /** The document to store; default the data itself. */
  toStored?: (data: T, now: Date) => unknown;
  watch?: WatchOptions;
}

export interface RuntimeOptions {
  now?: () => Date;
}

export class Runtime {
  readonly #host: ClaudeRuntime | null;
  readonly #now: () => Date;

  constructor(host: ClaudeRuntime | null, options: RuntimeOptions = {}) {
    this.#host = host;
    this.#now = options.now ?? (() => new Date());
  }

  /**
   * The runtime of the page this code runs in. Outside the artifact and
   * the VS Code view there is none, and every call fails with
   * `not_granted`, which the sidebar shows as "not available in this view".
   */
  static fromWindow(target: unknown = globalThis): Runtime {
    const claude = (target as { claude?: unknown } | null)?.claude;
    const usable =
      typeof claude === "object" &&
      claude !== null &&
      typeof (claude as { use?: unknown }).use === "function";
    return new Runtime(usable ? (claude as ClaudeRuntime) : null);
  }

  get present(): boolean {
    return this.#host !== null;
  }

  async #mcp(): Promise<McpApi> {
    if (!this.#host) throw { code: "not_granted" };
    return this.#host.use("mcp");
  }

  async #db(): Promise<DbApi> {
    if (!this.#host) throw { code: "not_granted" };
    return this.#host.use("db");
  }

  /** Calls a tool and returns its data; rejects with a `RuntimeError`. */
  async call(
    server: string,
    tool: string,
    args: Record<string, unknown> | null = null,
    options?: CallOptions,
  ): Promise<unknown> {
    try {
      const mcp = await this.#mcp();
      return toolData(await mcp.callTool(server, tool, args, options));
    } catch (error) {
      throw toRuntimeError(error);
    }
  }

  /**
   * Watches a tool. `onData` gets each result's data and the time it was
   * read (the host's cache time when it answered from cache). The returned
   * function stops the watch, including one that has not started yet.
   */
  watch(
    server: string,
    tool: string,
    args: Record<string, unknown> | null,
    handlers: {
      onData: (data: unknown, at: number) => void;
      onError?: (error: RuntimeError) => void;
    },
    options?: WatchOptions,
  ): () => void {
    let stop: (() => void) | null = null;
    let stopped = false;
    const onEvent = (event: ToolEvent) => {
      if (stopped) return;
      if (event.type === "data") {
        const at = cachedAt(event.result) ?? this.#now().getTime();
        handlers.onData(toolData(event.result), at);
      } else handlers.onError?.(toRuntimeError(event.error));
    };
    this.#mcp().then(
      (mcp) => {
        if (!stopped)
          stop = mcp.watchTool(server, tool, args, onEvent, options);
      },
      (error: unknown) => {
        if (!stopped) handlers.onError?.(toRuntimeError(error));
      },
    );
    return () => {
      stopped = true;
      stop?.();
    };
  }

  /** Reads a stored document; `undefined` when it does not exist. */
  async read<T = unknown>(path: string): Promise<T | undefined> {
    try {
      const snapshot = await (await this.#db()).doc(path).get();
      return snapshot.exists ? (snapshot.data() as T) : undefined;
    } catch (error) {
      throw toRuntimeError(error);
    }
  }

  async write(path: string, data: unknown): Promise<void> {
    try {
      await (await this.#db()).doc(path).set(data);
    } catch (error) {
      throw toRuntimeError(error);
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await (await this.#db()).doc(path).delete();
    } catch (error) {
      throw toRuntimeError(error);
    }
  }

  /** Follows a stored document; `onNext` gets `undefined` when it is gone. */
  subscribe<T = unknown>(
    path: string,
    onNext: (data: T | undefined) => void,
    onError?: (error: RuntimeError) => void,
  ): () => void {
    let stop: (() => void) | null = null;
    let stopped = false;
    const next = (snapshot: DocSnapshot) => {
      if (!stopped)
        onNext(snapshot.exists ? (snapshot.data() as T) : undefined);
    };
    const fail = (error: unknown) => {
      if (!stopped) onError?.(toRuntimeError(error));
    };
    this.#db().then((db) => {
      if (!stopped) stop = db.doc(path).onSnapshot(next, fail);
    }, fail);
    return () => {
      stopped = true;
      stop?.();
    };
  }

  /**
   * A tool watched live, with a stored copy for devices that cannot reach
   * it. Each new live answer is stored when its signature changed, and the
   * stored copy is followed, so a phone sees what the Mac last read. An
   * error that means the connector is unusable here drops the live data;
   * any other error keeps it as last known.
   */
  feed<T>(
    options: FeedOptions<T>,
    onState: (state: FeedState<T>) => void,
  ): () => void {
    const state: FeedState<T> = {
      live: null,
      liveAt: null,
      stored: null,
      error: null,
    };
    const emit = () => onState({ ...state });
    const signature = options.signature ?? ((data: T) => JSON.stringify(data));
    let written: string | null = null;
    const stops: Array<() => void> = [];

    if (options.path) {
      const path = options.path;
      stops.push(
        this.subscribe(path, (doc) => {
          state.stored = doc === undefined ? null : options.accept(doc);
          if (state.stored !== null) written ??= signature(state.stored);
          emit();
        }),
      );
    }

    stops.push(
      this.watch(
        options.server,
        options.tool,
        options.args ?? null,
        {
          onData: (raw, at) => {
            const data = options.accept(raw);
            if (data === null) {
              state.error = {
                code: "tool_error",
                message: "unexpected answer from the server",
              };
              emit();
              return;
            }
            state.live = data;
            state.liveAt = at;
            state.error = null;
            emit();
            if (!options.path) return;
            const sig = signature(data);
            if (sig === written) return;
            written = sig;
            const doc = options.toStored
              ? options.toStored(data, this.#now())
              : data;
            this.write(options.path, doc).catch(() => undefined);
          },
          onError: (error) => {
            state.error = error;
            if (UNAUTHORISED.has(error.code)) {
              state.live = null;
              state.liveAt = null;
            }
            emit();
          },
        },
        options.watch,
      ),
    );

    return () => {
      for (const stop of stops) stop();
    };
  }
}
