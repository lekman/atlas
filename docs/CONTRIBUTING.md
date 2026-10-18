# Contributing

## Setup

You need [mise](https://mise.jdx.dev). It installs the pinned Bun, Node,
go-task and Trunk.

```sh
mise install
task setup
```

`task setup` installs dependencies, the git hooks, the Chromium the story
tests run in, and creates your local client term list.

## The Client Term List

This repository is public. Before your first commit, open
`scripts/client-terms.txt` (gitignored, created by `task setup`) and add
anything that identifies your own clients: names and short forms,
repository names, tracker keys, people. The hooks then refuse any commit
that contains one, in a file or in the message.

If you have no clients, leave the file as it is. An empty list skips the
check.

## Signed Commits

Commits must be signed and show "Verified" on GitHub.

```sh
git config commit.gpgsign true
git config gpg.format ssh
git config user.signingkey ~/.ssh/id_ed25519.pub
git log -1 --format='%G? %GS'   # G, then your identity
```

Add the key to GitHub twice: once as an authentication key and once as a
signing key.

## Working on the UI

Every component has stories in `packages/ui/src`. Run `task storybook`, and
use the **World** control in the toolbar to see each component in both
worlds. A new component needs a story; a story is a test.

## Before You Push

`task quality` runs what CI runs. The pre-push hook runs it too, plus the
security sweep and the client-content check over all history.

## Pull Requests

Conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`), because
Release Please writes the changelog from them. `Quality Gate` is the one
required check.
