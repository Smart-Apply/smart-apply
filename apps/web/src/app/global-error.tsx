'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import NextError from 'next/error';

/**
 * Next.js App Router global error boundary.
 * Catches errors that escape every other boundary (errors in the root layout,
 * top-level providers, etc.). Forwards them to Sentry, then renders a minimal
 * error page.
 *
 * Required by @sentry/nextjs to capture the rare class of errors that bubble
 * up past all other boundaries.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
