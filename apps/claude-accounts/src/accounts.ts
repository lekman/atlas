/**
 * The pure half of `claude-accounts`: what to link, whether a login is the
 * account it should be, how the accounts file changes, and what the
 * transcripts say about an account's usage limit. Nothing here reads a
 * file or runs a process, so each rule is tested on plain values.
 *
 * The accounts file is the one the Atlas server reads from
 * `ATLAS_CLAUDE_ACCOUNTS_FILE`. Every file written here is checked with the
 * server's own `parseAccountsFile` first, so the two cannot drift.
 */
import {
  readTail,
  usageLimitIsActive,
  type UsageLimit,
} from "@atlas/collector";
import { Identifier } from "@atlas/core";
import { parseAccountsFile } from "@atlas/server/configuration";

/** One item every account folder links to the shared folder (`~/.claude`). */
export interface SharedItem {
  name: string;
  /** A directory is created in the shared folder when it is missing; a file is linked only when it exists. */
  kind: "directory" | "file";
}

/**
 * What the account folders share, by a symbolic link to the same name in
 * the shared folder. `projects/` is what lets `claude --resume` continue a
 * conversation under another account.
 */
export const sharedItems: readonly SharedItem[] = [
  { name: "projects", kind: "directory" },
  { name: "plugins", kind: "directory" },
  { name: "skills", kind: "directory" },
  { name: "rules", kind: "directory" },
  { name: "hooks", kind: "directory" },
  { name: "commander", kind: "directory" },
  { name: "file-history", kind: "directory" },
  { name: "todos", kind: "directory" },
  { name: "routines", kind: "directory" },
  { name: "scripts", kind: "directory" },
  { name: "settings.json", kind: "file" },
  { name: "CLAUDE.md", kind: "file" },
  { name: "commander.json", kind: "file" },
  { name: "history.jsonl", kind: "file" },
];

/**
 * What each folder keeps for itself and never links: the session records
 * (the folder a record is in is how Atlas knows a session's account), the
 * login and the account it names.
 */
export const perFolderItems: readonly string[] = [
  "sessions",
  ".claude.json",
  ".credentials.json",
  "shell-snapshots",
  "session-env",
];

/**
 * The files `CLAUDE.md` imports from its own folder, by the first part of
 * each relative `@path`. A linked `CLAUDE.md` resolves its imports in the
 * account folder, so these are linked too. Imports from the home folder
 * (`@~/…`) or an absolute path need no link. Lines in a fenced code block
 * are not imports.
 */
