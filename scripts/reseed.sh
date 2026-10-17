#!/usr/bin/env bash
# 予約DBのダミーデータを作り直す（実行した日の7日前〜14日後の予約になる。データは入れ替わる）。
#   使い方: scripts/reseed.sh
set -euo pipefail
out="$(mktemp)"
aws lambda invoke --function-name acme-reservation-seed --region ap-northeast-1 "$out" > /dev/null
cat "$out"; echo
rm -f "$out"
