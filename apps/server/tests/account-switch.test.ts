import type { AccountSwitchEvent, AtlasEvent } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  commandLineLauncher,
  createAccountSwitcher,
  decideSwitch,
  launcherArguments,
  openDatabase,
  parseAccountsFile,
  readConfiguration,
  type AccountLimitState,
  type AccountSwitchSettings,
  type AtlasDatabase,
  type LimitedSession,
  type RestartRequest,
  type SessionLauncher,
} from "../src";

const now = () => new Date("2026-10-24T09:00:00.000Z");

const settings = (
  mode: AccountSwitchSettings["mode"] = "on",
): AccountSwitchSettings => ({
  mode,
  maxAgeMinutes: 30,
  accounts: [
    { name: "ultra-a", directory: "/accounts/ultra-a" },
    { name: "ultra-b", directory: "/accounts/ultra-b" },
  ],
});

const limited: LimitedSession = {
  signalKey: "claude:usage-limit:session-1:2026-10-24T08:55:00Z",
  agentId: "schema",
  account: "ultra-a",
  sessionName: "Schema",
  sessionId: "11111111-2222-3333-4444-555555555555",
  cwd: "/work/sample-app",
  pid: 4321,
  limit: {
    kind: "weekly",
    resetsAt: "2026-10-25T18:00:00.000Z",
    at: "2026-10-24T08:55:00Z",
  },
};

const noLimits = new Map<string, AccountLimitState>();

describe("the account-switch rule", () => {
  test("does nothing while off", () => {
    expect(decideSwitch(limited, settings("off"), noLimits, now())).toBeNull();
  });

  test("moves a limited session to the first account that is not limited", () => {
    expect(decideSwitch(limited, settings(), noLimits, now())).toMatchObject({
      outcome: "switch",
      mode: "on",
      from: "ultra-a",
      to: "ultra-b",
      directory: "/accounts/ultra-b",
      needsYou: false,
    });
  });

  test("skips when every other account is limited, and asks the reader", () => {
    const limits = new Map<string, AccountLimitState>([
      [
        "ultra-b",
        {
          kind: "session",
          resetsAt: "2026-10-24T11:00:00.000Z",
          seenAt: "2026-10-24T08:00:00.000Z",
        },
      ],
    ]);
    expect(decideSwitch(limited, settings(), limits, now())).toMatchObject({
      outcome: "skip",
      to: null,
      needsYou: true,
      text: "Every other account is limited",
    });
  });

  test("counts an account whose limit has reset as free again", () => {
    const limits = new Map<string, AccountLimitState>([
      [
        "ultra-b",
        {
          kind: "session",
          resetsAt: "2026-10-24T08:30:00.000Z",
          seenAt: "2026-10-24T04:00:00.000Z",
        },
      ],
    ]);
    expect(decideSwitch(limited, settings(), limits, now())?.outcome).toBe(
      "switch",
    );
  });

  test("treats a limit with no reset time as holding for five hours", () => {
    const limits = (seenAt: string) =>
      new Map<string, AccountLimitState>([
        ["ultra-b", { kind: "other", resetsAt: null, seenAt }],
      ]);
    expect(
      decideSwitch(
        limited,
        settings(),
        limits("2026-10-24T05:00:00.000Z"),
        now(),
      )?.outcome,
    ).toBe("skip");
    expect(
      decideSwitch(
        limited,
        settings(),
        limits("2026-10-24T03:00:00.000Z"),
        now(),
      )?.outcome,
    ).toBe("switch");
  });

  test("skips a session whose account is not configured", () => {
    expect(
      decideSwitch({ ...limited, account: null }, settings(), noLimits, now()),
    ).toMatchObject({
      outcome: "skip",
      text: "The session's account is not in the accounts file",
    });
  });

  test("skips a session it cannot resume", () => {
    const { sessionId: _sessionId, ...withoutId } = limited;
    expect(decideSwitch(withoutId, settings(), noLimits, now())).toMatchObject({
      outcome: "skip",
      needsYou: true,
    });
  });

  test("skips a limit seen too late", () => {
    expect(
      decideSwitch(
        { ...limited, limit: { ...limited.limit, at: "2026-10-24T08:00:00Z" } },
        settings(),
        noLimits,
        now(),
      ),
    ).toMatchObject({
      outcome: "skip",
      text: "The limit is older than 30 minutes",
    });
  });
});

