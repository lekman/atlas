#!/usr/bin/env bash
# Runs Trunk on what changed since main, or on every file when there is no
# main to compare with.
#
# `trunk check --ci` compares against the merge base with origin/main. Before
# the first push there is no origin/main, and after a history rewrite there is
# no merge base, and Trunk then stops with an error instead of checking. In
# both cases this checks every file, which is stricter, never looser.
set -euo pipefail

upstream="origin/main"
if git rev-parse --verify --quiet "$upstream" >/dev/null &&
	git merge-base HEAD "$upstream" >/dev/null 2>&1; then
	exec trunk check --ci "$@"
fi

echo "trunk-check: no merge base with $upstream, so checking every file." >&2
exec trunk check --all --ci "$@"
