# Smart Apply — Rearchitecture Plan

> **Status:** Closed out · **Owner:** Arian · **Created:** 2026-05-11 · **Closed:** 2026-05-14
>
> Phased plan to retire the highest-cost / highest-risk parts of the current stack without a big-bang rewrite. Phase 1 + 2 shipped (v2.0.0 + v3.0.0). Phases 3 + 4 explicitly skipped — see [decision log](#decision-log). Phase 5 stays opportunistic. Kept here as a record; new architectural pivots get their own plan.

---

## Goals

1. **Cut infra cost** (Fly machines are oversized because of Chromium).
2. **Remove the largest sources of prod weirdness** (browser pool, hand-rolled auth).
3. **Reduce maintenance surface** (delete code we shouldn't be maintaining ourselves).
4. **Keep the things that work** (NestJS, Next.js, Neon, Fly, R2, QStash, Sentry, Resend, trunk-based + release-please).

## Non-Goals

- Not a framework rewrite. NestJS and Next.js stay.
- Not a hosting migration. Fly + Cloudflare stay.
- Not a multi-month feature freeze. Every phase ships independently and main stays releasable.
- Not done during the [public-launch push](./PUBLIC_LAUNCH_PLAN.md). Stabilize first, refactor after.

---

## Guiding principles

- **Co-existence over cutover.** New module lands next to old, both wired, traffic shifted by feature flag.
- **One phase per branch.** No 3-month branches nobody can review.
- **Measurable win per phase.** RAM drop, LoC delete, p95 improvement — pick one upfront.
- **Default to production providers.** The "in-memory" / "disk" pluggable variants exist for local dev only and must throw in prod.
- **No new long-lived branches.** Everything still squash-merges to `main` per [CONTRIBUTING.md](../../CONTRIBUTING.md).

---

## Phase overview

| # | Change | Effort | Risk | Win | Status |
|---|---|---|---|---|---|
| 1 | Puppeteer → `@react-pdf/renderer` | 2–3 wk | Medium (visual diffs) | -70% API RAM, -300 MB image | **✅ Done (v1.16)** — 3 designs ported (`classic-ats`, `harvard-classic`, `elegant-sidebar`), puppeteer + handlebars + pdf-lib + generic-pool removed; PNG previews now via `pdfjs-dist` + `@napi-rs/canvas` |
| 2 | Lock prod to real providers (`r2` / `qstash`) | 1 day | Low | Removes a footgun | **✅ Done (v3.0.0)** — boot fails when `NODE_ENV=production` and `STORAGE_DRIVER!='r2'` or `JOBS_DRIVER!='qstash'` (enforced via Zod `.superRefine()` in [`env.schema.ts`](../../apps/api/src/config/env.schema.ts)) |
| 3 | passport stack → better-auth | 3–4 wk | High (logs users out) | -2000 LoC, +WebAuthn | **⛔ Skipped** — see [decision log 2026-05-14](#decision-log) |
| 4 | Prisma → Drizzle | 2–3 wk | Medium (query semantics) | No codegen, faster cold start | **⛔ Skipped** — see [decision log 2026-05-14](#decision-log) |
| 5 | **npm → pnpm** ✅, **Jest → Vitest** ✅, OpenRouter | Opportunistic | Low | Quality of life | pnpm + Vitest done (May 2026); OpenRouter still opportunistic |

**Status:** Phase 1 + 2 shipped. Phases 3 + 4 explicitly skipped. Phase 5 is purely opportunistic.

---

## Phase 1 — Puppeteer → `@react-pdf/renderer`

### Why
- Browser pool ([pdf.service.ts](../../apps/api/src/pdf/pdf.service.ts)) is the single largest source of prod RAM, image bloat, and zombie-process bugs.
- 50 templates × 2 languages is the *core product asset* — moving them to typed React components gives us LSP refactors, shared layout primitives, and TS autocomplete on `ResumeData`.
- Deterministic page breaks via `<View wrap={false}>` instead of fighting Chromium's `page-break-inside: avoid`.
- PDF text layer is real text by construction — better for ATS.

### Scope
- New module `apps/api/src/pdf-v2/` co-existing with `apps/api/src/pdf/`.
- Both wired through `PdfModule`, selected by per-user feature flag (`pdfRenderer: 'puppeteer' | 'react-pdf'`).
- Port template families in this order:
  1. [classic-ats](../../apps/api/src/pdf/templates/classic-ats/styles.css) (proof)
  2. [harvard-classic](../../apps/api/src/pdf/templates/harvard-classic/styles.css)
  3. [elegant-sidebar](../../apps/api/src/pdf/templates/elegant-sidebar/styles.css)
- Snapshot regression harness: render both, extract text via `pdf-parse`, diff. Visual diff via `pixelmatch` on first-page raster.
- Per-template feature flag so we can enable react-pdf for `classic-ats` while still serving Puppeteer for the others.

### Out of scope (deferred to phase end)
- Removing `puppeteer`, `playwright`, `generic-pool` deps — happens *after* react-pdf is the default for 7 days clean.
- Shrinking Fly machine size — same.
- Updating preview PNGs in [scripts](../../apps/api/scripts) — happens per template as it's ported.

### Cutover
1. PR per template family, merged to main, shipped to staging via [deploy-staging.yml](../../.github/workflows/deploy-staging.yml).
2. Internal QA on staging (generate one application per template × language).
3. Per-user opt-in flag flipped for admin accounts (`ADMIN_EMAILS`) for 1 week.
4. Default flipped globally; old Puppeteer path kept as fallback for 7 days.
5. Delete `apps/api/src/pdf/`, drop deps, shrink machines (separate PR, separate release).

### Rollback
- Per-user flag: instant revert via `/admin/users/:email/preferences`.
- Global default: revert the one PR that flipped the default.
- After deletion: revert the cleanup PR — Puppeteer code lives in git history.

### Success metric
- API container RSS p95 drops from ~800 MB to <300 MB.
- Docker image (`infra/Dockerfile`) drops by ≥250 MB.
- PDF generation p95 drops or stays flat (do not regress).
- 0 visual regressions reported by users in 14-day window post-cutover.

### Doc updates required
- [README.md](../../README.md) — Tech Stack section.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — PDF generation pipeline diagram.
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md) — Backend Modules + PDF section.
- [docs/features/PDF_GENERATION.md](../features/PDF_GENERATION.md) — full rewrite.
- [docs/guides/TEMPLATE_GUIDE.md](./TEMPLATE_GUIDE.md) — full rewrite (CSS → TSX).
- [docs/implementation/BROWSER_POOLING.md](../implementation/BROWSER_POOLING.md) — mark as historical.

---

## Phase 2 — Lock prod to real providers

### Why
- `JOBS_DRIVER=in-memory` in prod silently drops jobs on machine restart.
- `STORAGE_DRIVER=disk` in prod writes to ephemeral Fly volumes and loses files on redeploy.
- Both are local-dev affordances that have no business being reachable in prod.

### Scope
- [apps/api/src/config/config.service.ts](../../apps/api/src/config/config.service.ts) — throw on boot if `NODE_ENV=production` and `JOBS_DRIVER !== 'qstash'` or `STORAGE_DRIVER !== 'r2'`.
- [fly.prod.toml](../../fly.prod.toml) and [fly.staging.toml](../../fly.staging.toml) — assert env vars are set (already are; this just enforces).
- Update [apps/api/.env.example](../../apps/api/.env.example) with a comment explaining prod restrictions.

### Cutover
- Single PR, merged to main, ships to staging immediately. If staging boots, it's safe.

### Rollback
- Revert the PR.

### Success metric
- Boot fails loudly if misconfigured. No behavioural change in normal operation.

---

## Phase 3 — passport stack → better-auth

> **⛔ Skipped (2026-05-14).** Revisit only if (a) a real CVE drops in passport-jwt that's painful to patch, (b) a customer demands WebAuthn / passkeys, or (c) we find ourselves touching auth code monthly. See [decision log](#decision-log) for the full rationale.

### Why
- ~2000 LoC of hand-rolled auth (passport-jwt + refresh rotation + 2FA + OAuth + sessions) that better-auth ships out of the box, battle-tested.
- WebAuthn / passkeys for free.
- Removes [apps/api/src/auth/](../../apps/api/src/auth/) from our maintenance surface.

### Scope
- Stand up better-auth under `/api/v2/auth/*` alongside existing `/api/v1/auth/*`.
- Migrate password hashes (better-auth supports importing argon2id directly — verified before commit).
- Migrate OAuth provider configs (Google, Microsoft, Azure AD).
- Bridge `User` table — better-auth uses its own session/refresh tables but can share the user table via adapter.
- 2FA (TOTP) migration — secrets are portable, just swap the verification library.
- Frontend `apiClient` updated to call v2 endpoints behind a flag.

### Out of scope
- Multi-tenant orgs (still non-goal per [copilot-instructions.md](../../.github/copilot-instructions.md)).
- Magic-link login (defer until requested).

### Cutover
1. Ship v2 endpoints, dual-write sessions for 1 week.
2. Frontend flips to v2 for new logins; existing v1 sessions remain valid until natural expiry (15 min access / 7 day refresh).
3. After 8 days, all sessions are v2; v1 endpoints return 410 Gone.
4. Delete `apps/api/src/auth/` — replaced by `apps/api/src/auth-v2/` (or rename).

### Rollback
- During dual-write window: flip frontend flag back to v1.
- After cutover: hard. Restore from git, manually re-issue refresh tokens. **This is why Phase 3 ships only when traffic is calm.**

### Success metric
- LoC in `apps/api/src/auth*` reduced by ≥60%.
- 0 reports of broken login / 2FA / OAuth in 14-day window.
- Auth-related Sentry errors drop or stay flat.

### Doc updates required
- [README.md](../../README.md) — Tech Stack + Auth.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — Auth flow diagrams.
- [docs/security/REFRESH_TOKENS.md](../security/REFRESH_TOKENS.md) — full rewrite.
- [docs/security/SECURITY.md](../security/SECURITY.md) — auth section.
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md) — Auth Endpoints section.

---

## Phase 4 — Prisma → Drizzle

> **⛔ Skipped (2026-05-14).** Prisma works, the codegen step costs ~10s in CI, the cold-start gain is theoretical for an always-on Fly machine. Revisit only if (a) we move read-heavy endpoints to Cloudflare Workers (where Prisma's edge story still bites) or (b) the Prisma engine binary becomes a meaningful share of the Docker image again. See [decision log](#decision-log).

### Why
- No codegen step (`prisma generate` removed from CI + Docker build).
- Faster cold starts (smaller bundle, no `@prisma/client` runtime).
- Edge-runtime compatible — opens the door to moving read-heavy endpoints to Cloudflare Workers later.
- SQL-first feels closer to Postgres; nested writes are explicit (which we want).

### Scope
- 16 models in [schema.prisma](../../apps/api/prisma/schema.prisma) → Drizzle schema in `apps/api/src/db/schema.ts`.
- Drizzle Kit reads existing migration history; **do not regenerate migrations**. Forward-only per [MIGRATION_ROLLBACK.md](../security/MIGRATION_ROLLBACK.md) still applies.
- Migrate per-module, read-paths first:
  1. `profile/` (most queries, no FK fan-out from this module)
  2. `applications/` (FK fan-out, do last)
  3. Everything else in any order
- Both ORMs co-exist against the same DB during migration. Prisma stays for migrations only at the end.

### Cutover
- Per-module PR. Each one ships independently, no big-bang.
- Final PR removes `@prisma/client` runtime dep. Prisma CLI may stay for migrations or be replaced by Drizzle Kit at the end.

### Rollback
- Per module: revert that module's PR. Other modules unaffected.

### Success metric
- Docker image -50 MB (no Prisma engine binary).
- API cold start -200 ms.
- 0 query semantic regressions (caught by existing e2e tests).

### Doc updates required
- [README.md](../../README.md) — Tech Stack.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — Data layer.
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md) — Tech Stack + Data Model.
- [docs/guides/PRISMA_7_CICD_MIGRATION.md](./PRISMA_7_CICD_MIGRATION.md) — supersede or archive.

---

## Phase 5 — Opportunistic cleanups

No big PRs. Do these as you happen to touch the affected areas.

### npm → pnpm (✅ Done — May 2026)
- Strict hoisting kills phantom deps and the `--legacy-peer-deps` flag.
- Migrated in [`chore/pnpm-migration`](https://github.com/Smart-Apply/smart-apply): added `pnpm-workspace.yaml` + `.npmrc`, switched root `packageManager` to `pnpm@11.1.2`, moved `overrides` to `pnpm.overrides`, regenerated lockfile (`package-lock.json` deleted, `pnpm-lock.yaml` committed).
- All internal `npm run X` calls inside workspace package.json scripts → `pnpm run X` so the production Docker image no longer ships npm.
- [`infra/Dockerfile`](../../infra/Dockerfile) rewritten around `pnpm deploy --prod` — produces an isolated, hoisted production tree with workspace deps (`@smart-apply/shared`) resolved into real copies.
- All three GH workflows ([ci.yml](../../.github/workflows/ci.yml), [deploy-staging.yml](../../.github/workflows/deploy-staging.yml), [deploy-prod.yml](../../.github/workflows/deploy-prod.yml)) use `pnpm/action-setup@v4` + `cache: 'pnpm'` + `pnpm install --frozen-lockfile`. Lockfile drift check rewritten for `pnpm-lock.yaml`.
- Docs synced: [CONTRIBUTING.md](../../CONTRIBUTING.md), [.github/copilot-instructions.md](../../.github/copilot-instructions.md), [README.md](../../README.md), [QUICKSTART.md](../../QUICKSTART.md), [ARCHITECTURE.md](../../ARCHITECTURE.md), [MONOREPO_WORKSPACE.md](./MONOREPO_WORKSPACE.md) (full rewrite).

### Jest → Vitest (✅ Done — May 2026)
- ~5× faster, native ESM, same API surface (`describe`/`it`/`expect`).
- Migrated `apps/api` in [`chore/vitest-migration`](https://github.com/Smart-Apply/smart-apply): single `vitest.config.mts` replaces three Jest configs, `unplugin-swc` + `.swcrc` handle decorator metadata, `vite-tsconfig-paths` handles the `@/*` alias.
- Mechanical churn: `jest.X` → `vi.X` across 25 spec files + `mock.helper.ts`. `jest.Mock` type cast → `import type { Mock } from 'vitest'`.
- Existing test debt was preserved as-is (the `TemplatesService` DI mismatch in `summary-translation.integration.spec.ts` was a pre-existing failure under Jest too).
- CI's `unit-tests` job still runs through `npm run test:unit` — script entrypoint is unchanged.

### Azure OpenAI → OpenRouter
- Only if we want to A/B models per request.
- Keep Azure as a secondary provider for EU residency contracts if any customer requires it.
- Pluggable LLM provider already in place — just add a third implementation.

---

## Doc sync checklist (per phase)

Per [.github/copilot-instructions.md](../../.github/copilot-instructions.md) "Documentation Sync (MANDATORY)":

- [ ] [README.md](../../README.md)
- [ ] [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [ ] [.github/copilot-instructions.md](../../.github/copilot-instructions.md)
- [ ] Affected files in [docs/features/](../features/) / [docs/guides/](./) / [docs/security/](../security/) / [docs/implementation/](../implementation/)
- [ ] [apps/api/.env.example](../../apps/api/.env.example) if env vars changed
- [ ] [CHANGELOG.md](../../CHANGELOG.md) auto-generated by release-please from Conventional Commits

---

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-11 | Recommend Phase 1 + 2 only for now | Highest ROI, lowest risk, ~3 weeks. Phases 3–5 deferred until user-growth data justifies the maintenance churn. |
| 2026-05-11 | Co-existence over cutover for every phase | DevOps overhaul worked the same way (parallel workflow files, then deletion). Same playbook here. |
| 2026-05-11 | No phase during public-launch push | Stabilize first. See [PUBLIC_LAUNCH_PLAN.md](./PUBLIC_LAUNCH_PLAN.md). |
| 2026-05-14 | Phase 1 shipped (v1.16 → v2.0.0) | Puppeteer + handlebars + pdf-lib + generic-pool removed. PNG previews via `pdfjs-dist` + `@napi-rs/canvas`. 3 designs ported (`classic-ats`, `harvard-classic`, `elegant-sidebar`), all 5 colour variants resolve via single factory + DB `accentColor`. |
| 2026-05-14 | Phase 2 shipped (v3.0.0) | Zod `.superRefine()` rejects `STORAGE_DRIVER!='r2'` or `JOBS_DRIVER!='qstash'` at boot when `NODE_ENV=production`. Major bump because misconfigured prod deployments now fail to boot instead of silently losing data. |
| 2026-05-14 | **Skip Phase 3 (better-auth) indefinitely** | Current passport stack is working (9.5/10 security score per copilot-instructions, refresh rotation + 2FA + 3 OAuth providers + audit logging + session mgmt all shipped). Phase 3 is the highest-risk phase — logs users out on rollback, manual recovery, narrow rollback window. -2000 LoC + free WebAuthn are real wins, but no users are asking for passkeys and we haven't been touching auth weekly. better-auth is MIT/self-hostable (no SaaS cost), so the question is purely effort-vs-payoff and the payoff isn't there pre-launch. Revisit only if a CVE drops in passport-jwt, a customer demands passkeys, or auth code starts changing monthly. |
| 2026-05-14 | **Skip Phase 4 (Drizzle) indefinitely** | Prisma works. `prisma generate` adds ~10s to CI, the cold-start gain is theoretical for an always-on Fly machine, and the Prisma engine binary is no longer a top-3 contributor to image size after Phase 1's puppeteer removal. Revisit only if we move read-heavy endpoints to Cloudflare Workers (where Prisma's edge story still bites). |
| 2026-05-14 | Phase 5 stays opportunistic only | No dedicated sprint. pnpm / Vitest / OpenRouter only when someone happens to be in those areas. |
| 2026-05-16 | Phase 5 partial: **Vitest done** | `apps/api` migrated from Jest 29 + ts-jest to Vitest 2.1 + unplugin-swc. Three Jest configs collapsed into one `vitest.config.mts`, `vite-tsconfig-paths` resolves `@/*`, `globals: true` keeps the legacy describe/it/expect API. Ran one branch (`chore/vitest-migration`) per [CONTRIBUTING.md](../../CONTRIBUTING.md) trunk-based rules. pnpm + OpenRouter still pending. |
| 2026-05-16 | Phase 5 partial: **pnpm done** | Monorepo migrated from npm Workspaces + `--legacy-peer-deps` to pnpm 11.1. `pnpm-workspace.yaml` + `.npmrc` added, root `packageManager` switched, `overrides` moved to `pnpm.overrides`, `package-lock.json` deleted in favour of `pnpm-lock.yaml`. Dockerfile rewritten around `pnpm deploy --prod` for clean isolated prod trees. All three GH workflows + CONTRIBUTING + copilot-instructions + MONOREPO_WORKSPACE updated. OpenRouter still pending. |

---

## Open questions

- Phase 1: Do we keep template authoring in CSS (via `@react-pdf/stylesheet`) or move to the `StyleSheet.create()` API? CSS-flavoured is closer to today; programmatic is more typed. — *Resolved in Phase 1 implementation: `StyleSheet.create()` per template factory.*
- ~~Phase 3: Self-hosted better-auth or Clerk/WorkOS?~~ Moot — phase skipped.
- ~~Phase 4: Keep Prisma CLI for migrations or move fully to Drizzle Kit?~~ Moot — phase skipped.
