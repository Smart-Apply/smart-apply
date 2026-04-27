# 🚀 Reddit Launch Roadmap — Open Tasks

> Snapshot taken **27 April 2026** after the domain + Cloudflare migration,
> Resend integration, Sentry integration (backend + frontend), and the
> initial backend hardening + UX polish + cost-protection phases were
> completed and deployed to production at <https://smart-apply.io>.

For full historical context see:
- [DOMAIN_CLOUDFLARE_SETUP.md](./DOMAIN_CLOUDFLARE_SETUP.md)
- [SENTRY_DEBUGGING.md](./SENTRY_DEBUGGING.md)

---

## What's already live ✅

| Area | Component |
|---|---|
| Domain & HTTPS | `smart-apply.io` + `api.smart-apply.io` behind Cloudflare (Full strict) |
| Backend hardening | Rate limits, `console.*` cleanup, parameterized URLs, 5xx → Sentry |
| Frontend Sentry | DSN baked into static bundle via `.env.production` |
| Backend Sentry | 5xx forwarded to Sentry with PII scrubbing |
| Email (Resend) | Password reset + verification emails wired and verified end-to-end |
| GDPR data export | `GET /api/v1/auth/export` + Settings UI button |
| Legal page scaffolds | Impressum, Datenschutz, AGB committed (placeholders inside) |
| Cookie banner | Minimal essential-cookies notice |
| Onboarding redirect after signup | OAuth + email signup land on `/onboarding` |
| Application progress UI | Live elapsed-time + animated step indicator |
| Tiptap unsaved-changes guard | `beforeunload` warning |
| URL parser fallback UI | Persistent inline alert + manual entry tab |
| Per-user generation cap | FREE tier: 5/day, 10/week, 20/month |
| LLM token cap | Default lowered 3000 → 2000 |
| Container security | API/Web ports bound to `127.0.0.1` only |
| SSH deploy key | VM uses ed25519 deploy key (PAT removed) |
| OAuth conditional providers | Google/Microsoft strategies don't crash without creds |
| Schema migrations applied to prod | `oauth_providers`, `daily_application_usage_window` |

---

## 🔴 P0 — Required before any Reddit post

These directly impact whether the demo "works" for a stranger landing on
the site. Do these first.

### 1. Switch LLM provider from `mock` → `azure-openai` ⚠️ BLOCKING

**Symptom today:** Every generated cover letter / resume contains the
same canned mock text. A Reddit visitor who tries the product gets
useless output and bounces in 30 seconds.

**Effort:** 5 min, but blocked on credentials.

