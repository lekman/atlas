#!/bin/sh
# SessionStart tripwire: warn (do not enforce) when the commit-hook guard rails
# look degraded. POSIX sh on purpose — it must run even when bun is the thing
# that is missing. Visibility only; version control, Dependabot, and secret
# scanning are the layers that actually catch what slips through.

dir="${CLAUDE_PROJECT_DIR:-.}"
warn=""

command -v bun >/dev/null 2>&1 || warn="$warn\n- bun is not on PATH: the precise no-verify guard hook will fail open (the deny rules still apply)."
[ -f "$dir/.claude/hooks/no-verify-guard.ts" ] || warn="$warn\n- .claude/hooks/no-verify-guard.ts is missing: the precise commit-hook guard is gone."
grep -q 'commit --no-verify' "$dir/.claude/settings.json" 2>/dev/null || warn="$warn\n- the no-verify deny backstop was not found in .claude/settings.json."

if [ -n "$warn" ]; then
	printf 'Guard-rail tripwire — degraded:%b\nThese are warnings, not blocks. See .claude/rules/security-gates.md.\n' "$warn"
fi
exit 0
