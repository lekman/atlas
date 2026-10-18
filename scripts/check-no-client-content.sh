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
# scripts/client-terms.example.txt. No list means no check, so a contributor
# who works with no clients is never blocked, except in CI: there the list is
# restored from a secret, and a missing or empty list fails, because a check
# that silently stops checking is worse than none.
#
# Everything is scanned: text and binary files alike, file and directory
# names, the lockfile (with its integrity hashes removed, which collide with
# short terms), commit messages, and author and committer names and emails.
# A term list line that is not a valid extended regex fails the check rather
# than matching nothing.
#
# Modes:
#   (none)      tracked + untracked-but-not-ignored files in the working tree
#   --staged    the staged blobs only, as the pre-commit hook runs it
#   --history   every blob in every reachable commit
#   --message <file>  one commit message, as the commit-msg hook runs it
#   --text <file>     any text, every line, such as a pull request's title,
#                     description and branch name
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
IN_CI="${CI:-}"

if [ ! -f "$TERMS_FILE" ]; then
	if [ -n "$IN_CI" ]; then
		echo "check-no-client-content: no $TERMS_FILE in CI. Set the CLIENT_TERMS secret." >&2
		exit 1
	fi
	echo "check-no-client-content: no $TERMS_FILE, skipping."
	echo "  cp scripts/client-terms.example.txt $TERMS_FILE and fill it in."
	exit 0
fi

PATTERN=$(grep -vE '^\s*(#|$)' "$TERMS_FILE" | paste -sd'|' -)
if [ -z "$PATTERN" ]; then
	if [ -n "$IN_CI" ]; then
		echo "check-no-client-content: $TERMS_FILE has no terms in CI." >&2
		exit 1
	fi
	echo "check-no-client-content: $TERMS_FILE has no terms, skipping."
	exit 0
fi

# A broken line makes grep exit 2, which a plain `if grep` reads as clean.
# Test the whole pattern once, without printing it.
grep -E -- "$PATTERN" </dev/null >/dev/null 2>&1
if [ $? -eq 2 ]; then
	echo "check-no-client-content: $TERMS_FILE holds a line that is not a valid extended regex." >&2
	exit 2
fi

# These files necessarily name the thing they look for.
EXCLUDE='^(scripts/check-no-client-content\.sh|scripts/client-terms(\.example)?\.txt)$'

# Pull --quiet out of the arguments so it can appear anywhere without being
# mistaken for a mode, a range or a message path.
QUIET=0
ARGS=()
for arg in "$@"; do
	if [ "$arg" = "--quiet" ]; then QUIET=1; else ARGS+=("$arg"); fi
done

MODE="${ARGS[0]:-worktree}"
HITS=""
FAILED=0

# Prefix every line on stdin, for indented reports.
indent() {
	local line
	while IFS= read -r line; do printf '%s%s\n' "$1" "$line"; done
}

# Content on stdin, made scannable: the lockfile loses its integrity hashes,
# which are random base64 and collide with short terms. Every other file,
# binary included, passes through unchanged.
prepare() {
	if [ "$1" = "bun.lock" ]; then
		sed -E 's/"sha(1|256|384|512)-[A-Za-z0-9+\/=]+"//g'
	else
		cat
	fi
}

# Scan stdin. Prints up to three matching lines, cut short, unless quiet.
# Returns 0 on a match and 1 on none; a grep error sets FAILED.
scan() {
	local found status
	found=$(grep -a -i -n -E -- "$PATTERN" | head -3 | cut -c1-200)
	status=${PIPESTATUS[0]}
	if [ "$status" -eq 2 ]; then
		FAILED=1
		return 1
	fi
	[ -n "$found" ] || return 1
	[ "$QUIET" -eq 1 ] || printf '%s\n' "$found"
	return 0
}

# A path whose name matches is a hit whatever its content.
name_matches() {
	printf '%s\n' "$1" | grep -iqE -- "$PATTERN"
}

