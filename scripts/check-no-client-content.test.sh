#!/usr/bin/env bash
# Tests for check-no-client-content.sh: every mode, against a planted term in
# a throwaway repository, including the ways a scanner can quietly pass (a
# binary file, a file name, a rename, a name with a space, an author field,
# an invalid regex, a missing or empty list in CI).
#
# Run with `bun run test`, which runs this after the unit tests.
set -u
S="$(git rev-parse --show-toplevel)/scripts/check-no-client-content.sh"
t=$(mktemp -d)
message=$(mktemp)
failures=0
cd "$t" || exit 1
git init -q && git config user.email t@example.com && git config user.name t && git config commit.gpgsign false
mkdir scripts && cp "$S" scripts/ && printf 'scripts/client-terms.txt\n' >.gitignore
printf '# comment\nzebracorp\n' >scripts/client-terms.txt
# Locally, whatever the machine running the tests says; in CI, as CI.
run() {
	env -u CI bash scripts/check-no-client-content.sh "$@" >/dev/null 2>&1
	echo $?
}
run_in_ci() {
	CI=true bash scripts/check-no-client-content.sh >/dev/null 2>&1
	echo $?
}
expect() {
	local want=$1 got=$2 name=$3
	if [ "$want" = "$got" ]; then
		echo "ok   $name"
	else
		echo "FAIL $name: wanted exit $want, got $got"
		failures=$((failures + 1))
	fi
}
echo clean >a.txt
git add -A
git commit -qm init
expect 0 "$(run)" "clean tree passes"
expect 0 "$(run --history)" "clean history passes"
expect 0 "$(run --messages)" "clean messages pass"
printf "ZebraCorp invoice\n" >"$message"
expect 1 "$(run --message "$message")" "message, mixed case"
printf '## Zebracorp rollout\n' >"$message"
expect 0 "$(run --message "$message")" "message skips git's comment lines"
expect 1 "$(run --text "$message")" "text reads a Markdown heading"
printf '\x00\x01zebracorp\x00' >bin.dat
git add bin.dat
expect 1 "$(run --staged)" "staged binary"
git rm -q --cached bin.dat
rm bin.dat
echo hi >"zebracorp-notes.md"
git add -A
expect 1 "$(run --staged)" "staged file name"
git rm -q --cached zebracorp-notes.md
rm zebracorp-notes.md
echo "x zebracorp" >"my notes.md"
git add -A
expect 1 "$(run --staged)" "staged name with a space"
git commit -qm "notes"

git mv "my notes.md" moved.md
echo "edit" >>moved.md
git add -A
expect 1 "$(run --staged)" "staged rename"
git reset -q --hard
git rm -q "my notes.md"
git commit -qm "remove"
expect 0 "$(run)" "tree clean after removal"
expect 1 "$(run --history)" "history still holds it"
mkdir -p d && echo ok >d/zebracorp.txt && git add -A && git commit -qm "dir"
expect 1 "$(run)" "nested file name"
git rm -rq d
git commit -qm rm
echo ok >zebracorpTop.md
git add -A
git commit -qm top
git rm -q zebracorpTop.md
git commit -qm rm2
expect 1 "$(run --history)" "top-level name in history"
git -c user.name="ZebraCorp Person" commit -q --allow-empty -m "neutral"
expect 1 "$(run --messages)" "author name"
printf '{"zebracorp-sdk": ["zebracorp-sdk@1.0.0", "", {}, "sha512-AbC/zebracorp+=="]}\n' >bun.lock
expect 1 "$(run)" "package name in lockfile"
printf '{"x": ["x@1.0.0", "", {}, "sha512-zebracorpQQ=="]}\n' >bun.lock
out=$(bash scripts/check-no-client-content.sh 2>&1)
if grep -q "bun.lock" <<<"$out"; then
	echo "FAIL an integrity hash in the lockfile was reported"
	failures=$((failures + 1))
else
	echo "ok   hash in lockfile ignored"
fi
rm bun.lock
printf 'zebra(corp\n' >scripts/client-terms.txt
expect 2 "$(run)" "invalid regex fails"
printf '# none\n' >scripts/client-terms.txt
expect 0 "$(run)" "empty list skips locally"
expect 1 "$(run_in_ci)" "empty list fails in CI"
rm scripts/client-terms.txt
expect 0 "$(run)" "missing list skips locally"
expect 1 "$(run_in_ci)" "missing list fails in CI"
cd / && rm -rf "$t" "$message"
echo "client-content check: $failures failed"
[ "$failures" -eq 0 ]
