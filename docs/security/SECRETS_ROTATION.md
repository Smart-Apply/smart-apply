# Secrets Rotation Runbook

> **When to use this:** A secret is suspected leaked, a contributor leaves,
> or you've hit the recommended rotation cadence (see table at the end).
> Each section is self-contained — jump to the secret you need to rotate.

---

## Operational principles

1. **Rotate before suspected leak is confirmed.** Cost of a false alarm is a
   30-second downtime; cost of a missed leak is the entire user database.
2. **One secret type at a time.** Don't combine "rotate Neon password" with
   "rotate JWT secret" in the same change — if something breaks you won't
   know which.
3. **Prod first, then staging.** Counterintuitive but correct: rotating in
   prod first means the leaked credential dies fastest. Staging is a
   read-only mirror for soak testing — a brief auth gap there is harmless.
4. **Verify health after every rotation.** A green `/api/v1/health` is the
   only proof the new secret reached the running container.
5. **Update the local `apps/api/.env`** if the rotated secret is also one
   you use locally (Neon password, Azure OpenAI key). Otherwise local dev
   breaks the next time you run `npm run start:dev`.
6. **Never paste rotated values into Slack / chat / GitHub issues.** Use a
   password manager (1Password / Bitwarden) as the single source of truth.

---

## Where each secret lives

| Secret                          | Source of truth          | Used by                              |
| ------------------------------- | ------------------------ | ------------------------------------ |
| `JWT_SECRET`                    | Fly Secrets              | API (signs auth + refresh tokens)    |
| `TWO_FACTOR_ENCRYPTION_KEY`     | Fly Secrets              | API (encrypts TOTP secrets at rest)  |
| `DATABASE_URL` / `DIRECT_URL`   | Fly Secrets ← Neon       | API (Prisma)                         |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Fly Secrets ← Cloudflare R2 | API (PDF storage)             |
| `AZURE_OPENAI_API_KEY`          | Fly Secrets ← Azure      | API (cover letter / resume gen)      |
| `QSTASH_TOKEN` + signing keys   | Fly Secrets ← Upstash    | API (background job queue)           |
| `RESEND_API_KEY`                | Fly Secrets ← Resend     | API (transactional email)            |
| OAuth client secrets (Google / Microsoft / Azure AD) | Fly Secrets ← provider console | API (OAuth flows)        |
| `FLY_API_TOKEN`                 | GitHub Environment ← Fly | CI deploy workflow                   |
| `CLOUDFLARE_API_TOKEN`          | GitHub Environment ← CF  | CI deploy workflow                   |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`| Public — committed       | Frontend (CAPTCHA widget)            |
| `TURNSTILE_SECRET_KEY`          | Fly Secrets ← Cloudflare | API (CAPTCHA verification)           |

> **Rule:** `NEXT_PUBLIC_*` values are baked into the browser bundle at
> build time. They are public by design — never put a real secret behind
> that prefix.

---

## Pre-flight: tools you need

```bash
# Fly CLI (you already have this)
fly version

# Active Fly login
fly auth whoami

# Optional but useful for testing connection strings
brew install postgresql        # gives you `psql`

# A password manager open and ready to receive new values
```

App names referenced below:

```
PROD app:    smart-apply-api
STAGING app: smart-apply-api-staging
```

---

## 1. JWT_SECRET

**Blast radius:** Logs out every user with an active session. Refresh tokens
are also invalidated, so they have to log in again with email/password.
Cookies are HttpOnly so users won't see an error — the next API call just
returns 401 and the frontend redirects to `/login`.

**Cadence:** Annually, OR immediately on suspected leak.

```bash
# 1. Generate (88 chars of base64 = 64 bytes of entropy)
NEW_JWT=$(openssl rand -base64 64 | tr -d '\n')
echo "Length: ${#NEW_JWT} (must be ≥ 64)"

# 2. Push to PROD first
fly secrets set --app smart-apply-api JWT_SECRET="$NEW_JWT"

# 3. Wait for rolling restart, verify
sleep 30
curl -s https://api.smart-apply.io/api/v1/health | head -c 200

# 4. Repeat for STAGING (different value — never share JWT secrets across envs)
NEW_JWT_STAGING=$(openssl rand -base64 64 | tr -d '\n')
fly secrets set --app smart-apply-api-staging JWT_SECRET="$NEW_JWT_STAGING"
sleep 30
curl -s https://smart-apply-api-staging.fly.dev/api/v1/health | head -c 200

