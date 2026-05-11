/**
 * Lazy ESM loader for @react-pdf/renderer.
 *
 * The api package is CommonJS (tsconfig `module: node16`) but
 * @react-pdf/renderer is ESM-only. Static `import` produces `require()` at
 * runtime which throws ERR_REQUIRE_ESM. We resolve the module exactly once
 * via dynamic import and cache the namespace.
 *
 * All template components and the renderer service go through this helper —
 * they receive the namespace as an argument rather than importing the package
 * directly.
 */

import type { ComponentType, ReactElement } from 'react';

export type ReactPdfStyle = Record<string, unknown>;

export interface ReactPdfStyleSheet {
  create<T extends Record<string, ReactPdfStyle>>(styles: T): T;
}

// Component types are intentionally `ComponentType<any>`: the upstream
// @react-pdf/renderer prop types live in ESM declarations we can't import
// from this CJS package, and modelling them by hand (style, size, src, wrap,
// etc. — different per component) would be both incomplete and brittle.
// Templates use `createElement(...)` so we accept any prop shape; runtime
// validation is the responsibility of @react-pdf/renderer.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ReactPdfNamespace {
  Document: ComponentType<any>;
  Page: ComponentType<any>;
  View: ComponentType<any>;
  Text: ComponentType<any>;
  Link: ComponentType<any>;
  Image: ComponentType<any>;
  StyleSheet: ReactPdfStyleSheet;
  Font: { register: (config: unknown) => void };
  renderToBuffer: (element: ReactElement) => Promise<Buffer>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let cached: Promise<ReactPdfNamespace> | undefined;

export function loadReactPdf(): Promise<ReactPdfNamespace> {
  if (!cached) {
    // Use `new Function` to bypass TS's CJS resolver — it would otherwise
    // emit `require()` for a static `import()` of a known package, which
    // throws ERR_REQUIRE_ESM at runtime against the ESM-only react-pdf
    // package. The Function indirection forces a real dynamic import.
    const dynamicImport = new Function('m', 'return import(m)') as (
      m: string,
    ) => Promise<ReactPdfNamespace>;
    cached = dynamicImport('@react-pdf/renderer');
  }
  return cached;
}