describe("the account switcher", () => {
  let database: AtlasDatabase;
  let recorded: AtlasEvent[];
  let restarts: RestartRequest[];
  const connection = {
    record: (event: AtlasEvent) => recorded.push(event),
    dataset: () => sampleDataset,
  };
  const launcher: SessionLauncher = {
    async restart(request) {
      restarts.push(request);
    },
  };

  function decisions() {
    return recorded.filter(
      (event): event is AccountSwitchEvent => event.type === "account-switch",
    );
  }

  beforeEach(() => {
    database = openDatabase(":memory:");
    recorded = [];
    restarts = [];
  });

  test("restarts the session under the other account, once per signal", async () => {
    const switcher = createAccountSwitcher({
      database,
      settings: settings("on"),
      launcher,
      now,
      log: () => {},
    });
    switcher.handle(limited, connection);
    switcher.handle(limited, connection);
    await switcher.settled();
    expect(restarts).toEqual([
      {
        sessionName: "Schema",
        sessionId: limited.sessionId!,
        cwd: "/work/sample-app",
        configDirectory: "/accounts/ultra-b",
        pid: 4321,
      },
    ]);
    expect(decisions()).toEqual([
      {
        type: "account-switch",
        signalKey: limited.signalKey,
        mode: "on",
        outcome: "switch",
        agentId: "schema",
        from: "ultra-a",
        to: "ultra-b",
        needsYou: false,
        text: "Restarted the session under account ultra-b",
      },
    ]);
  });

  test("records what it would do in dry mode, and restarts nothing", async () => {
    const switcher = createAccountSwitcher({
      database,
      settings: settings("dry"),
      launcher,
      now,
      log: () => {},
    });
    switcher.handle(limited, connection);
    await switcher.settled();
    expect(restarts).toHaveLength(0);
    expect(decisions()[0]).toMatchObject({
      mode: "dry",
      outcome: "switch",
      text: "Would restart the session under account ultra-b",
    });
  });

  test("remembers each account's limit, so a session is not moved back onto it", async () => {
    const switcher = createAccountSwitcher({
      database,
      settings: settings("on"),
      launcher,
      now,
      log: () => {},
    });
    switcher.handle(limited, connection);
    // Later the moved session hits a limit on ultra-b too.
    switcher.handle(
      {
        ...limited,
        signalKey: "claude:usage-limit:session-1:2026-10-24T08:58:00Z",
        account: "ultra-b",
        limit: { ...limited.limit, at: "2026-10-24T08:58:00Z" },
      },
      connection,
    );
    await switcher.settled();
    expect(restarts).toHaveLength(1);
    expect(decisions()[1]).toMatchObject({
      outcome: "skip",
      from: "ultra-b",
      text: "Every other account is limited",
    });
    expect([...switcher.limits().keys()].sort()).toEqual([
      "ultra-a",
      "ultra-b",
    ]);
  });

  test("notes limits but decides nothing while off", async () => {
    const switcher = createAccountSwitcher({
      database,
      settings: settings("off"),
      launcher,
      now,
      log: () => {},
    });
    switcher.handle(limited, connection);
    await switcher.settled();
    expect(decisions()).toHaveLength(0);
    expect(switcher.limits().get("ultra-a")?.resetsAt).toBe(
      "2026-10-25T18:00:00.000Z",
    );
  });

  test("records a failed restart, and asks the reader", async () => {
    const switcher = createAccountSwitcher({
      database,
      settings: settings("on"),
      launcher: {
        async restart() {
          throw new Error("the launcher exited with code 3");
        },
      },
      now,
      log: () => {},
    });
    switcher.handle(limited, connection);
    await switcher.settled();
    expect(decisions()[0]).toMatchObject({
      outcome: "fail",
      needsYou: true,
      text: "Could not restart the session under account ultra-b: the launcher exited with code 3",
    });
  });

  test("records a switch as dry when no launcher is configured", async () => {
    const switcher = createAccountSwitcher({
      database,
      settings: settings("on"),
      now,
      log: () => {},
    });
    switcher.handle(limited, connection);
    await switcher.settled();
    expect(decisions()[0]).toMatchObject({
      mode: "dry",
      text: "Would restart the session under account ultra-b: no launcher is configured",
    });
  });
});

