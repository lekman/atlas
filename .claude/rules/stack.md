# Atlas Stack Standards

Atlas follows the same stack as the other repositories by the same author,
with two differences that come from being public: CI runs on GitHub-hosted
runners, and the free security features GitHub gives public repositories
are switched on.

## Runtime and Language

- **Runtime:** Bun. Use Bun APIs over Node equivalents where available.
- **Language:** TypeScript 6, strict, with `noUncheckedIndexedAccess`. No
  JavaScript files.
- **Module system:** ESM (`"type": "module"` in every package.json).
- **Validation:** Zod 4, imported from `zod/v4`. The MCP SDK accepts Zod 4,
  and the root `package.json` overrides `zod` so the SDK shares our one
  copy. Zod 3 had no fix for GHSA-mrhx-c7xc-m3w5.

## Testing

- **Unit tests:** `bun test`, imported explicitly from `bun:test`.
- **Stories:** every story is a browser test through Vitest and Playwright,
  in `apps/storybook`. This is the one place Vitest is allowed, because
  `bun test` cannot drive a browser and accessibility checks need a laid-out
  page.
- **Coverage target:** 80% or more on `packages/core` and the pure parts of
  `packages/worlds` (layout, scene, SVG snapshot).

## Linting and Formatting

Trunk runs everything: Prettier, markdownlint, yamllint, shellcheck, shfmt,
actionlint, pinact, and the security scanners. Do not add ESLint.

## Build Orchestration

- **Monorepo:** Turbo (`turbo.json`). Tasks: `build`, `typecheck`, `test`,
  `test:coverage`.
- **Developer commands:** go-task (`task --list`).
- **Tools:** mise (`.mise.toml`).

## Packages

| Package           | Holds                                                       | Depends on          |
| ----------------- | ----------------------------------------------------------- | ------------------- |
| `@atlas/core`     | The data model, events, needs-you, and the boundary rules   | Zod                 |
| `@atlas/fixtures` | The invented sample dataset and the scripted day of events  | core                |
| `@atlas/worlds`   | Layout, scene, canvas and SVG renderers, sounds, per world  | core                |
| `@atlas/ui`       | React components and their stories                          | core, worlds, React |
| `apps/storybook`  | Storybook configuration, story tests, the published preview | ui, fixtures        |

`core` and `worlds` never import React. A world must draw from a plain
canvas or produce an SVG string, so the same code serves the web app, the
Claude Artifact and the still map in a Claude Code plugin.

## CI/CD

- **Runner:** `ubuntu-latest`. This repository is public, so GitHub-hosted
  minutes are free and no self-hosted runner ever sees a fork's code.
- **SHA pinning:** every external `uses:` is pinned to a commit with a
  version comment.
- **Required check:** `Quality Gate` only.
