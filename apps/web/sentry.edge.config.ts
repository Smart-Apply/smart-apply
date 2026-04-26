// This file configures the initialization of Sentry on the EDGE runtime
// (Edge middleware, Edge route handlers). Smaller subset of APIs available
// vs server.config.ts.
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
  });
}
