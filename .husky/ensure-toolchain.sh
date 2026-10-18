#!/bin/sh
# Refuse to pass a hook when the toolchain is missing.
#
# Without this, a missing `trunk` or `bun` lets the hook exit 0 and the commit
# goes through unchecked. A hook that silently passes is worse than no hook:
# it reports a check that never ran.
for tool in trunk bun task mise gitleaks; do
	if ! command -v "$tool" >/dev/null 2>&1; then
		echo "git hook: '$tool' is not on PATH, so the checks cannot run." >&2
		echo "Run 'mise install' to install the pinned toolchain." >&2
		echo "See docs/CONTRIBUTING.md for setup." >&2
		exit 1
	fi
done
