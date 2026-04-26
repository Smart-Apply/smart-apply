// This file configures the initialization of Sentry on the SERVER side.
// Runs in the Next.js Node server (route handlers, server components,
// middleware in the Node runtime).
// Loaded automatically by `withSentryConfig` in next.config.ts.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.SENTRY_RELEASE,
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) event.user = { id: event.user.id };
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        delete headers.authorization;
        delete headers.cookie;
      }
      return event;
    },
  });
}
