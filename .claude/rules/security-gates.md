# Security Gates Are Not Optional

The git hooks, the security scanners and the client-content check apply to
AI agents exactly as they apply to people. An agent runs faster than a
reviewer reads, so an agent that skips a gate does more damage than a person
who skips one.

## Never Bypass a Hook

Do not pass `--no-verify` to `git commit` or `git push`. Do not set
`core.hooksPath` to anything other than `.husky/_`. Do not remove or edit a
hook to make a commit go through. `.claude/hooks/no-verify-guard.ts` blocks
the common forms; the rule covers the rest.

If a hook fails, fix the cause. The same checks run in CI, so a bypass moves
the failure rather than removing it.

## Never Disable a Scanner to Pass

`gitleaks` and `trufflehog` (secrets), `osv-scanner` (dependency CVEs) and
`checkov` (workflow configuration) run from `.trunk/trunk.yaml`. Do not
remove a linter from `lint.enabled`, and do not add a path to `lint.ignore`,
to make a finding go away.

Do not enable the `trunk-check-pre-push` or `trunk-fmt-pre-commit` actions.
They take over `core.hooksPath` and silently disable the husky hooks.

When a finding is wrong, suppress that one finding where a reviewer can see
it:

| Finding | Suppress in                        | Must include                         |
| ------- | ---------------------------------- | ------------------------------------ |
| Secret  | `.gitleaksignore`                  | The fingerprint and a reason         |
| CVE     | `osv-scanner.toml`                 | The advisory ID, reason, review date |
| Other   | `trunk-ignore` comment on the line | A reason                             |

## The Client-Content Check Has No Suppression

There is no ignore file for it, on purpose. A match is either a real client
term, which must go, or a term list entry that is too broad, which you fix
in your own `scripts/client-terms.txt`. See
[No Client Content, Ever](client-content.md).

## Never Commit a Real Secret, Even Briefly

Do not write a live credential, token or key into a file, a fixture, or a
commit message, even meaning to remove it later. Git keeps history, and this
history is public. Use `.env` locally (gitignored) and the macOS Keychain for
anything the Mac mini server reads.

## Handle a CVE Properly

1. Upgrade the dependency, then commit the updated `bun.lock`.
2. Upgrade the parent package, when the flaw is in a transitive dependency.
3. Suppress it, only when neither works and our code cannot reach the flaw,
   and state the reasoning in the pull request.

## When You Cannot Comply

Stop and say so. Report the finding, what you tried, and why it is blocked.
A blocked task the owner knows about is recoverable; a bypassed gate
discovered later is not.
