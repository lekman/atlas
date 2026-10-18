# Repository Settings

What GitHub gives a public repository for free, and how Atlas uses each.
`scripts/configure-repository.sh` applies the settings that have an API;
run it once after the repository is created, with `gh` signed in as an
owner.

| Feature                         | What it does here                                                               | Set by                  |
| ------------------------------- | ------------------------------------------------------------------------------- | ----------------------- |
| Hosted runners                  | Every workflow; unlimited minutes for public repositories                       | Workflows               |
| CodeQL code scanning            | TypeScript and workflow analysis on pushes, pull requests, weekly               | `codeql.yml`            |
| Secret scanning                 | Finds credentials in pushes and history                                         | Script                  |
| Push protection                 | Refuses a push that contains a recognised secret                                | Script                  |
| Dependabot alerts               | Known vulnerabilities in dependencies                                           | Script                  |
| Dependabot security updates     | Opens fix pull requests for those alerts                                        | Script                  |
| Dependabot version updates      | Weekly, grouped                                                                 | `dependabot.yml`        |
| Dependency review               | Blocks a pull request adding a vulnerable or copyleft dependency                | `dependency-review.yml` |
| Private vulnerability reporting | A private channel for security reports                                          | Script                  |
| OpenSSF Scorecard               | Grades the repository's security practices, published                           | `scorecard.yml`         |
| GitHub Pages                    | The public Storybook                                                            | `pages.yml`, script     |
| Rulesets                        | `main`: pull requests only, both required checks, signed commits, no force push | Script                  |
| Workflow permissions            | Read-only token by default; Release Please may open its pull request            | Script                  |

## The First Push, in Order

The ruleset allows changes to `main` only through a pull request, so it is
set up after the first push, not before:

1. Create the repository and push `main`:
   `gh repo create lekman/atlas --public --source . --push`.
   Push `main` only, never `--all` or `--mirror`, so no local branch goes
   with it.
2. Set the secret: `gh secret set CLIENT_TERMS < scripts/client-terms.txt`.
3. Run `bash scripts/configure-repository.sh lekman/atlas`.

Commits show **Verified** only when the key that signed them is registered
on your GitHub account as a signing key, not only as an authentication key.

## Required Checks

| Check                           | From                 | Proves                                                            |
| ------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `Quality Gate`                  | `ci.yml`             | Lint, typecheck, unit tests and every story passed                |
| `No client-identifying content` | `client-content.yml` | Files, history, messages, title, branch and description are clean |

## The Release Pull Request

Release Please opens its pull request with the workflow's own token, and
GitHub does not start other workflows for a pull request made that way, so
its required checks never report on their own. Close the release pull
request and reopen it: a reopen by you starts the checks, and it can then be
merged as any other.

## The One Secret

`CLIENT_TERMS` holds your client term list, one pattern per line, the same
as your local `scripts/client-terms.txt`. The `Client Content` workflow
fails closed without it. Set it with:

```sh
gh secret set CLIENT_TERMS < scripts/client-terms.txt
```

Dependabot pull requests never receive repository secrets, so the workflow
skips them; they change only `package.json` and `bun.lock`.
