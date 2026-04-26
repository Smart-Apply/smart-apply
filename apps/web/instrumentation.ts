// Next.js auto-loads this file at startup. Required by @sentry/nextjs to
// register the appropriate runtime config (server vs edge) before any user
// code executes.
//
// See: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Re-export Sentry's request error hook so server-side errors in route
// handlers / server actions are captured automatically.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
