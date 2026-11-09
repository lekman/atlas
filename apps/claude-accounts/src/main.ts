#!/usr/bin/env bun
/**
 * claude-accounts: registers each Claude subscription in its own
 * `CLAUDE_CONFIG_DIR` folder, and writes the accounts file the Atlas server
 * reads from `ATLAS_CLAUDE_ACCOUNTS_FILE`. The owner runs it by hand.
 *
 *   claude-accounts add <name> --email <address> [--folder <path>]
 *   claude-accounts login <name> [--email <address>]
 *   claude-accounts status [--json]
 *   claude-accounts doctor
 *
 * Every command takes `--accounts-file <path>`. Without it the file is
 * `ATLAS_CLAUDE_ACCOUNTS_FILE`, or `~/.config/atlas/claude-accounts.json`.
 *
 * It never reads, prints or copies a login token: from `claude auth status
 * --json` it keeps `loggedIn` and `email`, and from a folder's `.claude.json`
 * it reads `oauthAccount.accountUuid` and `emailAddress` only. It never
 * opens `.credentials.json` or the Keychain.
 */
import {
  chmodSync,
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  renameSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { readSessionRecord } from "@atlas/collector";

import {
  accountUsageLimit,
  checkIdentity,
  claudeMarkdownImports,
  copyMcpServers,
  defaultFolder,
  displayFolder,
  duplicateAccounts,
  expandFolder,
  linkAction,
  mergeAccount,
  readAccountEmail,
  readAccountId,
  readAccountsFile,
  readAuthStatus,
  serialiseAccountsFile,
  sharedItems,
  statusLine,
  statusReport,
  validAccountName,
  validEmail,
  type AccountsFileBody,
  type AccountStatus,
  type AuthStatus,
  type Identity,
  type Observed,
  type SessionTail,
  type SharedItem,
} from "./accounts";

/** A failure the owner can act on: one plain line, then exit 1. */
class Stop extends Error {}

const USAGE = `Usage:
  claude-accounts add <name> --email <address> [--folder <path>]
  claude-accounts login <name> [--email <address>]
  claude-accounts status [--json]
  claude-accounts doctor
Every command takes --accounts-file <path>.`;

const HOME = process.env.HOME || homedir();
/** The folder the accounts share, the one Claude Code uses without CLAUDE_CONFIG_DIR. */
const SHARED = join(HOME, ".claude");

function accountsFilePath(flag: string | undefined): string {
  return resolve(
    expandFolder(
      flag ||
        process.env.ATLAS_CLAUDE_ACCOUNTS_FILE?.trim() ||
        join(HOME, ".config", "atlas", "claude-accounts.json"),
      HOME,
    ),
  );
}

/** Writes a file through a temporary file and a rename, readable by its owner only. */
function writeAtomically(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.temporary`;
  writeFileSync(temporary, text, { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, path);
}

/** A file's text, or null when there is no file. Read once, without checking first. */
function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return null;
    throw error;
  }
}

function readJsonObject(path: string): Record<string, unknown> | null {
  const text = readIfPresent(path);
  if (text === null) return null;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Stop(`${path} is not JSON. Fix it by hand, then run again.`);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Stop(`${path} is not a JSON object`);
  return body as Record<string, unknown>;
}

function loadAccounts(path: string) {
  const text = readIfPresent(path);
  if (text === null) return null;
  try {
    return readAccountsFile(text, HOME);
  } catch (error) {
    throw new Stop(
      `The accounts file ${path} is not valid (${(error as Error).message}). Fix it by hand, then run again.`,
    );
  }
}

function requireAccounts(path: string) {
  const accounts = loadAccounts(path);
  if (!accounts)
    throw new Stop(
      `There is no accounts file at ${path}. Run claude-accounts add first.`,
    );
  return accounts;
}

function folderEnvironment(folder: string) {
  return { ...process.env, CLAUDE_CONFIG_DIR: folder };
}

function claudeMissing(error: unknown): never {
  if ((error as { code?: string }).code === "ENOENT")
    throw new Stop(
      "claude is not on PATH. Install Claude Code, then run again.",
    );
  throw error;
}

/** `claude auth status --json` for one folder. Its output is parsed, never printed. */
function authStatus(folder: string): AuthStatus | null {
  let result;
  try {
    result = Bun.spawnSync(["claude", "auth", "status", "--json"], {
      env: folderEnvironment(folder),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
    });
  } catch (error) {
    claudeMissing(error);
  }
  return readAuthStatus(result.stdout.toString());
}

/** Runs a `claude auth` command in the owner's terminal. */
function interactive(folder: string, args: string[]): number {
  try {
    return Bun.spawnSync(["claude", ...args], {
      env: folderEnvironment(folder),
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }).exitCode;
  } catch (error) {
    claudeMissing(error);
  }
}

function folderFile(folder: string): string | null {
  const path = join(folder, ".claude.json");
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function identityOf(name: string, folder: string): Identity {
  const status = existsSync(folder) ? authStatus(folder) : null;
  const text = folderFile(folder);
  return {
    name,
    email: status?.loggedIn ? status.email : null,
    accountId: status?.loggedIn && text ? readAccountId(text) : null,
  };
}

function observe(path: string): Observed {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return { kind: "missing" };
  }
  return stat.isSymbolicLink()
    ? { kind: "link", target: readlinkSync(path) }
    : { kind: "other" };
}

/** The shared items: the fixed list, and the files the shared `CLAUDE.md` imports from its folder. */
function linkedItems(): SharedItem[] {
  let imports: string[] = [];
  try {
    imports = claudeMarkdownImports(
      readFileSync(join(SHARED, "CLAUDE.md"), "utf8"),
    );
  } catch {
    imports = [];
  }
  return [
    ...sharedItems,
    ...imports.map((name) => ({ name, kind: "file" as const })),
  ];
}

/** A file is linked only when the shared folder has it. */
function wanted(item: SharedItem): boolean {
  return item.kind === "directory" || existsSync(join(SHARED, item.name));
}

function checkFolder(folder: string) {
  if (resolve(folder) === resolve(SHARED) || resolve(folder) === resolve(HOME))
    throw new Stop(
      `${folder} is the shared folder or the home folder. Give the account its own folder.`,
    );
  const observed = observe(folder);
  if (observed.kind !== "missing" && !statSync(folder).isDirectory())
    throw new Stop(
      `${folder} exists and is not a folder. Move it away, then run again.`,
    );
}

/** Step 1: the folder and its links. Checks every link before it makes one. */
function makeLinks(folder: string): string {
  checkFolder(folder);
  const items = linkedItems().filter(wanted);
  const plans = items.map((item) => {
    const path = join(folder, item.name);
    const target = join(SHARED, item.name);
    return { item, path, target, action: linkAction(observe(path), target) };
  });
  const refused = plans.find((plan) => plan.action === "refuse");
  if (refused)
    throw new Stop(
      `${refused.path} exists and is not a link to ${refused.target}. Move it away, then run add again.`,
    );
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  let made = 0;
  for (const plan of plans) {
    if (plan.action !== "create") continue;
    if (plan.item.kind === "directory")
      mkdirSync(plan.target, { recursive: true, mode: 0o700 });
    symlinkSync(plan.target, plan.path);
    made++;
  }
  return `${plans.length} shared links in place (${made} new)`;
}

/** Steps 2 and 3, for add and login: sign in when needed, then check who it is. */
function signIn(
  name: string,
  folder: string,
  expectedEmail: string | null,
  others: readonly { name: string; directory: string }[],
  force: boolean,
): string {
  const before = authStatus(folder);
  const already =
    !force &&
    before?.loggedIn &&
    expectedEmail &&
    before.email?.toLowerCase() === expectedEmail.toLowerCase();
  if (!force && before?.loggedIn && !already)
    throw new Stop(
      `${folder} is signed in as another address. Run CLAUDE_CONFIG_DIR=${folder} claude auth logout, then run add again.`,
    );
  let signedIn = false;
  if (!already) {
    const code = interactive(folder, [
      "auth",
      "login",
      "--claudeai",
      ...(expectedEmail ? ["--email", expectedEmail] : []),
    ]);
    if (code !== 0)
      throw new Stop(
        `The login for ${name} did not finish. Run the command again.`,
      );
    signedIn = true;
  }
  const status = authStatus(folder);
  if (!status)
    throw new Stop(`claude auth status gave no answer for ${folder}.`);
  const text = folderFile(folder);
  const own: Identity = {
    name,
    email: status.email,
    accountId: text ? readAccountId(text) : null,
  };
  const identities = others
    .filter((other) => other.name !== name)
    .map((other) => identityOf(other.name, other.directory));
  const check = checkIdentity(status, own, expectedEmail, identities);
  if (!check.ok) {
    if (signedIn && status.loggedIn) {
      interactive(folder, ["auth", "logout"]);
      throw new Stop(`${check.message}. The login was undone.`);
    }
    throw new Stop(`${check.message}.`);
  }
  return signedIn
    ? `logged in as ${status.email}`
    : `already logged in as ${status.email}`;
}

/** Step 4: the user-scope MCP servers, from `~/.claude.json` into the folder's own file. */
function copyServers(folder: string): string {
  const home = readJsonObject(join(HOME, ".claude.json"));
  const path = join(folder, ".claude.json");
  const own = readJsonObject(path) ?? {};
  const { file, copied } = copyMcpServers(own, home?.mcpServers);
  if (copied > 0) writeAtomically(path, `${JSON.stringify(file, null, 2)}\n`);
  return `${copied} MCP server${copied === 1 ? "" : "s"} copied`;
}

function add(
  name: string | undefined,
  email: string | undefined,
  folderFlag: string | undefined,
  accountsPath: string,
) {
  if (!name || !validAccountName(name))
    throw new Stop(
      "Give the account a name of lower-case words joined by hyphens, such as ultra-a.",
    );
  if (!email || !validEmail(email))
    throw new Stop(
      "Give the account's address with --email, such as you@example.com.",
    );
  const folder = resolve(
    expandFolder(folderFlag ?? defaultFolder(name, HOME), HOME),
  );
  const accounts = loadAccounts(accountsPath);
  const directory = displayFolder(folder, HOME);
  let body: AccountsFileBody;
  try {
    body = mergeAccount(accounts?.body ?? null, { name, directory }, HOME);
  } catch (error) {
    throw new Stop((error as Error).message);
  }
  const say = (line: string) => console.log(`${name}: ${line}`);
  say(makeLinks(folder));
  say(
    signIn(
      name,
      folder,
      email,
      accounts?.configuration.settings.accounts ?? [],
      false,
    ),
  );
  say(copyServers(folder));
  const text = serialiseAccountsFile(body);
  const unchanged = readIfPresent(accountsPath) === text;
  if (!unchanged) writeAtomically(accountsPath, text);
  say(
    `${unchanged ? "already in" : "written to"} ${accountsPath} (switch ${String(body.switch ?? "off")})`,
  );
}

function login(
  name: string | undefined,
  email: string | undefined,
  accountsPath: string,
) {
  const { configuration } = requireAccounts(accountsPath);
  const account = configuration.settings.accounts.find(
    (entry) => entry.name === name,
  );
  if (!account)
    throw new Stop(
      `There is no account ${name ?? "(no name)"} in ${accountsPath}. Run claude-accounts add first.`,
    );
  if (email && !validEmail(email))
    throw new Stop(
      "Give the account's address with --email, such as you@example.com.",
    );
  if (!existsSync(account.directory))
    throw new Stop(
      `The folder ${account.directory} is missing. Run claude-accounts add ${account.name} again.`,
    );
  const before = folderFile(account.directory);
  const expected = email ?? (before ? readAccountEmail(before) : null);
  console.log(
    `${account.name}: ${signIn(account.name, account.directory, expected, configuration.settings.accounts, true)}`,
  );
}

/** The bytes read from the end of a transcript: enough for its last turns, as the server reads. */
const TAIL_BYTES = 256 * 1024;

function lastLines(path: string): string[] {
  let file: number;
  try {
    file = openSync(path, "r");
  } catch {
    return [];
  }
  try {
    // The size of the file that is open, so a change between two calls cannot mislead the read.
    const size = fstatSync(file).size;
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    readSync(file, buffer, 0, length, size - length);
    const lines = buffer.toString("utf8").split("\n");
    return size > length ? lines.slice(1) : lines;
  } finally {
    closeSync(file);
  }
}

/** The transcript path Claude Code uses, as the Atlas server's `transcriptPath`. */
function transcriptPath(projects: string, cwd: string, sessionId: string) {
  return join(projects, cwd.replace(/[/.]/g, "-"), `${sessionId}.jsonl`);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as { code?: string }).code === "EPERM";
  }
}

/** The session records in one account folder: how many are live, and each one's transcript tail. */
function readSessions(folder: string): { live: number; tails: SessionTail[] } {
  const directory = join(folder, "sessions");
  let names: string[];
  try {
    names = readdirSync(directory);
  } catch {
    return { live: 0, tails: [] };
  }
  let live = 0;
  const tails: SessionTail[] = [];
  for (const name of names) {
    if (!/^\d+\.json$/.test(name)) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(directory, name), "utf8"));
    } catch {
      continue;
    }
    const record = readSessionRecord(raw);
    if (!record) continue;
    if (processIsAlive(record.pid)) live++;
    const startedAt = (raw as { startedAt?: unknown }).startedAt;
    tails.push({
      startedAt: typeof startedAt === "number" ? startedAt : null,
      lines: record.cwd
        ? lastLines(
            transcriptPath(
              join(folder, "projects"),
              record.cwd,
              record.sessionId,
            ),
          )
        : [],
    });
  }
  return { live, tails };
}

function status(json: boolean, accountsPath: string): number {
  const { configuration } = requireAccounts(accountsPath);
  const now = new Date();
  const accounts: AccountStatus[] = configuration.settings.accounts.map(
    ({ name, directory }) => {
      if (!existsSync(directory))
        return {
          name,
          directory,
          loggedIn: false,
          email: null,
          usageLimit: null,
          liveSessions: 0,
          problem: "folder-missing",
        };
      const auth = authStatus(directory);
      const sessions = readSessions(directory);
      return {
        name,
        directory,
        loggedIn: auth?.loggedIn ?? false,
        email: auth?.email ?? null,
        usageLimit: accountUsageLimit(sessions.tails, now),
        liveSessions: sessions.live,
        problem: !auth ? "status-failed" : auth.loggedIn ? null : "logged-out",
      };
    },
  );
  const report = statusReport(accounts, accountsPath, now);
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const account of report.accounts) console.log(statusLine(account));
    for (const reason of report.reasons) console.log(`Needs you: ${reason}`);
  }
  return report.needsOwner ? 1 : 0;
}

function doctor(accountsPath: string): number {
  const results: Array<{ ok: boolean; text: string }> = [];
  const check = (ok: boolean, text: string) => results.push({ ok, text });
  const { configuration } = requireAccounts(accountsPath);
  check(true, `the accounts file ${accountsPath} is valid`);
  const accounts = configuration.settings.accounts;
  const folders = new Map<string, string>();
  for (const account of accounts) {
    const other = folders.get(account.directory);
    if (other)
      check(
        false,
        `${account.name} and ${other} use the same folder ${account.directory}`,
      );
    folders.set(account.directory, account.name);
  }
  const items = linkedItems().filter(wanted);
  const identities: Identity[] = [];
  for (const account of accounts) {
    if (!existsSync(account.directory)) {
      check(
        false,
        `${account.name}: the folder ${account.directory} is missing`,
      );
      continue;
    }
    const broken = items.filter((item) => {
      const path = join(account.directory, item.name);
      const target = join(SHARED, item.name);
      return linkAction(observe(path), target) !== "keep" || !existsSync(path);
    });
    check(
      broken.length === 0,
      broken.length === 0
        ? `${account.name}: ${items.length} shared links intact`
        : `${account.name}: links missing or wrong: ${broken.map((item) => item.name).join(", ")}`,
    );
    const identity = identityOf(account.name, account.directory);
    identities.push(identity);
    check(
      identity.email !== null,
      identity.email
        ? `${account.name}: logged in as ${identity.email}`
        : `${account.name}: NOT logged in; run claude-accounts login ${account.name}`,
    );
  }
  const pairs = duplicateAccounts(identities);
  check(
    pairs.length === 0,
    pairs.length === 0
      ? "every folder is on its own account"
      : pairs
          .map(([left, right]) => `${left} and ${right} are on one account`)
          .join("; "),
  );
  for (const result of results)
    console.log(`${result.ok ? "ok  " : "FAIL"} ${result.text}`);
  return results.every((result) => result.ok) ? 0 : 1;
}

function main(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        email: { type: "string" },
        folder: { type: "string" },
        "accounts-file": { type: "string" },
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    console.error(`${(error as Error).message}\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, name, ...rest] = positionals;
  if (values.help || !command) {
    console.log(USAGE);
    return values.help ? 0 : 2;
  }
  const accountsPath = accountsFilePath(values["accounts-file"]);
  try {
    if (rest.length)
      throw new Stop(`Unexpected argument: ${rest[0]}\n${USAGE}`);
    switch (command) {
      case "add":
        add(name, values.email, values.folder, accountsPath);
        return 0;
      case "login":
        login(name, values.email, accountsPath);
        return 0;
      case "status":
        if (name) throw new Stop(`status takes no name\n${USAGE}`);
        return status(values.json ?? false, accountsPath);
      case "doctor":
        if (name) throw new Stop(`doctor takes no name\n${USAGE}`);
        return doctor(accountsPath);
      default:
        console.error(`Unknown command: ${command}\n${USAGE}`);
        return 2;
    }
  } catch (error) {
    if (error instanceof Stop) {
      console.error(error.message);
      return 1;
    }
    console.error(
      `claude-accounts failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}

process.exit(main(process.argv.slice(2)));
