# DevOps Roadmap — Multi-Stage Environments, Secrets & Releases

> **Status:** ✅ **Implemented** (May 2026). The plan below is preserved for
> reference. See the "Shipped state" section directly below for what's
> actually live.
> **Audience:** Solo / small team running Smart Apply on Fly.io + Cloudflare Workers + Neon.
> **Goal state:** `local → staging → prod` with safe migrations, scoped secrets, and tag-driven releases via Conventional Commits + release-please.

---

## Shipped state (May 2026)

| Phase | Item | Status | Where |
|---|---|---|---|
| 1 | Neon `staging` branch + R2 bucket + Upstash QStash + Fly app + CF Worker | ✅ | live |
| 1 | Custom domains (`*.staging.smart-apply.io`) | ⏸ deferred | use `*.workers.dev` / `*.fly.dev` |
| 2 | GitHub Environments: `production` (gated), `staging` (auto), `copilot` | ✅ | repo Settings |
| 2 | Per-env JWT/2FA secrets, scoped Fly tokens, secret rotation runbook | ✅ | [SECRETS_ROTATION.md](../security/SECRETS_ROTATION.md) |
| 2 | Push protection + secret scanning + Dependabot security updates | ✅ | org-level |
| 2 | gitleaks pre-commit hook | ⏸ deferred | optional |
| 3 | `ci.yml` (lint + tests + lockfile sync check) | ✅ | runs on every PR |
| 3 | `deploy-staging.yml` (auto on `main` push) | ✅ | no approval gate |
| 3 | `deploy-prod.yml` (gated on `v*.*.*` tag push) | ✅ | requires manual approval |
| 4 | release-please workflow + Conventional Commits adoption | ✅ | first release: v1.1.0 |
| 4 | commitlint pre-commit hook | ⏸ deferred | self-discipline for now |
| 4 | Sentry release tagging in deploy workflows | ⏸ deferred | nice-to-have |
| 5 | Per-PR Neon migration dry-run + drift check | ✅ | [ci.yml](../../.github/workflows/ci.yml) |
| 5 | Migration rollback runbook | ✅ | [MIGRATION_ROLLBACK.md](../security/MIGRATION_ROLLBACK.md) |
| 6 | PR previews, Doppler, k6 load tests, synthetic monitoring | ⏸ deferred | when scale demands |

**The contributor workflow it produced:** see [CONTRIBUTING.md](../../CONTRIBUTING.md) for the daily-use guide.

---

## TL;DR

| Today                                    | Target                                         |
| ---------------------------------------- | ---------------------------------------------- |
| `main` push deploys straight to prod     | `main` → staging (auto), tag `vX.Y.Z` → prod (gated) |
| One Fly app, one Neon DB, one CF Worker  | Two of each (`-staging` siblings)              |
| Secrets live in `apps/api/.env` + Fly    | Secrets live in GitHub Environments → synced to Fly / CF |
| Manual versioning                        | release-please: Conventional Commits → CHANGELOG + tag |
| No DB migration dry-run                  | Per-PR Neon branch + `prisma migrate deploy` smoke |

---

## Architecture target

```
┌──────────┐  push   ┌──────────────┐  PR open  ┌──────────────────┐
│  local   │  ────►  │     main     │  ──────►  │ pr-<num> Neon br │
│ Docker DB│         │   (trunk)    │           │ + ephemeral CI   │
└──────────┘         └──────┬───────┘           └──────────────────┘
                            │ merge
                            ▼
                  ┌──────────────────────┐
                  │ STAGING              │
                  │  smart-apply-api-    │
                  │   staging (Fly)      │
                  │  smart-apply-web     │
                  │   [env.staging]      │
                  │  Neon `staging` br   │
                  └──────────┬───────────┘
                             │ release-please PR merged → tag vX.Y.Z
                             ▼ (manual approval)
                  ┌──────────────────────┐
                  │ PROD                 │
                  │  smart-apply-api     │
                  │  smart-apply-web     │
                  │  Neon `main` branch  │
                  └──────────────────────┘
```

