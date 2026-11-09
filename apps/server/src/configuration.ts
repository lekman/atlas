/**
 * Server settings, read from the environment. Every setting has a default
 * that is safe on the Mac mini: the server listens on the loopback address
 * only, and Tailscale Serve is what puts it on the tailnet.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { dispatchRules, Identifier } from "@atlas/core";
import { z } from "zod/v4";

import type { AccountSwitchSettings } from "./account-switch";
import {
  defaultDispatcherSettings,
  mergeMethods,
  ruleModes,
  type DispatcherSettings,
} from "./dispatcher-rules";

export interface Configuration {
  /** Where the SQLite file lives. */
  databasePath: string;
  hostname: string;
  port: number;
  /**
   * What to write into an empty database: the invented dataset, a dataset
   * from a JSON file kept outside the repository, or nothing.
   */
  seed: Seed;
  /** Refuse callers without a machine token or a Tailscale Serve identity. */
  requireTokens: boolean;
  /** Where tasks come from, or `undefined` to serve SQLite alone. */
  tasks?: TaskDatabaseConfiguration;
  /**
   * Show invented development tracking (issue, branch, pull request) on
   * items tracked on GitHub, until the real integration exists. Set by
   * `ATLAS_FAKE_DEVELOPMENT=true`; the stored records never change.
   */
  fakeDevelopment: boolean;
  /**
   * The folder where gh-events writes `registry.json` and `events.jsonl`,
   * or `undefined` to leave GitHub state off. Set by
   * `ATLAS_GITHUB_STATE_DIR`; see `github-reader.ts`.
   */
  githubStateDirectory?: string;
  /**
   * Where live agent status comes from, or `undefined` to leave it off.
   * Set by `ATLAS_SESSIONS_DIR`; see `session-source.ts`.
   */
  sessions?: SessionsConfiguration;
  /**
   * The dispatcher: its rules on GitHub signals run whenever GitHub state
   * is on, and its rule on idle agents whenever live agent status is on,
   * unless `ATLAS_DISPATCHER=off`; see `dispatcher.ts` and
   * `idle-with-work.ts`.
   */
  dispatcher?: DispatcherConfiguration;
}

/** An HTTP endpoint and the command that prints its token. */
export interface EndpointConfiguration {
  url: string;
  tokenCommand: string;
}

export interface DispatcherConfiguration {
  /** The rules' modes and the merge methods, from `ATLAS_DISPATCHER_FILE`, or the defaults. */
  settings: DispatcherSettings;
  /** The name task database changes are recorded under. */
  by: string;
  /**
   * The tasks MCP server's HTTP endpoint, for adding delegated tasks:
   * `ATLAS_TASKS_API_URL` and `ATLAS_TASKS_API_TOKEN_COMMAND`. Without it a
   * delegation is recorded as dry.
   */
  tasksApi?: EndpointConfiguration;
  /**
   * The Commander bridge, for waking an agent on a delegated task:
   * `ATLAS_COMMANDER_URL` and `ATLAS_COMMANDER_TOKEN_COMMAND`. Without it
   * the task is added and no agent is woken.
   */
  commander?: EndpointConfiguration;
  /** The GitHub command line merges run, `gh` unless `ATLAS_GITHUB_COMMAND` is set. */
  githubCommand: string;
  /**
   * Sweep each alert already open in `registry.json` once, so alerts that
   * were open before gh-events read their repository are triaged too.
   * On unless the dispatcher file sets `sweepOpenAlerts` to false.
   */
  sweepOpenAlerts: boolean;
}

/**
 * Claude Code's session files on this machine. Set `ATLAS_SESSIONS_DIR`
 * to the folder that holds them, usually `~/.claude/sessions`, or
 * `ATLAS_CLAUDE_ACCOUNTS_FILE` to read one folder per account.
 */
