#!/usr/bin/env bash
# ================================================================
# sync-env-to-vm.sh
# ================================================================
# Idempotently push specific env keys from the local apps/api/.env
# (or hard-coded defaults below) to the production VM, then restart
# the API container.
#
# Designed for SAFE upserts:
#   - Backs up the existing remote .env to .env.bak.<timestamp>
#   - Touches only the keys listed in KEYS_TO_SYNC (R2, Upstash, etc.)
#   - Leaves every other line of the remote .env untouched
#   - Verifies /health after restart
#
# Usage:
#   bash scripts/sync-env-to-vm.sh                    # default: dry-run
#   bash scripts/sync-env-to-vm.sh --apply            # actually push & restart
#   bash scripts/sync-env-to-vm.sh --apply --no-restart   # push only, no restart
#
# Override defaults via env vars:
#   VM_HOST=1.2.3.4 VM_USER=azureuser VM_SSH_KEY=~/path/to/key.pem \
#     bash scripts/sync-env-to-vm.sh --apply
# ================================================================
set -euo pipefail

# ----------------------------------------------------------------
# Configuration (override via env vars)
# ----------------------------------------------------------------
VM_HOST="${VM_HOST:-135.225.56.134}"
VM_USER="${VM_USER:-azureuser}"
# Path to your private SSH key. Set via env var — paths with spaces or
# apostrophes break bash parameter-expansion defaults, so we keep this empty.
# Example:
#   export VM_SSH_KEY="$HOME/path/to/smartapply-mvp-vm_key.pem"
VM_SSH_KEY="${VM_SSH_KEY:-}"
REMOTE_ENV_PATH="${REMOTE_ENV_PATH:-/home/azureuser/smart-apply/apps/api/.env}"
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-/home/azureuser/smart-apply/infra/docker-compose.prod.yml}"
API_CONTAINER="${API_CONTAINER:-smartapply-api}"
LOCAL_ENV="${LOCAL_ENV:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/apps/api/.env}"

# Keys we want to push. Order matters for the resulting file.
KEYS_TO_SYNC=(
  STORAGE_DRIVER
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET
  R2_ENDPOINT
  THROTTLER_STORAGE
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  AZURE_OPENAI_API_VERSION
  CORS_ORIGINS
  JOBS_DRIVER
  QSTASH_URL
  QSTASH_TOKEN
  QSTASH_CURRENT_SIGNING_KEY
  QSTASH_NEXT_SIGNING_KEY
  # Auth rate limit — bumped from 5 to 15 (Apr 2026) so legitimate users
  # on Firefox/Safari with strict tracking protection don't get locked
  # out for 15min after a few CAPTCHA retries. CAPTCHA failures themselves
  # no longer consume the budget (rejected by CaptchaGuard before the
  # throttler), but typos / 2FA / forgot-password retries still do.
  RATE_LIMIT_AUTH_TTL
  RATE_LIMIT_AUTH_MAX
)

# Keys forced to a specific production value (overrides whatever the local
# .env says). Local dev has these flipped to safe defaults.
# Format: "KEY=VALUE" — parallel array, bash-3.2 compatible (no `declare -A`).
FORCE_KV=(
  "STORAGE_DRIVER=r2"
  "THROTTLER_STORAGE=upstash"
  "JOBS_DRIVER=qstash"
  # Production CORS allowlist — includes the Cloudflare Worker frontend
  # (default workers.dev URL) alongside the existing custom domains.
  # Update this when you switch the Worker to a custom domain.
  "CORS_ORIGINS=https://smart-apply.io,https://www.smart-apply.io,https://smart-apply-web.ari41dev.workers.dev"
)

# Returns forced value for $1, or empty string if not in FORCE_KV.
force_value_for() {
  local key="$1"
  local entry
  for entry in "${FORCE_KV[@]}"; do
    if [[ "${entry%%=*}" == "$key" ]]; then
      printf '%s' "${entry#*=}"
      return
    fi
  done
}

# ----------------------------------------------------------------
# Args
# ----------------------------------------------------------------
APPLY=0
RESTART=1
for arg in "$@"; do
  case "$arg" in
    --apply)      APPLY=1 ;;
    --no-restart) RESTART=0 ;;
    -h|--help)
      sed -n '2,22p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

# ----------------------------------------------------------------
# Colors
# ----------------------------------------------------------------
if [[ -t 1 ]]; then
  C_RED=$'\033[0;31m'; C_GREEN=$'\033[0;32m'; C_YELLOW=$'\033[1;33m'
  C_BLUE=$'\033[0;34m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_DIM=""; C_RST=""
fi

