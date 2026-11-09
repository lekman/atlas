import { describe, expect, test } from "bun:test";

import {
  accountUsageLimit,
  checkIdentity,
  claudeMarkdownImports,
  copyMcpServers,
  displayFolder,
  duplicateAccounts,
  expandFolder,
  linkAction,
  mergeAccount,
  readAccountId,
  readAuthStatus,
  readAccountsFile,
  serialiseAccountsFile,
  statusLine,
  statusReport,
  validAccountName,
  validEmail,
  type AccountStatus,
} from "../src/accounts";

const home = "/Users/example";

/** A usage-limit line as Claude Code 2.1.317 writes it. */
function limitLine(at: string, rateLimitType: string, resetsAt: number) {
  return JSON.stringify({
    type: "assistant",
    timestamp: at,
    message: {
      model: "<synthetic>",
      content: [{ type: "text", text: "You've hit your weekly limit" }],
    },
    apiError: "usage_limit_reached",
    quotaLimits: { status: "rejected", resetsAt, rateLimitType },
    error: "rate_limit",
    isApiErrorMessage: true,
  });
}

const reply = (at: string) =>
  JSON.stringify({
    type: "assistant",
    timestamp: at,
    message: { content: [{ type: "text", text: "Done" }] },
  });

describe("names and addresses", () => {
  test("an account name is lower-case words joined by hyphens", () => {
    expect(validAccountName("ultra-a")).toBe(true);
    expect(validAccountName("Ultra A")).toBe(false);
    expect(validAccountName("-a")).toBe(false);
    expect(validAccountName("")).toBe(false);
  });

  test("an address needs a local part, an at sign and a domain", () => {
    expect(validEmail("you@example.com")).toBe(true);
    expect(validEmail("you@example")).toBe(false);
    expect(validEmail("you example.com")).toBe(false);
  });

  test("folders under the home folder are written with ~/ and read back", () => {
    expect(displayFolder(`${home}/.claude-ultra-a`, home)).toBe(
      "~/.claude-ultra-a",
    );
    expect(displayFolder("/accounts/ultra-a", home)).toBe("/accounts/ultra-a");
    expect(expandFolder("~/.claude-ultra-a", home)).toBe(
      `${home}/.claude-ultra-a`,
    );
    expect(expandFolder("/accounts/ultra-a", home)).toBe("/accounts/ultra-a");
  });
});

describe("links", () => {
  test("creates where nothing is, keeps the right link, refuses anything else", () => {
    const target = `${home}/.claude/projects`;
    expect(linkAction({ kind: "missing" }, target)).toBe("create");
    expect(linkAction({ kind: "link", target }, target)).toBe("keep");
    expect(linkAction({ kind: "link", target: "/elsewhere" }, target)).toBe(
      "refuse",
    );
    expect(linkAction({ kind: "other" }, target)).toBe("refuse");
  });

  test("links the files CLAUDE.md imports from its own folder only", () => {
    const text = [
      "# Guidelines",
      "@SOUL.md",
      "@./TONE.md and @standards/BIAS.md",
      "@~/Repo/elsewhere/CLAUDE.md",
      "@/absolute/RULES.md",
      "Ask @someone about it",
      "@settings.json",
      "```",
      "@IN-A-CODE-BLOCK.md",
      "```",
    ].join("\n");
    expect(claudeMarkdownImports(text)).toEqual([
      "SOUL.md",
      "TONE.md",
      "standards",
    ]);
  });
});

describe("auth status", () => {
  test("keeps only whether it is logged in and the address", () => {
    expect(
      readAuthStatus(
        JSON.stringify({
          loggedIn: true,
          email: "you@example.com",
          orgId: "organisation",
          subscriptionType: "max",
        }),
      ),
    ).toEqual({ loggedIn: true, email: "you@example.com" });
    expect(
      readAuthStatus(JSON.stringify({ loggedIn: false, authMethod: "none" })),
    ).toEqual({ loggedIn: false, email: null });
    expect(readAuthStatus("not json")).toBeNull();
    expect(
      readAuthStatus(JSON.stringify({ email: "you@example.com" })),
    ).toBeNull();
  });

  test("reads the account id from oauthAccount and nothing else", () => {
    expect(
      readAccountId(
        JSON.stringify({ oauthAccount: { accountUuid: "account-1" } }),
      ),
    ).toBe("account-1");
    expect(readAccountId(JSON.stringify({}))).toBeNull();
    expect(readAccountId("{")).toBeNull();
  });
});

