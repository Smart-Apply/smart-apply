# Contributing to Smart Apply

> **Audience:** Anyone making changes to this repository — solo maintainer
> today, future contributors tomorrow. Keep this file honest about what's
> currently enforced vs. what's convention.

---

## TL;DR

```bash
# 1. Branch from main
git checkout main && git pull
git checkout -b feat/<short-name>

# 2. Code, then commit using Conventional Commits
git commit -m "feat(profile): add languages section"

# 3. Push + open PR
git push -u origin feat/<short-name>
gh pr create --fill

# 4. Wait for CI to go green, then squash-merge
# 5. main → staging deploys automatically (~5 min)
# 6. release-please opens a Release PR — merge it when ready to ship prod
# 7. Tag push → prod deploy waits at approval gate → click approve → live
```

---

## Local development setup

See [QUICKSTART.md](QUICKSTART.md) for the full walkthrough. The condensed version:

```bash
corepack enable && corepack prepare pnpm@11.1.2 --activate  # one-time, installs pnpm
pnpm install
docker compose -f infra/docker-compose.yml up -d            # local Postgres
cp apps/api/.env.example apps/api/.env                      # then fill real values
cp apps/web/.env.example apps/web/.env
pnpm prisma:migrate
pnpm prisma:seed
pnpm prisma:seed:templates
pnpm dev                                                    # API :3000, Web :3001
```

The default `apps/api/.env` runs **mostly mocked** (Docker Postgres, disk
storage, in-memory queue) but with **real Azure OpenAI + OAuth + Resend** so
prompts and login actually behave like prod.

To exercise R2 / QStash / Upstash Redis locally, see the commented blocks
in `apps/api/.env.example` — flip a `*_DRIVER` and uncomment the matching
credential block.

---

## Branching model

We use **trunk-based development**. There is one long-lived branch (`main`)
and short-lived feature branches.

### Branch naming

| Prefix     | When to use                              |
| ---------- | ---------------------------------------- |
| `feat/`    | New feature                              |
| `fix/`     | Bug fix                                  |
| `chore/`   | Refactor, dep bump, tooling, no behavior |
| `docs/`    | Documentation only                       |
| `ci/`      | CI/CD config changes                     |
| `test/`    | Adding/refactoring tests                 |

Examples:

```
feat/job-bookmarks
fix/refresh-token-race
chore/upgrade-prisma-7-1
docs/contributing
ci/add-codeql-scanning
```

### Branch lifetime

- **Hours to two days, max.** Branches that live longer collect merge conflicts and rot.
- If a feature is too big for a 2-day branch, ship it in **multiple smaller PRs** behind a feature flag, not one giant branch.
- **Delete the branch after merge** (GitHub button or `git push origin :feat/...`).

### Why no `staging` / `develop` branch

Trunk-based development treats environments as **deployment targets**, not as branches. We have:
- A `staging` Fly app + Worker (auto-deployed from `main`)
- A `production` Fly app + Worker (deployed from tagged releases)

Adding a `staging` branch on top would mean two long-lived branches that drift apart and require double-merges. See [DEVOPS_ROADMAP.md](docs/guides/DEVOPS_ROADMAP.md) for the full reasoning.

---

## Commit messages: Conventional Commits