log()  { printf '%s\n' "${C_BLUE}==>${C_RST} $*"; }
ok()   { printf '%s\n' "${C_GREEN}✓${C_RST} $*"; }
warn() { printf '%s\n' "${C_YELLOW}⚠${C_RST} $*"; }
err()  { printf '%s\n' "${C_RED}✗${C_RST} $*" >&2; }

# ----------------------------------------------------------------
# Pre-flight checks
# ----------------------------------------------------------------
log "Pre-flight checks"

if [[ ! -f "$LOCAL_ENV" ]]; then
  err "Local env file not found: $LOCAL_ENV"
  exit 1
fi
ok "Local .env: $LOCAL_ENV"

if [[ -z "$VM_SSH_KEY" ]]; then
  err "VM_SSH_KEY env var is required. Example:"
  err "  export VM_SSH_KEY=\"\$HOME/path/to/smartapply-mvp-vm_key.pem\""
  err "  bash scripts/sync-env-to-vm.sh"
  exit 1
fi

if [[ ! -f "$VM_SSH_KEY" ]]; then
  err "SSH key not found: $VM_SSH_KEY"
  exit 1
fi

# Lock down key perms or SSH refuses it
KEY_PERMS=$(stat -f '%A' "$VM_SSH_KEY" 2>/dev/null || stat -c '%a' "$VM_SSH_KEY")
if [[ "$KEY_PERMS" != "600" && "$KEY_PERMS" != "400" ]]; then
  warn "SSH key perms are $KEY_PERMS — fixing to 600"
  chmod 600 "$VM_SSH_KEY"
fi
ok "SSH key: $VM_SSH_KEY (perms $(stat -f '%A' "$VM_SSH_KEY" 2>/dev/null || stat -c '%a' "$VM_SSH_KEY"))"