---

## Phase 0 — Prerequisites (½ hour)

- [ ] Confirm Neon plan supports ≥10 branches (Launch tier or higher).
- [ ] Decide staging hostnames:
  - API: `api.staging.smart-apply.io`
  - Web: `staging.smart-apply.io`
- [ ] Generate per-env JWT + 2FA secrets (one set per environment):
  ```bash
  openssl rand -base64 64    # JWT_SECRET (staging + prod, separately)
  openssl rand -hex 32       # TWO_FACTOR_ENCRYPTION_KEY
  ```
- [ ] Create a Fly deploy token scoped to **staging only**:
  ```bash
  fly tokens create deploy --app smart-apply-api-staging
  ```
  Keep the existing prod token; never let staging CI use it.

---

## Phase 1 — Provision the staging environment (1–2 hrs)

### 1.1 Neon staging branch

In the Neon console (or via CLI):

```bash
neon branches create --project-id <id> --name staging --parent main
```

- Inherits prod schema.
- Optional: schedule `neon branches reset staging --parent main` weekly so staging never drifts more than 7 days from prod.
- Capture both URLs (pooled + direct) — these become Fly Secrets, not committed values.

### 1.2 Cloudflare R2 staging bucket

```bash
# Or via dashboard: R2 → Create bucket → Jurisdiction: EU
wrangler r2 bucket create smart-apply-staging --location=eu
```

Generate a token scoped to **only** that bucket (R2 → Manage R2 API tokens → Object Read/Write, single bucket).

### 1.3 Upstash staging instances

- Create separate **QStash** project + **Redis** instance for staging (free tier covers it).
- Region: `eu-central-1`.

### 1.4 Azure OpenAI staging deployment

Already provisioned in your existing Azure OpenAI resource:

```
deployments/
  gpt-4.1            ← prod    (200K TPM)
  gpt-4.1-staging    ← staging (medium quota)
  gpt-4.1-local      ← local dev (low quota — runaway-loop safe)
```

Same API key across all three; only `AZURE_OPENAI_DEPLOYMENT_NAME` differs
per environment. This way a bad prompt loop in staging or local can't
starve prod of TPM.

### 1.5 Fly staging app

Split today's `fly.toml` into two configs:

```bash
mv fly.toml fly.prod.toml
cp fly.prod.toml fly.staging.toml
```

Edit `fly.staging.toml`:

```toml
app = 'smart-apply-api-staging'
primary_region = 'fra'

[http_service]
  auto_stop_machines = 'suspend'
  min_machines_running = 0          # ← suspend on idle to save €€

[[vm]]
  size = 'shared-cpu-1x'
  memory = '1gb'                    # ← smaller than prod's 2gb
```

Create the Fly app + push secrets:

```bash
fly apps create smart-apply-api-staging --org <your-org>
fly secrets set --app smart-apply-api-staging \
  DATABASE_URL='postgresql://…neon staging pooled…' \
  DIRECT_URL='postgresql://…neon staging direct…' \
  JWT_SECRET='…openssl rand -base64 64…' \
  TWO_FACTOR_ENCRYPTION_KEY='…openssl rand -hex 32…' \
  AZURE_OPENAI_API_KEY='<same key>' \
  AZURE_OPENAI_DEPLOYMENT_NAME='gpt-4.1-staging' \
  R2_ACCESS_KEY_ID='…staging…' \
  R2_SECRET_ACCESS_KEY='…staging…' \
  R2_BUCKET='smart-apply-staging' \
  QSTASH_TOKEN='…staging…' \
  UPSTASH_REDIS_REST_URL='…staging…' \
  UPSTASH_REDIS_REST_TOKEN='…staging…' \
  RESEND_API_KEY='<same or staging-scoped>'
```

First deploy (manual, to verify):

```bash
fly deploy --config fly.staging.toml --app smart-apply-api-staging --remote-only
```

### 1.6 Cloudflare Worker staging environment

