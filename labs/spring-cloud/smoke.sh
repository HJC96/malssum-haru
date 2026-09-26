#!/usr/bin/env bash
set -euo pipefail

GATEWAY="${GATEWAY_URL:-http://localhost:8080}"
failures=0

check_status() {
  local path="$1"
  local expected="$2"
  local response actual
  response="$(curl -sS -w '\n%{http_code}' "$GATEWAY$path")"
  actual="${response##*$'\n'}"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL $path expected HTTP $expected, got $actual: ${response%$'\n'*}" >&2
    failures=$((failures + 1))
  else
    echo "PASS $path returned HTTP $expected"
  fi
}

check_contains() {
  local path="$1"
  local expected="$2"
  local body
  body="$(curl -sS "$GATEWAY$path")"
  if [[ "$body" != *"$expected"* ]]; then
    echo "FAIL $path did not contain '$expected': $body" >&2
    failures=$((failures + 1))
  else
    echo "PASS $path contained '$expected'"
  fi
}

check_status /api/daily-content 200
check_contains /api/daily-content NO_SCRIPTURE_CONTENT
check_status '/api/explanations?fail=true' 503
check_contains '/api/explanations?fail=true' EXPLANATION_UNAVAILABLE
check_status '/api/explanations?fail=true' 503
check_status /api/daily-content 200
check_contains /api/daily-content NO_SCRIPTURE_CONTENT
check_status /api/official-qt-links 200
check_contains /api/official-qt-links sum.su.or.kr
check_contains /api/official-qt-links www.duranno.com

if [[ "$failures" -gt 0 ]]; then
  echo "$failures smoke check(s) failed." >&2
  exit 1
fi
echo "All lab smoke checks passed."
