#!/usr/bin/env node
/**
 * Sanitize Prisma generated client for Node 24 + CommonJS runtime.
 *
 * The `prisma-client` provider in Prisma 6.19.x emits TypeScript that, depending
 * on the host platform / @prisma/client version skew, may contain either:
 *
 *   1. `import.meta.url`  — Node 24's experimental ESM auto-detection picks
 *      this up, treats the compiled .js as ESM, then crashes with
 *      "exports is not defined in ES module scope" because the rest of the
 *      file is CJS (uses `exports = ...`).
 *
 *   2. Explicit `.ts` extensions in relative imports (e.g. `from "./internal/class.ts"`).
 *      With `moduleResolution: "node"` TypeScript preserves the `.ts` extension
 *      in the compiled output, producing `require("./internal/class.ts")`,
 *      which fails with `MODULE_NOT_FOUND` at runtime.
 *
 * Both result in production crash loops.
 *
 * This script runs after `prisma generate` and:
 *   - Replaces the `globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))`
 *     line (and the `import { fileURLToPath } from 'node:url'` it depends on)
 *     with a no-op (CJS already provides __dirname).
 *   - Strips `.ts` extensions from any relative imports.
 *
 * It's intentionally idempotent and a no-op when neither pattern is present
 * (so it stays safe on top of future Prisma versions that fix the upstream).
 */

const fs = require('node:fs');
const path = require('node:path');

const GENERATED_DIR = path.resolve(__dirname, '..', 'src', 'generated', 'prisma');

if (!fs.existsSync(GENERATED_DIR)) {
  console.error(`[sanitize-prisma-client] Skipping: ${GENERATED_DIR} does not exist`);
  process.exit(0);
}

let totalFiles = 0;
let importMetaFixes = 0;
let tsExtensionFixes = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      sanitize(full);
    }
  }
}

function sanitize(file) {
  const original = fs.readFileSync(file, 'utf8');
  let content = original;

  // 1. Drop `fileURLToPath` import + replace the `import.meta.url` line.
  if (content.includes('import.meta.url')) {
    content = content.replace(
      /^\s*import\s*\{\s*fileURLToPath\s*\}\s*from\s*['"]node:url['"];?\s*$/m,
      '',
    );
    content = content.replace(
      /^\s*globalThis\[['"]__dirname['"]\]\s*=\s*path\.dirname\(\s*fileURLToPath\(\s*import\.meta\.url\s*\)\s*\);?\s*$/m,
      '// [sanitize-prisma-client] removed ESM-only directory resolution; CJS provides __dirname',
    );
    importMetaFixes++;
  }

  // 2. Strip explicit relative-import extensions so both ts-node (CJS) and the
  //    compiled JS runtime can resolve them.
  //
  //    Prisma 6.19.x emits TypeScript files whose relative imports include the
  //    target file extension (`./internal/class.js` or `./foo.ts`). Two failure
  //    modes follow:
  //      - With `moduleResolution: "node"`, ts-node turns `from "./foo.ts"`
  //        into `require("./foo.ts")` → MODULE_NOT_FOUND.
  //      - The newer Prisma output uses NodeNext-style `.js` suffixes inside
  //        `.ts` source files; ts-node in CJS mode also can't resolve those
  //        because no `.js` sibling exists at runtime.
  //
  //    Stripping both extensions normalizes the imports so Node's standard
  //    resolver picks up the actual sibling file (whether .ts or .js).
  const extRegex = /(from\s+['"])(\.{1,2}\/[^'"]+?)\.(?:ts|js)(['"])/g;
  if (extRegex.test(content)) {
    content = content.replace(extRegex, '$1$2$3');
    tsExtensionFixes++;
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    totalFiles++;
  }
}

walk(GENERATED_DIR);

if (totalFiles === 0) {
  console.log('[sanitize-prisma-client] Generated client is clean — no changes needed.');
} else {
  console.log(
    `[sanitize-prisma-client] Patched ${totalFiles} file(s) ` +
      `(import.meta: ${importMetaFixes}, .ts extensions: ${tsExtensionFixes})`,
  );
}