describe("the launcher command", () => {
  const request: RestartRequest = {
    sessionName: "Schema",
    sessionId: "11111111-2222-3333-4444-555555555555",
    cwd: "/work/sample-app",
    configDirectory: "/accounts/ultra-b",
    pid: 4321,
  };

  test("is called with named arguments, never through a shell", () => {
    expect(launcherArguments(["/bin/switch", "--quiet"], request)).toEqual([
      "/bin/switch",
      "--quiet",
      "--name",
      "Schema",
      "--session-id",
      request.sessionId,
      "--cwd",
      "/work/sample-app",
      "--config-directory",
      "/accounts/ultra-b",
      "--pid",
      "4321",
    ]);
  });

  test("succeeds on exit 0 and fails with the exit code otherwise", async () => {
    const folder = mkdtempSync(join(tmpdir(), "atlas-launcher-"));
    const script = join(folder, "launcher.sh");
    const out = join(folder, "arguments.txt");
    writeFileSync(
      script,
      `#!/bin/sh\nprintf '%s\\n' "$@" > '${out}'\n[ "$4" = "${request.sessionId}" ] || exit 3\n`,
    );
    chmodSync(script, 0o755);
    await commandLineLauncher([script]).restart(request);
    expect(readFileSync(out, "utf8")).toContain("--config-directory");
    await expect(
      commandLineLauncher([script]).restart({ ...request, sessionId: "other" }),
    ).rejects.toThrow("the launcher exited with code 3");
  });
});

describe("the accounts file", () => {
  test("reads accounts, the mode and the launcher, with the mode off by default", () => {
    const read = parseAccountsFile(
      JSON.stringify({
        accounts: [
          { name: "ultra-a", directory: "~/.claude-ultra-a" },
          { name: "ultra-b", directory: "/accounts/ultra-b" },
        ],
        launcher: ["/usr/local/bin/claude-switch"],
      }),
      "/Users/example",
    );
    expect(read).toEqual({
      settings: {
        mode: "off",
        maxAgeMinutes: 30,
        accounts: [
          { name: "ultra-a", directory: "/Users/example/.claude-ultra-a" },
          { name: "ultra-b", directory: "/accounts/ultra-b" },
        ],
      },
      launcher: ["/usr/local/bin/claude-switch"],
    });
  });

  test("refuses a duplicate or unsafe account name, or an unknown field", () => {
    const file = (body: object) => () =>
      parseAccountsFile(JSON.stringify(body), "/Users/example");
    expect(
      file({
        accounts: [
          { name: "ultra-a", directory: "/a" },
          { name: "ultra-a", directory: "/b" },
        ],
      }),
    ).toThrow();
    expect(
      file({ accounts: [{ name: "Ultra A", directory: "/a" }] }),
    ).toThrow();
    expect(
      file({ accounts: [{ name: "ultra-a", directory: "/a" }], mode: "on" }),
    ).toThrow();
  });

  test("turns the session reader on with one folder per account", () => {
    const folder = mkdtempSync(join(tmpdir(), "atlas-accounts-file-"));
    const path = join(folder, "accounts.json");
    writeFileSync(
      path,
      JSON.stringify({
        accounts: [{ name: "ultra-a", directory: "/accounts/ultra-a" }],
        switch: "dry",
      }),
    );
    const sessions = readConfiguration({
      ATLAS_CLAUDE_ACCOUNTS_FILE: path,
    }).sessions;
    expect(sessions?.directory).toBeUndefined();
    expect(sessions?.accounts?.settings.mode).toBe("dry");
    expect(sessions?.accounts?.settings.accounts[0]?.name).toBe("ultra-a");
  });
});