**What I need from you:**
- `AZURE_OPENAI_ENDPOINT` (e.g. `https://my-aoai.openai.azure.com/`)
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT_NAME` (e.g. `gpt-4o-mini` — recommend mini for cost)
- Confirm quota is approved + region

**My side:** Update `apps/api/.env` on the VM, set `LLM_PROVIDER=azure-openai`,
restart API container, run a smoke test. Documented at
[apps/api/src/llm/providers/azure-openai.provider.ts](../../apps/api/src/llm/providers/azure-openai.provider.ts).

### 2. Fill in legal-page placeholders

**Files:**
- [apps/web/src/app/(legal)/impressum/page.tsx](../../apps/web/src/app/(legal)/impressum/page.tsx)
- [apps/web/src/app/(legal)/datenschutz/page.tsx](../../apps/web/src/app/(legal)/datenschutz/page.tsx)
- [apps/web/src/app/(legal)/agb/page.tsx](../../apps/web/src/app/(legal)/agb/page.tsx)

**Search for `[BITTE EINFÜGEN]`** in each file — replace with:
- Real name OR Impressum-service address (impressumspflicht.de, IT-Recht
  Kanzlei, Trusted Shops are fine for ~5–15 €/mo)
- Email: use `support@smart-apply.io` (already routed to your inbox via
  Cloudflare Email Routing)

**Effort:** 15 min, you only.

**Why blocking:** German TMG §5 requires a working Impressum on every
public site. Going live without it = legal exposure.

### 3. Confirm frontend Sentry captures real client-side errors

**Effort:** 5 min, you click around.

Open <https://smart-apply.io>, DevTools → Network → filter `sentry` →
hard reload. You should see ≥1 request to `*.ingest.de.sentry.io` (or
`/monitoring` tunnel). Then deliberately trigger an error (e.g. paste
`throw new Error("client test")` in the Console) and check the Sentry
UI within 30 seconds.

---

## 🟠 P1 — Strongly recommended before launch

These prevent embarrassing problems but won't outright break the demo.

### 4. Cloudflare Turnstile captcha on signup

**Why:** Without this, a single bot-signup script drains your Azure OpenAI
budget overnight. Reddit posts can attract automated abuse.

**You:** Sign up at <https://dash.cloudflare.com/?to=/:account/turnstile>,
create a site for `smart-apply.io`, save site key + secret key.

**Me:** Wire widget into the register page + verify token server-side in
`AuthService.register()`. ~30 min once keys exist.

### 5. Enforce email verification before first generation

**Why:** Currently anyone can sign up with a junk email and start
generating. The verification-email flow exists but isn't required.

**Me:** ~2 h. Add middleware/guard, update onboarding flow.

### 6. Manual end-to-end smoke test on smart-apply.io

**You:** ~30 min. Walk through:
- Sign up new user → onboarding → fill profile manually
- Add a real LinkedIn job posting URL
- Generate application → preview both PDFs
- Edit cover letter in Tiptap → save → re-export
- Forgot password → click reset link from email → reset → log in
- Settings → export my data → verify ZIP/JSON contents
- Settings → delete account
- All on mobile too (iPhone Safari + Android Chrome)

If anything breaks, paste the issue here and I fix.

### 7. Switch jobs queue: in-memory → Service Bus

**Why:** Currently if the API container restarts, any pending PDF
generation jobs are lost. Real impact is small (most flows are sync), but
for any background-queued work it's relevant.

**You:** Confirm Azure Service Bus namespace exists + provide
`SERVICE_BUS_CONNECTION_STRING` + queue name.

**Me:** ~20 min. Set `JOBS_DRIVER=service-bus` in `.env`, restart.

---

## 🟡 P2 — Nice-to-have before / shortly after launch

### 8. i18n DE+EN with next-intl

**Why:** Currently the UI is German-only. Reddit posts in English
subreddits (r/jobs, r/cscareerquestions, r/resumes) will see all-German
buttons → bounce.

**Effort:** ~5 days focused work. Largest single remaining chunk.

**Strategy:** Install next-intl, configure `/de/...` + `/en/...` route
prefixes (default `de`, browser auto-detect), extract ~400–600 hardcoded
German strings into `messages/de.json` + `en.json`, machine-translate EN
+ ~2 h human polish on Fiverr.

**Recommendation:** Either ship DE-only to German subreddits first
(r/de_EDV, r/Bewerbung, r/Studium) and add EN in week 2, or invest the
5 days now and launch bilingual.

### 9. Sentry alerts (email / Discord on >5 errors / 5 min)

**You:** Configure in Sentry → Alerts → Create Alert Rule.

**Me:** Available to help configure if you want.

### 10. Add `Sentry.setUser({ id })` after login

**Why:** Without this, Sentry events are anonymous — you see "an error
happened" but can't tie it to a user to follow up.

**Me:** ~15 min. Hook into `auth-store.ts` setAuth().

### 11. Wire the contact form on the landing page

**Why:** The landing page has a contact form, but submit goes nowhere.
Reddit users who hit issues will just leave.

**Me:** ~30 min. POST to a backend endpoint that sends via Resend to
`support@smart-apply.io`.

### 12. Minimal FAQ page

**Why:** Top 10 questions answered preemptively reduces support load
during launch spike.

**Me:** ~1 h to scaffold + you write the actual content.

### 13. Soft-launch to one small DE subreddit first

**Plan:** Post to r/de_EDV or r/studium first. Watch Sentry for 48 h.
Fix top 3 issues. Then post to bigger subs (r/Bewerbung, r/jobs,
r/cscareerquestions, r/resumes).

### 14. Prepare Reddit launch package

- 60–90 sec Loom demo video
- 3–5 high-quality screenshots
- Reddit post draft tailored per subreddit (each sub has different rules)
- Always read the subreddit's self-promotion policy first

---

## ⚠️ Hygiene reminders (do soon, not blocking)

- [ ] **Revoke the leaked GitHub PAT** at <https://github.com/settings/tokens>
  (replaced by the SSH deploy key earlier)
- [ ] **Rotate the Resend API key** at <https://resend.com/api-keys>
  (was pasted in chat history)
- [ ] **Rotate the Cloudflare Origin Certificate** in 2-3 weeks at
  Cloudflare → SSL/TLS → Origin Server (private key was in chat)
- [ ] **Rotate the two Sentry DSNs** at Sentry → Settings → Projects →
  Client Keys (low risk — DSNs are public credentials by design — but
  good hygiene after debugging)

---

## 🟢 Deferred — do after launch / later

| Task | Why later |
|---|---|
| Plausible / PostHog analytics | Not needed for first 1000 users |
| Status page (StatusPage.io) | Use Reddit comments for first incident |
| Migration to Azure Container Apps | VM works fine for MVP traffic |
| Stripe / paid tier (PRO subscription) | MVP is free; revenue is post-validation |
| Two-factor auth nudge in onboarding | Already implemented, just not pushed in UX |
| Real-time SSE progress in dashboard | Existing polling is fine |
| Resume version history | Single-snapshot model is fine for MVP |
| Multi-tenant / organizations | Single-user is fine |
| Native mobile app | Responsive web works |
| Languages beyond DE+EN | Phase 2 of i18n |
| Cloudflare WAF custom rules | Free tier defaults are enough |
| Database read replicas | Premature for MVP traffic |

---

## Recommended order (next 1–2 weeks)

```
Day 0  ──►  P0.1  Azure OpenAI credentials (you provide)
            P0.2  Legal placeholders (you fill)
            P0.3  Sentry frontend smoke test (you click)
                                             ↓
