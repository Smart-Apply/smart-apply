# Frontend Bundle Optimization Guide

This document describes the bundle size optimizations implemented in the Smart Apply frontend to improve initial page load performance and Core Web Vitals scores.

## Overview

The frontend uses Next.js 16 with several optimization strategies:
- **Dynamic imports** for heavy components (~500KB total savings)
- **Package import optimization** for icon libraries
- **Code splitting** by route (automatic via Next.js App Router)
- **Webpack bundle analyzer** for monitoring bundle size

## Goals

- **Initial bundle size:** < 500KB (gzipped)
- **First Contentful Paint (FCP):** < 1.5s
- **Time to Interactive (TTI):** < 3.5s
- **Lighthouse Performance score:** > 90

## Dynamic Imports

Heavy components are loaded on-demand using Next.js `dynamic()` import:

### 1. PDF Preview Modal (~300KB)

**Location:** `apps/web/src/app/(dashboard)/applications/[id]/page.tsx`

```typescript
const PDFPreviewModal = dynamic(
  () => import('@/components/pdf/pdf-preview-modal').then(mod => ({ default: mod.PDFPreviewModal })),
  {
    loading: () => (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <CenteredLoader message="Lädt PDF-Vorschau..." />
        </div>
      </div>
    ),
    ssr: false, // PDF viewer doesn't work with SSR
  }
);
```

**Why:** `react-pdf` and `pdfjs-dist` (5.4.394) are large dependencies only needed when user clicks "Preview" button.

### 2. Rich Text Editors (~200KB)

**Location:** `apps/web/src/app/(dashboard)/applications/[id]/edit/page.tsx`

```typescript
const ResumeFormEditor = dynamic(
  () => import('@/components/applications/resume-form-editor').then(mod => ({ default: mod.ResumeFormEditor })),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false, // Tiptap editor doesn't work with SSR
  }
);

const CoverLetterEditor = dynamic(
  () => import('@/components/applications/cover-letter-editor').then(mod => ({ default: mod.CoverLetterEditor })),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false,
  }
);
```

**Why:** `@tiptap/react` and `@tiptap/starter-kit` are only needed on the edit page, not application list or detail view.

### 3. Profile Form Managers (~200KB)

**Location:** `apps/web/src/app/(dashboard)/profile/edit/page.tsx`

```typescript
const ExperienceManager = dynamic(
  () => import('@/components/forms/experience-manager').then(mod => ({ default: mod.ExperienceManager })),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  }
);

const EducationManager = dynamic(
  () => import('@/components/forms/education-manager').then(mod => ({ default: mod.EducationManager })),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  }
);

const ProjectsManager = dynamic(
  () => import('@/components/forms/projects-manager').then(mod => ({ default: mod.ProjectsManager })),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  }
);
```

**Why:** These components use `RichTextEditor` (Tiptap-based) which is only needed in profile editing flow.

## Package Import Optimization

**Location:** `apps/web/next.config.ts`

```typescript
experimental: {
  optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
}
```

**Why:** Tree-shaking optimization for large icon libraries. Without this, Next.js would bundle all 1000+ Lucide icons even if only using 20.

## Bundle Analyzer

**Installation:**
```bash
npm install --save-dev @next/bundle-analyzer
```

**Configuration:** `apps/web/next.config.ts`
```typescript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer(nextConfig);
```

**Usage:**
```bash
cd apps/web
ANALYZE=true npm run build
```

This opens an interactive treemap visualization of bundle size in your browser.

## Best Practices

### When to Use Dynamic Imports

✅ **DO use dynamic imports for:**
- Heavy third-party libraries (> 50KB)
- Components only used in specific routes
- Editor libraries (Tiptap, Monaco, etc.)
- PDF/document viewers
- Data visualization libraries
- Modal/dialog content (if large)

❌ **DON'T use dynamic imports for:**
- UI primitives (buttons, inputs, cards)
- Small components (< 10KB)
- Components used on every page
- Critical above-the-fold content

