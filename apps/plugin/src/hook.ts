#!/usr/bin/env bun
/**
 * The plugin's hook command. Claude Code runs it for each event in
 * hooks/hooks.json and waits for it, so it keeps only the fields it needs,
 * hands them to a detached copy of itself and exits at once. The copy reads
 * the session's name, asks Atlas for its agents, and makes the calls plan()
 * gives.
 *
 * It does nothing, quietly, where it cannot work: no Keychain (not macOS),
 * no atlas-token item, Atlas unreachable, or no agent for the session.
 * Atlas's address is ATLAS_MCP_URL (default the Mac mini's tailnet
 * address). The machine token is read from the Keychain item atlas-token
 * and never printed. Each failure is one line in ~/.claude/atlas/plugin.log:
 * the event, the tool and a fixed reason, never text a server or a session
 * wrote.
 */
import { spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  plan,
  readHookInput,
  safeName,
  vesselId,
  type AtlasAgent,
  type HookInput,
  type ToolCall,
} from "./plan";

const HOME = homedir();
const ATLAS_URL =
  process.env.ATLAS_MCP_URL ?? "https://server.tail051b7.ts.net/mcp";
const STATE = join(HOME, ".claude", "atlas");
const INPUT_VARIABLE = "ATLAS_HOOK_INPUT";

/** Why a call failed, as a fixed word: the log never holds what a server or a session wrote. */
type Failure = "http" | "refused" | "unreachable" | "unreadable";

/** A failed Atlas call, with a fixed reason and, for HTTP, the status code. */
class AtlasFailure extends Error {
  constructor(
    readonly reason: Failure,
    readonly status: number | null = null,
  ) {
    super(reason);
  }
}

const reasonOf = (error: unknown): string =>
  error instanceof AtlasFailure
    ? `${error.reason}${error.status === null ? "" : ` ${error.status}`}`
    : "unexpected";

/** One line in the plugin's log: the event, the tool and a fixed reason. */
function log(event: string, tool: string, error: unknown): void {
  try {
    mkdirSync(STATE, { recursive: true });
    appendFileSync(
      join(STATE, "plugin.log"),
      `${new Date().toISOString()} ${event} ${tool} ${reasonOf(error)}\n`,
    );
  } catch {
    // a log that cannot be written is not worth stopping for
  }
}

/** An Atlas on this machine, as `task server` runs it, which asks for no token. */
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//;

/** The bearer token, "" for a local Atlas, or null when there is none. */
function token(): string | null {
  if (LOCAL.test(ATLAS_URL)) return "";
  if (process.platform !== "darwin") return null;
  const result = Bun.spawnSync([
    "/usr/bin/security",
    "find-generic-password",
    "-s",
    "atlas-token",
    "-w",
  ]);
  const value = new TextDecoder().decode(result.stdout).trim();
  return result.exitCode === 0 && value ? value : null;
}

async function callTool(
  bearer: string,
  tool: string,
  args: Record<string, string>,
): Promise<unknown> {
  const response = await fetch(ATLAS_URL, {
    method: "POST",
    headers: {
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    throw new AtlasFailure("unreachable");
  });
  if (!response.ok) throw new AtlasFailure("http", response.status);
  const raw = await response.text();
  const data =
    raw
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .pop()
      ?.slice(5) ?? raw;
  let message: {
    error?: unknown;
    result?: { content?: Array<{ text?: string }>; isError?: boolean };
  };
  try {
    message = JSON.parse(data);
  } catch {
    throw new AtlasFailure("unreadable");
  }
  if (message.error || message.result?.isError)
    throw new AtlasFailure("refused");
  const reply = message.result?.content?.[0]?.text ?? "";
  try {
    return JSON.parse(reply);
  } catch {
    return reply;
  }
}

/** The session's name from its record in ~/.claude/sessions. */
function sessionName(sessionId: string): string | null {
  const folder = join(HOME, ".claude", "sessions");
  if (!existsSync(folder)) return null;
  for (const file of readdirSync(folder)) {
    if (!file.endsWith(".json")) continue;
    try {
      const record = JSON.parse(readFileSync(join(folder, file), "utf8"));
      if (record?.sessionId === sessionId) return safeName(record.name);
    } catch {
      // a record being written; the next one may be ours
    }
  }
  return null;
}

/** One empty file per vessel, so subagents that start together never race on one file. */
const vesselFolder = (sessionId: string) => join(STATE, "vessels", sessionId);

function tracked(sessionId: string): string[] {
  const folder = vesselFolder(sessionId);
  return existsSync(folder) ? readdirSync(folder) : [];
}

function remember(sessionId: string, track: string[], untrack: string[]): void {
  const folder = vesselFolder(sessionId);
  for (const id of track) {
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, id), "");
  }
  for (const id of untrack) rmSync(join(folder, id), { force: true });
  if (existsSync(folder) && readdirSync(folder).length === 0)
    rmSync(folder, { recursive: true, force: true });
}

async function send(input: HookInput): Promise<void> {
  const bearer = token();
  if (bearer === null) return;
  const vessels = tracked(input.sessionId);
  // Skip the round trip when nothing can come of it: a stop for a vessel
  // this session never launched, an end with none out, or no session name.
  if (
    input.event === "SubagentStop" &&
    !(input.agentId && vessels.includes(vesselId(input.agentId)))
  )
    return;
  if (input.event === "SessionEnd" && vessels.length === 0) return;
  const name = sessionName(input.sessionId);
  if (!name && input.event !== "SessionEnd" && input.event !== "SubagentStop")
    return;
  let agents: AtlasAgent[];
  try {
    const listed = (await callTool(bearer, "list_agents", {})) as {
      agents?: AtlasAgent[];
    };
    agents = listed.agents ?? [];
  } catch (error) {
    log(input.event, "list_agents", error);
    return;
  }
  const steps = plan(input, name, agents, vessels);
  const done: ToolCall[] = [];
  for (const call of steps.calls) {
    try {
      await callTool(bearer, call.tool, call.arguments);
      done.push(call);
    } catch (error) {
      log(input.event, call.tool, error);
    }
  }
  // Track a vessel only once Atlas has it; untrack whatever the plan let go.
  const launched = done
    .filter((call) => call.tool === "launch_vessel")
    .map((call) => call.arguments.vesselId ?? "");
  remember(
    input.sessionId,
    steps.track.filter((id) => launched.includes(id)),
    steps.untrack,
  );
}

if (import.meta.main) {
  const handed = process.env[INPUT_VARIABLE];
  if (handed) {
    try {
      const input = readHookInput(JSON.parse(handed));
      if (input) await send(input);
    } catch (error) {
      log("hook", "-", error);
    }
    process.exit(0);
  }
  let input: HookInput | null = null;
  try {
    input = readHookInput(JSON.parse(await Bun.stdin.text()));
  } catch {
    process.exit(0);
  }
  if (!input) process.exit(0);
  const child = spawn(process.execPath, [import.meta.path], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      [INPUT_VARIABLE]: JSON.stringify({
        hook_event_name: input.event,
        session_id: input.sessionId,
        agent_id: input.agentId,
        agent_type: input.agentType,
        notification_type: input.notificationType,
      }),
    },
  });
  child.unref();
  process.exit(0);
}
