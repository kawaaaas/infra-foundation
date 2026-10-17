#!/usr/bin/env bash
# 使い方: scripts/harden-github-repo.sh <owner/repo>   例：scripts/harden-github-repo.sh kawaaaas/dashboard-app
# public リポジトリの最低限のセキュリティ設定。何度実行しても同じ結果になる。
set -euo pipefail
R="$1"

echo "== $R"

# 他人の Issue・PR・コメントを止める（コラボレーターだけ。最長6か月なので期限が来たら再実行）
gh api -X PUT "repos/$R/interaction-limits" -f limit=collaborators_only -f expiry=six_months > /dev/null

# 使わない機能を閉じる。マージしたブランチは消す
gh api -X PATCH "repos/$R" -F has_wiki=false -F has_projects=false -F delete_branch_on_merge=true > /dev/null

# 秘密情報の検出と push のブロック、依存の脆弱性アラート
gh api -X PATCH "repos/$R" --input - > /dev/null <<'JSON'
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}
JSON
gh api -X PUT "repos/$R/vulnerability-alerts" > /dev/null

# Actions：使えるのは GitHub 公式と aws-actions/configure-aws-credentials だけ
gh api -X PUT "repos/$R/actions/permissions" -F enabled=true -f allowed_actions=selected > /dev/null
gh api -X PUT "repos/$R/actions/permissions/selected-actions" --input - > /dev/null <<'JSON'
{"github_owned_allowed":true,"verified_allowed":false,"patterns_allowed":["aws-actions/configure-aws-credentials@*"]}
JSON
# GITHUB_TOKEN は読み取りだけ。Actions に PR を承認させない
gh api -X PUT "repos/$R/actions/permissions/workflow" -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false > /dev/null
# フォークからの PR の workflow は、外部の人なら毎回承認が要る
gh api -X PUT "repos/$R/actions/permissions/fork-pr-contributor-approval" -f approval_policy=all_external_contributors > /dev/null

# ルールセット：main は消せない・force push できない。v* タグは作り直し・削除できない（公開済みのバージョンを差し替えさせない）
upsert_ruleset() {
  local name="$1" body="$2" id
  id=$(gh api "repos/$R/rulesets" -q ".[] | select(.name==\"$name\") | .id")
  if [ -n "$id" ]; then gh api -X PUT "repos/$R/rulesets/$id" --input - <<<"$body" > /dev/null
  else gh api -X POST "repos/$R/rulesets" --input - <<<"$body" > /dev/null; fi
}
upsert_ruleset main '{"name":"main","target":"branch","enforcement":"active",
  "conditions":{"ref_name":{"include":["~DEFAULT_BRANCH"],"exclude":[]}},
  "rules":[{"type":"deletion"},{"type":"non_fast_forward"}]}'
upsert_ruleset release-tags '{"name":"release-tags","target":"tag","enforcement":"active",
  "conditions":{"ref_name":{"include":["refs/tags/v*"],"exclude":[]}},
  "rules":[{"type":"deletion"},{"type":"update"}]}'

echo "done"