# 5. Forget the values — Fly is now the only place they exist
unset NEW_JWT NEW_JWT_STAGING
```

---

## 2. TWO_FACTOR_ENCRYPTION_KEY

**Blast radius: HIGH.** This key encrypts the TOTP secrets stored in the DB.
Rotating it without re-encrypting existing secrets means **every user with
2FA enabled is locked out** until they complete recovery.

**Cadence:** Only on confirmed compromise. Otherwise, leave alone.

**Procedure:** Two paths, choose one.

### 2a. Suspect-leak path (no users have 2FA enabled)

If your DB has zero rows in `User.twoFactorSecret` (check via `prisma studio`):

```bash
NEW_2FA=$(openssl rand -hex 32)
echo "Length: ${#NEW_2FA} (must be 64)"

fly secrets set --app smart-apply-api TWO_FACTOR_ENCRYPTION_KEY="$NEW_2FA"
fly secrets set --app smart-apply-api-staging TWO_FACTOR_ENCRYPTION_KEY="$(openssl rand -hex 32)"
```

### 2b. Real users have 2FA enabled

Don't do this without a re-encryption migration. Out of scope for this
runbook — write a one-shot script that:
1. Reads each `User.twoFactorSecret` with the OLD key.
2. Decrypts to plaintext.
3. Re-encrypts with the NEW key.
4. Writes back.

Run the script while the app holds **both** keys (introduce a transitional
`TWO_FACTOR_ENCRYPTION_KEY_OLD` env var, deploy, run migration, remove old
key, deploy again).

---

## 3. Neon Postgres password (`neondb_owner`)

**Blast radius:** Brief auth gap (~15-30 sec) on whichever app rotates
second. Existing Postgres connections in the pool are fine — they're
already authenticated. Only NEW connections need the new password.

**Cadence:** Annually, OR immediately on suspected leak.

```bash
# ── Step 1: Reset in Neon console ──
# Neon dashboard → Roles → neondb_owner → Reset password
# Copy the new password to your password manager IMMEDIATELY (Neon shows it once)

NEW_PW='<paste new password here, then clear shell history>'

# ── Step 2: Update PROD first ──
# Hostname for prod is `ep-red-heart-aljqrpfj` (verify in your Neon console)
fly secrets set --app smart-apply-api \
  DATABASE_URL="postgresql://neondb_owner:$NEW_PW@ep-red-heart-aljqrpfj-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" \
  DIRECT_URL="postgresql://neondb_owner:$NEW_PW@ep-red-heart-aljqrpfj.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# ── Step 3: Update STAGING ──
# Different hostname (ep-proud-sound-ald0492q), same password
fly secrets set --app smart-apply-api-staging \
  DATABASE_URL="postgresql://neondb_owner:$NEW_PW@ep-proud-sound-ald0492q-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" \
  DIRECT_URL="postgresql://neondb_owner:$NEW_PW@ep-proud-sound-ald0492q.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# ── Step 4: Update local apps/api/.env ──
# Open in your editor, replace npg_OLD with the new password in DATABASE_URL/DIRECT_URL

# ── Step 5: Verify both ──
curl -s https://api.smart-apply.io/api/v1/health | jq '.data.info.database'
curl -s https://smart-apply-api-staging.fly.dev/api/v1/health | jq '.data.info.database'

# ── Step 6: Forget ──
unset NEW_PW
history -c   # zsh: clear shell history (or manually edit ~/.zsh_history)
```

> **Why prod first?** The instant you reset in Neon, the OLD password stops
> working everywhere. If you rotate staging first, prod runs broken until
> you get to it. Prod first = staging is the only thing broken during the
> 30-sec window, and staging breaking is fine.

> **Long-term improvement:** Create a separate Neon role per environment
> (`prod_owner` + `staging_owner`) so rotating one doesn't affect the other.

---

## 4. Cloudflare R2 token (per environment)

**Blast radius:** Existing PDF downloads via signed URLs keep working until
the URL expires (1 hour). New uploads/downloads break until the new key
propagates (~30 sec rolling restart).

**Cadence:** Every 6 months, OR immediately on suspected leak.

```bash
# ── Step 1: Cloudflare dashboard ──
# R2 → Manage R2 API tokens → find existing staging or prod token → Delete
# Then: Create API token →
#   Name: smart-apply-staging-rw  (or smart-apply-prod-rw)
#   Permissions: Object Read & Write
#   Apply to specific buckets: smart-apply-staging  (or smart-apply-prod)
#   TTL: 1 year
# Copy Access Key ID + Secret Access Key to your password manager (one-time view)

NEW_R2_KEY_ID='<new access key id>'
NEW_R2_SECRET='<new secret access key>'

# ── Step 2: Push to the matching Fly app ──
# STAGING:
fly secrets set --app smart-apply-api-staging \
  R2_ACCESS_KEY_ID="$NEW_R2_KEY_ID" \
  R2_SECRET_ACCESS_KEY="$NEW_R2_SECRET"

# PROD: same command with --app smart-apply-api and the prod token's values

# ── Step 3: Verify storage subcheck ──
sleep 30
curl -s https://smart-apply-api-staging.fly.dev/api/v1/health | jq '.data.info.storage'
# expect: {"status":"up"}

