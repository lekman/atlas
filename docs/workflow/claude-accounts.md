# Claude Accounts

`claude-accounts` is a command you run by hand on the machine where your
Claude Code sessions run. It gives each Claude subscription its own
configuration folder (`CLAUDE_CONFIG_DIR`), signs it in, checks that it is
the account you meant, and writes the accounts file the Atlas server reads
from `ATLAS_CLAUDE_ACCOUNTS_FILE`. It is the first step of
[Setting Up Two Accounts](../architecture.md#setting-up-two-accounts), and
it feeds the [usage-limit signals](events.md#usage-limit-signals).

It is a script, not an agent. Each step stops at the first failure and
prints one line that says what to do.

## Install

The command is one file, built with Bun from `apps/claude-accounts`. The
file holds everything it needs, so the machine does not need this
repository. It needs Bun and Claude Code on the `PATH`.

```bash
bun install
bun run --cwd apps/claude-accounts build
# Copy the file to the machine, for example over SSH:
scp apps/claude-accounts/dist/claude-accounts.js <machine>:.local/bin/claude-accounts
ssh <machine> chmod 755 .local/bin/claude-accounts
```

`~/.local/bin` must be on the `PATH` there. Any folder on the `PATH` works.

## Set Up Two Accounts

Run these on the machine, in a terminal (an SSH session works). Each `add`
prints a sign-in link; open it in a browser, sign in with that account, and
paste the code back.

```bash
claude-accounts add ultra-a --email you@example.com
claude-accounts add ultra-b --email you+b@example.com
claude-accounts status
```

Then set `ATLAS_CLAUDE_ACCOUNTS_FILE` in the Atlas server's environment to
the path `add` printed, and restart the server. The switch rule stays `off`
until you change it in the file.

## Commands

Every command takes `--accounts-file <path>`. Without it the file is
`ATLAS_CLAUDE_ACCOUNTS_FILE`, or `~/.config/atlas/claude-accounts.json` when
that is not set. The shared folder is `~/.claude`.

### `add <name> --email <address> [--folder <path>]`

The name is lower-case words joined by hyphens. It appears in Atlas events,
so use an invented name, not an address. The folder is `~/.claude-<name>`
unless you give one. In order:

1. Creates the folder and links the shared items into it from `~/.claude`.
   It never replaces anything that is not already the right link; move it
   away and run again.
2. Runs `claude auth login --claudeai --email <address>` for the folder, in
   your terminal. Skipped when the folder is already signed in as that
   address.
3. Runs `claude auth status --json`. The folder must be signed in as the
   address you gave, and must not be on the same account (by address or
   account id) as another folder in the accounts file. If it is, the login
   is undone with `claude auth logout` and nothing is written.
4. Copies the user-scope MCP servers from `~/.claude.json` into the folder's
   own `.claude.json`. The folder's login (`oauthAccount`) is not touched.
5. Adds the account to the accounts file, or updates its folder. Other
   accounts and every other field stay, the switch mode included. A new
   file has `"switch": "off"`. The file is written whole, through a
   temporary file, readable by you only (mode 0600).

Running `add` again on a finished account only checks it again.

| Shared by a link to `~/.claude`                                                                                                                                                                                                               | Kept per folder                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `projects/`, `plugins/`, `skills/`, `rules/`, `hooks/`, `commander/`, `file-history/`, `todos/`, `routines/`, `scripts/`, `settings.json`, `CLAUDE.md`, `commander.json`, `history.jsonl`, and the files `CLAUDE.md` imports from `~/.claude` | `sessions/`, `.claude.json`, `.credentials.json`, `shell-snapshots/`, `session-env/` |

A shared folder that `~/.claude` does not have yet is created there; a
shared file it does not have is not linked. `sessions/` stays per folder
because the folder a session record is in is how Atlas knows its account.

### `login <name> [--email <address>]`

Signs one folder in again, for example after the login expired, with the
same checks as `add`. The address is the one you give, or else the one the
folder was signed in as before.

### `status [--json]`

One line per account: signed in or not and as which address, the usage
limit that holds now and when it resets, and how many live sessions use the
folder. It exits 1 when an account needs you: a folder is missing or signed
out, or every account is at a usage limit.

The limit comes from the end of the transcript of each session whose record
is in the folder's `sessions/`, read with `@atlas/collector` as the server
reads it. `projects/` is shared, so a transcript alone does not say which
account wrote it. A limit hit before that session's process started is
ignored, because it belongs to an earlier run. When no session record is
left in a folder, `status` cannot see that account's limit; the server keeps
each account's newest limit for that.

`--json` prints this shape. `version` changes only when a field is removed
or changes meaning; new fields can be added without it.

```json
{
  "version": 1,
  "checkedAt": "2026-11-09T12:00:00.000Z",
  "accountsFile": "/Users/you/.config/atlas/claude-accounts.json",
  "needsOwner": true,
  "reasons": ["Every account is at a usage limit"],
  "accounts": [
    {
      "name": "ultra-a",
      "directory": "/Users/you/.claude-ultra-a",
      "loggedIn": true,
      "email": "you@example.com",
      "usageLimit": {
        "kind": "weekly",
        "resetsAt": "2026-11-10T18:00:00.000Z",
        "at": "2026-11-09T11:07:13.085Z"
      },
      "liveSessions": 2,
      "problem": null
    }
  ]
}
```

| Field                 | Meaning                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `needsOwner`          | True when an account is missing, signed out or cannot be read, or every account is limited |
| `reasons`             | One sentence for each reason `needsOwner` is true                                          |
| `directory`           | The account folder, with `~/` expanded                                                     |
| `email`               | The address the folder is signed in as, or null                                            |
| `usageLimit.kind`     | `session` (the five-hour limit), `weekly` or `other`                                       |
| `usageLimit.resetsAt` | When it resets, or null when Claude Code gave no time                                      |
| `usageLimit.at`       | When a session hit it                                                                      |
| `liveSessions`        | Session records in the folder whose process is alive                                       |
| `problem`             | `folder-missing`, `logged-out`, `status-failed` or null                                    |

### `doctor`

Read-only checks, one line each, exit 1 when any fails: the accounts file
is valid, no two accounts share a folder, every folder exists with its
links intact, every folder is signed in, and no two folders are on one
account.

## What It Never Does

It never reads, prints or copies a login token. From `claude auth status
--json` it keeps `loggedIn` and `email`; from a folder's `.claude.json` it
reads `oauthAccount.accountUuid` and `oauthAccount.emailAddress` only. It
never opens `.credentials.json` or the Keychain. The MCP server list it
copies can hold a server's own key in its settings; it is written into the
folder's `.claude.json` (mode 0600) and never printed.

It does not start, stop or switch sessions. The launcher in the accounts
file does that, when the switch rule is on.
