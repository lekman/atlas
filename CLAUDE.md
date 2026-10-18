# CLAUDE.md

Guidance for Claude Code (and anyone else) working in this repository. The
enforceable rules are in [.claude/rules/](.claude/rules/) and load
automatically.

## What This Repository Is

Atlas is a live map of agents, clients and the work between them: groups of
AI agents and scripts, which client each serves, and the requirements,
backlog, open questions and decisions they connect to. It replaces a
Markdown dashboard with a database and draws the result as a world you
choose. The first release has two worlds, Astronomer and Mariner.

**This repository is public under the MIT licence.** Nothing that
identifies a client, an employer, a person at either, or an engagement may
appear in it, in any file or commit message. Use the invented dataset in
`packages/fixtures`. Read [No Client Content, Ever](.claude/rules/client-content.md)
before writing an example.

## Commands

Use `task` rather than calling `bun` directly. `task --list` shows all.

```bash
task setup           # One-time: tools, dependencies, hooks, browser, term list
task quality         # Lint, typecheck, unit tests, story tests, client content
task storybook       # http://localhost:6006
task security        # Secrets, dependency CVEs, workflow configuration
```

One test file: `bun test packages/core/tests/core.test.ts`. One test by
name: `bun test -t 'substring'`.

## Layout

| Path                | What it holds                                                 |
| ------------------- | ------------------------------------------------------------- |
| `packages/core`     | Data model, events, needs-you, boundary rules. Zod, no React  |
| `packages/fixtures` | The invented dataset and a scripted day of events             |
| `packages/worlds`   | Layout, scene, canvas and SVG renderers and sounds, per world |
| `packages/ui`       | React components and their stories                            |
| `apps/storybook`    | Storybook configuration, story tests, the Pages build         |
| `docs/`             | Architecture, worlds, contributing, repository settings       |

Planned next, not yet here: `apps/server` (Bun, SQLite, MCP, Litestream, on
a Mac mini over Tailscale), `apps/web` (the PWA for iPhone), `apps/artifact`
(the Claude desktop sidebar build), `apps/plugin` (a thin Claude Code
plugin). See [Architecture](docs/architecture.md).

## Skills Come From lekman/ai-toolkit

[.claude/settings.json](.claude/settings.json) declares the
[lekman/ai-toolkit](https://github.com/lekman/ai-toolkit) marketplace and
enables `git`, `tone` and `dependabot`. Use `tone` for any Markdown.

## The Commit Hooks

Husky owns the hooks. `bun install` reinstalls them through `prepare`.

| Hook         | Runs                                                                                  |
| ------------ | ------------------------------------------------------------------------------------- |
| `pre-commit` | Identity, client content in staged files, `trunk check`, typecheck                    |
| `commit-msg` | Client content in the message                                                         |
| `pre-push`   | The above, unit tests, story tests, the security sweep, client content in all history |

**Never use `--no-verify`.** A hook in `.claude/hooks/` blocks it for
agents. See [Security Gates Are Not Optional](.claude/rules/security-gates.md).

## Designing a World

Read [Rules Every World Keeps](.claude/rules/worlds.md). Status colours,
plain button words, the real term one step away, motion only from events,
sound only when asked.

## Signed Commits

Commits are signed and show "Verified" on GitHub. `git log -1 --format='%G?'`
must print `G`.
