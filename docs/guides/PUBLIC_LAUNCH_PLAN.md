# Public Launch Plan

> **Status:** Open. Created 11 May 2026 to consolidate every gap that
> blocks (or seriously embarrasses) a public launch of <https://smart-apply.io>.
> Replaces the old `REDDIT_LAUNCH_ROADMAP.md`, `MVP_EVALUATION_DEC_2025.md`,
> `MVP_FEATURES.md`, and `INFRA_MIGRATION_ROADMAP.md`, all of which had
> drifted out of sync with the shipped state.
>
> **Audit basis:** verified against the actual codebase (not just docs)
> on the `feat/mobile-ux-overhaul` branch.

---

## Already shipped — do NOT re-litigate

These were tracked as "todo" in the deleted docs but are live in code today:

- ✅ Legal pages with real Impressum/Datenschutz/AGB data ([apps/web/src/app/(legal)/](../../apps/web/src/app/(legal)/))
- ✅ Cloudflare Turnstile on register/login (`captcha.guard.ts`, `cloudflare-turnstile.service.ts`)
- ✅ Email verification enforced before first generation (`EmailVerifiedGuard` on applications)
- ✅ Contact form → Resend → `support@smart-apply.io` (`contact.controller.ts`, premium-priority routing included)
- ✅ FAQ page ([apps/web/src/app/(legal)/faq/page.tsx](../../apps/web/src/app/(legal)/faq/page.tsx))
- ✅ TOTP 2FA (otplib + qrcode + speakeasy, full enroll/verify/disable UI)
- ✅ OAuth: Google, Microsoft, Azure AD
- ✅ GDPR data export (`AuthService.exportUserData`) + account deletion (`AuthService.deleteAccount`) with 30-day soft-delete window
- ✅ Refresh-token rotation, multi-device sessions, audit logging, rate limiting
- ✅ Backend Sentry (5xx → Sentry with PII scrubbing)
- ✅ Cookie banner, post-signup onboarding redirect, per-user generation cap
- ✅ Neon Postgres + Cloudflare R2 + Fly.io migration (infra cutover complete)
- ✅ Trunk-based CI/CD with `release-please`, staging auto-deploy, prod tag-gated deploy

---

## 🔴 Blockers — fix before any public post

### 1. Re-add frontend error monitoring

**Symptom:** [apps/web/src/instrumentation.ts](../../apps/web/src/instrumentation.ts) is a no-op — Sentry was removed and never replaced. Anything client-side that breaks (PDF preview crash, Tiptap edge case, OAuth redirect in Safari, mobile layout regression) is invisible.

