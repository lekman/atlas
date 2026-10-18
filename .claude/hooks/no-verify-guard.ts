#!/usr/bin/env bun
// PreToolUse(Bash) guard: an agent must not circumvent the commit hooks.
// It may propose changing them, but a human approves the change (see
// .claude/rules/security-gates.md). Keep this small: one file, a few
// patterns, no framework.

/** Returns a reason if the shell command tries to bypass git hooks, else null. */
export function findBypass(command: string): string | null {
  // Inspect each sub-command separately so a dry-run push (`-n`) in one segment
  // does not get blamed on a `commit` in another. Quoted text is stripped so a
  // `-n` or `--no-verify` inside a commit message is ignored.
  for (const raw of command.split(/&&|\|\||[;|\n]/)) {
    // Quoted text handed to another shell is a command, not a message:
    // `sh -c 'git commit --no-verify'` is checked as the command it runs.
    if (/\b(sh|bash|zsh|dash)\s+-\w*c\b|\beval\b|\bxargs\b/.test(raw)) {
      for (const [, single, double] of raw.matchAll(/'([^']*)'|"([^"]*)"/g)) {
        const inner = findBypass(single ?? double ?? "");
        if (inner) return inner;
      }
    }
    const segment = raw.replace(/'[^']*'/g, " ").replace(/"[^"]*"/g, " ");
    if (/(^|\s)--no-verify(\s|=|$)/.test(segment))
      return "`--no-verify` skips git hooks";
    if (/\bcommit\b/.test(segment) && /(^|\s)-n(\s|$)/.test(segment))
      return "`git commit -n` skips git hooks";
    if (/core\.hooksPath/.test(segment))
      return "overriding `core.hooksPath` bypasses git hooks";
    if (
      /(^|\s)(HUSKY|HUSKY_SKIP_HOOKS|PRE_COMMIT_ALLOW_NO_CONFIG|LEFTHOOK)=/.test(
        segment,
      )
    )
      return "a hook-skip env var disables git hooks";
  }
  return null;
}

if (import.meta.main) {
  let payload: { tool_name?: string; tool_input?: { command?: string } };
  try {
    payload = JSON.parse(await Bun.stdin.text());
  } catch {
    process.exit(0); // not our concern; let the normal flow proceed
  }
  if (payload.tool_name === "Bash") {
    const reason = findBypass(payload.tool_input?.command ?? "");
    if (reason) {
      const message = `${reason}. An agent must not circumvent commit hooks — ask the repo owner to change or relax the hook; only a human may approve that.`;
      // Belt and suspenders: the structured JSON deny and exit code 2 each block
      // a PreToolUse call on their own, so emit both.
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: message,
          },
        }),
      );
      console.error(message);
      process.exit(2);
    }
  }
  process.exit(0);
}
