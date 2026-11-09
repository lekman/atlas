/**
 * The dispatcher's connections to the world: the task database's API, the
 * Commander bridge that wakes an agent, and the GitHub command line that
 * merges. Each takes its address and a token function, so a token is read
 * when it is needed and never logged or put in an error.
 */
import type { AgentWaker, Merger, TaskApi, WakeRequest } from "./dispatcher";
import type { TaskDraft } from "./dispatcher-rules";

/** The task states that count as open: not `done` and not `dropped`. */
const openStates = new Set(["todo", "doing", "review", "approved", "merged"]);

/** Seconds to wait for an answer before a call counts as failed. */
const timeoutSeconds = 20;

type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

export interface HttpConnection {
  url: string;
  token: () => Promise<string>;
  /** `fetch` unless set; tests pass their own. */
  fetch?: FetchFunction;
}

/**
 * Calls one tool on the tasks MCP server over HTTP, as the `tasks` command
 * and gh-events do: one JSON-RPC `tools/call`, answered as JSON or as one
 * server-sent event. Returns the tool's JSON answer.
 */
async function callTool(
  connection: HttpConnection,
  tool: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const send = connection.fetch ?? fetch;
  const response = await send(connection.url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${await connection.token()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: input },
    }),
    signal: AbortSignal.timeout(timeoutSeconds * 1000),
  });
  if (!response.ok)
    throw new Error(`the tasks API answered HTTP ${response.status}`);
  const raw = await response.text();
  const data = raw
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .at(-1);
  let message: {
    error?: unknown;
    result?: { content?: { text?: string }[]; isError?: boolean };
  };
  try {
    message = JSON.parse(data ?? raw);
  } catch {
    throw new Error(`the tasks API's answer to ${tool} was not JSON`);
  }
  if (message.error) throw new Error(`the tasks API refused ${tool}`);
  const text = message.result?.content?.[0]?.text ?? "";
  // A refusal's text is the tasks server's own message, safe to keep.
  if (message.result?.isError)
    throw new Error(`${tool}: ${text.slice(0, 120)}`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`the tasks API's answer to ${tool} was not JSON`);
  }
}

/** The tool input `task_add` takes for a draft. */
export function taskAddInput(
  draft: TaskDraft,
  by: string,
  today: string,
): Record<string, unknown> {
  return {
    by,
    clientId: draft.clientId,
    title: draft.title,
    summary: draft.summary,
    tags: draft.tags,
    priority: draft.priority,
    kind: "work",
    scheduledFor: today,
    ...(draft.pullRequests ? { pullRequests: draft.pullRequests } : {}),
    ...(draft.tracker ? { tracker: draft.tracker } : {}),
    // Waiting on "You" puts the task on the reader's Waiting on you list,
    // while an agent is still asked to start on it.
    ...(draft.needsYou
      ? {
          blocked: true,
          blockedOn: {
            since: today,
            waitingFor: "You",
            reason:
              "A high or critical security alert: check the fix an agent prepares",
          },
        }
      : {}),
  };
}

/** The task database through the tasks MCP server's HTTP endpoint. */
export function tasksApi(connection: HttpConnection): TaskApi {
  return {
    async add(draft, by, today) {
      const answer = (await callTool(
        connection,
        "task_add",
        taskAddInput(draft, by, today),
      )) as { id?: unknown };
      if (typeof answer?.id !== "string" || !answer.id)
        throw new Error("task_add gave no id");
      return { id: answer.id };
    },
    async isOpen(taskId) {
      const answer = (await callTool(connection, "task_get", {
        id: taskId,
      })) as { state?: unknown };
      return typeof answer?.state === "string" && openStates.has(answer.state);
    },
  };
}

/**
 * The body of an `execute` request to the Commander bridge, in the shape
 * the dashboard's `commander_send` sends. `ref` names a task database task
 * as `db:<id>`, as the dashboard does.
 */
export function commanderRequest(
  request: WakeRequest,
  requestedAt: string,
): Record<string, unknown> {
  return {
    id: request.requestId,
    action: "execute",
    client: request.clientName,
    title: request.title,
    key: request.key,
    link: request.url,
    band: "today",
    day: request.day,
    ref: `db:${request.taskId}`,
    requestedAt,
  };
}

/** An address without the slashes it ends with, trimmed in one pass. */
export function withoutTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end -= 1;
  return url.slice(0, end);
}

/**
 * Wakes an agent through the Commander bridge: `POST /requests` with the
 * bridge's shared token. Commander stores the request and dispatches the
 * task to a worker session. The same request id sent twice is one request.
 */
export function commanderWaker(
  connection: HttpConnection & { now?: () => Date },
): AgentWaker {
  return {
    async wake(request) {
      const send = connection.fetch ?? fetch;
      const requestedAt = (connection.now?.() ?? new Date())
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z");
      const response = await send(
        `${withoutTrailingSlashes(connection.url)}/requests`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${await connection.token()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(commanderRequest(request, requestedAt)),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok)
        throw new Error(`Commander answered HTTP ${response.status}`);
    },
  };
}

/** Runs a command and gives its exit code. Tests pass their own. */
export type CommandRunner = (
  argumentsList: string[],
) => Promise<{ exitCode: number }>;

const runCommand: CommandRunner = async (argumentsList) => {
  const child = Bun.spawn(argumentsList, {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
    timeout: 60_000,
  });
  return { exitCode: await child.exited };
};

/**
 * Merges through the GitHub command line, signed in as the account that
 * owns the pull request. `--match-head-commit` makes GitHub refuse the
 * merge when the head moved since the approval and the green checks were
 * seen. The command's output is not read, so nothing it prints is kept.
 */
export function githubCommandLineMerger(
  command = "gh",
  run: CommandRunner = runCommand,
): Merger {
  return {
    async merge({ repository, number, sha, method }) {
      const { exitCode } = await run([
        command,
        "pr",
        "merge",
        String(number),
        "--repo",
        repository,
        `--${method}`,
        "--match-head-commit",
        sha,
      ]);
      if (exitCode !== 0)
        throw new Error(`the GitHub command line exited with ${exitCode}`);
    },
  };
}