Day 1  ──►  P1.4  Cloudflare Turnstile (you sign up + I integrate)
            P1.5  Email verification enforcement (me)
                                             ↓
Day 2  ──►  P1.6  Manual smoke test on smart-apply.io (you walk through)
            P1.7  Service Bus switch (optional, low impact)
                                             ↓
Day 3  ──►  P2.10 Sentry.setUser (me)
            P2.11 Contact form wiring (me)
            P2.12 FAQ page scaffold (me + you write)
                                             ↓
Day 4–8  ►  P2.8  i18n DE+EN (me, biggest chunk)
                                             ↓
Day 9   ──► P2.13 Soft launch to small DE subreddit
                                             ↓
Day 10–11 ► P2.14 Big push to international subreddits
```

Realistic ship date for full bilingual MVP: **~10 days from today**.
DE-only ship date if you skip i18n for v1: **~3 days from today**.

---

## What I need from you (consolidated checklist)

The one-page list of things only you can provide:

- [ ] Azure OpenAI: endpoint, API key, deployment name (P0.1)
- [ ] Real Impressum data — name, address (or service), email (P0.2)
- [ ] Click around live site to confirm Sentry frontend (P0.3)
- [ ] Cloudflare Turnstile site key + secret key (P1.4)
- [ ] Walk through manual smoke test (P1.6)
- [ ] Optional: Service Bus connection string (P1.7)
- [ ] FAQ content text (P2.12)
- [ ] Decide: launch DE-only first or wait for full bilingual (informs P2.8)

Ping me when ready for any of these and we'll execute one at a time.