describe("identity check", () => {
  const status = { loggedIn: true, email: "you@example.com" };
  const own = { name: "ultra-a", email: "you@example.com", accountId: "a" };

  test("passes a login on the expected address and its own account", () => {
    expect(
      checkIdentity(status, own, "You@Example.com", [
        { name: "ultra-b", email: "you+b@example.com", accountId: "b" },
      ]),
    ).toEqual({ ok: true });
  });

  test("fails a folder that is logged out", () => {
    const check = checkIdentity(
      { loggedIn: false, email: null },
      own,
      "you@example.com",
      [],
    );
    expect(check.ok ? null : check.reason).toBe("logged-out");
  });

  test("fails a login on another address", () => {
    const check = checkIdentity(status, own, "you+b@example.com", []);
    expect(check.ok ? null : check.reason).toBe("wrong-email");
  });

  test("fails the same account as another folder, by address or by account id", () => {
    const byEmail = checkIdentity(status, own, null, [
      { name: "ultra-b", email: "YOU@example.com", accountId: "b" },
    ]);
    expect(byEmail.ok ? null : byEmail.reason).toBe("same-account");
    const byId = checkIdentity(status, own, null, [
      { name: "ultra-b", email: "you+b@example.com", accountId: "a" },
    ]);
    expect(byId.ok ? null : byId.message).toContain("ultra-b");
  });

  test("lists every pair of folders on one account", () => {
    expect(
      duplicateAccounts([
        { name: "ultra-a", email: "you@example.com", accountId: "a" },
        { name: "ultra-b", email: "you+b@example.com", accountId: "a" },
        { name: "ultra-c", email: "you@example.com", accountId: null },
        { name: "ultra-d", email: null, accountId: null },
      ]),
    ).toEqual([
      ["ultra-a", "ultra-b"],
      ["ultra-a", "ultra-c"],
    ]);
  });
});

describe("the accounts file", () => {
  test("a new file has the account and the switch off", () => {
    const body = mergeAccount(
      null,
      { name: "ultra-a", directory: "~/.claude-ultra-a" },
      home,
    );
    expect(body).toEqual({
      accounts: [{ name: "ultra-a", directory: "~/.claude-ultra-a" }],
      switch: "off",
    });
    const read = readAccountsFile(serialiseAccountsFile(body), home);
    expect(read.configuration.settings.mode).toBe("off");
    expect(read.configuration.settings.accounts[0]?.directory).toBe(
      `${home}/.claude-ultra-a`,
    );
  });

  test("keeps other entries, the mode and the launcher, and updates a folder in place", () => {
    const existing = readAccountsFile(
      JSON.stringify({
        accounts: [
          { name: "ultra-a", directory: "~/.claude-ultra-a" },
          { name: "ultra-b", directory: "~/.claude-ultra-b" },
        ],
        switch: "dry",
        launcher: ["/usr/local/bin/claude-session-switch"],
        maxAgeMinutes: 20,
      }),
      home,
    ).body;
    const body = mergeAccount(
      existing,
      { name: "ultra-b", directory: "/accounts/ultra-b" },
      home,
    );
    expect(body).toEqual({
      accounts: [
        { name: "ultra-a", directory: "~/.claude-ultra-a" },
        { name: "ultra-b", directory: "/accounts/ultra-b" },
      ],
      switch: "dry",
      launcher: ["/usr/local/bin/claude-session-switch"],
      maxAgeMinutes: 20,
    });
    expect(existing.accounts[1]?.directory).toBe("~/.claude-ultra-b");
  });

  test("adding the same account twice changes nothing", () => {
    const once = mergeAccount(
      null,
      { name: "ultra-a", directory: "~/.claude-ultra-a" },
      home,
    );
    const twice = mergeAccount(
      once,
      { name: "ultra-a", directory: "~/.claude-ultra-a" },
      home,
    );
    expect(serialiseAccountsFile(twice)).toBe(serialiseAccountsFile(once));
  });

  test("refuses a folder another account uses, written either way", () => {
    const existing = mergeAccount(
      null,
      { name: "ultra-a", directory: "~/.claude-ultra-a" },
      home,
    );
    expect(() =>
      mergeAccount(
        existing,
        { name: "ultra-b", directory: `${home}/.claude-ultra-a` },
        home,
      ),
    ).toThrow("ultra-a already uses");
  });

  test("refuses what the server would refuse", () => {
    expect(() =>
      mergeAccount(null, { name: "Ultra A", directory: "/a" }, home),
    ).toThrow();
    expect(() =>
      readAccountsFile(JSON.stringify({ accounts: [] }), home),
    ).toThrow();
  });
});