We use the [Conventional Commits](https://www.conventionalcommits.org/) spec because [`release-please`](https://github.com/googleapis/release-please-action) reads commit prefixes to compute the next semantic version and generate the changelog.

### Format

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer (e.g. BREAKING CHANGE: ...)>
```

### Types and their effect on the next release

| Prefix          | Version bump | Example                                                  |
| --------------- | ------------ | -------------------------------------------------------- |
| `feat:`         | minor        | `feat(profile): add languages section`                   |
| `fix:`          | patch        | `fix(auth): refresh token rotation race`                 |
| `feat!:`        | major        | `feat!: drop legacy /api/v0 endpoint`                    |
| `BREAKING CHANGE:` in footer | major | (any type with this footer triggers a major bump) |
| `chore:`        | no release entry | `chore: bump @nestjs/* to 11.2`                      |
| `docs:`         | no release entry | `docs: clarify R2 setup in QUICKSTART`               |
| `ci:`           | no release entry | `ci: add CodeQL scanning`                            |
| `refactor:`     | no release entry | `refactor(applications): extract pipeline service`   |
| `test:`         | no release entry | `test(profile): add unit tests for skill diffing`    |
| `perf:`         | patch        | `perf(pdf): warm Puppeteer pool on boot`                 |

### Scope (optional)

Use the module name from `apps/api/src/` or the package: `auth`, `profile`, `applications`, `llm`, `pdf`, `web`, `shared`, `infra`.

### Multiple commits per PR

Fine — we squash-merge, so all commits collapse into one. The **PR title** must follow Conventional Commits because that's what becomes the squash commit.

If you have several distinct changes, **open separate PRs**. Easier to review, easier to revert.

### Bad examples (don't do this)

```
wip                                    # ← no prefix, ambiguous
fixed bug                              # ← past tense, no scope
update                                 # ← uninformative
Various improvements                   # ← grab-bag PR
```

---

## Database changes (Prisma migrations)

If your change adds or alters a Prisma model, you **must** create a migration.

### During development

```bash
cd apps/api
npx prisma migrate dev --name <descriptive_name>
# e.g. add_bookmarks_table
# e.g. drop_legacy_avatar_url_column
```

This creates a SQL file in `apps/api/prisma/migrations/<timestamp>_<name>/`. **Commit it.**

### Forward-only migrations

We don't write `down` migrations. Rollback is via Neon point-in-time-restore, not Prisma.

### Expand → migrate → contract

For any non-trivial schema change, split across **two releases**:

1. **Expand release** (backwards-compatible)
   - Add the new column / table
   - Backfill if needed
   - New code reads from BOTH old and new columns
2. **Contract release** (after expand has shipped to prod for ≥ 1 day)
   - Stop reading the old column
   - DROP it in a separate migration

The classic anti-pattern: `feat: rename column foo to bar` — in one PR, with one migration, with one code change. The release command can't apply the migration before the new app code starts (or vice versa) without downtime.

---

## Pull requests

### Opening

```bash
git push -u origin feat/...
gh pr create --fill
```

`--fill` populates the PR title and body from your commit messages. If you used Conventional Commits properly, this Just Works.

### What CI runs

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every PR:

| Check               | What it verifies                              |
| ------------------- | --------------------------------------------- |
| `lint-and-typecheck`| `pnpm lint` passes; `pnpm-lock.yaml` is in sync with `package.json`s |
| `unit-tests`        | `pnpm test:unit` passes                       |

Both must be green before merge. (Currently advisory — once they're set up as required status checks in branch protection, the merge button stays grey until they pass.)

### Self-review

Solo dev: re-read your own diff in the GitHub PR view. You will catch things you missed locally. Expect to push 1-2 follow-up commits per PR — that's normal.

### Merging

**Always squash-merge.** Linear history is required for `release-please` to work cleanly. The squash commit message must be a Conventional Commit (GitHub auto-fills it from the PR title).

Then **delete the branch** (GitHub button).

---

## Release process

We use [`release-please`](https://github.com/googleapis/release-please-action) for automated versioning + changelog generation.

### How it works

1. You merge PRs to `main`. Each Conventional Commit (`feat:`, `fix:`, `feat!:`) is a release candidate.
2. `release-please` watches `main` and opens a **Release PR** titled like `chore(main): release 1.2.0`.
3. The Release PR contains:
   - Bumped `package.json` versions
   - Updated [CHANGELOG.md](CHANGELOG.md) with all entries grouped by type
4. **You merge the Release PR when you want to ship.** This creates a Git tag `v1.2.0`.
5. The tag push triggers [`deploy-prod.yml`](.github/workflows/deploy-prod.yml) → blocks at the `production` environment gate → you click **Approve and deploy** → live on smart-apply.io.

### Batching releases

The Release PR is **continuously updated** as you merge more `feat:`/`fix:` commits. You don't have to ship after every PR.

Typical cadence:
- Merge 3-5 feature PRs over a few days
- One Release PR accumulates all of them
- Ship once = one prod deploy = one CHANGELOG entry users can read

### Hotfix workflow

Same as a normal feature, just faster:

```bash
git checkout main && git pull
git checkout -b fix/critical-thing
# ... fix it ...
git commit -m "fix(auth): handle null in JWT payload"
git push -u origin fix/critical-thing
gh pr create --fill
# Merge
# release-please opens a Release PR (just for this fix)
# Merge that Release PR
# Tag triggers prod deploy → approve → live in ~10 min
```

There's no "skip staging" path. Even hotfixes go through the full pipeline. The pipeline is designed to be fast (< 15 min PR → prod) so this is rarely a problem.

---

## Deployments

| Trigger                      | Workflow                                                     | Target                                                                                | Approval     |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------ |
| Push to `main`               | [`deploy-staging.yml`](.github/workflows/deploy-staging.yml) | `smart-apply-api-staging.fly.dev` + `smart-apply-web-staging.ari41dev.workers.dev`    | Auto         |
| Tag `v*.*.*` push            | [`deploy-prod.yml`](.github/workflows/deploy-prod.yml)       | `api.smart-apply.io` + `smart-apply.io`                                               | Manual click |
| `workflow_dispatch` (manual) | Either workflow                                              | The corresponding env                                                                  | Per env rule |

### Rolling back

Fly does rolling deploys — old machines stay up until new ones pass health checks. If something goes wrong:

```bash
flyctl releases list --app smart-apply-api
flyctl releases rollback <release-id> --app smart-apply-api
```

Worker rollback is atomic via `wrangler rollback` (or the Cloudflare dashboard).

For DB schema rollbacks, use Neon point-in-time-restore via the dashboard. **Never** run `prisma migrate reset` against staging or prod.

See [docs/security/SECRETS_ROTATION.md](docs/security/SECRETS_ROTATION.md) for credential rotation procedures.

---

## Code style

### TypeScript

- Strict mode is on. Don't add `any` to silence the compiler — `unknown` + a type guard, or fix the upstream type.
- Don't add type annotations to obvious local variables (`const x: string = "hello"`). The inference is the documentation.
- Don't add docstrings, comments, or annotations to code you didn't change.

### Backend (NestJS)

- Use the existing module structure. New features go into a new directory under `apps/api/src/<module>/` with `*.module.ts`, `*.controller.ts`, `*.service.ts`.
- All endpoints under `/api/v1/...`.
- Validation via DTOs with `class-validator`. Always set `whitelist: true, forbidNonWhitelisted: true` on the controller's pipe.
- Sanitize string inputs from users with the existing `@Sanitize()` decorator.
- Prefer **transactions** for multi-table writes (`prisma.$transaction(...)`).
- Cache expensive reads via the existing cache module.

### Frontend (Next.js)

- App Router only. No Pages Router.
- Server components by default; mark client components explicitly with `'use client'`.
- Forms use `react-hook-form` + `zod` resolver.
- Server state via `@tanstack/react-query` with the existing `apiClient` wrapper. No raw `fetch()` in components.
- UI from `shadcn/ui` (Radix primitives). Add new components via `npx shadcn@latest add <name>`.

### Profession-neutral copy

Smart Apply is for **all professions**, not just tech. When writing user-facing copy, examples, or placeholders:

- ✅ "z.B. Projektmanager, Krankenpfleger, Vertriebsleiter"
- ❌ "z.B. Senior Software Engineer"

Use generic skill categories ("Core Competencies", "Methodologies"), not "Programming Languages" / "Frameworks".

---

## Security

### Never commit secrets

- `.env` files are gitignored. Never `git add` one.
- Ad-hoc files like `fly-staging-secrets.env` are also gitignored (`*-secrets.env` pattern).
- If you accidentally commit a secret: **rotate it immediately** per [SECRETS_ROTATION.md](docs/security/SECRETS_ROTATION.md), then `git filter-repo` or `git rebase -i` to remove from history before pushing.

### Don't paste real secrets in chat / Slack / Issues

The repo's GitHub Push Protection catches some leaks but isn't perfect. Always use a password manager.

### Reporting vulnerabilities

Email the maintainer directly. Do not open a public issue for security findings.

---

## What we do NOT accept in PRs

- **`git push --force` to main.** Ever.
- **Direct push to main without a PR.** Self-discipline rule for solo work; would be enforced via branch protection if we move to a paid GitHub plan.
- **Lockfile out of sync** — CI now blocks this. After editing any `package.json`, run `pnpm install` and commit the resulting `pnpm-lock.yaml` change in the same PR.
- **Bypassing CI** with `--no-verify` or skipping required checks.
- **Disabling validation** (`@Sanitize()`, DTO whitelist, JWT guards) without an explicit justification in the PR description.
- **DROP COLUMN in the same release** as the code that stopped using it (see expand/migrate/contract above).
- **Catch-and-ignore error handling** (`try { ... } catch {}`). If it can fail, handle it; if it can't, don't try-catch.

---

## Useful commands

```bash
# Run lint + tests (same as CI)
pnpm lint
pnpm test:unit

# Verify lockfile is in sync (same as CI)
pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts && git diff --exit-code pnpm-lock.yaml

# Open Prisma Studio (DB GUI)
pnpm prisma:studio

# Reset local DB (WARNING: deletes everything)
cd apps/api && pnpm exec prisma migrate reset

# Manually deploy current main to staging (bypassing CI, for quick smoke tests)
flyctl deploy --config fly.staging.toml --app smart-apply-api-staging --remote-only

# View staging logs
flyctl logs --app smart-apply-api-staging

# View staging health
curl https://smart-apply-api-staging.fly.dev/api/v1/health | jq
```

---

## Documentation

- [README.md](README.md) — high-level overview
- [QUICKSTART.md](QUICKSTART.md) — get the app running locally
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture
- [docs/guides/DEVOPS_ROADMAP.md](docs/guides/DEVOPS_ROADMAP.md) — what we built and why
- [docs/security/SECRETS_ROTATION.md](docs/security/SECRETS_ROTATION.md) — how to rotate every credential
- [docs/](docs/) — full documentation index

---

## Questions?

Open a [discussion](https://github.com/Smart-Apply/smart-apply/discussions) or DM the maintainer. For bug reports, open an [issue](https://github.com/Smart-Apply/smart-apply/issues).
