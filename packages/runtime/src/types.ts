/**
 * The artifact runtime as the sidebar sees it: `window.claude.use("mcp")`
 * and `window.claude.use("db")`. The claude.ai artifact host provides it,
 * and the VS Code extension provides a stand-in with the same shapes, so
 * these types describe both.
 */

/**
 * The error codes the runtime rejects with, as the sidebar page of 1 Nov
 * 2026 handles them. The list is closed here; anything else becomes
 * `upstream_error`.
 */
export const ERROR_CODES = [
  "needs_reauth",
  "server_not_connected",
  "selection_required",
  "not_in_manifest",
  "blocked_by_policy",
  "approval_required",
  "server_unavailable",
  "rate_limited",
  "tool_error",
  "not_granted",
  "capability_disabled",
  "capability_removed",
  "upstream_error",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** A rejected runtime call, in the runtime's own shape. */
export interface RuntimeError {
  code: ErrorCode;
  message?: string;
}

/** What `watchTool` reports each time it calls the tool. */
export type ToolEvent =
  { type: "data"; result: unknown } | { type: "error"; error: unknown };

/** How long the host may answer from its own cache, in milliseconds. */
export interface CacheOptions {
  staleTime?: number;
  gcTime?: number;
}

export interface WatchOptions {
  /** Call the tool again this many milliseconds after each answer. */
  refetchInterval?: number;
  cache?: CacheOptions;
}

export interface CallOptions {
  /** `false` asks the host not to answer from its cache. */
  cache?: CacheOptions | false;
}

export interface McpApi {
  callTool(
    server: string,
    tool: string,
    args?: Record<string, unknown> | null,
    options?: CallOptions,
  ): Promise<unknown>;
  /** Calls the tool now and on every interval; returns a stop function. */
  watchTool(
    server: string,
    tool: string,
    args: Record<string, unknown> | null,
    onEvent: (event: ToolEvent) => void,
    options?: WatchOptions,
  ): () => void;
}

export interface DocSnapshot {
  id: string;
  exists: boolean;
  data(): unknown;
}

export interface DocRef {
  get(): Promise<DocSnapshot>;
  set(data: unknown): Promise<unknown>;
  delete(): Promise<unknown>;
  /** Reports the document now and after every write; returns an unsubscribe. */
  onSnapshot(
    onNext: (snapshot: DocSnapshot) => void,
    onError?: (error: unknown) => void,
  ): () => void;
}

export interface DbApi {
  doc(path: string): DocRef;
}

/** `window.claude`. */
export interface ClaudeRuntime {
  use(name: "mcp"): Promise<McpApi>;
  use(name: "db"): Promise<DbApi>;
}
