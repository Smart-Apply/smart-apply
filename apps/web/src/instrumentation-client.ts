// This file configures the initialization of Sentry on the BROWSER side.
// Bundled into the client JS, runs in the user's browser.
//
// Filename `instrumentation-client.ts` is required by Next.js 15+ / Turbopack
// (the legacy `sentry.client.config.ts` only works under Webpack).
// See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
import * as Sentry from '@sentry/nextjs';

// Re-export Sentry's router-transition hook so SDK can capture navigation spans.
// Required since Sentry SDK v9+ in App Router projects.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    // Capture 100% of errors. Sentry's client SDK is smart about deduping.
    sampleRate: 1.0,
    // Performance tracing — 10% of page loads is enough to spot slow routes.
    tracesSampleRate: 0.1,
    // Session replay — disabled for now (heavy on bandwidth + adds GDPR overhead)
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,

    // Don't auto-attach IP / cookies. We add minimal user context manually
    // (just user.id) when the user logs in, via setUser elsewhere.
    sendDefaultPii: false,

    // Drop browser-extension and noisy-third-party errors before they hit our quota.
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Network / aborted requests (user navigated away)
      'AbortError',
      'NetworkError when attempting to fetch resource',
      'Failed to fetch',
      'Load failed',
      // Auth flow — we redirect on 401 ourselves
      'Session expired. Redirecting to login...',
    ],

    beforeSend(event) {
      // Strip PII from request data and user object before send.
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  });
}