case "$MODE" in
--message | --text)
	# Trunk does not expand ${TRUNK_GIT_STDIN_FILE} in an action's `run:`, so
	# the path arrives empty when this runs as a trunk action. Read it from the
	# environment instead, then fall back to git's own message file. Relying on
	# the argument alone made the hook fire and then fail on an empty path,
	# which at least failed loudly, unlike the hook that never fired at all.
	FILE="${ARGS[1]:-}"
	[ -n "$FILE" ] || FILE="${TRUNK_GIT_STDIN_FILE:-}"
	[ -n "$FILE" ] || FILE="$(git rev-parse --git-dir)/COMMIT_EDITMSG"
	[ -f "$FILE" ] || {
		echo "check-no-client-content: no message file at '$FILE'" >&2
		exit 2
	}
	# A commit message skips the comment lines git adds to its template; they
	# are never committed. Other text is read whole: a Markdown heading starts
	# with # too.
	if [ "$MODE" = "--message" ]; then
		filter=(grep -vE '^\s*#')
	else
		filter=(cat)
	fi
	if match=$("${filter[@]}" "$FILE" | scan); then
		if [ "$QUIET" -eq 1 ]; then
			HITS="the message names a protected term"
		else
			HITS="$match"
		fi
	fi
	;;

--messages)
	# The message and who wrote and committed it: an author field is as
	# public as the message.
	RANGE="${ARGS[1]:-HEAD}"
	while IFS= read -r sha; do
		if git log -1 --format='%an%n%ae%n%cn%n%ce%n%B' "$sha" | scan >/dev/null; then
			if [ "$QUIET" -eq 1 ]; then
				HITS="${HITS}${sha}
"
			else
				HITS="${HITS}${sha:0:8} $(git log -1 --format=%s "$sha" | cut -c1-60)
"
			fi
		fi
	done < <(git rev-list "$RANGE")
	;;

--history)
	# Every path and every object once. A path is reported when its name or
	# any version of its content matches; each path once.
	HITS=$(git rev-list --objects --all | sort -u -k2 | while read -r sha path; do
		if [ -n "$path" ]; then
			printf '%s\n' "$path" | grep -qE "$EXCLUDE" && continue
			if name_matches "$path"; then
				echo "$path (its name)"
				continue
			fi
		fi
		[ "$(git cat-file -t "$sha" 2>/dev/null)" = "blob" ] || continue
		if git cat-file -p "$sha" 2>/dev/null | prepare "$path" | scan >/dev/null; then
			echo "${path:-$sha}"
		fi
	done | sort -u)
	;;

--staged)
	# Added, copied, modified and renamed, read NUL-separated so a name with
	# spaces is one name.
	while IFS= read -r -d '' f; do
		printf '%s\n' "$f" | grep -qE "$EXCLUDE" && continue
		if name_matches "$f"; then
			HITS="${HITS}${f} (its name)
"
			continue
		fi
		if match=$(git show ":$f" 2>/dev/null | prepare "$f" | scan); then
			HITS="${HITS}${f}:
$(indent '    ' <<<"$match")
"
		fi
	done < <(git diff --cached --name-only -z --diff-filter=ACMR)
	;;

*)
	while IFS= read -r -d '' f; do
		printf '%s\n' "$f" | grep -qE "$EXCLUDE" && continue
		[ -f "$f" ] || continue
		if name_matches "$f"; then
			HITS="${HITS}${f} (its name)
"
			continue
		fi
		# prepare only reads its argument as a name, never the file.
		# shellcheck disable=SC2094
		if match=$(prepare "$f" <"$f" | scan); then
			HITS="${HITS}${f}:
$(indent '    ' <<<"$match")
"
		fi
	done < <(git ls-files -z --cached --others --exclude-standard)
	;;
esac

if [ "$FAILED" -ne 0 ]; then
	echo "check-no-client-content: grep failed while scanning; treating as a failure." >&2
	exit 2
fi

if [ -n "$HITS" ]; then
	echo "BLOCKED: client-identifying content found." >&2
	indent '  ' <<<"$HITS" >&2
	echo >&2
	if [ "$QUIET" -eq 1 ]; then
		echo "Re-run locally without --quiet to see the term and where it is." >&2
	else
		echo "Replace with a placeholder (Acme, Globex, PROJ-123, acme-platform)." >&2
	fi
	if [ "$MODE" = "--messages" ] || [ "$MODE" = "--message" ] || [ "$MODE" = "--text" ]; then
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
