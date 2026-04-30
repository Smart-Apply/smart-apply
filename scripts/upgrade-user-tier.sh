#!/usr/bin/env bash
# Upgrade (or downgrade) a user's subscription tier by email.
#
# Runs psql against the smartapply Postgres container. Works in two modes:
#
#   1. Local mode (default): execute on the VM where the db container lives.
#        ./upgrade-user-tier.sh user@example.com PREMIUM
#
#   2. SSH mode: run from your laptop, the script SSHes into the VM for you.
#        REMOTE=1 ./upgrade-user-tier.sh user@example.com PRO
#        # Optional overrides:
#        VM_HOST=smartapplymvp.swedencentral.cloudapp.azure.com \
#        VM_USER=azureuser \
#        REMOTE=1 ./upgrade-user-tier.sh user@example.com FREE
#
# The script is idempotent: it INSERTs a Subscription row if missing,
# otherwise UPDATEs tier + status. Status is forced to ACTIVE so the user
# isn't gated by a stale PAST_DUE/CANCELED state from a previous Stripe run.
#
# Exit codes:
#   0  success
#   1  bad arguments / unknown tier
#   2  user not found
#   3  psql / docker error

set -euo pipefail

usage() {
  cat >&2 <<EOF
Usage: $(basename "$0") <email> <FREE|PRO|PREMIUM>

Examples:
  $(basename "$0") jane@example.com PREMIUM
  REMOTE=1 $(basename "$0") jane@example.com PRO

Env vars (SSH mode):
  REMOTE=1            enable SSH mode
  VM_HOST=...         default: smartapplymvp.swedencentral.cloudapp.azure.com
  VM_USER=azureuser
  SSH_KEY=~/.ssh/id_rsa  optional, passed as -i to ssh

Env vars (both modes):
  DB_CONTAINER=smartapply-db
  DB_USER=postgres
  DB_NAME=smartapply
EOF
  exit 1
}

[[ $# -eq 2 ]] || usage

EMAIL="$1"
TIER="$(echo "$2" | tr '[:lower:]' '[:upper:]')"

case "$TIER" in
  FREE|PRO|PREMIUM) ;;
  *) echo "❌ Unknown tier: $2 (must be FREE, PRO, or PREMIUM)" >&2; exit 1 ;;
esac

# Basic email sanity check — we still single-quote in SQL below, but reject
# anything with quote/semicolon/backslash up front to keep this script
# obviously safe against accidental injection from shell history.
if printf '%s' "$EMAIL" | LC_ALL=C grep -q "[\"';\\\\]"; then
  echo "❌ Email contains disallowed characters" >&2
  exit 1
fi

DB_CONTAINER="${DB_CONTAINER:-smartapply-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-smartapply}"

# SQL: look up user, upsert subscription, return resulting row.
# Subscription.id uses cuid() in the app — Postgres can't generate one, so we
# fall back to gen_random_uuid()::text (pgcrypto is built-in on PG13+ alpine).
# That's fine: the app only treats `id` as an opaque PK string.
read -r -d '' SQL <<SQL || true
DO \$\$
DECLARE
  v_user_id text;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE lower(email) = lower('${EMAIL}');
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  INSERT INTO subscriptions (id, "userId", tier, status, "createdAt", "updatedAt")
  VALUES (
    'sub_' || replace(gen_random_uuid()::text, '-', ''),
    v_user_id,
    '${TIER}'::"SubscriptionTier",
    'ACTIVE'::"SubscriptionStatus",
    NOW(),
    NOW()
  )
  ON CONFLICT ("userId") DO UPDATE
    SET tier = EXCLUDED.tier,
        status = 'ACTIVE'::"SubscriptionStatus",
        "updatedAt" = NOW();
END
\$\$;

SELECT u.email, s.tier, s.status, s."updatedAt"
FROM subscriptions s
JOIN users u ON u.id = s."userId"
WHERE lower(u.email) = lower('${EMAIL}');
SQL

run_psql() {
  # -v ON_ERROR_STOP=1 surfaces RAISE EXCEPTION / SQL errors as non-zero exit.
  docker exec -i "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
}

echo "🔧 Setting tier=${TIER} for ${EMAIL}..."

if [[ "${REMOTE:-0}" == "1" ]]; then
  VM_HOST="${VM_HOST:-smartapplymvp.swedencentral.cloudapp.azure.com}"
  VM_USER="${VM_USER:-azureuser}"
  SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
  [[ -n "${SSH_KEY:-}" ]] && SSH_OPTS+=(-i "$SSH_KEY")

  output=$(printf '%s\n' "$SQL" | ssh "${SSH_OPTS[@]}" "${VM_USER}@${VM_HOST}" \
    "docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1" 2>&1) || {
    rc=$?
    if echo "$output" | grep -q 'USER_NOT_FOUND'; then
      echo "❌ No user found with email: $EMAIL" >&2
      exit 2
    fi
    echo "$output" >&2
    exit 3
  }
else
  output=$(printf '%s\n' "$SQL" | run_psql 2>&1) || {
    rc=$?
    if echo "$output" | grep -q 'USER_NOT_FOUND'; then
      echo "❌ No user found with email: $EMAIL" >&2
      exit 2
    fi
    echo "$output" >&2
    exit 3
  }
fi

echo "$output"
echo "✅ Done."