describe("MCP servers", () => {
  test("copies the user-scope servers and keeps the login", () => {
    const { file, copied } = copyMcpServers(
      {
        oauthAccount: { accountUuid: "a" },
        mcpServers: { own: { command: "own" }, shared: { command: "old" } },
      },
      { shared: { command: "new" }, more: { command: "more" } },
    );
    expect(copied).toBe(2);
    expect(file).toEqual({
      oauthAccount: { accountUuid: "a" },
      mcpServers: {
        own: { command: "own" },
        shared: { command: "new" },
        more: { command: "more" },
      },
    });
  });

  test("copies nothing when the home file has no servers", () => {
    const folder = { oauthAccount: { accountUuid: "a" } };
    expect(copyMcpServers(folder, undefined)).toEqual({
      file: folder,
      copied: 0,
    });
  });
});

describe("usage limit from transcripts", () => {
  const now = new Date("2026-11-09T12:00:00.000Z");
  const resets = Date.parse("2026-11-10T18:00:00.000Z") / 1000;
  const started = Date.parse("2026-11-09T09:00:00.000Z");

  test("finds the newest limit that still holds", () => {
    const limit = accountUsageLimit(
      [
        {
          startedAt: started,
          lines: [limitLine("2026-11-09T11:07:13.085Z", "seven_day", resets)],
        },
        {
          startedAt: started,
          lines: [limitLine("2026-11-09T10:00:00.000Z", "five_hour", resets)],
        },
      ],
      now,
    );
    expect(limit).toEqual({
      kind: "weekly",
      resetsAt: "2026-11-10T18:00:00.000Z",
      at: "2026-11-09T11:07:13.085Z",
    });
  });

  test("a later reply clears it", () => {
    expect(
      accountUsageLimit(
        [
          {
            startedAt: started,
            lines: [
              limitLine("2026-11-09T10:00:00.000Z", "seven_day", resets),
              reply("2026-11-09T10:05:00.000Z"),
            ],
          },
        ],
        now,
      ),
    ).toBeNull();
  });

  test("ignores a limit from before the process started, and one that has reset", () => {
    expect(
      accountUsageLimit(
        [
          {
            startedAt: Date.parse("2026-11-09T11:30:00.000Z"),
            lines: [limitLine("2026-11-09T11:07:13.085Z", "seven_day", resets)],
          },
          {
            startedAt: null,
            lines: [
              limitLine(
                "2026-11-09T06:00:00.000Z",
                "five_hour",
                Date.parse("2026-11-09T11:00:00.000Z") / 1000,
              ),
            ],
          },
        ],
        now,
      ),
    ).toBeNull();
  });
});

describe("status report", () => {
  const now = new Date("2026-11-09T12:00:00.000Z");
  const account = (
    name: string,
    overrides: Partial<AccountStatus> = {},
  ): AccountStatus => ({
    name,
    directory: `${home}/.claude-${name}`,
    loggedIn: true,
    email: "you@example.com",
    usageLimit: null,
    liveSessions: 0,
    problem: null,
    ...overrides,
  });
  const limit = {
    kind: "weekly" as const,
    resetsAt: "2026-11-10T18:00:00.000Z",
    at: "2026-11-09T11:07:13.085Z",
  };

  test("needs nobody while one account is free and all are logged in", () => {
    const report = statusReport(
      [account("ultra-a", { usageLimit: limit }), account("ultra-b")],
      "/accounts.json",
      now,
    );
    expect(report.needsOwner).toBe(false);
    expect(report.reasons).toEqual([]);
    expect(report.version).toBe(1);
    expect(report.checkedAt).toBe("2026-11-09T12:00:00.000Z");
  });

  test("needs the owner when an account is logged out or every account is limited", () => {
    const loggedOut = statusReport(
      [
        account("ultra-a"),
        account("ultra-b", {
          loggedIn: false,
          email: null,
          problem: "logged-out",
        }),
      ],
      "/accounts.json",
      now,
    );
    expect(loggedOut.needsOwner).toBe(true);
    expect(loggedOut.reasons[0]).toContain("claude-accounts login ultra-b");
    const limited = statusReport(
      [
        account("ultra-a", { usageLimit: limit }),
        account("ultra-b", { usageLimit: limit }),
      ],
      "/accounts.json",
      now,
    );
    expect(limited.reasons).toEqual(["Every account is at a usage limit"]);
  });

  test("one line per account says login, limit and live sessions", () => {
    expect(statusLine(account("ultra-b", { liveSessions: 1 }))).toBe(
      "ultra-b: logged in as you@example.com; no usage limit; 1 live session",
    );
    expect(
      statusLine(
        account("ultra-a", {
          loggedIn: false,
          email: null,
          problem: "logged-out",
          usageLimit: limit,
          liveSessions: 2,
        }),
      ),
    ).toMatch(
      /^ultra-a: NOT logged in; weekly limit, resets 10 Nov \d\d:00; 2 live sessions$/,
    );
  });
});
