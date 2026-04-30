#!/usr/bin/env node
// @ts-check
/**
 * with-env.mjs — load `apps/web/.env.${APP_ENV}` into process.env BEFORE
 * spawning the wrapped command. Required because Next.js bakes
 * `NEXT_PUBLIC_*` values into the client bundle at build time.
 *
 * Loading order (FIRST wins, like the API):
 *   1. .env.${APP_ENV}   ← stage-specific overrides
 *   2. .env.local        ← Next.js convention, untouched
 *
 * This script does NOT touch `.env.local`; it only pre-populates
 * process.env so Next sees the right values during `next dev` / `next build`.
 *
 * Usage in package.json:
 *   "dev:dev":  "node scripts/with-env.mjs dev  next dev -p 3001"
 *   "build:int":"node scripts/with-env.mjs int  next build"
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');

const [stage, ...cmd] = process.argv.slice(2);
if (!stage || cmd.length === 0) {
  console.error('Usage: with-env.mjs <stage> <command> [args...]');
  process.exit(2);
}

const envFile = resolve(webRoot, `.env.${stage}`);
if (existsSync(envFile)) {
  const raw = readFileSync(envFile, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Already-set env vars (e.g. CI overrides) win.
    if (!(key in process.env)) process.env[key] = value;
  }
  process.env.APP_ENV = stage;
  // eslint-disable-next-line no-console
  console.log(`[with-env] APP_ENV=${stage} loaded ${envFile}`);
} else {
  process.env.APP_ENV = stage;
  // eslint-disable-next-line no-console
  console.log(`[with-env] APP_ENV=${stage} (no .env.${stage} found, using defaults)`);
}

const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('[with-env] failed to spawn:', err);
  process.exit(1);
});
