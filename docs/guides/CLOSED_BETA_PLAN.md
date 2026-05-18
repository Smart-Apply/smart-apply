# Closed Beta Plan — 50–100 invited testers

> **Status:** Open. Created 19 May 2026.
> **Scope:** Invite-only MVP test on **production** infra (not staging).
> **Sibling doc:** [PUBLIC_LAUNCH_PLAN.md](./PUBLIC_LAUNCH_PLAN.md) covers
> the *open* Reddit/HN launch. This file is the smaller, faster path
> for getting real-user signal first.

---

## Goal

Get **qualitative signal on the happy path** (signup → profile →
generate first application) from 50–100 motivated users in a controlled
environment, *before* opening the firehose to Reddit.

What we want to learn:

1. Does the funnel `signup → first profile save → first generation`
   actually convert, or does it leak somewhere we haven't seen?
2. What breaks on real iOS Safari + Android Chrome that the dev loop missed?
3. Which prompts in the German LLM output feel off to native speakers
   in actual job-search context (not synthetic test data)?
4. Where do users get stuck and need to ask a question?

What we are **not** trying to measure: virality, SEO, monetisation, or
scale. Those belong to the public launch.

---

## Cohort definition

- **Size:** 50–100 testers, staged in 3 waves (see Rollout below).
- **Profile:** German-speaking job seekers actively applying within the
  next ~60 days. DACH region. Mix of professions (NOT just IT — see the
  domain-agnostic principle in `.github/copilot-instructions.md`).
- **Recruitment:** personal network → LinkedIn DMs → 1 small Discord/Slack
  community. No paid ads, no Reddit, no public posts.
- **Cost:** ~€5–€20 in Azure OpenAI tokens (150–300 generations).
  Negligible. Don't worry about it.

---

## Why prod, not staging

- Staging has `min_machines_running = 0` in [fly.staging.toml](../../fly.staging.toml).
  First request after idle = ~30s cold start. Testers will think the app
  is broken before they even reach the login screen.
- Staging's Neon branch has weaker durability guarantees and no
  point-in-time-restore promises in the privacy policy.
- Testers' real data (profiles, generated PDFs) belongs where the real
  R2 + Neon backups are.

The cohort lives on prod, gated by an invite code. Staging stays for
pre-merge smoke testing only.

---

## ✅ Before the first invite goes out

This is the **complete** checklist. Don't send a single invite until
every item is checked.

### Must have (≈ 1 day of work)

- [ ] **#A1 — Frontend error monitoring re-enabled** *(~3h)*
  [apps/web/src/instrumentation.ts](../../apps/web/src/instrumentation.ts)
  is currently a no-op. Wire `@sentry/nextjs` (or PostHog if you want
  product analytics + session replay in one tool). Tunnel through
  `/monitoring` to bypass ad blockers. **Acceptance:** a deliberately-
  thrown `Error` in the dashboard shows up in Sentry within 30s.
  Without this, every "the PDF preview broke on my iPhone" report is
  unfixable.

- [ ] **#A2 — Verify `LLM_PROVIDER=azure-openai` on Fly prod** *(30s)*
  ```bash
  flyctl secrets list --app smart-apply-api | grep LLM_PROVIDER
  ```
  If it's anything other than `azure-openai`, every tester gets canned
  mock text and the whole beta is worthless. Also confirm
  `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT_NAME` are set.

- [ ] **#A3 — Invite-code gate on `/auth/register`** *(~30min)*
  Add `INVITE_CODES` env var (comma-separated, e.g.
  `alpha-001,alpha-002,...`). Check in `AuthService.register`; throw
  `ForbiddenException('Invalid invite code')` when missing or unknown.
  Each code is single-use (track in `User.inviteCodeUsed` or a tiny
  `InviteCode` model). Frontend: add `inviteCode` to the register form,
  shown when `NEXT_PUBLIC_REQUIRE_INVITE=true`.
  **Why:** lets you stage the rollout, identify who churned, and shut
  the door instantly if something blows up. Beats a hard "first 50" DB
  cap (no race conditions, no waitlist UX to build).

