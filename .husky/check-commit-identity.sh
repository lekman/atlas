#!/bin/sh
# Refuses a commit whose author email is outside the expected domain.
#
# Why a hook rather than documentation alone: the failure it prevents is silent.
# A commit made with a personal or machine-default address is signed correctly,
# passes every local check, and reads as a good signature in `git log`. The
# problem only surfaces on GitHub, where a signature counts as verified solely
# when the commit email is a verified address on the signing account. Where a
# ruleset enforces required_signatures, the wrong domain becomes a rejected push
# rather than a warning, and by then the commits already exist.
#
# CONFIGURING THE DOMAIN
#
# The domain is not hardcoded. Resolution order:
#
#   1. $COMMIT_EMAIL_DOMAIN            per-invocation override
#   2. git config commit.emailDomain   per-clone, the usual way
#   3. (empty)                         default for this repository
#
# Atlas is a public repository that anyone may contribute to, so no domain is
# enforced by default. Set one for your own clone if you keep several
# identities on one machine and want the hook to catch the wrong one:
#
#   git config commit.emailDomain "example.com"
#
# Set it empty to disable the check entirely in a repository where any address
# is acceptable:
#
#   git config commit.emailDomain ""
#
# Skipped under CI, where the committer is a bot with its own address.

set -eu

# Written as a conditional, not `[ -n "$CI" ] && exit 0`. Under `set -e` that
# one-liner exits 1 whenever CI is unset, which is every local commit.
if [ -n "${CI:-}" ]; then
	exit 0
fi

configured="$(git config --get commit.emailDomain 2>/dev/null || true)"
if [ -n "${COMMIT_EMAIL_DOMAIN+set}" ]; then
	EXPECTED_DOMAIN="$COMMIT_EMAIL_DOMAIN"
elif git config --get commit.emailDomain >/dev/null 2>&1; then
	EXPECTED_DOMAIN="$configured"
else
	EXPECTED_DOMAIN=""
fi

# Explicitly emptied: this repository accepts any address.
if [ -z "$EXPECTED_DOMAIN" ]; then
	exit 0
fi

email="$(git config user.email 2>/dev/null || true)"

if [ -z "$email" ]; then
	cat >&2 <<EOF
No commit email is configured.

  git config user.email "your.name@${EXPECTED_DOMAIN}"

Set it per repository, not globally: a global identity follows you into every
other repository on this machine. See docs/CONTRIBUTING.md.
EOF
	exit 1
fi

case "$email" in
*"@${EXPECTED_DOMAIN}")
	exit 0
	;;
*)
	cat >&2 <<EOF
Commit email "$email" is outside the expected domain @${EXPECTED_DOMAIN}.

Set it for this repository only:

  git config user.email "your.name@${EXPECTED_DOMAIN}"

The address must also be verified at https://github.com/settings/emails, or the
signature reports "no_user" and the push is rejected wherever
required_signatures is enforced.

If this repository should accept any address, disable the check:

  git config commit.emailDomain ""
EOF
	exit 1
	;;
esac
