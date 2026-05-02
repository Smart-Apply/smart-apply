# 📊 Sentry Integration — Postmortem & Debugging Saga

> Documenting the multi-attempt fight to get `@sentry/nextjs` v10 to bake the
> client-side DSN into the static bundle on a **Next.js 16 + Turbopack +
> Docker standalone** stack. April 2026.

## TL;DR

**What worked:** Backend Sentry (NestJS / `@sentry/node`). Captured a real
test event end-to-end on the first try.

**What was painful:** Frontend Sentry (Next.js / `@sentry/nextjs`). The
`NEXT_PUBLIC_SENTRY_DSN` value did not get inlined into the client bundle
across **four different attempts**, despite the build-time environment
variable being correctly set (proven via diagnostic echo: `length=95`).

**Resolution:** Writing a `.env.production` file inside `apps/web/` at
Docker build time (Attempt 4) finally worked. Confirmed by greppinng the
static JS chunks for the Sentry org-id — 1 chunk now contains the DSN.
Frontend Sentry is fully operational.

**Root cause (likely):** Next.js 15+ uses Turbopack as the default bundler
for `next build`, which has stricter / different rules than Webpack for
inlining `process.env.NEXT_PUBLIC_*` references in client code. The
canonical mechanism Turbopack respects is a `.env.production` file present
at the project root at build time — NOT shell ENV, NOT `next.config.ts`'s
`env` field (which lands the value in `required-server-files.json` only).

---

## Architecture (intended)

```
                                  Browser
                                     │
                                     ▼ throw new Error()
                          ┌────────────────────┐
                          │ instrumentation-   │
                          │ client.ts          │  Sentry.init({ dsn: ... })
                          │ (loaded by Next 15)│  Sentry.captureException()
                          └─────────┬──────────┘
                                    │ HTTPS
                                    ▼
                  https://o4511288...ingest.de.sentry.io/4511288...
                  (or via /monitoring tunnel route to bypass ad-blockers)


      Server (NestJS)
         │
         ▼ throw new Error()
   AllExceptionsFilter
         │  status >= 500
         ▼
   Sentry.captureException()
         │ HTTPS
         ▼
   ingest.de.sentry.io
```

## What was supposed to happen at build time

```
GitHub Actions
    │ vars.SENTRY_DSN_WEB  →  --build-arg NEXT_PUBLIC_SENTRY_DSN=...
    ▼
Docker build (Dockerfile.web)
    │ ARG NEXT_PUBLIC_SENTRY_DSN=
    │ ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
    ▼
next build (Turbopack)
    │ instrumentation-client.ts: const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    │ ↓ should be replaced with literal at build time
    ▼
Static JS chunks contain the DSN literal
```

## What actually happened

The DSN reached the build environment correctly. We proved this with a
build-time `echo`:

```
[build-args] NEXT_PUBLIC_API_URL length: 33
[build-args] NEXT_PUBLIC_SENTRY_DSN length: 95     ✅
[build-args] NEXT_PUBLIC_SENTRY_RELEASE: c4fbb90
```

But it did NOT end up in any static chunk. Verified by grep:

```bash
docker exec smartapply-web sh -c 'grep -rl "o4511288476958720" apps/web/.next/static/' | wc -l
# → 0
```

The DSN ended up only in `apps/web/.next/required-server-files.json` —
i.e. available to the **server** runtime, not inlined into client chunks.

---

## Approaches tried (chronological)

### Attempt 1 — Default `sentry.client.config.ts` ❌

**Setup:** Followed Sentry's classic docs — created
`apps/web/sentry.client.config.ts` with `Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN })`.
Wrapped `next.config.ts` with `withSentryConfig`. Added build-args.

**Result:** Bundle contained `sentry`-related chunk (the SDK code), but
zero references to the DSN string. Init was a no-op in the browser — no
network requests to `*.sentry.io`.

**Why it failed:** Sentry's own deprecation warning explained it (found
later in the SDK source):

> When using Turbopack `${clientSentryConfigFileName}` will no longer work.
> Read more about the `instrumentation-client.ts` file.

`sentry.client.config.ts` was the legacy webpack-only convention.
Turbopack silently ignores it.

### Attempt 2 — Renamed to `instrumentation-client.ts` ❌

**Change:** `git mv sentry.client.config.ts instrumentation-client.ts`.
Added the `onRouterTransitionStart` re-export Sentry asks for in App
Router projects.

