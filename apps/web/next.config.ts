import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Standalone output for Docker container deployment
  output: 'standalone',
  
  // Set workspace root for file tracing (monorepo setup)
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Enable gzip compression for production builds (default: true in production)
  // This compresses static assets and API responses, reducing bandwidth usage
  compress: true,

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
  // Note: CSP is now set dynamically in middleware.ts for runtime API URL support
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
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