### Loading State Pattern

Always provide a loading state for dynamic imports:

```typescript
const HeavyComponent = dynamic(
  () => import('./heavy-component'),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  }
);
```

Use:
- `<Skeleton>` for content areas
- `<CenteredLoader>` for full-page/modal loading
- `<Spinner>` for inline loading

### SSR vs Client-Only

Set `ssr: false` for:
- Components that use browser-only APIs (DOM manipulation)
- Editor libraries (Tiptap, Monaco)
- PDF viewers (react-pdf)
- Any component that breaks with hydration

## Monitoring Bundle Size

### Automated Checks

**GitHub Actions CI** (future enhancement):
```yaml
- name: Analyze bundle size
  run: |
    cd apps/web
    ANALYZE=true npm run build
    # Upload bundle stats to GitHub artifacts
```

### Manual Checks

Run bundle analyzer before major releases:
```bash
cd apps/web
ANALYZE=true npm run build
```

Check for:
- **Main bundle:** < 200KB (gzipped)
- **Framework chunks:** < 150KB (React, Next.js runtime)
- **Vendor chunks:** < 150KB (third-party libraries)
- **Route chunks:** < 50KB each (individual pages)

## Performance Metrics

### Target Metrics (3G Network)

| Metric | Target | Current |
|--------|--------|---------|
| First Contentful Paint | < 1.5s | TBD |
| Largest Contentful Paint | < 2.5s | TBD |
| Time to Interactive | < 3.5s | TBD |
| Total Blocking Time | < 300ms | TBD |
| Cumulative Layout Shift | < 0.1 | TBD |

### Lighthouse Scores

Run Lighthouse locally:
```bash
cd apps/web
npm run build
npm run start
# Open Chrome DevTools > Lighthouse > Run analysis
```

**Target scores:**
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 90

## Troubleshooting

### "Module not found" after dynamic import

**Cause:** Incorrect module path or export name.

**Fix:**
```typescript
// ❌ Wrong
dynamic(() => import('./component'))

// ✅ Correct (named export)
dynamic(() => import('./component').then(mod => ({ default: mod.ComponentName })))

// ✅ Correct (default export)
dynamic(() => import('./component'))
```

### Hydration mismatch error

**Cause:** Server-rendered HTML doesn't match client-rendered HTML.

**Fix:** Set `ssr: false` for client-only components:
```typescript
dynamic(() => import('./component'), { ssr: false })
```

### Bundle size not decreasing

**Cause:** Component is still imported elsewhere synchronously.

**Fix:** Search codebase for all imports:
```bash
grep -r "import.*ComponentName" apps/web/src
```

Ensure all imports use `dynamic()`.

## Future Optimizations

### Planned Improvements (Post-MVP)

1. **Image optimization:** Use Next.js `<Image>` component with `priority` prop
2. **Font optimization:** Self-host Google Fonts instead of external CDN
3. **CSS optimization:** Remove unused Tailwind classes with PurgeCSS
4. **CDN deployment:** Serve static assets from Azure CDN
5. **HTTP/2:** Enable server push for critical resources
6. **Prefetching:** Add `<link rel="prefetch">` for likely next pages

### Monitoring Tools

1. **Lighthouse CI:** Automated performance testing in GitHub Actions
2. **Bundle Size Bot:** Comment on PRs with bundle size changes
3. **Web Vitals:** Track real user metrics (RUM) with Azure Application Insights

## References

- [Next.js Dynamic Imports](https://nextjs.org/docs/advanced-features/dynamic-import)
- [Next.js Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse Performance](https://developer.chrome.com/docs/lighthouse/performance/)

## Related Documentation

- [Performance Optimization Roadmap](../../docs/features/PERFORMANCE_OPTIMIZATION.md) (if exists)
- [Deployment Guide](../../docs/guides/AZURE_DEPLOYMENT.md)
- [Testing Strategy](../../docs/testing/TESTING_STRATEGY.md)