Edit `apps/web/wrangler.jsonc` to add an `env.staging` block:

```jsonc
{
  "name": "smart-apply-web",
  // …existing top-level config = prod defaults…
  "vars": {
    "NEXT_PUBLIC_API_URL": "https://api.smart-apply.io/api/v1"
  },

  "env": {
    "staging": {
      "name": "smart-apply-web-staging",
      "vars": {
        "NEXT_PUBLIC_API_URL": "https://api.staging.smart-apply.io/api/v1"
      }
    }
  }
}
```

Deploy with:

```bash
cd apps/web
npm run cf:build
wrangler deploy --env staging       # ← staging
wrangler deploy                     # ← prod (unchanged)
```

### 1.7 DNS / TLS

In the Cloudflare dashboard:

- DNS: `api.staging.smart-apply.io` → Fly app `smart-apply-api-staging` (CNAME to `smart-apply-api-staging.fly.dev`, proxied OFF for cert issuance, then re-enable).
- DNS: `staging.smart-apply.io` → Worker `smart-apply-web-staging` (Custom Domain).
- Issue Fly cert: `fly certs create api.staging.smart-apply.io --app smart-apply-api-staging`.

---

## Phase 2 — GitHub Environments + secret hygiene (1 hr)

### 2.1 Create GitHub Environments

Repo → Settings → Environments → New environment:

| Environment | Required reviewers | Branch protection            |
| ----------- | ------------------ | ---------------------------- |
| `staging`   | none               | `main` only                  |
| `production`| **you** (yourself) | tags `v*.*.*` only           |

### 2.2 Per-environment secrets & vars

For each environment, populate:

**Secrets** (encrypted, write-only after entry):

```
FLY_API_TOKEN              # scoped to that environment's app
CLOUDFLARE_API_TOKEN
NEON_API_KEY               # only in PR + staging envs (for branch automation)
SENTRY_AUTH_TOKEN          # for source map uploads
```

**Variables** (visible, safe to log):

```
FLY_APP                    # smart-apply-api-staging or smart-apply-api
HEALTH_CHECK_HOST          # api.staging.smart-apply.io or api.smart-apply.io
PUBLIC_API_URL             # baked into the Worker bundle
TURNSTILE_SITE_KEY         # public by design
SENTRY_DSN_WEB             # public DSN
WRANGLER_ENV               # 'staging' or '' (empty = prod)
```

### 2.3 Rotate everything you used in single-env mode

The keys currently in your local `.env` were also being pushed to prod. After staging is up:

- [ ] Rotate `JWT_SECRET` (prod) → all users get logged out once.
- [ ] Rotate `TWO_FACTOR_ENCRYPTION_KEY` (prod) → write a one-shot migration to re-encrypt secrets.
- [ ] Rotate `AZURE_OPENAI_API_KEY`, `RESEND_API_KEY`, OAuth client secrets (if you can without breaking redirect URIs).
- [ ] Rotate `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` for prod bucket.

### 2.4 Add `gitleaks` pre-commit hook

```bash
npm install --save-dev --save-exact lint-staged simple-git-hooks
brew install gitleaks
```

`.gitleaks.toml`:

```toml
[extend]
useDefault = true
[[allowlist.regexes]]
description = "Cloudflare Turnstile site keys are public by design"
regex = '''0x[A-Z0-9]{20,}|1x00000000000000000000AA'''
```

Add to `package.json`:

```jsonc
{
  "simple-git-hooks": {
    "pre-commit": "npx --no-install gitleaks protect --staged --redact"
  }
}
```

### 2.5 Turn on GitHub Push Protection

Repo → Settings → Code security → Push protection: **enable**.

---

## Phase 3 — Split the deploy workflow (1 hr)

Replace `.github/workflows/deploy.yml` with **three** workflows:

