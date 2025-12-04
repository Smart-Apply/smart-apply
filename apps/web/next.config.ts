import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Standalone output for Docker container deployment
  output: 'standalone',
  
  // Set workspace root for file tracing (monorepo setup)
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Image configuration for external template preview images
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/v1/templates/*/preview',
      },
    ],
  },

  // Security headers for enhanced XSS and clickjacking protection
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // API endpoints for Content-Security-Policy connect-src
    // Development: Allow localhost for API and HMR WebSocket
    // Production: Use environment variable or default to same-origin
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    // Extract just the origin (protocol + host + port) for CSP
    const apiOrigin = new URL(apiBaseUrl).origin;
    const connectSrc = isDevelopment 
      ? `'self' ${apiOrigin} ws://localhost:3001 ws://localhost:3000` 
      : `'self' ${apiOrigin}`;

    return [
      {
        source: '/:path*',
        headers: [
          // Content Security Policy
          // Protects against XSS attacks by controlling which resources can be loaded
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js requires 'unsafe-eval' for development (HMR)
              // and 'unsafe-inline' for some runtime features
              isDevelopment 
                ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" 
                : "script-src 'self' 'unsafe-inline'",
              // Tailwind CSS and inline styles require 'unsafe-inline'
              "style-src 'self' 'unsafe-inline'",
              // Allow images from self, data URIs, HTTPS sources, and backend API
              `img-src 'self' data: https: ${apiOrigin}`,
              // Allow fonts from self and data URIs
              "font-src 'self' data:",
              // API and WebSocket connections
              `connect-src ${connectSrc}`,
              // Prevent embedding in frames (defense in depth with X-Frame-Options)
              "frame-ancestors 'none'",
              // Restrict base URI to prevent base tag injection
              "base-uri 'self'",
              // Restrict form submissions to same origin
              "form-action 'self'",
            ].join('; '),
          },
          // Prevent clickjacking attacks by denying iframe embedding
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Control how much referrer information is sent
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Restrict access to sensitive browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Strict Transport Security (HSTS) - only in production with HTTPS
          // Forces browsers to use HTTPS for all future requests
          ...(process.env.NODE_ENV === 'production' ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