**Result:** Same as before. Sentry's loader confirmed it reads the file
from the Sentry-hardcoded list:
```
['src', 'instrumentation-client.ts'],
['src', 'instrumentation-client.js'],
['instrumentation-client.ts'],
['instrumentation-client.js'],
```
Our path `apps/web/instrumentation-client.ts` matches the third entry
(relative to `process.cwd()` which is `apps/web/` during `next build`).
But the DSN literal still didn't appear in the client bundle.

**Why it failed:** Even with the right filename, the
`process.env.NEXT_PUBLIC_SENTRY_DSN` reference inside the file wasn't
substituted with the actual value at build time. Turbopack treated it as
a runtime lookup, found the var was undefined in the client runtime, and
the conditional `if (dsn) { ... }` block dead-code-eliminated.

### Attempt 3 — `next.config.ts` `env` field ❌

**Change:** Added explicit forwarding to `next.config.ts`:
```ts
env: {
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
  NEXT_PUBLIC_API_URL:    process.env.NEXT_PUBLIC_API_URL ?? '',
  NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? '',
},
```

**Result:** The DSN ended up in `apps/web/.next/required-server-files.json`
— but not inlined into static client chunks.

**Why it failed:** The `env` block makes vars available to the **server
runtime** (process.env on the Node side), but doesn't necessarily inline
them into the **client bundle**. That's only documented to work for code
that's part of the page tree.

### Attempt 4 — `.env.production` written at Docker build time ✅ (resolved)

**Change:** Dockerfile.web writes `apps/web/.env.production` from
build-args before running `next build`:
```dockerfile
RUN printf 'NEXT_PUBLIC_API_URL=%s\nNEXT_PUBLIC_SENTRY_DSN=%s\nNEXT_PUBLIC_SENTRY_RELEASE=%s\n' \
      "$NEXT_PUBLIC_API_URL" \
      "$NEXT_PUBLIC_SENTRY_DSN" \
      "$NEXT_PUBLIC_SENTRY_RELEASE" \
      > .env.production
```

**Rationale:** `.env.production` is the canonical Next.js mechanism that
both Webpack and Turbopack respect identically. It's documented as the
"correct" way to feed env vars into a Next.js build.

**Status:** ✅ **Confirmed working.** Verification:
```bash
docker exec smartapply-web sh -c \
  'grep -rl "o4511288476958720" apps/web/.next/static/ 2>/dev/null | wc -l'
# → 1
```
Client bundle now contains the Sentry org-id literal. Sentry initializes
on page load and forwards exceptions to the dashboard.

### Attempt 5 — Hardcode DSN literal (not needed, kept as reference)

**Not applied.** Was the planned fallback if Attempt 4 had failed. Worth
noting because Sentry DSNs are explicitly public credentials — hardcoding
them in `instrumentation-client.ts` would have been acceptable and
documented by Sentry. Sentry DSNs only allow sending events, not reading
them; anyone inspecting the client bundle sees the DSN regardless.

---

## Timeline of pain (commit-level)

| Commit  | Change                                                        | Result                          |
| ------- | ------------------------------------------------------------- | ------------------------------- |
| `969c8f4` | Initial: `sentry.client.config.ts` + `withSentryConfig`        | Bundle has SDK, no DSN         |
| `0ab3f4f` | Empty commit to retrigger build                                | Didn't trigger (paths-ignore)   |
| `5b4e412` | Added debug echo + `no-cache` flag                             | Confirmed ARG→ENV chain works  |
| `aacad0f` | Renamed to `instrumentation-client.ts`                        | Still no DSN in bundle          |
| `c4fbb90` | Added build-time echo of all `NEXT_PUBLIC_*` lengths           | Proved DSN reaches build (95)   |
| `ada8bd8` | Added `next.config.ts` `env` field                            | DSN in server config only       |
| `32f4eb7` | Write `.env.production` at Docker build time                  | **Testing now**                 |

**Total pivot count:** 4 distinct mechanisms tried for the same goal.

---

## What we learned (the actual lessons)

### 1. Bundler matters more than you'd think

| Bundler            | NEXT_PUBLIC_* via shell ENV | NEXT_PUBLIC_* via `.env.production` | NEXT_PUBLIC_* via `next.config.ts` env block |
| ------------------ | --------------------------- | ----------------------------------- | --------------------------------------------- |
| Webpack (Next ≤14) | ✅ auto-inlined              | ✅ auto-inlined                      | ✅ auto-inlined                                |
| **Turbopack (Next 15+)** | ❌ **ignored**         | ✅ auto-inlined                      | 🟡 server-only                                |

Lesson: `.env.production` is the only mechanism guaranteed to work across
all bundlers and all Next.js versions. Stick to it.

### 2. Sentry SDK file conventions changed silently