SSH_OPTS=(-i "$VM_SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

log "Probing SSH to ${VM_USER}@${VM_HOST}"
if ! ssh "${SSH_OPTS[@]}" "${VM_USER}@${VM_HOST}" 'echo connected' >/dev/null 2>&1; then
  err "SSH connection failed."
  err "Try manually: ssh -i \"$VM_SSH_KEY\" ${VM_USER}@${VM_HOST}"
  exit 1
fi
ok "SSH OK"

# ----------------------------------------------------------------
# Build the delta snippet from local .env (+ FORCE_VALUES overrides)
# ----------------------------------------------------------------
log "Building env delta"

DELTA_FILE=$(mktemp -t smartapply-env-delta.XXXXXX)
trap 'rm -f "$DELTA_FILE"' EXIT

{
  printf '# === Synced by sync-env-to-vm.sh on %s ===\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for key in "${KEYS_TO_SYNC[@]}"; do
    forced=$(force_value_for "$key")
    if [[ -n "$forced" ]]; then
      printf '%s=%s\n' "$key" "$forced"
    else
      # Pull last assignment of $key from local .env (handles duplicates by taking last)
      value=$(awk -F= -v k="$key" '$1 == k { sub(/^[^=]*=/, ""); v=$0 } END { print v }' "$LOCAL_ENV")
      if [[ -z "$value" ]]; then
        warn "$key not present in local .env — skipping"
        continue
      fi
      printf '%s=%s\n' "$key" "$value"
    fi
  done
} > "$DELTA_FILE"

log "Delta to apply (values masked):"
sed -E 's/^([^#=]+)=.*/\1=***/' "$DELTA_FILE" | sed 's/^/    /'
echo

# ----------------------------------------------------------------
# Dry-run vs apply
# ----------------------------------------------------------------
if [[ $APPLY -eq 0 ]]; then
  warn "DRY RUN — not pushing. Re-run with --apply to push to ${VM_HOST}."
  exit 0
fi

# ----------------------------------------------------------------
# Push delta to remote /tmp
# ----------------------------------------------------------------
log "Uploading delta to ${VM_HOST}:/tmp"
scp "${SSH_OPTS[@]}" "$DELTA_FILE" "${VM_USER}@${VM_HOST}:/tmp/smartapply-env-delta.tmp" >/dev/null
ok "Delta uploaded"

# ----------------------------------------------------------------
# Remote upsert (idempotent: backup, replace existing keys, append new)
# ----------------------------------------------------------------
log "Applying delta on remote (with backup)"

REMOTE_ENV_QUOTED=$(printf '%q' "$REMOTE_ENV_PATH")
COMPOSE_QUOTED=$(printf '%q' "$DOCKER_COMPOSE_FILE")

# This script runs ON the VM. It:
#   1. Backs up the current .env
#   2. For each KEY=VALUE in the delta:
#      - Removes any existing line starting with KEY=
#      - Appends the new line
#   3. Reports a diff summary
ssh "${SSH_OPTS[@]}" "${VM_USER}@${VM_HOST}" bash -s -- "$REMOTE_ENV_PATH" <<'REMOTE_EOF'
set -euo pipefail
REMOTE_ENV="$1"
DELTA="/tmp/smartapply-env-delta.tmp"
TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="${REMOTE_ENV}.bak.${TS}"

if [[ ! -f "$REMOTE_ENV" ]]; then
  echo "ERROR: $REMOTE_ENV not found on VM" >&2
  exit 1
fi

cp "$REMOTE_ENV" "$BACKUP"
echo "  ✓ Backup: $BACKUP"

# Build new file: copy original lines, dropping any keys present in the delta
TMP_NEW=$(mktemp)
DELTA_KEYS=$(grep -E '^[A-Z_][A-Z0-9_]*=' "$DELTA" | cut -d= -f1 | sort -u)

awk -v keys="$DELTA_KEYS" '
  BEGIN {
    n = split(keys, arr, "\n")
    for (i = 1; i <= n; i++) drop[arr[i]] = 1
  }
  /^[A-Z_][A-Z0-9_]*=/ {
    split($0, kv, "=")
    if (kv[1] in drop) next
  }
  { print }
' "$REMOTE_ENV" > "$TMP_NEW"

# Append the delta block
echo "" >> "$TMP_NEW"
cat "$DELTA" >> "$TMP_NEW"

# Atomic replace
mv "$TMP_NEW" "$REMOTE_ENV"
chmod 600 "$REMOTE_ENV"
echo "  ✓ Updated $REMOTE_ENV"

# Quick diff summary (line count delta)
echo "  ✓ Lines: $(wc -l < "$BACKUP" | tr -d ' ') → $(wc -l < "$REMOTE_ENV" | tr -d ' ')"

# Show which keys are now in the file
echo "  ✓ Keys synced:"
echo "$DELTA_KEYS" | sed 's/^/      /'

rm -f "$DELTA"
REMOTE_EOF

ok "Remote .env updated"

# ----------------------------------------------------------------
# Restart API
# ----------------------------------------------------------------
if [[ $RESTART -eq 0 ]]; then
  warn "Skipping restart (--no-restart). Restart manually with:"
  warn "  ssh ${VM_USER}@${VM_HOST} 'docker compose -f $DOCKER_COMPOSE_FILE restart api'"
  exit 0
fi

log "Restarting API container ($API_CONTAINER)"
ssh "${SSH_OPTS[@]}" "${VM_USER}@${VM_HOST}" bash -s -- "$DOCKER_COMPOSE_FILE" "$API_CONTAINER" <<'REMOTE_EOF'
set -euo pipefail
COMPOSE_FILE="$1"
CONTAINER="$2"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not installed on VM" >&2
  exit 1
fi

# Prefer compose if available, fall back to plain docker restart
if docker compose version >/dev/null 2>&1 && [[ -f "$COMPOSE_FILE" ]]; then
  echo "  → docker compose restart api"
  cd "$(dirname "$COMPOSE_FILE")"
  docker compose -f "$COMPOSE_FILE" restart api
else
  echo "  → docker restart $CONTAINER"
  docker restart "$CONTAINER"
fi

echo "  ✓ Restart issued"
REMOTE_EOF

ok "API restart triggered"

# ----------------------------------------------------------------
# Health check
# ----------------------------------------------------------------
log "Waiting for /health (up to 60s)"
for i in $(seq 1 12); do
  if ssh "${SSH_OPTS[@]}" "${VM_USER}@${VM_HOST}" \
       "curl -sf -m 3 http://127.0.0.1:3000/api/v1/health" >/dev/null 2>&1; then
    ok "Health check passed (after ${i}×5s)"
    break
  fi
  if [[ $i -eq 12 ]]; then
    err "Health check did not pass within 60s. Inspect logs:"
    err "  ssh ${VM_USER}@${VM_HOST} 'docker logs --tail 100 $API_CONTAINER'"
    exit 1
  fi
  sleep 5
done

# ----------------------------------------------------------------
# Verify R2 + Upstash drivers active
# ----------------------------------------------------------------
log "Verifying drivers on remote"
DRIVERS=$(ssh "${SSH_OPTS[@]}" "${VM_USER}@${VM_HOST}" \
  "docker logs --tail 200 $API_CONTAINER 2>&1 | grep -E 'R2StorageProvider|UpstashThrottlerStorage|Storage driver' || true")

if [[ -n "$DRIVERS" ]]; then
  echo "$DRIVERS" | sed 's/^/    /'
else
  warn "Couldn't find R2/Upstash init lines in logs (may have rolled off — check manually)"
fi

ok "Done. Smart Apply API on ${VM_HOST} is now using R2 + Upstash."
