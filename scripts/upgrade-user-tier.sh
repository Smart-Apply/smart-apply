#!/usr/bin/env bash
#
# upgrade-user-tier.sh
#
# Interactive helper for the admin tier-change endpoint
# (POST /api/v1/admin/users/:email/tier).
#
# Replaces the old `flyctl ssh console` + `node /app/promote-premium.js`
# workflow. The caller must already be in the API's ADMIN_EMAILS allow-list
# and must provide a valid access token (JWT) for that admin user.
#
# Usage:
#   ./scripts/upgrade-user-tier.sh
#
# All inputs are prompted interactively. Override defaults with env vars:
#   ENVIRONMENT       prod | staging
#   ADMIN_EMAIL       email of the calling admin (logged server-side)
#   USER_EMAIL        email of the user whose tier you want to change
#   TIER              FREE | PREMIUM | PREMIUM_PLUS  (default PREMIUM)
#   PERIOD_MONTHS     1-120 (default 12)
#   ACCESS_TOKEN      JWT bearer token for the admin user
#
# Requirements: bash, curl, and (optionally) jq for pretty output.

set -euo pipefail

PROD_API_BASE="https://api.smart-apply.io/api/v1"
STAGING_API_BASE="https://smart-apply-api-staging.fly.dev/api/v1"

VALID_TIERS=("FREE" "PREMIUM" "PREMIUM_PLUS")

err()  { printf '\033[31m✖ %s\033[0m\n' "$*" >&2; }
warn() { printf '\033[33m! %s\033[0m\n' "$*" >&2; }
info() { printf '\033[36m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m✓ %s\033[0m\n' "$*"; }

prompt() {
  # prompt VAR_NAME "Question" [default]
  local var_name="$1" question="$2" default="${3:-}"
  local current="${!var_name:-}"
  if [[ -n "$current" ]]; then
    return 0
  fi
  local answer
  if [[ -n "$default" ]]; then
    read -r -p "$question [$default]: " answer
    answer="${answer:-$default}"
  else
    read -r -p "$question: " answer
  fi
  printf -v "$var_name" '%s' "$answer"
}

prompt_secret() {
  # prompt_secret VAR_NAME "Question"
  local var_name="$1" question="$2"
  local current="${!var_name:-}"
  if [[ -n "$current" ]]; then
    return 0
  fi
  local answer
  read -r -s -p "$question: " answer
  printf '\n'
  printf -v "$var_name" '%s' "$answer"
}

contains() {
  local needle="$1"; shift
  local item
  for item in "$@"; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Required command not found: $1"
    exit 1
  fi
}

require_cmd curl

echo "──────────────────────────────────────────────────────────────"
echo "  Smart Apply — admin tier change"
echo "──────────────────────────────────────────────────────────────"

prompt ENVIRONMENT "Environment (prod | staging)" "staging"
ENVIRONMENT="$(printf '%s' "$ENVIRONMENT" | tr '[:upper:]' '[:lower:]')"
case "$ENVIRONMENT" in
  prod)    API_BASE="$PROD_API_BASE" ;;
  staging) API_BASE="$STAGING_API_BASE" ;;
  *) err "ENVIRONMENT must be 'prod' or 'staging' (got: $ENVIRONMENT)"; exit 1 ;;
esac

prompt       ADMIN_EMAIL  "Admin email (caller, must be in ADMIN_EMAILS)"
prompt       USER_EMAIL   "Target user email"
prompt       TIER         "New tier (FREE | PREMIUM | PREMIUM_PLUS)" "PREMIUM"
TIER="$(printf '%s' "$TIER" | tr '[:lower:]' '[:upper:]')"

if ! contains "$TIER" "${VALID_TIERS[@]}"; then
  err "TIER must be one of: ${VALID_TIERS[*]} (got: $TIER)"
  exit 1
fi

prompt        PERIOD_MONTHS "Billing period in months (1-120)" "12"
if ! [[ "$PERIOD_MONTHS" =~ ^[0-9]+$ ]] || (( PERIOD_MONTHS < 1 || PERIOD_MONTHS > 120 )); then
  err "PERIOD_MONTHS must be an integer between 1 and 120 (got: $PERIOD_MONTHS)"
  exit 1
fi

prompt_secret ACCESS_TOKEN "Admin access token (JWT, hidden input)"
if [[ -z "$ACCESS_TOKEN" ]]; then
  err "ACCESS_TOKEN is required"
  exit 1
fi

# Strip a leading "Bearer " if pasted in by accident.
ACCESS_TOKEN="${ACCESS_TOKEN#Bearer }"
ACCESS_TOKEN="${ACCESS_TOKEN#bearer }"

# URL-encode the email (handles + and other RFC3986-reserved chars).
url_encode() {
  local raw="$1" out="" i ch
  for (( i=0; i<${#raw}; i++ )); do
    ch="${raw:i:1}"
    case "$ch" in
      [a-zA-Z0-9.~_-]) out+="$ch" ;;
      *) out+="$(printf '%%%02X' "'$ch")" ;;
    esac
  done
  printf '%s' "$out"
}
USER_EMAIL_ENCODED="$(url_encode "$USER_EMAIL")"

URL="$API_BASE/admin/users/$USER_EMAIL_ENCODED/tier"
BODY="$(printf '{"tier":"%s","periodMonths":%d}' "$TIER" "$PERIOD_MONTHS")"

echo
info "Environment   : $ENVIRONMENT"
info "API base      : $API_BASE"
info "Admin caller  : $ADMIN_EMAIL"
info "Target user   : $USER_EMAIL"
info "New tier      : $TIER"
info "Period months : $PERIOD_MONTHS"
echo

read -r -p "Proceed? [y/N]: " confirm
case "$confirm" in
  y|Y|yes|YES) ;;
  *) warn "Aborted."; exit 0 ;;
esac

echo
info "POST $URL"

http_response="$(mktemp)"
trap 'rm -f "$http_response"' EXIT

http_code="$(
  curl -sS -o "$http_response" -w '%{http_code}' \
    -X POST "$URL" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data "$BODY"
)"

echo
if [[ "$http_code" == "200" ]]; then
  ok  "HTTP $http_code — tier updated"
else
  err "HTTP $http_code — request failed"
fi

if command -v jq >/dev/null 2>&1; then
  jq . < "$http_response" || cat "$http_response"
else
  cat "$http_response"
fi
echo

[[ "$http_code" == "200" ]] || exit 1