The `sentry.client.config.ts` filename was the standard for years. In
Sentry SDK v9+ it was deprecated in favor of `instrumentation-client.ts`.
Most blog posts / tutorials online still reference the old name. Result:
people set it up "correctly" by following old docs, then the SDK just
silently does nothing. No error. No warning unless you go looking.

Lesson: When Sentry isn't capturing events, the first thing to check is
whether the init file is in the location the **current** SDK version
expects. The SDK will not warn you if it's missing.

### 3. Empty commits don't trigger workflows with `paths-ignore`

GitHub-known quirk. Forced us to add real changes (debug echo) to retrigger.

Workaround for the future: keep `workflow_dispatch` in deploy workflows so
you can always retrigger manually without a code change.

### 4. The `--no-cache` flag is your friend during diagnosis

Registry buildcache (`type=registry`) caches layers based on the literal
text of `RUN` commands, NOT based on resolved ARG/ENV values. Changing an
ARG value alone won't invalidate a `RUN npm run build` layer. We hit this
once and the symptom was identical to "the build is broken" — but the
real cause was "the build never re-ran".

Lesson: When debugging build-time variable inlining, always start with
`no-cache: true` to rule out cached layers. Re-enable cache only after
the variable is confirmed working.

### 5. Backend Sentry: trivial. Frontend Sentry: a saga.

`@sentry/node` worked first try. Inject DSN via env, init in main.ts, hook
the global exception filter. Done.

`@sentry/nextjs` is fighting the build pipeline. Multiple file conventions
that look like they should work, only one actually works for any given
Next.js + bundler combination, and the SDK silently no-ops when wrong.

Lesson: Budget more time for any Sentry+Next setup than you think.
Especially with bleeding-edge Next versions.

---

## Diagnostic snippets (saved for future use)

### Verify build-time env inlining

```bash
# In the running container, count chunks containing the Sentry org-id:
docker exec smartapply-web sh -c \
  'grep -rl "o4511288476958720" apps/web/.next/static/ 2>/dev/null | wc -l'

# >0 means DSN is in the bundle
# 0 means inlining failed
```

### Verify build-arg → ENV chain

Add this to Dockerfile.web before `npm run build`:

```dockerfile
RUN echo "[build-args] NEXT_PUBLIC_API_URL length: ${#NEXT_PUBLIC_API_URL}" && \
    echo "[build-args] NEXT_PUBLIC_SENTRY_DSN length: ${#NEXT_PUBLIC_SENTRY_DSN}"
```

GitHub Actions log will show the lengths (without exposing values).

### Force a real test event from the running container

```bash
docker exec smartapply-api node -e '
  const Sentry = require("@sentry/node");
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: "production" });
  const id = Sentry.captureException(new Error("Manual test " + Date.now()));
  console.log("Event ID:", id);
  Sentry.flush(5000).then(() => process.exit(0));
'
```

### Verify Sentry is loaded in the browser

1. Open the live site
2. DevTools → Network tab
3. Filter by `sentry`
4. Hard reload (Cmd+Shift+R)
5. Should see ≥1 request to `ingest.*.sentry.io` or `/monitoring`

If empty: client-side init never ran or DSN was empty.

---

## Final state

- **Backend Sentry:** ✅ Working, verified with test event ID
  `f80f1fb3df9b498bb722276426f30b45`
- **Frontend Sentry:** ✅ Working, DSN baked into static bundle via
  `.env.production` mechanism (commit `32f4eb7`)
- **Both DSNs in chat history:** Should be rotated post-launch (DSNs are
  public credentials but rotation is good hygiene after debugging)

---

## Open TODOs related to Sentry

- [ ] Trigger a real client-side error from the live site and confirm
  capture in the Sentry UI (browser DevTools → Network filter `sentry`)
- [ ] Configure Sentry release tracking from CI commit SHA (already wired
  via `NEXT_PUBLIC_SENTRY_RELEASE`)
- [ ] Set up Sentry alerts (email/Slack) for high-severity issues before
  Reddit launch
- [ ] Add `Sentry.setUser({ id })` calls after login so frontend errors
  are tied to user IDs (no PII, just opaque ID)

## References

- Sentry: [Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- Next.js: [instrumentation-client.ts](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client)
- Next.js: [Environment Variables](https://nextjs.org/docs/app/guides/environment-variables)
- Sentry GitHub: [Turbopack support announcement](https://github.com/getsentry/sentry-javascript/issues)
- Repo: [`apps/web/instrumentation-client.ts`](../../apps/web/instrumentation-client.ts),
  [`apps/web/instrumentation.ts`](../../apps/web/instrumentation.ts),
  [`apps/web/sentry.server.config.ts`](../../apps/web/sentry.server.config.ts)