**Action:** Re-add `@sentry/nextjs` (or wire PostHog with session replay if you want product analytics + monitoring in one tool — see #6 below). Tunnel through `/monitoring` to bypass ad blockers. Confirm a deliberately-thrown `Error` shows up in the dashboard within 30 s.

**Owner:** dev. **Effort:** ~3 h.

### 2. Sync or delete stale planning docs

**Already done as part of this PR:** deleted `REDDIT_LAUNCH_ROADMAP.md`, `MVP_EVALUATION_DEC_2025.md`, `MVP_FEATURES.md`, `INFRA_MIGRATION_ROADMAP.md`. This file replaces them.

**Action:** If you add a new planning doc later, follow the "Documentation Sync (MANDATORY)" rule in `.github/copilot-instructions.md` — keep `README.md` + `ARCHITECTURE.md` + this file in lockstep.

---

## 🟠 Strongly recommended before launch

### 3. Backend unit tests blocking in CI

**Symptom:** [.github/workflows/ci.yml](../../.github/workflows/ci.yml) has `continue-on-error: true` on the `unit-tests` job with an explicit `TODO: rewrite the unit suite`. A regression in auth, profile diff-update, or the LLM circuit breaker won't fail a PR today.

**Action:** Write a minimal smoke suite (auth flow + applications pipeline with mock LLM) and flip `continue-on-error` to `false`. Don't try to fix the entire legacy suite — delete the broken specs and start a clean `test/smoke/` directory.

**Owner:** dev. **Effort:** ~½ day.

### 4. Stripe / payment integration (decide: in or out for v1)

**Symptom:** Premium tier is enforced in the backend (`@RequiresFeature`, `SubscriptionService`, `/admin/users/:email/tier` for manual upgrades) but there's no checkout flow, no webhook handler, no `stripe` package in dependencies.

**Action — pick one:**
- **(a) Launch with Stripe.** Multi-day item: install `stripe`, add a `payments` module with a `POST /payments/checkout-session` endpoint, a `POST /payments/webhook` to flip `subscriptionTier`, and a "Upgrade" page on the frontend.
- **(b) Launch free-tier only, manual Premium upgrades.** Audit the frontend for any "Upgrade to Premium" CTA that doesn't lead anywhere and either remove or point at the contact form. Document this on the FAQ page.

**Recommendation:** (b) for the public launch. Validate demand first, then add Stripe in week 2–3.

**Owner:** dev + product. **Effort:** (a) ~3 days · (b) ~1 h.

### 5. SEO + social-share assets

**Symptom:** No `app/sitemap.ts`, no `app/robots.ts`, no Open Graph image (`apps/web/public/og*` doesn't exist), no `metadata.openGraph` outside legal pages. A Reddit / LinkedIn / WhatsApp share renders without a preview card → much lower click-through.

**Action:**
- Add `apps/web/src/app/sitemap.ts` listing `/`, `/login`, `/register`, `/impressum`, `/datenschutz`, `/agb`, `/faq`.
- Add `apps/web/src/app/robots.ts` allowing the public pages, disallowing `/dashboard/*` and `/settings/*`.
- Generate one 1200×630 OG image (PNG, < 300 KB), drop it at `apps/web/public/og-default.png`, wire it via `metadata.openGraph` in the root layout.
- Verify with <https://www.opengraph.xyz/> against the staging URL.

**Owner:** dev. **Effort:** ~2 h.

### 6. Product analytics

**Symptom:** No Plausible / PostHog / GA in the bundle. You will fly blind on the funnel that matters most for a Reddit launch: **signup → first profile save → first generation**.

**Action:** Add Plausible (1 KB script, GDPR-friendly, no cookie banner needed) **or** PostHog (heavier but covers #1 too via session replay). Wire 4 custom events: `signup_completed`, `profile_first_save`, `application_created`, `application_ready`.

**Owner:** dev. **Effort:** ~1 h (Plausible) · ~3 h (PostHog with session replay).

---

## 🟡 Hygiene & ops

### 7. Verify production `LLM_PROVIDER` secret

`apps/api/.env.example` defaults to `mock`. Confirm Fly prod is `azure-openai` and not silently serving canned demo text:

```bash
flyctl secrets list --app smart-apply-api | grep LLM_PROVIDER
```

If it's anything other than `azure-openai`, fix before launch.

**Effort:** 30 s.

### 8. Document backup + restore procedures

**Symptom:** [docs/security/MIGRATION_ROLLBACK.md](../security/MIGRATION_ROLLBACK.md) covers schema rollback. There's no runbook for:
- "User wants their soft-deleted account restored within the 30-day window the privacy policy promises."
- "R2 bucket got nuked / corrupted."
- "Neon point-in-time-restore for partial data loss."

The privacy policy at [apps/web/src/app/(legal)/datenschutz/page.tsx](../../apps/web/src/app/(legal)/datenschutz/page.tsx) explicitly promises 30-day soft-delete recovery — make sure the runbook delivers that.

**Action:** Add `docs/security/BACKUP_RESTORE.md` covering Neon PITR, R2 versioning status, and the soft-delete restore SQL.

**Owner:** dev. **Effort:** ~1 h.

### 9. Sentry alert rules

**Symptom:** Backend Sentry receives 5xx errors but no alert is configured. You'll only see incidents when you happen to open the dashboard.

**Action:** In Sentry → Alerts → Create Alert Rule, set:
- Trigger: > 5 errors in 5 min, OR any new issue in production environment.
- Action: email `support@smart-apply.io` (already routed via Cloudflare).

**Effort:** ~15 min.

### 10. End-to-end smoke test against staging

**Symptom:** No Playwright/Cypress run pointing at `*.staging.smart-apply.io`. The PDF generation path (profile → job → LLM → Puppeteer → R2 → SAS URL → preview) has the most moving parts and is where a stranger will hit issues first.

**Action:** Walk through manually on `*.staging.smart-apply.io` (desktop + iOS Safari + Android Chrome):
1. Sign up new user → onboarding → fill profile manually
2. Add a real LinkedIn job posting URL
3. Generate application → preview both PDFs
4. Edit cover letter in Tiptap → save → re-export
5. Forgot password → click reset link from email → reset → log in
6. Settings → export my data → verify ZIP contents
7. Settings → delete account

If anything breaks, fix and re-run before promoting to prod.

**Owner:** dev. **Effort:** ~1 h.

### 11. Mobile UX overhaul ships cleanly

The current branch is `feat/mobile-ux-overhaul`. Make sure it ships **and** gets a real-device pass before the launch post — mobile is where most Reddit traffic comes from.

---

## 🟢 Deferred — explicitly NOT doing for v1

These are conscious deferrals; don't bring them up again at launch time:

- i18n EN translation (DE-only launch is fine for German subs first)
- Migration to Azure Container Apps (Fly.io is healthy)
- k6 load tests, synthetic monitoring (premature)
- Status page (use Reddit comments / Twitter for first incident)
- Native mobile app (responsive web works)
- Multi-tenant orgs
- Resume version history
- Database read replicas

---

## Suggested execution order

```
Day 0 ──► #2 doc cleanup (this PR)             [1 h]
          #7 verify LLM_PROVIDER prod secret   [30 s]
          #5 SEO + OG assets                   [2 h]
                    ↓
Day 1 ──► #1 re-add frontend error monitoring  [3 h]
          #6 Plausible (or PostHog)            [1–3 h]
          #9 Sentry alert rules                [15 min]
                    ↓
Day 2 ──► #4(b) audit Premium CTAs OR
          #4(a) Stripe integration             [1 h or 3 days]
          #3   smoke unit tests + flip CI gate [½ day]
                    ↓
Day 3 ──► #11 mobile-ux-overhaul real-device pass
          #8  backup/restore runbook           [1 h]
          #10 manual E2E smoke on staging      [1 h]
                    ↓
Day 4 ──► Soft launch to one small DE subreddit (r/de_EDV / r/Bewerbung)
          Watch Sentry + Plausible for 48 h
                    ↓
Day 6 ──► Bigger DE subs + (if EN i18n is later) international subs
```

**Realistic ship date:** ~4 days from start if Stripe is deferred · ~1 week if Stripe is in.

---

## Updating this file

Treat this as the single source of truth for launch readiness. When you
finish an item, move it from its priority section into the "Already
shipped" list at the top with a one-line note. When the list is empty
below "Hygiene & ops", launch.