### 3.1 `.github/workflows/ci.yml` — runs on every PR

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci --legacy-peer-deps
      - run: npm run shared:build
      - run: npm run lint
      - run: npm run test:unit

  migration-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      # Create an ephemeral Neon branch off `staging`
      - id: branch
        uses: neondatabase/create-branch-action@v5
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          parent: staging
          branch_name: pr-${{ github.event.number }}
          api_key: ${{ secrets.NEON_API_KEY }}

      - run: npm ci --legacy-peer-deps
      - name: Apply migrations to ephemeral branch
        env:
          DATABASE_URL: ${{ steps.branch.outputs.db_url_pooled }}
          DIRECT_URL:   ${{ steps.branch.outputs.db_url }}
        run: |
          cd apps/api
          npx prisma migrate deploy
          npx prisma migrate diff \
            --from-url "$DIRECT_URL" \
            --to-schema-datamodel prisma/schema.prisma \
            --exit-code

      - if: always()
        uses: neondatabase/delete-branch-action@v3
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          branch: pr-${{ github.event.number }}
          api_key: ${{ secrets.NEON_API_KEY }}
```

### 3.2 `.github/workflows/deploy-staging.yml` — push to `main`

```yaml
name: Deploy → Staging
on:
  push:
    branches: [main]
    paths-ignore: ['**.md', 'docs/**']
  workflow_dispatch:

concurrency:
  group: deploy-staging
  cancel-in-progress: false

jobs:
  deploy-api:
    environment: staging         # ← uses GitHub Environment secrets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: |
          flyctl deploy \
            --app "${{ vars.FLY_APP }}" \
            --config fly.staging.toml \
            --remote-only --strategy rolling
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
      # … health check against ${{ vars.HEALTH_CHECK_HOST }}

  deploy-web:
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci --workspace=apps/web --workspace=packages/shared --include=dev --legacy-peer-deps
      - run: npm run shared:build
      - working-directory: apps/web
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          NEXT_PUBLIC_API_URL: ${{ vars.PUBLIC_API_URL }}
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${{ vars.TURNSTILE_SITE_KEY }}
          NEXT_PUBLIC_SENTRY_DSN: ${{ vars.SENTRY_DSN_WEB }}
          NEXT_PUBLIC_SENTRY_RELEASE: ${{ github.sha }}
        run: |
          npm run cf:build
          npx wrangler deploy --env ${{ vars.WRANGLER_ENV }}
```

### 3.3 `.github/workflows/deploy-prod.yml` — tag `v*.*.*`

```yaml
name: Deploy → Production
on:
  push:
    tags: ['v*.*.*']
  workflow_dispatch:

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  deploy-api:
    environment: production    # ← REQUIRES YOUR APPROVAL CLICK
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: |
          flyctl deploy \
            --app "${{ vars.FLY_APP }}" \
            --config fly.prod.toml \
            --remote-only --strategy rolling
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy-web:
    environment: production
    runs-on: ubuntu-latest
    # …same shape as staging, but with prod vars/secrets…
```

---

## Phase 4 — Semantic Versioning with release-please (½ hr)

### 4.1 Add release-please workflow

`.github/workflows/release-please.yml`:

```yaml
name: release-please
on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          release-type: node
          package-name: smart-apply
```

### 4.2 Adopt Conventional Commits

Add `commitlint` + Husky:

```bash
npm install --save-dev --save-exact @commitlint/cli @commitlint/config-conventional
```

`commitlint.config.js`:

```js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

Hook it via `simple-git-hooks` (already added in Phase 2.4):

```jsonc
{
  "simple-git-hooks": {
    "pre-commit": "npx --no-install gitleaks protect --staged --redact",
    "commit-msg": "npx --no-install commitlint --edit"
  }
}
```

**Commit conventions you'll use:**

| Prefix       | Bumps    | Example                                      |
| ------------ | -------- | -------------------------------------------- |
| `feat:`      | minor    | `feat(profile): add languages section`       |
| `fix:`       | patch    | `fix(auth): refresh token rotation race`     |
| `feat!:`     | major    | `feat!: drop /api/v0`                        |
| `chore:`     | none     | `chore: bump deps`                           |
| `docs:`      | none     | `docs: update README`                        |

