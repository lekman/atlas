/**
 * The command against throwaway folders: a home folder under a temporary
 * directory, and a fake `claude` first on PATH (see fake-claude.ts). No
 * real login runs.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAIN = join(import.meta.dir, "..", "src", "main.ts");
const FAKE = join(import.meta.dir, "fake-claude.ts");
/** The field the fake puts in its status output; it must never be repeated. */
const FAKE_SECRET = "fake-secret-that-must-never-be-printed";

let root: string;
let home: string;
let log: string;
let accountsFile: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "claude-accounts-"));
  home = join(root, "home");
  log = join(root, "claude.log");
  accountsFile = join(home, ".config", "atlas", "claude-accounts.json");
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "claude"),
    `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "$@"\n`,
    { mode: 0o755 },
  );
  const shared = join(home, ".claude");
  mkdirSync(join(shared, "projects"), { recursive: true });
  writeFileSync(join(shared, "settings.json"), "{}");
  writeFileSync(join(shared, "CLAUDE.md"), "# Guidelines\n\n@SOUL.md\n");
  writeFileSync(join(shared, "SOUL.md"), "# Soul\n");
  writeFileSync(
    join(home, ".claude.json"),
    JSON.stringify({
      oauthAccount: { accountUuid: "default-account" },
      mcpServers: { tasks: { type: "http", url: "http://127.0.0.1:1/mcp" } },
    }),
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

interface Run {
  code: number;
  out: string;
}

function run(
  args: string[],
  environment: Record<string, string> = {},
  script = MAIN,
): Run {
  const result = Bun.spawnSync([process.execPath, script, ...args], {
    cwd: root,
    env: {
      HOME: home,
      PATH: `${join(root, "bin")}:/usr/bin:/bin`,
      FAKE_CLAUDE_LOG: log,
      TZ: "UTC",
      ...environment,
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = result.stdout.toString() + result.stderr.toString();
  expect(out).not.toContain(FAKE_SECRET);
  return { code: result.exitCode, out };
}

const calls = () =>
  existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];

const folderOf = (name: string) => join(home, `.claude-${name}`);

describe("add", () => {
  test("makes the folder and links, signs in, copies MCP servers and writes the file", () => {
    const result = run(["add", "ultra-a", "--email", "you@example.com"]);
    expect(result.code).toBe(0);
    const folder = folderOf("ultra-a");
    expect(readlinkSync(join(folder, "projects"))).toBe(
      join(home, ".claude", "projects"),
    );
    expect(readlinkSync(join(folder, "SOUL.md"))).toBe(
      join(home, ".claude", "SOUL.md"),
    );
    expect(lstatSync(join(folder, "plugins")).isSymbolicLink()).toBe(true);
    expect(existsSync(join(home, ".claude", "plugins"))).toBe(true);
    // A shared file the shared folder does not have is not linked.
    expect(existsSync(join(folder, "history.jsonl"))).toBe(false);
    expect(existsSync(join(folder, "sessions"))).toBe(false);

    expect(calls()).toContain(
      ".claude-ultra-a auth login --claudeai --email you@example.com",
    );
    const own = JSON.parse(readFileSync(join(folder, ".claude.json"), "utf8"));
    expect(own.oauthAccount).toEqual({
      accountUuid: "account-you@example.com",
      emailAddress: "you@example.com",
    });
    expect(Object.keys(own.mcpServers)).toEqual(["tasks"]);

    expect(JSON.parse(readFileSync(accountsFile, "utf8"))).toEqual({
      accounts: [{ name: "ultra-a", directory: "~/.claude-ultra-a" }],
      switch: "off",
    });
    expect(statSync(accountsFile).mode & 0o777).toBe(0o600);
    expect(result.out).toContain("logged in as you@example.com");
  });

  test("a second run on a finished account only checks it again", () => {
    run(["add", "ultra-a", "--email", "you@example.com"]);
    const before = readFileSync(accountsFile, "utf8");
    rmSync(log);
    const result = run(["add", "ultra-a", "--email", "you@example.com"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("already logged in");
    expect(result.out).toContain("already in");
    expect(calls().some((call) => call.includes("auth login"))).toBe(false);
    expect(readFileSync(accountsFile, "utf8")).toBe(before);
  });

  test("keeps the other accounts, the switch mode and the launcher", () => {
    mkdirSync(join(home, ".config", "atlas"), { recursive: true });
    writeFileSync(
      accountsFile,
      JSON.stringify({
        accounts: [{ name: "ultra-a", directory: "~/.claude-ultra-a" }],
        switch: "dry",
        launcher: ["/usr/local/bin/claude-session-switch"],
      }),
    );
    const result = run(["add", "ultra-b", "--email", "you+b@example.com"]);
    expect(result.code).toBe(0);
    expect(JSON.parse(readFileSync(accountsFile, "utf8"))).toEqual({
      accounts: [
        { name: "ultra-a", directory: "~/.claude-ultra-a" },
        { name: "ultra-b", directory: "~/.claude-ultra-b" },
      ],
      switch: "dry",
      launcher: ["/usr/local/bin/claude-session-switch"],
    });
  });

  test("undoes a login on another address than asked, and writes nothing", () => {
    const result = run(["add", "ultra-a", "--email", "you@example.com"], {
      FAKE_CLAUDE_LOGIN_EMAIL: "you+b@example.com",
    });
    expect(result.code).toBe(1);
    expect(result.out).toContain("The login was undone");
    expect(calls()).toContain(".claude-ultra-a auth logout");
    expect(existsSync(accountsFile)).toBe(false);
  });

  test("undoes a login on the same account as another folder, by address or account id", () => {
    expect(run(["add", "ultra-a", "--email", "you@example.com"]).code).toBe(0);
    const sameAddress = run(["add", "ultra-b", "--email", "you@example.com"]);
    expect(sameAddress.code).toBe(1);
    expect(sameAddress.out).toContain("same account as ultra-a");
    expect(calls()).toContain(".claude-ultra-b auth logout");

    const sameId = run(["add", "ultra-c", "--email", "you+c@example.com"], {
      FAKE_CLAUDE_ACCOUNT_ID: "account-you@example.com",
    });
    expect(sameId.code).toBe(1);
    expect(sameId.out).toContain("same account as ultra-a");
    const accounts = JSON.parse(readFileSync(accountsFile, "utf8")).accounts;
    expect(accounts).toEqual([
      { name: "ultra-a", directory: "~/.claude-ultra-a" },
    ]);
  });

  test("refuses to replace a real folder where a link belongs, before any login", () => {
    mkdirSync(join(folderOf("ultra-a"), "projects"), { recursive: true });
    const result = run(["add", "ultra-a", "--email", "you@example.com"]);
    expect(result.code).toBe(1);
    expect(result.out).toContain("is not a link to");
    expect(calls()).toEqual([]);
    expect(existsSync(join(folderOf("ultra-a"), "settings.json"))).toBe(false);
  });

  test("stops when the login does not finish", () => {
    const result = run(["add", "ultra-a", "--email", "you@example.com"], {
      FAKE_CLAUDE_LOGIN_EXIT: "1",
    });
    expect(result.code).toBe(1);
    expect(result.out).toContain("did not finish");
    expect(existsSync(accountsFile)).toBe(false);
  });

  test("takes another folder and another accounts file", () => {
    const other = join(root, "elsewhere.json");
    const result = run([
      "add",
      "ultra-a",
      "--email",
      "you@example.com",
      "--folder",
      join(root, "accounts", "ultra-a"),
      "--accounts-file",
      other,
    ]);
    expect(result.code).toBe(0);
    expect(JSON.parse(readFileSync(other, "utf8")).accounts).toEqual([
      { name: "ultra-a", directory: join(root, "accounts", "ultra-a") },
    ]);
  });

  test("refuses a bad name or address without touching anything", () => {
    expect(run(["add", "Ultra A", "--email", "you@example.com"]).code).toBe(1);
    expect(run(["add", "ultra-a", "--email", "nobody"]).code).toBe(1);
    expect(calls()).toEqual([]);
  });
});

describe("login", () => {
  test("signs a folder in again, on the address it had", () => {
    run(["add", "ultra-a", "--email", "you@example.com"]);
    rmSync(join(folderOf("ultra-a"), ".fake-login"));
    rmSync(log);
    const result = run(["login", "ultra-a"]);
    expect(result.code).toBe(0);
    expect(calls()).toContain(
      ".claude-ultra-a auth login --claudeai --email you@example.com",
    );
  });

  test("undoes a login that lands on another folder's account", () => {
    run(["add", "ultra-a", "--email", "you@example.com"]);
    run(["add", "ultra-b", "--email", "you+b@example.com"]);
    const result = run(["login", "ultra-b"], {
      FAKE_CLAUDE_LOGIN_EMAIL: "you@example.com",
    });
    expect(result.code).toBe(1);
    expect(calls()).toContain(".claude-ultra-b auth logout");
  });

  test("refuses an account that is not in the file", () => {
    run(["add", "ultra-a", "--email", "you@example.com"]);
    expect(run(["login", "ultra-z"]).out).toContain("no account ultra-z");
  });
});

/** Writes a live session record in a folder and a transcript that ends in a weekly limit. */
function limitedSession(folder: string) {
  const cwd = join(root, "work");
  const sessionId = "11111111-2222-3333-4444-555555555555";
  mkdirSync(join(folder, "sessions"), { recursive: true });
  writeFileSync(
    join(folder, "sessions", `${process.pid}.json`),
    JSON.stringify({
      pid: process.pid,
      sessionId,
      name: "Schema",
      status: "idle",
      cwd,
      startedAt: Date.now() - 3_600_000,
    }),
  );
  const resetsAt = Math.floor(Date.now() / 1000) + 86_400;
  const directory = join(folder, "projects", cwd.replace(/[/.]/g, "-"));
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, `${sessionId}.jsonl`),
    `${JSON.stringify({
      type: "assistant",
      timestamp: new Date(Date.now() - 60_000).toISOString(),
      message: { model: "<synthetic>", content: [] },
      apiError: "usage_limit_reached",
      quotaLimits: { status: "rejected", resetsAt, rateLimitType: "seven_day" },
      error: "rate_limit",
      isApiErrorMessage: true,
    })}\n`,
  );
  return new Date(resetsAt * 1000).toISOString();
}

describe("status", () => {
  test("reports each account's login, limit and live sessions as JSON", () => {
    run(["add", "ultra-a", "--email", "you@example.com"]);
    run(["add", "ultra-b", "--email", "you+b@example.com"]);
    const resetsAt = limitedSession(folderOf("ultra-a"));
    const result = run(["status", "--json"]);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.out);
    expect(report.version).toBe(1);
    expect(report.needsOwner).toBe(false);
    expect(report.accountsFile).toBe(accountsFile);
    expect(report.accounts).toEqual([
      {
        name: "ultra-a",
        directory: folderOf("ultra-a"),
        loggedIn: true,
        email: "you@example.com",
        usageLimit: {
          kind: "weekly",
          resetsAt,
          at: expect.any(String),
        },
        liveSessions: 1,
        problem: null,
      },
      {
        name: "ultra-b",
        directory: folderOf("ultra-b"),
        loggedIn: true,
        email: "you+b@example.com",
        usageLimit: null,
        liveSessions: 0,
        problem: null,
      },
    ]);
  });

  test("exits non-zero when an account is logged out, and says what to run", () => {
    run(["add", "ultra-a", "--email", "you@example.com"]);
    run(["add", "ultra-b", "--email", "you+b@example.com"]);
    rmSync(join(folderOf("ultra-b"), ".fake-login"));
    const result = run(["status"]);
    expect(result.code).toBe(1);
    expect(result.out).toContain("ultra-b: NOT logged in");
    expect(result.out).toContain("run claude-accounts login ultra-b");
  });

  test("exits non-zero when every account is limited", () => {
    run(["add", "ultra-a", "--email", "you@example.com"]);
    limitedSession(folderOf("ultra-a"));
    const result = run(["status"]);
    expect(result.code).toBe(1);
    expect(result.out).toContain("weekly limit, resets");
    expect(result.out).toContain("Every account is at a usage limit");
  });

  test("says how to start when there is no accounts file", () => {
    const result = run(["status"]);
    expect(result.code).toBe(1);
    expect(result.out).toContain("Run claude-accounts add first");
  });
});

describe("doctor", () => {
  test("passes a finished setup and fails a broken link or a logged-out folder", () => {
    run(["add", "ultra-a", "--email", "you@example.com"]);
    run(["add", "ultra-b", "--email", "you+b@example.com"]);
    const good = run(["doctor"]);
    expect(good.code).toBe(0);
    expect(good.out).not.toContain("FAIL");

    rmSync(join(folderOf("ultra-b"), "projects"));
    rmSync(join(folderOf("ultra-a"), ".fake-login"));
    const bad = run(["doctor"]);
    expect(bad.code).toBe(1);
    expect(bad.out).toContain("FAIL ultra-b: links missing or wrong: projects");
    expect(bad.out).toContain("FAIL ultra-a: NOT logged in");
    // Read-only: nothing was put back.
    expect(existsSync(join(folderOf("ultra-b"), "projects"))).toBe(false);
  });

  test("fails two folders on one account", () => {
    run(["add", "ultra-a", "--email", "you@example.com"]);
    run(["add", "ultra-b", "--email", "you+b@example.com"]);
    writeFileSync(
      join(folderOf("ultra-b"), ".fake-login"),
      JSON.stringify({ email: "you@example.com" }),
    );
    const result = run(["doctor"]);
    expect(result.code).toBe(1);
    expect(result.out).toContain("ultra-a and ultra-b are on one account");
  });
});

describe("the built file", () => {
  test("runs on its own, outside the workspace", () => {
    const outfile = join(root, "dist", "claude-accounts.js");
    const build = Bun.spawnSync(
      [
        process.execPath,
        "build",
        join(import.meta.dir, "..", "src", "main.ts"),
        "--target=bun",
        `--outfile=${outfile}`,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(build.exitCode).toBe(0);
    expect(readFileSync(outfile, "utf8").startsWith("#!/usr/bin/env bun")).toBe(
      true,
    );
    expect(
      run(["add", "ultra-a", "--email", "you@example.com"], {}, outfile).code,
    ).toBe(0);
    const result = run(["status", "--json"], {}, outfile);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out).accounts[0].name).toBe("ultra-a");
  });
});