- [ ] **#A4 — Audit Premium CTAs for dead ends** *(~30min)*
  Grep the frontend for "Upgrade", "Premium", "Pro" buttons. Either
  remove for the beta or point them at the existing contact form
  (`POST /api/v1/contact`). Premium gets granted manually via
  `POST /api/v1/admin/users/:email/tier` (already shipped).

- [ ] **#A5 — One real-device E2E pass on prod** *(~1h)*
  After #A1–A4 are deployed. On desktop + iOS Safari + Android Chrome:
  1. Sign up with an invite code → onboarding → fill profile manually
  2. Add a real LinkedIn job posting URL
  3. Generate application → preview both PDFs
  4. Edit cover letter in Tiptap → save → re-export
  5. Forgot password → click reset link from email → reset → log in
  6. Settings → export my data → verify ZIP contents
  7. Settings → delete account

  If anything breaks, fix and re-run before sending the first invite.

### Strongly recommended (≈ 2h extra)

- [ ] **#A6 — Plausible** *(~1h)*
  1 KB script, no cookie banner, GDPR-friendly. Wire 4 custom events:
  `signup_completed`, `profile_first_save`, `application_created`,
  `application_ready`. Funnel data on 50 people is still 50× more than
  your gut.

- [ ] **#A7 — Sentry alert rule** *(~15min)*
  In Sentry → Alerts → New Rule: `> 5 errors in 5 min` OR
  `any new issue in production environment` → email
  `support@smart-apply.io`. With a 50-user cohort you can spot
  incidents within minutes instead of "next time you open the dashboard".

- [ ] **#A8 — Beta-tester FAQ section** *(~30min)*
  Add a short addition to [apps/web/src/app/(legal)/faq/page.tsx](../../apps/web/src/app/(legal)/faq/page.tsx)
  explaining: "What is the beta?", "Will my data persist after the
  beta ends?" (yes), "Is it free?" (yes during beta), "How do I get
  Premium?" (ask in Discord — manual grant).

### Explicitly skipped for the beta

These are real items, but they don't change the risk profile of a
50-user invited cohort. Defer to [PUBLIC_LAUNCH_PLAN.md](./PUBLIC_LAUNCH_PLAN.md):

- ❌ Stripe / payment flow — manual `/admin/users/:email/tier` upgrades
- ❌ Sitemap / robots / OG image — no one's sharing a private invite link
- ❌ CI unit test gate — you control deploy cadence during a pilot
- ❌ Backup/restore runbook — Neon PITR is the safety net; document
      *after* the pilot when you know what restore scenarios actually arose
- ❌ EN i18n — DE-only cohort
- ❌ Status page — Discord *is* the status page

---

## Rollout

Stage the invites in three waves. Don't send all 100 at once — you
want to learn from wave N before exposing wave N+1.

### Wave 1 — "Friends test" (10 invites)

- **Who:** 10 personal contacts who will reply to a "hey, try this and
  tell me what broke" message within 24h. Forgiving audience.
