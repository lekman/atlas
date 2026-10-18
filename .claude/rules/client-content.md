# No Client Content, Ever

This repository is public under the MIT licence. Nothing that identifies a
client, an employer, a person at either, or an engagement may appear in it:
not in code, not in fixtures, not in a screenshot, not in a commit message,
not in a pull request title.

## Why the Rule Is Absolute

Atlas exists to show real work for real clients. That makes it easy to
reach for a real example while building a story or a test. Once pushed, a
name stays in history even after a fix commit, and removing it means a
history rewrite on a public repository that others may have cloned.

## Use the Invented World

Every example comes from `packages/fixtures`. Its clients (Halcyon Labs,
Kestrel Freight, Larchwood Studio, Meridian Bank), agents, requirements and
decisions are invented. Add to them; never replace one with something real.

When a new example is needed, describe the _shape_ of the real situation in
invented terms. A real "the cut-over waits on a risk sign-off" becomes the
same sentence about Halcyon Labs.

## How It Is Enforced

| Where      | What runs                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| pre-commit | `scripts/check-no-client-content.sh --staged`                                                                        |
| commit-msg | the same script on the message                                                                                       |
| pre-push   | the same script over all history and all commit messages                                                             |
| CI         | `Client Content`, with the term list restored from the `CLIENT_TERMS` secret, quiet so the log never repeats a match |

The term list lives in `scripts/client-terms.txt`, which is gitignored. Run
`task client-content:init` once, then add your clients' names, short forms,
repository names, tracker keys and people.

Screenshots and recordings are the easy miss: a scan cannot read pixels.
Take them only from Storybook or from a server running the fixtures.

## If Something Slips Through

Stop. Do not push a fix on top and move on.

1. Say so to the repository owner immediately.
2. Remove the content from history (`git filter-repo`), then force-push.
3. Treat anything that was a credential as compromised and rotate it.