### 4.3 Release flow

1. Merge PRs to `main` using Conventional Commits.
2. release-please opens a "Release PR" that:
   - Bumps `package.json` version
   - Updates `CHANGELOG.md`
3. Review + merge that PR.
4. release-please creates tag `v1.5.0` → triggers `deploy-prod.yml`.
5. You approve the production environment in GitHub Actions UI → prod deploys.

### 4.4 Tag Sentry releases

Append to both deploy workflows:

```yaml
- uses: getsentry/action-release@v1
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: <your-org>
    SENTRY_PROJECT: smart-apply
  with:
    environment: ${{ vars.WRANGLER_ENV || 'production' }}
    version: ${{ github.ref_name }}      # 'v1.5.0' on tag pushes
```

---

## Phase 5 — Migration safety (½ hr)

Already covered in Phase 3.1 (PR-time Neon branch + `prisma migrate deploy` dry-run). Add the human side:

- **Add to `docs/security/` or `docs/guides/`:** runbook called `MIGRATION_ROLLBACK.md` documenting:
  1. `flyctl releases list --app smart-apply-api` to find the previous release.
  2. `flyctl releases rollback <id>` to redeploy the previous image.
  3. For schema rollbacks, **do not use `prisma migrate reset`**. Instead:
     - In Neon console: `Branches → main → Restore` to the snapshot taken before the bad release. PITR is automatic.
     - Or branch off the snapshot, repoint Fly via `fly secrets set DATABASE_URL=…`, then promote the branch.
- **Backwards-compatible migrations rule:** every migration must be deployable while the old code is still running (expand → migrate → contract). No `DROP COLUMN` in the same release as the code that stopped using it; defer the drop one release.

---

## Phase 6 — Optional polish (later)

| Item                         | When to bother                                   |
| ---------------------------- | ------------------------------------------------ |
| Per-PR Fly preview apps      | When you onboard a contributor and review > deploy |
| Doppler / Azure Key Vault    | When you have ≥3 engineers or auto-rotation needs |
| Wrangler `[env.preview]`     | When PR previews would help with frontend review  |
| Synthetic monitoring (Checkly, Better Uptime) | After first paying customer    |
| Load tests in CI (k6)        | Before announcing publicly                       |

---

## What this plan does NOT do (and why)

- **No GitFlow.** Trunk-based + tagged releases is enough for a solo dev. GitFlow's `develop` branch buys nothing here.
- **No persistent cloud `dev` env.** Docker Postgres + your local `.env` is faster, cheaper, and isolated. Add a cloud `dev` env only if a contributor joins.
- **No shared "dev" Neon branch.** Same shared-mutable-state problem as a shared dev DB. Personal `dev-<yourname>` branches are fine if you want cloud DB on the road.
- **No secrets manager service.** GitHub Environments cover the use case at this scale; switch to Doppler/Vault if you outgrow them.
- **No per-package versions in the monorepo.** One repo-wide version (`smart-apply@1.5.0`) until `packages/shared` is published externally.

---

## Implementation order (recommended)

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
   ½h      1-2h       1h        1h       ½h        ½h
   prereq  staging   secrets   workflows release   migrations
```

Each phase is independently shippable — you can stop after Phase 1 and still benefit from a real staging environment.

---

## Acceptance criteria — "we're done"

- [ ] Pushing to `main` deploys to staging only, never prod.
- [ ] Tagging `v1.0.1` requires manual approval before prod deploys.
- [ ] `JWT_SECRET` value differs between staging and prod (prove by `fly secrets list --app …`).
- [ ] A PR with a new Prisma migration shows a green `migration-check` job.
- [ ] `git push` of a commit with leaked-looking secrets is rejected by `gitleaks`.
- [ ] `git commit -m "wip"` is rejected by commitlint.
- [ ] `CHANGELOG.md` auto-updates on every release.
- [ ] Sentry shows a "release" marker matching the tag name.
- [ ] Rolling back to `v1.0.0` in Fly takes < 60 seconds.
