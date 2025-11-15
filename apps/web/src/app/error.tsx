'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

/**
 * Next.js error boundary for app directory
 * Catches errors in server components and client components
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Next.js Error Boundary:', error);
    }
    
    // In production, log to error tracking service
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle>Ein Fehler ist aufgetreten</CardTitle>
          </div>
          <CardDescription>
            Beim Laden dieser Seite ist ein Fehler aufgetreten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">Fehlermeldung:</p>
              <p className="mt-1 text-sm text-red-700">{error.message}</p>
              {error.digest && (
                <p className="mt-1 text-xs text-red-600">Digest: {error.digest}</p>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              onClick={reset}
              className="flex-1"
            >
              Erneut versuchen
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/dashboard'}
              className="flex-1"
            >
              Zum Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
