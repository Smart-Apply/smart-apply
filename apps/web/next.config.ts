import type { NextConfig } from "next";
import path from "path";
import bundleAnalyzer from "@next/bundle-analyzer";

// Bundle analyzer for webpack analysis (ANALYZE=true npm run build)
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// When building for Cloudflare Workers via OpenNext, disable Next features
// that don't translate to the Workers runtime (standalone output, sharp-based
// image optimization). Existing Docker/VM build path is unchanged.
const isOpenNextBuild = process.env.OPEN_NEXT === 'true';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Standalone output for Docker deployment.
  // Skipped for OpenNext (Workers) — OpenNext produces its own bundle.
  output: isOpenNextBuild ? undefined : 'standalone',

  // Monorepo file tracing
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Enable gzip compression for production builds (default: true in production)
  // This compresses static assets and API responses, reducing bandwidth usage
  compress: true,

  // Optimized image configuration
  images: {
    // Sharp isn't available in the Workers runtime, so disable Next.js image
    // optimization when building for OpenNext (still works on the VM build).
    // Re-enable later via Cloudflare Images binding if needed.
    unoptimized: isOpenNextBuild,
    // Modern image formats for better compression
    formats: ['image/avif', 'image/webp'],
    // Device widths for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for different breakpoints
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimize external requests
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days cache
    // Remote patterns for external images
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/v1/templates/*/preview',
      },
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
        pathname: '/**',
      },
      {
        // Cloudflare R2 presigned URLs (when STORAGE_DRIVER=r2 on backend)
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
        pathname: '/**',
      },
    ],
  },

  // Experimental optimizations for package imports
  // Tree-shaking optimization for large icon libraries
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
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

// Sentry was removed from the frontend to keep the Cloudflare Workers
// bundle under the 3 MB free-tier script-size limit. Backend Sentry on the
// NestJS API is unaffected and continues to capture server-side errors.
// To re-enable: `git log --diff-filter=D -- apps/web/src/sentry*.ts`
// and revert the removing commit, then `npm install @sentry/nextjs`.
export default withBundleAnalyzer(nextConfig);

