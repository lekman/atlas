/**
 * A stand-in for `window.claude` with the same behaviour as the VS Code
 * shim: tools answer from handlers, the store keeps documents in memory and
 * tells every listener about each write. Stories and tests use it, and it
 * can be installed on a window for the built page.
 */
import type {
  CallOptions,
  ClaudeRuntime,
  DbApi,
  DocSnapshot,
  ErrorCode,
  HostApi,
  HostMode,
  McpApi,
  ToolEvent,
  WatchOptions,
} from "./types";

/** Answers a tool call; throw `{ code }` to fail it. */
export type ToolHandler = (
  args: Record<string, unknown> | null,
) => unknown | Promise<unknown>;

export interface FakeRuntimeOptions {
  /** Handlers keyed `server/tool`. A missing one fails with `not_in_manifest`. */
  tools?: Record<string, ToolHandler>;
  /** Stored documents keyed by path. */
  docs?: Record<string, unknown>;
  /**
   * Act as the VS Code extension, which offers `host`. Without it, `host`
   * fails with `not_granted`, as in the artifact.
   */
  host?: FakeHostOptions;
}

export interface FakeHostOptions {
  /** Set to make this page one task's details tab. */
  mode?: HostMode;
  /** `openDetails` fails with this code, as when the editor cannot open the tab. */
  refuse?: ErrorCode;
}

export interface FakeRuntime extends ClaudeRuntime {
  /** Every tool call, in order. */
  readonly calls: Array<{
    server: string;
    tool: string;
    args: Record<string, unknown> | null;
  }>;
  /** The store as it is now. */
  readonly docs: Map<string, unknown>;
  /** Replace or add a tool handler. */
  setTool(server: string, tool: string, handler: ToolHandler): void;
  /** Every ref the page asked the host to open details for, in order. */
  readonly opened: string[];
}

/** Codes after which a watch stops calling, as in the VS Code shim. */
const STOP = new Set(["not_granted", "not_in_manifest"]);

const copy = (data: unknown): unknown =>
  data === undefined || data === null
    ? null
    : (JSON.parse(JSON.stringify(data)) as unknown);

export function createFakeRuntime(
  options: FakeRuntimeOptions = {},
): FakeRuntime {
  const tools = new Map(Object.entries(options.tools ?? {}));
  const docs = new Map<string, unknown>(
    Object.entries(options.docs ?? {}).map(([k, v]) => [k, copy(v)]),
  );
  const listeners = new Map<string, Set<(s: DocSnapshot) => void>>();
  const calls: FakeRuntime["calls"] = [];

  const snap = (path: string): DocSnapshot => {
    const data = docs.get(path);
    return {
      id: path,
      exists: data !== undefined && data !== null,
      data: () => copy(data),
    };
  };
  const notify = (path: string) => {
    for (const fn of [...(listeners.get(path) ?? [])]) fn(snap(path));
  };

  const mcp: McpApi = {
    async callTool(server, tool, args = null, _options?: CallOptions) {
      calls.push({ server, tool, args: args ?? null });
      const handler = tools.get(`${server}/${tool}`);
      if (!handler) throw { code: "not_in_manifest" };
      return handler(args ?? null);
    },
    watchTool(server, tool, args, onEvent, watch?: WatchOptions) {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
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
      const schedule = (again: boolean) => {
        if (!stopped && again && watch?.refetchInterval) {
          timer = setTimeout(run, watch.refetchInterval);
        }
      };
      run();
      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
      };
    },
  };

  const db: DbApi = {
    doc(path) {
      return {
        get: async () => snap(path),
        set: async (data) => {
          docs.set(path, copy(data));
          notify(path);
        },
        delete: async () => {
          docs.delete(path);
          notify(path);
        },
        onSnapshot(onNext) {
          let set = listeners.get(path);
          if (!set) listeners.set(path, (set = new Set()));
          set.add(onNext);
          queueMicrotask(() => {
            if (set.has(onNext)) onNext(snap(path));
          });
          return () => {
            set.delete(onNext);
          };
        },
      };
    },
  };

  const opened: string[] = [];
  const hostOptions = options.host;
  const host: HostApi | null = hostOptions
    ? {
        ...(hostOptions.mode ? { mode: { ...hostOptions.mode } } : {}),
        async openDetails(ref) {
          opened.push(ref);
          if (hostOptions.refuse) throw { code: hostOptions.refuse };
          return null;
        },
      }
    : null;

  const use = ((name: string) =>
    name === "mcp"
      ? Promise.resolve(mcp)
      : name === "db"
        ? Promise.resolve(db)
        : name === "host" && host
          ? Promise.resolve(host)
          : Promise.reject({ code: "not_granted" })) as ClaudeRuntime["use"];

  return {
    use,
    calls,
    docs,
    opened,
    setTool(server, tool, handler) {
      tools.set(`${server}/${tool}`, handler);
    },
  };
}
