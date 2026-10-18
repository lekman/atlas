#!/usr/bin/env bash
# Turns on the security features GitHub gives a public repository for free,
# and protects main. Run once after creating the repository, with `gh`
# signed in as an owner. Safe to run again: every call sets a state.
#
#   bash scripts/configure-repository.sh lekman/atlas
#
# See docs/repository-settings.md for what each setting is for.
set -euo pipefail

repository="${1:-lekman/atlas}"
api() { gh api --silent "$@"; }

echo "Repository options"
api -X PATCH "repos/$repository" \
  -F delete_branch_on_merge=true \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F has_wiki=false

echo "Secret scanning and push protection"
api -X PATCH "repos/$repository" --input - <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON

echo "Dependabot alerts and security updates"
api -X PUT "repos/$repository/vulnerability-alerts"
api -X PUT "repos/$repository/automated-security-fixes"

echo "Private vulnerability reporting"
api -X PUT "repos/$repository/private-vulnerability-reporting"

echo "Workflow token: read-only by default; Release Please may open its pull request"
api -X PUT "repos/$repository/actions/permissions/workflow" \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=true

echo "GitHub Pages from the workflow"
if ! api "repos/$repository/pages" 2>/dev/null; then
  api -X POST "repos/$repository/pages" -f build_type=workflow
else
  api -X PUT "repos/$repository/pages" -f build_type=workflow
fi

echo "Ruleset protecting main"
existing=$(gh api "repos/$repository/rulesets" --jq '.[] | select(.name == "Protect main") | .id' || true)
method=POST
path="repos/$repository/rulesets"
if [ -n "$existing" ]; then
  method=PUT
  path="repos/$repository/rulesets/$existing"
fi
gh api --silent -X "$method" "$path" --input - <<'JSON'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_signatures" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "Quality Gate" },
          { "context": "No client-identifying content" }
        ]
      }
    }
  ]
}
JSON

if ! gh secret list --repo "$repository" | grep -q '^CLIENT_TERMS'; then
  echo
  echo "One step left: the Client Content workflow fails until CLIENT_TERMS is set."
  echo "  gh secret set CLIENT_TERMS --repo $repository < scripts/client-terms.txt"
fi
echo "Done."
