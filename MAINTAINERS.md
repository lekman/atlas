# Maintainers

How Atlas is built, tested and released. For what Atlas is and how to install
it, see the [README](README.md).

## Set Up

You need [mise](https://mise.jdx.dev). It installs the pinned Bun, Node,
go-task and Trunk.

```sh
if ! command -v mise &>/dev/null; then
  if command -v brew &>/dev/null; then brew install mise; else curl https://mise.run | sh; fi
fi
mise install && task setup && task storybook
```

`task setup` installs dependencies, the git hooks, the Chromium the story
tests run in, and your local client term list. The rules for commits, the
client term list and pull requests are in [Contributing](docs/CONTRIBUTING.md).

## What the Repository Holds

| Path                      | What it is                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/console` | The console: frame, top bar, rail, Missions and their stories                                                         |
| `apps/sidebar`            | The page app. `bun run build:console` builds the console to one HTML file; `bun run build` builds the earlier sidebar |
| `apps/server`             | The Atlas server: the API, MCP for agents, and the pages at `/console` and `/sidebar`                                 |
| `apps/collector`          | Reads Claude Code sessions on a machine and reports their status to Atlas                                             |
| `packages/core`           | The data model                                                                                                        |
| `packages/runtime`        | How a page reaches its data: the Claude artifact runtime or the Atlas server                                          |
| `packages/worlds`         | The map worlds. Astronomer is the only one supported                                                                  |

The full design of the server, the data model and who may connect is in
[Architecture](docs/architecture.md). How Atlas judges signals and runs work
as experiments is in [The Standard Workflow](docs/workflow/README.md).

## One Theme

The console uses the Astronomer look only, and no other theme is supported
for now. The other five worlds (Mariner, Woodsman, Gardener, Samurai, Doctor)
remain in `packages/worlds` and in Storybook for the earlier full-page map.
Do not add theme options to the console. See [Worlds](docs/worlds.md) for
the map's vocabulary.

## Stack

- **Runtime:** Bun, TypeScript 6 (strict)
- **Validation:** Zod
- **UI:** React 19, Storybook 10
- **Tests:** `bun test`; stories as browser tests through Vitest and
  Playwright, with axe
- **Tooling:** Turbo, go-task, mise, Trunk, Husky
- **CI:** GitHub Actions on hosted runners, CodeQL, dependency review,
  OpenSSF Scorecard, Storybook on GitHub Pages, Release Please

## Test

| Command                                    | What it checks                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `bun test`                                 | Unit tests across the workspace                                                               |
| `task test:stories`                        | Every story as a browser test, with axe                                                       |
| `bun run --cwd apps/sidebar check:console` | The built console under the VS Code policy at four sizes, with Done, Move and an offline move |
| `bun run --cwd apps/sidebar check`         | The same for the earlier sidebar                                                              |

The pre-push hook runs the unit tests, the story tests, a security scan and
the client-content check over the history.

## Release and Deploy

- Release Please opens the version pull request from conventional commits.
- On the Mac mini, `deploy.sh` checks out `origin/main` in the service
  checkout, builds the sidebar and the console with the machine's
  configuration, and restarts the server, the demo and the collector.
- The console test artifact is republished from the same build, with the
  capabilities listed in the README's Claude desktop section plus the
  Cloudflare D1 connector for the phone inbox and `db` for the stored copy.

## Client Content

Atlas is for client work, so the repository holds none. Every example runs on
an invented consultancy and four invented clients. Commits are scanned for
client names before they exist, and again in CI. See
[No Client Content, Ever](.claude/rules/client-content.md).

## Related

[lekman/ai-toolkit](https://github.com/lekman/ai-toolkit) holds the rest of
the setup:

- the planner VS Code extension (`packages/vscode-planner`), which shows the
  sidebar in a VS Code view;
- the tasks server (`packages/tasks-mcp`), which holds the worklist;
- the live dashboard practice, with the sync scripts and the local MCP server
  the pages read.

## Security

See [Security](SECURITY.md).