export function claudeMarkdownImports(text: string): string[] {
  const found = new Set<string>();
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const match of line.matchAll(/(?:^|\s)@([^\s`]+)/g)) {
      const path = match[1];
      if (!path || path.startsWith("~") || path.startsWith("/")) continue;
      const first = path.replace(/^\.\//, "").split("/")[0];
      if (!first || first === "." || first === "..") continue;
      if (!/\.md$/i.test(path) && !path.includes("/")) continue;
      if (perFolderItems.includes(first)) continue;
      if (sharedItems.some((item) => item.name === first)) continue;
      found.add(first);
    }
  }
  return [...found].sort();
}

/** What is at a path in the account folder now. */
export type Observed =
  { kind: "missing" } | { kind: "link"; target: string } | { kind: "other" };

/** What to do with one shared item. */
export type LinkAction = "create" | "keep" | "refuse";

/** A link is created where nothing is, kept where it is already right, and nothing else is ever replaced. */
export function linkAction(observed: Observed, expected: string): LinkAction {
  if (observed.kind === "missing") return "create";
  if (observed.kind === "link" && observed.target === expected) return "keep";
  return "refuse";
}

/** Whether a name can be an account name in the accounts file. */
export function validAccountName(name: string): boolean {
  return Identifier.safeParse(name).success && name.length <= 64;
}

/** A plain check that an address looks like one. The login page checks the rest. */
export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** The fields `claude auth status --json` gives that are used here. Nothing else is kept. */
export interface AuthStatus {
  loggedIn: boolean;
  email: string | null;
}

/** Reads `claude auth status --json`, keeping only whether it is logged in and the address. */
export function readAuthStatus(text: string): AuthStatus | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.loggedIn !== "boolean") return null;
  return {
    loggedIn: record.loggedIn,
    email:
      record.loggedIn && typeof record.email === "string" ? record.email : null,
  };
}

/** Reads `oauthAccount.accountUuid` from a folder's `.claude.json`, and nothing else. */
export function readAccountId(text: string): string | null {
  try {
    const body = JSON.parse(text) as {
      oauthAccount?: { accountUuid?: unknown };
    };
    const id = body?.oauthAccount?.accountUuid;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

/** Reads `oauthAccount.emailAddress` from a folder's `.claude.json`, and nothing else. */
export function readAccountEmail(text: string): string | null {
  try {
    const body = JSON.parse(text) as {
      oauthAccount?: { emailAddress?: unknown };
    };
    const email = body?.oauthAccount?.emailAddress;
    return typeof email === "string" && email ? email : null;
  } catch {
    return null;
  }
}

/** Who a folder is signed in as. */
export interface Identity {
  name: string;
  email: string | null;
  accountId: string | null;
}

export type IdentityCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "logged-out" | "wrong-email" | "same-account";
      message: string;
    };

const sameEmail = (left: string | null, right: string | null) =>
  !!left && !!right && left.toLowerCase() === right.toLowerCase();

/**
 * Whether a folder's login is the account it should be: logged in, with
 * the expected address when one is given, and not the same account (by
 * address or account id) as any other folder.
 */
export function checkIdentity(
  status: AuthStatus,
  own: Identity,
  expectedEmail: string | null,
  others: readonly Identity[],
): IdentityCheck {
  if (!status.loggedIn)
    return {
      ok: false,
      reason: "logged-out",
      message: `${own.name} is not logged in`,
    };
  if (expectedEmail && !sameEmail(status.email, expectedEmail))
    return {
      ok: false,
      reason: "wrong-email",
      message: `${own.name} is logged in as ${status.email ?? "an unknown address"}, not ${expectedEmail}`,
    };
  const clash = others.find(
    (other) =>
      other.name !== own.name &&
      (sameEmail(other.email, status.email) ||
        (!!own.accountId && other.accountId === own.accountId)),
  );
  if (clash)
    return {
      ok: false,
      reason: "same-account",
      message: `${own.name} is logged in to the same account as ${clash.name}; use a different account for each folder`,
    };
  return { ok: true };
}

/** Every pair of folders signed in to one account, by address or account id. */
export function duplicateAccounts(
  identities: readonly Identity[],
): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  identities.forEach((left, index) => {
    for (const right of identities.slice(index + 1))
      if (
        sameEmail(left.email, right.email) ||
        (!!left.accountId && left.accountId === right.accountId)
      )
        pairs.push([left.name, right.name]);
  });
  return pairs;
}

/** A folder written as the accounts file shows it: `~/…` when it is under the home folder. */
export function displayFolder(folder: string, home: string): string {
  const base = home.replace(/\/+$/, "");
  return folder.startsWith(`${base}/`)
    ? `~/${folder.slice(base.length + 1)}`
    : folder;
}

/** A folder as given on the command line, with a leading `~/` as the home folder. */
export function expandFolder(folder: string, home: string): string {
  return folder === "~"
    ? home
    : folder.startsWith("~/")
      ? `${home.replace(/\/+$/, "")}/${folder.slice(2)}`
      : folder;
}

/** The default folder for an account: `~/.claude-<name>`. */
export function defaultFolder(name: string, home: string): string {
  return `${home.replace(/\/+$/, "")}/.claude-${name}`;
}

/** The accounts file as stored: kept as read, so fields this script does not use stay. */
export type AccountsFileBody = Record<string, unknown> & {
  accounts: Array<{ name: string; directory: string }>;
};

/**
 * Adds an account to the accounts file, or updates its folder. Every other
 * entry and field stays as it was, the switch mode included. A new file
 * has the switch `off`. The result is checked with the server's parser,
 * and an account whose folder another account already uses is refused.
 */
export function mergeAccount(
  existing: AccountsFileBody | null,
  account: { name: string; directory: string },
  home: string,
): AccountsFileBody {
  const body: AccountsFileBody = existing
    ? { ...existing, accounts: [...existing.accounts] }
    : { accounts: [], switch: "off" };
  const folder = expandFolder(account.directory, home);
  const sharing = body.accounts.find(
    (entry) =>
      entry.name !== account.name &&
      expandFolder(entry.directory, home) === folder,
  );
  if (sharing)
    throw new Error(
      `${sharing.name} already uses ${account.directory}; give each account its own folder`,
    );
  const index = body.accounts.findIndex((entry) => entry.name === account.name);
  const entry = { name: account.name, directory: account.directory };
  if (index === -1) body.accounts.push(entry);
  else body.accounts[index] = entry;
  parseAccountsFile(JSON.stringify(body), home);
  return body;
}

/**
 * Reads the accounts file's text: checked with the server's parser, and
 * kept as written so a later write changes only what it must.
 */
export function readAccountsFile(text: string, home: string) {
  const configuration = parseAccountsFile(text, home);
  const body = JSON.parse(text) as AccountsFileBody;
  return { body, configuration };
}

/** The accounts file serialised the way it is written: two-space JSON and a final new line. */
export function serialiseAccountsFile(body: AccountsFileBody): string {
  return `${JSON.stringify(body, null, 2)}\n`;
}

/**
 * Copies the user-scope MCP servers into a folder's `.claude.json`. The
 * folder's own servers stay; a server of the same name is replaced by the
 * one from the home file. `oauthAccount` and every other field are kept.
 */
export function copyMcpServers(
  folderFile: Record<string, unknown>,
  homeServers: unknown,
): { file: Record<string, unknown>; copied: number } {
  if (!homeServers || typeof homeServers !== "object")
    return { file: folderFile, copied: 0 };
  const own =
    folderFile.mcpServers && typeof folderFile.mcpServers === "object"
      ? (folderFile.mcpServers as Record<string, unknown>)
      : {};
  const servers = homeServers as Record<string, unknown>;
  return {
    file: { ...folderFile, mcpServers: { ...own, ...servers } },
    copied: Object.keys(servers).length,
  };
}

/** One session record in an account folder, with the end of its transcript. */
export interface SessionTail {
  /** When the process started, in milliseconds since 1970, when the record gives it. */
  startedAt: number | null;
  /** The last lines of the session's transcript, or none when it has none. */
  lines: readonly string[];
}

/**
 * The account's current usage limit: the newest one any of its sessions'
 * transcripts ends in that still holds at `now`. A limit hit before a
 * session's process started belongs to an earlier run, possibly under
 * another account, and is ignored, as the Atlas server does.
 */
export function accountUsageLimit(
  sessions: readonly SessionTail[],
  now: Date,
): UsageLimit | null {
  let newest: UsageLimit | null = null;
  for (const session of sessions) {
    const limit = readTail(session.lines).usageLimit;
    if (!limit) continue;
    if (session.startedAt !== null && Date.parse(limit.at) < session.startedAt)
      continue;
    if (!usageLimitIsActive(limit, now)) continue;
    if (!newest || limit.at > newest.at) newest = limit;
  }
  return newest;
}

/** Why an account needs the owner. */
export const accountProblems = [
  "folder-missing",
  "logged-out",
  "status-failed",
] as const;
export type AccountProblem = (typeof accountProblems)[number];

/** One account as `status --json` reports it. */
export interface AccountStatus {
  name: string;
  /** The account folder, with `~/` expanded. */
  directory: string;
  loggedIn: boolean;
  /** The address the folder is signed in as, or null when logged out. */
  email: string | null;
  /** The usage limit that holds now, or null. */
  usageLimit: UsageLimit | null;
  /** Sessions whose record is in this folder and whose process is alive. */
  liveSessions: number;
  /** Why this account needs the owner, or null. */
  problem: AccountProblem | null;
}

/** The whole `status --json` output. `version` changes only when a field changes meaning or is removed. */
export interface StatusReport {
  version: 1;
  checkedAt: string;
  accountsFile: string;
  /** True when an account is logged out or cannot be read, or every account is limited. */
  needsOwner: boolean;
  /** One plain sentence for each reason `needsOwner` is true. */
  reasons: string[];
  accounts: AccountStatus[];
}

/** Puts the accounts together and says whether the owner is needed. */
export function statusReport(
  accounts: readonly AccountStatus[],
  accountsFile: string,
  now: Date,
): StatusReport {
  const reasons: string[] = [];
  for (const account of accounts) {
    if (account.problem === "folder-missing")
      reasons.push(
        `${account.name}: the folder ${account.directory} is missing`,
      );
    else if (account.problem === "logged-out")
      reasons.push(
        `${account.name} is not logged in; run claude-accounts login ${account.name}`,
      );
    else if (account.problem === "status-failed")
      reasons.push(`${account.name}: claude auth status did not answer`);
  }
  if (accounts.length > 0 && accounts.every((account) => account.usageLimit))
    reasons.push("Every account is at a usage limit");
  return {
    version: 1,
    checkedAt: now.toISOString(),
    accountsFile,
    needsOwner: reasons.length > 0,
    reasons,
    accounts: [...accounts],
  };
}

/** A reset time for a person: the day and the time on this machine's clock. */
function resetText(resetsAt: string | null): string {
  if (!resetsAt) return "no reset time given";
  const at = new Date(resetsAt);
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return `resets ${day} ${time}`;
}

const LIMIT_WORDS = {
  session: "session limit",
  weekly: "weekly limit",
  other: "usage limit",
} as const;

/** One line for a person, per account. */
export function statusLine(account: AccountStatus): string {
  const login =
    account.problem === "folder-missing"
      ? "folder missing"
      : account.problem === "status-failed"
        ? "login unknown"
        : account.loggedIn
          ? `logged in as ${account.email ?? "an unknown address"}`
          : "NOT logged in";
  const limit = account.usageLimit
    ? `${LIMIT_WORDS[account.usageLimit.kind]}, ${resetText(account.usageLimit.resetsAt)}`
    : "no usage limit";
  const sessions = `${account.liveSessions} live session${account.liveSessions === 1 ? "" : "s"}`;
  return `${account.name}: ${login}; ${limit}; ${sessions}`;
}