export interface SessionsConfiguration {
  /** From `ATLAS_SESSIONS_DIR`. Not read when `accounts` is set. */
  directory?: string;
  /** From `ATLAS_CLAUDE_ACCOUNTS_FILE`: the account folders and the switch rule. */
  accounts?: AccountsConfiguration;
  /** Seconds between reads: `ATLAS_SESSIONS_POLL_SECONDS`, 5 unless set. */
  pollSeconds: number;
  /** Hours a docked agent stays after its session ends: `ATLAS_SESSIONS_FORGET_HOURS`, 24 unless set. */
  forgetHours: number;
}

/**
 * The task database. Set `ATLAS_TASKS_HOST` to turn it on. The password
 * is never set directly: `ATLAS_TASKS_PASSWORD_COMMAND` names a command
 * that prints it, such as a Keychain lookup.
 */
export interface TaskDatabaseConfiguration {
  hostname: string;
  port: number;
  database: string;
  username: string;
  /** A command that prints the password. Absent when the database needs none. */
  passwordCommand?: string;
  /** Seconds between reads. */
  pollSeconds: number;
  /** Only these clients, when set: `ATLAS_TASKS_CLIENTS`, ids joined by commas. */
  clients?: string[];
}

export type Seed =
  { kind: "none" } | { kind: "fixtures" } | { kind: "file"; path: string };

function readSeed(value: string | undefined): Seed {
  if (!value) return { kind: "none" };
  if (value === "fixtures") return { kind: "fixtures" };
  if (value.endsWith(".json")) return { kind: "file", path: value };
  throw new Error("ATLAS_SEED must be fixtures or the path of a .json file");
}

function readTasks(
  environment: Record<string, string | undefined>,
): TaskDatabaseConfiguration | undefined {
  const hostname = environment.ATLAS_TASKS_HOST;
  if (!hostname) return undefined;
  const database = environment.ATLAS_TASKS_DATABASE;
  const username = environment.ATLAS_TASKS_USER;
  if (!database || !username)
    throw new Error(
      "ATLAS_TASKS_HOST needs ATLAS_TASKS_DATABASE and ATLAS_TASKS_USER",
    );
  const port = Number(environment.ATLAS_TASKS_PORT ?? 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error("ATLAS_TASKS_PORT must be a port number");
  const pollSeconds = Number(environment.ATLAS_TASKS_POLL_SECONDS ?? 30);
  if (!Number.isFinite(pollSeconds) || pollSeconds < 1)
    throw new Error("ATLAS_TASKS_POLL_SECONDS must be 1 or more");
  const passwordCommand = environment.ATLAS_TASKS_PASSWORD_COMMAND?.trim();
  const clients = (environment.ATLAS_TASKS_CLIENTS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  for (const id of clients)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id))
      throw new Error(
        "ATLAS_TASKS_CLIENTS must be client ids joined by commas",
      );
  return {
    hostname,
    port,
    database,
    username,
    ...(passwordCommand ? { passwordCommand } : {}),
    pollSeconds,
    ...(clients.length ? { clients } : {}),
  };
}

/** The accounts file: one Claude Code folder per account, and the switch rule. */
export interface AccountsConfiguration {
  settings: AccountSwitchSettings;
  /** The command that restarts a session under another account, as arguments. */
  launcher?: string[];
}

/**
 * The accounts file, kept outside the repository. Only `accounts` is
 * required; the rule (`switch`) is `off` unless set.
 *
 * ```json
 * {
 *   "accounts": [
 *     { "name": "ultra-a", "directory": "~/.claude-ultra-a" },
 *     { "name": "ultra-b", "directory": "~/.claude-ultra-b" }
 *   ],
 *   "switch": "off",
 *   "launcher": ["/usr/local/bin/claude-session-switch"],
 *   "maxAgeMinutes": 30
 * }
 * ```
 */
