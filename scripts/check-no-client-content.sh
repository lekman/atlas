#!/usr/bin/env bash
# Fail if client-identifying content reaches this public repository.
#
# The repo is published. Client names, their repository names, ticket keys and
# meeting titles must never appear in it — examples use placeholders (Acme,
# Globex, PROJ-nnn). See .claude/rules/client-content.md.
#
# Terms live in scripts/client-terms.txt, one extended-regex per line, so the
# list can be updated without touching this script. That file is gitignored:
# it would otherwise be the leak it exists to prevent. Start from
# scripts/client-terms.example.txt. No list means no check — a contributor who
# works with no clients is never blocked.
#
# Modes:
#   (none)      tracked + untracked-but-not-ignored files in the working tree
#   --staged    the staged blobs only, as the pre-commit hook runs it
#   --history   every blob in every reachable commit
#   --message <file>  one commit message, as the commit-msg hook runs it
#   --messages [range]  every commit message in a range (default: all)
#   --quiet     report locations only — never the matched text
#
# Commit messages need the same rule as file content, and are worse to get
# wrong. They travel further — pull request titles, notifications, release
# notes, a `git log` pasted into an issue — and a changelog generator turns
# them into a shipped artefact. They are also the one thing a later cleanup
# cannot fix quietly: redacting a file is a commit, redacting a message is a
# history rewrite.
#
# --quiet exists for CI. A failure report that quotes the match puts the very
# string this check protects into a build log, which is public for a public
# repo. Locally the full context is printed, because the machine running it
# already holds the term list.
#
# --staged reads staged *content*, not the file on disk. A partially staged
# file can differ from its working copy, and the commit records the staged one.
#
# --history is the check that catches a leak already committed. The working
# tree going clean does not clean the history behind it: a fix commit corrects
# the tip and leaves the earlier blob exactly where it was, published. Stale
# local branches count as reachable, so prune before reading its output as a
# statement about what is published.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 2

TERMS_FILE="scripts/client-terms.txt"
if [ ! -f "$TERMS_FILE" ]; then
  echo "check-no-client-content: no $TERMS_FILE — skipping."
  echo "  cp scripts/client-terms.example.txt $TERMS_FILE and fill it in."
  exit 0
fi

PATTERN=$(grep -vE '^\s*(#|$)' "$TERMS_FILE" | paste -sd'|' -)
if [ -z "$PATTERN" ]; then
  echo "check-no-client-content: $TERMS_FILE has no terms — skipping."
  exit 0
fi

# The lockfile's integrity hashes collide with short terms, and these two files
# necessarily name the thing they look for.
EXCLUDE='^(bun\.lock|scripts/check-no-client-content\.sh|scripts/client-terms(\.example)?\.txt)$'

# Pull --quiet out of the arguments so it can appear anywhere without being
# mistaken for a mode, a range or a message path.
QUIET=0
ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--quiet" ]; then QUIET=1; else ARGS+=("$arg"); fi
done

MODE="${ARGS[0]:-worktree}"
HITS=""

# Prefix every line on stdin, for indented reports.
indent() {
  local line
  while IFS= read -r line; do printf '%s%s\n' "$1" "$line"; done
}

case "$MODE" in
  --message)
    # Trunk does not expand ${TRUNK_GIT_STDIN_FILE} in an action's `run:`, so
    # the path arrives empty when this runs as a trunk action. Read it from the
    # environment instead, then fall back to git's own message file. Relying on
    # the argument alone made the hook fire and then fail on an empty path —
    # which at least failed loudly, unlike the hook that never fired at all.
    FILE="${ARGS[1]:-}"
    [ -n "$FILE" ] || FILE="${TRUNK_GIT_STDIN_FILE:-}"
    [ -n "$FILE" ] || FILE="$(git rev-parse --git-dir)/COMMIT_EDITMSG"
    [ -f "$FILE" ] || {
      echo "check-no-client-content: no message file at '$FILE'" >&2
      exit 2
    }
    # Skip the comment lines git adds to the template; they are never committed.
    match=$(grep -vE '^\s*#' "$FILE" | grep -InE "$PATTERN")
    if [ -n "$match" ]; then
      if [ "$QUIET" -eq 1 ]; then
        HITS="the commit message names a protected term"
      else
        HITS=$(indent '    ' <<<"$match")
      fi
    fi
    ;;

  --messages)
    RANGE="${ARGS[1]:-}"
    while IFS= read -r sha; do
      if git log -1 --format=%B "$sha" | grep -IiqE "$PATTERN"; then
        if [ "$QUIET" -eq 1 ]; then
          HITS="${HITS}${sha}
"
        else
          HITS="${HITS}${sha:0:8} $(git log -1 --format=%s "$sha" | cut -c1-60)
"
        fi
      fi
    done < <(git rev-list "${RANGE:-HEAD}")
    ;;

  --history)
    # Walk every blob once. Paths repeat across commits; report each path once.
    HITS=$(git rev-list --objects --all \
      | awk 'NF>1 {print $1" "$2}' \
      | while read -r sha path; do
        echo "$path" | grep -qE "$EXCLUDE" && continue
        if git cat-file -p "$sha" 2>/dev/null | grep -IiqE "$PATTERN"; then
          echo "$path"
        fi
      done | sort -u)
    ;;

  --staged)
    FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -vE "$EXCLUDE")
    for f in $FILES; do
      match=$(git show ":$f" 2>/dev/null | grep -IinE "$PATTERN" | head -3)
      if [ -n "$match" ]; then
        HITS="${HITS}${f}:
$(indent '    ' <<<"$match")
"
      fi
    done
    ;;

  *)
    FILES=$(git ls-files --cached --others --exclude-standard | grep -vE "$EXCLUDE")
    [ -z "$FILES" ] && exit 0
    HITS=$(printf '%s\n' "$FILES" | tr '\n' '\0' \
      | xargs -0 grep -IinE "$PATTERN" 2>/dev/null)
    ;;
esac

if [ -n "$HITS" ]; then
  echo "BLOCKED: client-identifying content found." >&2
  indent '  ' <<<"$HITS" >&2
  echo >&2
  if [ "$QUIET" -eq 1 ]; then
    echo "Re-run locally without --quiet to see the term and where it is." >&2
  else
    echo "Replace with a placeholder (Acme, Globex, PROJ-123, acme-platform)." >&2
  fi
  if [ "$MODE" = "--messages" ] || [ "$MODE" = "--message" ]; then
    echo "For a message, describe the shape of the change instead of the party:" >&2
    echo "  bad   fix(api): stop importing Acme Ltd invoices" >&2
    echo "  good  fix(api): stop importing invoices billed to another tenant" >&2
  fi
  if [ "$MODE" = "--history" ]; then
    echo "Committed already: fixing the working tree is not enough. The blob" >&2
    echo "stays in history until it is rewritten." >&2
  fi
  exit 1
fi

echo "check-no-client-content: clean (${MODE#--})"
