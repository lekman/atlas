# PR Author Owns CI Until Green

When you open a pull request, you own it until CI passes. Do not hand the task off, reassign it, or mark it done until all required checks are green.

## Required Behaviour

1. After `gh pr create`, immediately check CI status: `gh pr checks <number> --watch` or poll with `gh pr checks <number>`.
2. If any check fails, investigate and fix on the same branch. Push the fix and re-check.
3. Only mark the task as ready for review or done after the quality gate passes.
4. If a failure is outside your control (flaky infra, upstream dependency), comment on the PR explaining the failure and escalate — do not silently hand off a red PR.