- **When:** Day 0 (the day #A1–A5 finish).
- **Goal:** Catch the obvious. iOS Safari crashes, mobile-keyboard
  overlap, OAuth redirect loops, copy typos. The stuff Sentry and the
  E2E pass missed because dev devices ≠ real devices.
- **Pause point:** wait 48h. Fix the top 3 bugs. Don't move on if
  Sentry shows any unresolved error affecting > 1 user.

### Wave 2 — "Network test" (15 invites, total 25)

- **Who:** LinkedIn 2nd-degree connections who are actively job-searching.
  Less forgiving than wave 1. More representative of real users.
- **When:** Day 2–3, after wave-1 issues are closed.
- **Goal:** Generation-quality feedback. Do the German cover letters
  feel native? Does the ATS keyword matching actually help? Do users
  trust the output enough to send it?
- **Pause point:** 48h. Look at Plausible — what's the dropoff between
  `signup_completed` and `profile_first_save`? Between
  `application_created` and `application_ready`?

### Wave 3 — "Cohort test" (50–75 invites, total 75–100)

- **Who:** Open the Discord invite link to one DACH job-search Discord
  / Slack community (just one — e.g. r/Bewerbung's Discord or a
  Berlin tech community). Hand out invite codes to the first 75 who DM you.
- **When:** Day 5–7, after wave-2 generation-quality issues are addressed.
- **Goal:** Scale + retention. Do people come back for a *second*
  application? Does the LLM rate-limit kick in? Does Fly autoscale?
- **End:** 2 weeks of observation, then either roll into the public
  launch (PUBLIC_LAUNCH_PLAN.md) or do another wave.

---

## Discord setup

The single highest-leverage thing on this list. Set this up **before
wave 1** even if it feels overkill for 10 people.

### Server structure

```
📢 announcements        — read-only, you post here
👋 welcome              — auto-post invite code redemption instructions
💬 general              — anything off-topic
🐛 bugs                 — "screenshot + what you did + what you expected"
💡 feedback             — "this felt slow / confusing / wrong"
🎯 feature-requests     — vote with reactions
📈 generation-quality   — paste anonymised LLM outputs that were bad
👀 watch-me-fix-it      — optional: stream/share fixes you're shipping live
```

### Pin in every channel

1. **A Loom of the happy path** (signup → profile → first generation).
   Stops you from answering "how do I…" five times.
2. **The current known-issues list** — short, dated, who's looking at it.
3. **The privacy reminder** — testers can request data export / deletion
   at any time via `Settings → Privacy`.

### Cadence

- **Daily** (during waves 1–2): scan #bugs and #feedback first thing in
  the morning. Reply to every message, even if just "seen, triaging".
- **Weekly digest** in #announcements: "shipped this week / known
  issues / what's next". Builds trust + retention.
- **Office hours** (optional): 30min voice channel once a week where
  testers can demo their use case. Best signal you'll ever get.

---

## Success metrics

Track in Plausible (#A6). Decide *before* the beta starts what counts
as success — don't move the goalposts after seeing the data.

| Metric | Wave 1 (n=10) | Wave 3 (n=75) |
|---|---|---|
| `signup_completed` rate (of invite-code redemptions) | ≥ 80% | ≥ 60% |
| `profile_first_save` rate (of signups) | ≥ 90% | ≥ 70% |
| `application_ready` rate (of profile-savers) | ≥ 80% | ≥ 50% |
| Second application within 7d | — | ≥ 30% |
| Unresolved Sentry issues affecting > 1 user | 0 | ≤ 2 |
| Median time signup → first application | ≤ 15 min | ≤ 25 min |

Below those numbers → don't launch publicly yet, iterate first.

---

## What "beta done" looks like

- All wave-3 testers have had ≥ 14 days of access
- The PUBLIC_LAUNCH_PLAN blockers (#A1 + #A6 here = #1 + #6 there) are
  resolved as a side effect
- The top-3 bugs from each wave are fixed and deployed
- You can answer in one sentence: *"Smart Apply solves X for Y in Z way,
  and 30% of the cohort came back for a second application"* (or
  whatever the real number is)

**Then** move to [PUBLIC_LAUNCH_PLAN.md](./PUBLIC_LAUNCH_PLAN.md) and
work through the remaining items (Stripe decision, SEO, OG image, CI
unit-test gate, real backup/restore runbook).

---

## Suggested execution order

```
Day 0  ──► #A2 verify LLM_PROVIDER (30s)
           #A1 Sentry frontend (3h)
           #A3 invite-code gate (30min)
           #A4 audit Premium CTAs (30min)
           #A6 Plausible (1h)
           #A7 Sentry alerts (15min)
           Discord server setup (1h)
                      ↓
Day 1  ──► #A5 real-device E2E pass (1h)
           #A8 beta FAQ (30min)
           Generate first 10 invite codes
           Send wave-1 invites
                      ↓
Day 1–3 ─► Watch Sentry + Plausible + #bugs channel
           Fix top wave-1 issues
                      ↓
Day 3  ──► Send wave-2 invites (15 more)
                      ↓
Day 3–7 ─► Generation-quality iteration
                      ↓
Day 7  ──► Open Discord invite to one community
           Hand out wave-3 codes (50–75 more)
                      ↓
Day 7–21 ► Cohort observation, weekly digests
                      ↓
Day 21 ──► Decide: public launch OR iterate further
```

---

## Updating this file

Same rule as PUBLIC_LAUNCH_PLAN.md: when an item is done, move it
into a "Done" section at the top with a one-line note. When the
"Before the first invite goes out" checklist is empty, send the first
invite.