unset NEW_R2_KEY_ID NEW_R2_SECRET
```

---

## 5. Azure OpenAI API key

**Blast radius:** All LLM calls fail with 401 until rotation completes
(~30 sec). Background generation jobs in flight will retry via the
opossum circuit breaker; user-facing /generate endpoints will return 503
until the new key is live.

**Cadence:** Annually. Azure does not auto-expire keys, but Microsoft
recommends rotation per their Well-Architected Framework.

```bash
# ── Step 1: Azure Portal ──
# Azure OpenAI resource → Resource Management → Keys and Endpoint
# Two keys exist (KEY 1, KEY 2) for zero-downtime rotation:
#   1. Click "Regenerate" on KEY 2 (the one NOT currently in use)
#   2. Copy the new KEY 2 value
#   3. Update Fly Secrets to use KEY 2 (steps below)
#   4. Wait for rolling restart, verify
#   5. Click "Regenerate" on KEY 1 to invalidate the old leaked one
# This way there is no auth gap — both keys are valid simultaneously.

NEW_AZURE_KEY='<new KEY 2 value>'

# Both apps share the same Azure resource — same key, different deployments
fly secrets set --app smart-apply-api          AZURE_OPENAI_API_KEY="$NEW_AZURE_KEY"
fly secrets set --app smart-apply-api-staging  AZURE_OPENAI_API_KEY="$NEW_AZURE_KEY"

# Verify
sleep 30
curl -s https://api.smart-apply.io/api/v1/health | jq '.data.info.llm'
curl -s https://smart-apply-api-staging.fly.dev/api/v1/health | jq '.data.info.llm'

# Now invalidate the OLD key in Azure Portal (regenerate KEY 1)

# Update local apps/api/.env so dev doesn't break
unset NEW_AZURE_KEY
```

---

## 6. Upstash QStash (token + signing keys)

**Blast radius:** New job enqueue fails until rotation completes (~30 sec).
QStash supports key overlap during signing-key rotation — old signature
verifies for ~24 hours via `QSTASH_NEXT_SIGNING_KEY` after `CURRENT` rotates.

**Cadence:** Annually, OR immediately on suspected leak.

```bash
# ── Step 1: Upstash console ──
# QStash → Settings (or Details page)
#   - Click "Regenerate token"
#   - Click "Regenerate signing keys" (rotates both CURRENT + NEXT atomically)
# Copy all three values to your password manager.

NEW_TOKEN='<new QStash token>'
NEW_CURRENT='<new current signing key>'
NEW_NEXT='<new next signing key>'

# ── Step 2: Both apps share QStash — push to both ──
for APP in smart-apply-api smart-apply-api-staging; do
  fly secrets set --app "$APP" \
    QSTASH_TOKEN="$NEW_TOKEN" \
    QSTASH_CURRENT_SIGNING_KEY="$NEW_CURRENT" \
    QSTASH_NEXT_SIGNING_KEY="$NEW_NEXT"
done

# ── Step 3: Verify queue subcheck on both ──
sleep 30
curl -s https://api.smart-apply.io/api/v1/health | jq '.data.info.queue'
curl -s https://smart-apply-api-staging.fly.dev/api/v1/health | jq '.data.info.queue'

unset NEW_TOKEN NEW_CURRENT NEW_NEXT
```

---

## 7. Resend API key

**Blast radius:** All transactional email (password reset, verification)
fails until rotation completes. Users in the middle of password reset
flow get an error and have to retry.

**Cadence:** Annually.

```bash
# ── Step 1: Resend dashboard ──
# https://resend.com/api-keys → Create API key →
#   Name: smart-apply-prod  (or smart-apply-staging)
#   Permission: Full access (or Sending access only — preferred)
# Copy the value.

NEW_RESEND='<new Resend key starting with re_>'

# ── Step 2: Push to the matching Fly app ──
# Both apps can share one key, OR use separate keys per env.
fly secrets set --app smart-apply-api          RESEND_API_KEY="$NEW_RESEND"
fly secrets set --app smart-apply-api-staging  RESEND_API_KEY="$NEW_RESEND"

# ── Step 3: Revoke OLD key in Resend dashboard ──
# Verify by sending a test email (e.g. trigger password reset on a test account)

unset NEW_RESEND
```

---

## 8. OAuth client secrets (Google, Microsoft, Azure AD)

**Blast radius:** OAuth login flows fail until rotation completes. Users
who already have a session keep their JWTs (no impact) — only NEW logins
via that provider break.

**Cadence:** Per provider policy (Google: 2 years max, Microsoft: 2 years
max). All three providers email you reminders ~30 days before expiry.

```bash
# ── For Google ──
# console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client →
#   "Add Secret" (creates a second active secret for zero-downtime rotation)
# Or "Reset Secret" (immediate, breaks logins until new value is deployed)

