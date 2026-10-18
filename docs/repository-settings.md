# Repository Settings

What GitHub gives a public repository for free, and how Atlas uses each.
`scripts/configure-repository.sh` applies the settings that have an API;
run it once after the repository is created, with `gh` signed in as an
owner.

| Feature                         | What it does here                                                                  | Set by                  |
| ------------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| Hosted runners                  | Every workflow; unlimited minutes for public repositories                          | Workflows               |
| CodeQL code scanning            | TypeScript and workflow analysis on pushes, pull requests, weekly                  | `codeql.yml`            |
| Secret scanning                 | Finds credentials in pushes and history                                            | Script                  |
| Push protection                 | Refuses a push that contains a recognised secret                                   | Script                  |
| Dependabot alerts               | Known vulnerabilities in dependencies                                              | Script                  |
| Dependabot security updates     | Opens fix pull requests for those alerts                                           | Script                  |
| Dependabot version updates      | Weekly, grouped                                                                    | `dependabot.yml`        |
| Dependency review               | Blocks a pull request adding a vulnerable or copyleft dependency                   | `dependency-review.yml` |
| Private vulnerability reporting | A private channel for security reports                                             | Script                  |
| OpenSSF Scorecard               | Grades the repository's security practices, published                              | `scorecard.yml`         |
| GitHub Pages                    | The public Storybook                                                               | `pages.yml`, script     |
| Rulesets                        | `main`: pull requests only, `Quality Gate` required, signed commits, no force push | Script                  |

## The One Secret

`CLIENT_TERMS` holds your client term list, one pattern per line, the same
as your local `scripts/client-terms.txt`. The `Client Content` workflow
fails closed without it. Set it with:

```sh
gh secret set CLIENT_TERMS < scripts/client-terms.txt
```

Dependabot pull requests never receive repository secrets, so the workflow
skips them; they change only `package.json` and `bun.lock`.
