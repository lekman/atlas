#!/usr/bin/env bun
/**
 * The Atlas collector for one machine. Every minute it reads the Claude Code
 * sessions here (their records, or for a screen-run session its command
 * line) and the tail of each transcript, works out what each is doing with
 * @atlas/collector, and reports a change to Atlas with report_status.
 *
 *   bun apps/collector/src/main.ts            print what it would report, once
 *   bun apps/collector/src/main.ts --apply    report, every minute
 *   bun apps/collector/src/main.ts --apply --once
 *   bun apps/collector/src/main.ts --list     each session as read here, without calling Atlas
 *
 * Atlas's address is ATLAS_MCP_URL (default the Mac mini's tailnet address).
 * The machine token is read from the Keychain item atlas-token on each call
 * and never printed. Only a session name, enums, numbers and fixed notes
 * leave this machine.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  matchAgent,
  nameFromArgs,
  readSessionRecord,
  readTail,
  reportFor,
  type SessionRecord,
} from "@atlas/collector";

import { decide, type AtlasAgent } from "./decide";

const HOME = homedir();
const URL_ = process.env.ATLAS_MCP_URL ?? "https://server.tail051b7.ts.net/mcp";
const APPLY = process.argv.includes("--apply");
const ONCE = process.argv.includes("--once") || !APPLY;
const TAIL_LINES = 400;

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

function token(): string {
  const r = Bun.spawnSync([
    "/usr/bin/security",
    "find-generic-password",
    "-s",
    "atlas-token",
    "-w",
  ]);
  const t = new TextDecoder().decode(r.stdout).trim();
  if (r.exitCode !== 0 || !t) throw new Error("no atlas-token in the Keychain");
  return t;
}

async function call(
  tool: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Atlas answered HTTP ${res.status}`);
  const raw = await res.text();
  const data =
    raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .pop()
      ?.slice(5) ?? raw;
  const msg = JSON.parse(data) as {
    error?: { message?: string };
    result?: { content?: Array<{ text?: string }>; isError?: boolean };
  };
  if (msg.error)
    throw new Error(
      String(msg.error.message ?? "Atlas returned an error").slice(0, 200),
    );
  const text = msg.result?.content?.[0]?.text ?? "";
  if (msg.result?.isError)
    throw new Error(text.slice(0, 200) || `${tool} was refused`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const projectDir = (cwd: string) =>
  join(HOME, ".claude", "projects", cwd.replace(/[/.]/g, "-"));

/** Sessions from their records, and screen-run ones from their command lines. */
function sessions(): Array<{
  record: SessionRecord;
  transcript: string | null;
}> {
  const out = new Map<
    number,
    { record: SessionRecord; transcript: string | null }
  >();
  const dir = join(HOME, ".claude", "sessions");
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    if (!f.endsWith(".json")) continue;
    try {
      const record = readSessionRecord(
        JSON.parse(readFileSync(join(dir, f), "utf8")),
      );
      if (!record?.cwd) continue;
      const t = join(projectDir(record.cwd), `${record.sessionId}.jsonl`);
      out.set(record.pid, { record, transcript: existsSync(t) ? t : null });
    } catch {
      // a record being rewritten
    }
  }
  const ps = new TextDecoder().decode(
    Bun.spawnSync(["ps", "-axo", "pid=,args="]).stdout,
  );
  for (const line of ps.split("\n")) {
    const m = /^\s*(\d+)\s+(\S*\/)?claude\s(.*)$/.exec(line);
    if (!m) continue;
    const pid = Number(m[1]);
    if (out.has(pid)) continue;
    const name = nameFromArgs(m[3]!);
    if (!name) continue;
    const lsof = new TextDecoder().decode(
      Bun.spawnSync(["lsof", "-a", "-p", String(pid), "-d", "cwd", "-Fn"])
        .stdout,
    );
    const cwd = /^n(.+)$/m.exec(lsof)?.[1] ?? null;
    let transcript: string | null = null;
    const resume = /--resume\s+([0-9a-f-]{36})/.exec(m[3]!)?.[1];
    if (cwd) {
      const p = projectDir(cwd);
      if (resume && existsSync(join(p, `${resume}.jsonl`)))
        transcript = join(p, `${resume}.jsonl`);
      else if (existsSync(p)) {
        // The newest transcript in the session's folder; a fresh session writes a new one.
        const newest = readdirSync(p)
          .filter((f) => f.endsWith(".jsonl"))
          .map((f) => ({ f, t: statSync(join(p, f)).mtimeMs }))
          .sort((a, b) => b.t - a.t)[0];
        transcript = newest ? join(p, newest.f) : null;
      }
    }
    out.set(pid, {
      record: { pid, sessionId: resume ?? "", name, state: null, cwd },
      transcript,
    });
  }
  return [...out.values()];
}

function lastLines(path: string): string[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  return lines.slice(-TAIL_LINES);
}

/** Each session as this machine sees it, for checking the collector. Prints only safe fields. */
function list() {
  const now = new Date();
  for (const { record, transcript } of sessions()) {
    const r = reportFor(
      record,
      readTail(transcript ? lastLines(transcript) : []),
      now,
    );
    console.log(
      [
        r?.name ?? "(no safe name)",
        r?.status ?? "-",
        r?.note ?? "",
        record.state ?? "no record",
        transcript ? "transcript" : "no transcript",
      ].join(" | "),
    );
  }
}

async function tick() {
  const now = new Date();
  const reports = sessions()
    .map(({ record, transcript }) => {
      const tail = readTail(transcript ? lastLines(transcript) : []);
      const r = reportFor(record, tail, now);
      const quiet = tail.lastWriteAt
        ? now.getTime() - Date.parse(tail.lastWriteAt)
        : Infinity;
      return r ? { report: r, quiet } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const { agents } = (await call("list_agents", {})) as {
    agents: AtlasAgent[];
  };
  for (const { report, quiet } of reports) {
    const agent = matchAgent(report.name, agents);
    if (!agent) continue;
    const change = decide(report, agent, quiet);
    if (!change) continue;
    if (!APPLY) {
      log("would report", agent.id, change.status, `"${change.note}"`);
      continue;
    }
    try {
      await call("report_status", { agentId: agent.id, ...change });
      log("reported", agent.id, change.status, `"${change.note}"`);
    } catch (err) {
      log(
        "not reported",
        agent.id,
        String((err as Error).message).slice(0, 160),
      );
    }
  }
  if (!APPLY) log(`dry run: ${reports.length} sessions read`);
}

if (process.argv.includes("--list")) {
  list();
  process.exit(0);
}

await tick().catch((e) =>
  log("tick failed:", String((e as Error).message ?? e).slice(0, 200)),
);
if (!ONCE)
  setInterval(
    () =>
      tick().catch((e) =>
        log("tick failed:", String((e as Error).message ?? e).slice(0, 200)),
      ),
    60_000,
  );