# ── For Microsoft / Azure AD ──
# portal.azure.com → Entra ID → App registrations → smart-apply →
#   Certificates & secrets → New client secret
# Multiple secrets can coexist — preferred for zero-downtime.

# ── Push to Fly ──
fly secrets set --app smart-apply-api \
  GOOGLE_CLIENT_SECRET='<new google secret>'
# (Repeat for AZURE_AD_CLIENT_SECRET, MICROSOFT_CLIENT_SECRET if used)

# Staging usually doesn't have OAuth configured — skip unless you set it up.

# ── Verify ──
# Open https://smart-apply.io in a private window → Sign in with Google
```

---

## 9. Fly deploy token (CI)

**Blast radius:** GitHub Actions deploys fail until the new token is in
GitHub Environment secrets. Doesn't affect the running app.

**Cadence:** Annually, OR immediately when a contributor leaves the org.

```bash
# ── Step 1: Create new token, scoped to ONE app ──
# Prod token (for the production environment):
fly tokens create deploy --app smart-apply-api --name "github-actions-prod-$(date +%Y%m)" --expiry 8760h

# Staging token (for the staging environment):
fly tokens create deploy --app smart-apply-api-staging --name "github-actions-staging-$(date +%Y%m)" --expiry 8760h

# Copy the FlyV1 fm2_... token immediately — Fly shows it once.

# ── Step 2: GitHub UI ──
# Repo → Settings → Environments →
#   production environment → Secrets → FLY_API_TOKEN → Update
#   staging environment    → Secrets → FLY_API_TOKEN → Update

# ── Step 3: Revoke the old token ──
fly tokens list
fly tokens revoke <old-token-id>
```

---

## 10. Cloudflare API token (CI)

**Blast radius:** GitHub Actions deploys of the Worker fail. Doesn't
affect the running Worker.

**Cadence:** Annually.

```bash
# ── Step 1: Cloudflare dashboard ──
# My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template
#   Account resources: Include → smart-apply
#   Zone resources: Include → smart-apply.io
#   TTL: 1 year
# Copy the value.

# ── Step 2: GitHub UI ──
# Repo → Settings → Environments → production → Secrets →
# CLOUDFLARE_API_TOKEN → Update with new value.

# ── Step 3: Revoke the old token ──
# Cloudflare dashboard → API Tokens → find old token → ⋮ → Roll
```

---

## Recommended cadence

| Secret                          | Cadence       | Trigger for immediate rotation             |
| ------------------------------- | ------------- | ------------------------------------------ |
| `JWT_SECRET`                    | 12 months     | Suspected source leak, ex-employee         |
| `TWO_FACTOR_ENCRYPTION_KEY`     | Never*        | Confirmed leak only (\*needs migration)    |
| Neon `neondb_owner` password    | 12 months     | Suspected leak, contributor leaves         |
| R2 token                        | 6 months      | Suspected leak                             |
| Azure OpenAI API key            | 12 months     | Per Microsoft WAF guidance                 |
| QStash token + signing keys     | 12 months     | Suspected leak                             |
| Resend API key                  | 12 months     | Suspected leak                             |
| Google / MS / Azure AD OAuth    | Per provider  | Provider expiration warning email          |
| Fly deploy token (CI)           | 12 months     | Contributor leaves org                     |
| Cloudflare API token (CI)       | 12 months     | Contributor leaves org                     |

---

## After any rotation: shell history hygiene

If you pasted a secret on the command line:

```bash
# zsh
history -c                         # clear in-memory history
> ~/.zsh_history                   # truncate the file

# bash
history -c
> ~/.bash_history
```

Better long-term: prefix sensitive commands with a leading space — most
shells skip them when `HISTCONTROL=ignorespace` is set:

```bash
# Add to ~/.zshrc:
setopt HIST_IGNORE_SPACE

# Then prefix sensitive commands with a space:
 fly secrets set --app smart-apply-api JWT_SECRET='value-not-saved-to-history'
```

---

## What we explicitly do NOT do

- **Bulk-rotate everything.** Only rotate what's actually compromised or
  due. "Rotate all the things" makes diagnosis impossible if something
  breaks.
- **Use the same value across environments.** Staging and prod must have
  independent `JWT_SECRET`, `TWO_FACTOR_ENCRYPTION_KEY`, R2 tokens. Shared
  Azure OpenAI keys are OK (separate deployments) but not preferred long-term.
- **Email rotated values.** Always password manager, never inbox.
- **Leave the old credential active "just in case."** If you rotated it,
  revoke the old one immediately. Otherwise it's still a valid attack
  surface.
- **Skip the verification step.** A secret that "should be" set is not the
  same as a secret that's actually working. Always `curl /health` after.