const AccountsFile = z
  .object({
    accounts: z
      .array(
        z
          .object({
            name: Identifier,
            directory: z.string().min(1).max(1024),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    switch: z.enum(ruleModes).optional(),
    launcher: z.array(z.string().min(1).max(1024)).min(1).max(20).optional(),
    maxAgeMinutes: z.number().positive().optional(),
  })
  .strict();

/** Reads the accounts file's text. A leading `~/` in a folder is the home folder. */
export function parseAccountsFile(
  text: string,
  home: string = homedir(),
): AccountsConfiguration {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("ATLAS_CLAUDE_ACCOUNTS_FILE is not JSON");
  }
  const read = AccountsFile.safeParse(body);
  if (!read.success)
    throw new Error(
      `ATLAS_CLAUDE_ACCOUNTS_FILE does not match its shape: ${read.error.issues
        .map((issue) => issue.path.join(".") || issue.message)
        .join(", ")}`,
    );
  const names = read.data.accounts.map((account) => account.name);
  if (new Set(names).size !== names.length)
    throw new Error("ATLAS_CLAUDE_ACCOUNTS_FILE names an account twice");
  return {
    settings: {
      mode: read.data.switch ?? "off",
      maxAgeMinutes: read.data.maxAgeMinutes ?? 30,
      accounts: read.data.accounts.map(({ name, directory }) => ({
        name,
        directory: directory.startsWith("~/")
          ? join(home, directory.slice(2))
          : directory,
      })),
    },
    ...(read.data.launcher ? { launcher: read.data.launcher } : {}),
  };
}

function readSessions(
  environment: Record<string, string | undefined>,
): SessionsConfiguration | undefined {
  const directory = environment.ATLAS_SESSIONS_DIR?.trim();
  const accountsPath = environment.ATLAS_CLAUDE_ACCOUNTS_FILE?.trim();
  if (!directory && !accountsPath) return undefined;
  const pollSeconds = Number(environment.ATLAS_SESSIONS_POLL_SECONDS ?? 5);
  if (!Number.isFinite(pollSeconds) || pollSeconds < 1)
    throw new Error("ATLAS_SESSIONS_POLL_SECONDS must be 1 or more");
  const forgetHours = Number(environment.ATLAS_SESSIONS_FORGET_HOURS ?? 24);
  if (!Number.isFinite(forgetHours) || forgetHours <= 0)
    throw new Error("ATLAS_SESSIONS_FORGET_HOURS must be more than 0");
  const accounts = accountsPath
    ? parseAccountsFile(readFileSync(accountsPath, "utf8"))
    : undefined;
  return {
    ...(directory && !accounts ? { directory } : {}),
    ...(accounts ? { accounts } : {}),
    pollSeconds,
    forgetHours,
  };
}

const RuleMode = z.enum(ruleModes);
const MergeMethod = z.enum(mergeMethods);

/**
 * The dispatcher file, kept outside the repository. Every field is
 * optional; what is left out keeps its default.
 *
 * ```json
 * {
 *   "rules": { "merge-approved": "dry", "fix-failed-checks": "on", "alert-by-severity": "on", "nudge-idle-with-work": "dry" },
 *   "mergeMethods": { "default": "squash", "example-org": "rebase", "example-org/ledger": "merge" },
 *   "maxAgeHours": 24,
 *   "sweepOpenAlerts": true,
 *   "by": "atlas-dispatcher",
 *   "idleWithWork": { "idleMinutes": 20, "goneMinutes": 10, "cooldownMinutes": 60 }
 * }
 * ```
 */
const DispatcherFile = z
  .object({
    rules: z.partialRecord(z.enum(dispatchRules), RuleMode).optional(),
    /** `default`, then entries by `owner` or `owner/name`. */
    mergeMethods: z.record(z.string().min(1).max(140), MergeMethod).optional(),
    maxAgeHours: z.number().positive().optional(),
    sweepOpenAlerts: z.boolean().optional(),
    by: z.string().min(1).max(96).optional(),
    /** The `nudge-idle-with-work` rule's thresholds, in minutes. */
    idleWithWork: z
      .object({
        idleMinutes: z.number().positive().optional(),
        goneMinutes: z.number().positive().optional(),
        cooldownMinutes: z.number().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Reads the dispatcher file's text into settings over the defaults. */
export function parseDispatcherFile(text: string): {
  settings: DispatcherSettings;
  by?: string;
  sweepOpenAlerts?: boolean;
} {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("ATLAS_DISPATCHER_FILE is not JSON");
  }
  const read = DispatcherFile.safeParse(body);
  if (!read.success)
    throw new Error(
      `ATLAS_DISPATCHER_FILE does not match its shape: ${read.error.issues
        .map((issue) => issue.path.join(".") || issue.message)
        .join(", ")}`,
    );
  const { default: defaultMethod, ...byRepository } =
    read.data.mergeMethods ?? {};
  return {
    settings: {
      rules: { ...defaultDispatcherSettings.rules, ...read.data.rules },
      defaultMergeMethod:
        defaultMethod ?? defaultDispatcherSettings.defaultMergeMethod,
      mergeMethods: Object.fromEntries(
        Object.entries(byRepository).map(([name, method]) => [
          name.toLowerCase(),
          method,
        ]),
      ),
      maxAgeHours:
        read.data.maxAgeHours ?? defaultDispatcherSettings.maxAgeHours,
      idleWithWork: {
        ...defaultDispatcherSettings.idleWithWork,
        ...read.data.idleWithWork,
      },
    },
    ...(read.data.by ? { by: read.data.by } : {}),
    ...(read.data.sweepOpenAlerts !== undefined
      ? { sweepOpenAlerts: read.data.sweepOpenAlerts }
      : {}),
  };
}

function readEndpoint(
  environment: Record<string, string | undefined>,
  urlName: string,
  tokenName: string,
): EndpointConfiguration | undefined {
  const url = environment[urlName]?.trim();
  const tokenCommand = environment[tokenName]?.trim();
  if (!url && !tokenCommand) return undefined;
  if (!url || !tokenCommand)
    throw new Error(`${urlName} and ${tokenName} are set together`);
  if (!/^https?:\/\//.test(url))
    throw new Error(`${urlName} must be an http or https address`);
  return { url, tokenCommand };
}

function readDispatcher(
  environment: Record<string, string | undefined>,
): DispatcherConfiguration | undefined {
  if (environment.ATLAS_DISPATCHER === "off") return undefined;
  const path = environment.ATLAS_DISPATCHER_FILE?.trim();
  const file: ReturnType<typeof parseDispatcherFile> = path
    ? parseDispatcherFile(readFileSync(path, "utf8"))
    : { settings: defaultDispatcherSettings };
  const tasksApi = readEndpoint(
    environment,
    "ATLAS_TASKS_API_URL",
    "ATLAS_TASKS_API_TOKEN_COMMAND",
  );
  const commander = readEndpoint(
    environment,
    "ATLAS_COMMANDER_URL",
    "ATLAS_COMMANDER_TOKEN_COMMAND",
  );
  return {
    settings: file.settings,
    by: file.by ?? "atlas-dispatcher",
    ...(tasksApi ? { tasksApi } : {}),
    ...(commander ? { commander } : {}),
    githubCommand: environment.ATLAS_GITHUB_COMMAND?.trim() || "gh",
    sweepOpenAlerts: file.sweepOpenAlerts ?? true,
  };
}

export function readConfiguration(
  environment: Record<string, string | undefined> = process.env,
): Configuration {
  const port = Number(environment.ATLAS_PORT ?? 7400);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error("ATLAS_PORT must be a port number");
  const sessions = readSessions(environment);
  const githubStateDirectory = environment.ATLAS_GITHUB_STATE_DIR?.trim();
  const dispatcher =
    githubStateDirectory || sessions ? readDispatcher(environment) : undefined;
  return {
    databasePath:
      environment.ATLAS_DATABASE ??
      join(homedir(), "Library", "Application Support", "Atlas", "atlas.db"),
    hostname: environment.ATLAS_HOSTNAME ?? "127.0.0.1",
    port,
    seed: readSeed(environment.ATLAS_SEED),
    requireTokens: environment.ATLAS_REQUIRE_TOKENS === "true",
    tasks: readTasks(environment),
    fakeDevelopment: environment.ATLAS_FAKE_DEVELOPMENT === "true",
    ...(githubStateDirectory ? { githubStateDirectory } : {}),
    ...(sessions ? { sessions } : {}),
    ...(dispatcher ? { dispatcher } : {}),
  };
}
