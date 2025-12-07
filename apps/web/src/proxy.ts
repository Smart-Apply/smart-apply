import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16 requires "proxy" named export instead of "middleware"
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  
  // Get API URL from environment variable (available at runtime in Container Apps)
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const apiOrigin = new URL(apiBaseUrl).origin;
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const connectSrc = isDevelopment 
    ? `'self' ${apiOrigin} ws://localhost:3001 ws://localhost:3000` 
    : `'self' ${apiOrigin}`;
  
  // Set CSP header dynamically based on runtime environment
  const csp = [
    "default-src 'self'",
    isDevelopment 
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" 
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: https: ${apiOrigin}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  
  return response;
}

// Apply proxy to all routes
export const config = {
  matcher: '/:path*',
};
