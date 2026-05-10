/**
 * Detect failed loads of `_next/static/chunks/*` JS / CSS bundles and
 * force a single page reload to pick up the latest deploy.
 *
 * Why this exists
 * ---------------
 * The Cloudflare Worker (OpenNext) deploys are atomic: every push to
 * `main` replaces the worker bundle AND the asset directory. Any open
 * tab still references the previous deploy's chunk hashes (e.g.
 * `/_next/static/chunks/abc123.js`). After deploy those URLs return the
 * SPA HTML fallback (status 200, Content-Type: text/html), which the
 * browser refuses to execute as JS / parse as CSS — surfacing as the
 * "Refused to apply style / execute script — MIME type mismatch" errors
 * we kept seeing in the prod console.
 *
 * Strategy
 * --------
 * 1. Catch failed resource loads (capture-phase `error`) for `<script>`
 *    and `<link rel="stylesheet">` whose URL points at a Next chunk.
 * 2. Catch unhandled `ChunkLoadError` rejections from the dynamic
 *    chunk loader.
 * 3. On the first hit, store a sessionStorage marker with `Date.now()`
 *    and call `window.location.reload()`.
 * 4. If the reload itself triggers another chunk error within 30s
 *    (i.e. the reload didn't actually fix the problem — Worker is
 *    actually broken), suppress further reloads to avoid a reload loop.
 *    Show a toast instead asking the user to retry later.
 *
 * No-op on the server (typeof window === 'undefined').
 */

import { toast } from 'sonner';

const RELOAD_MARKER_KEY = 'smart-apply:chunk-reload-at';
const RELOAD_LOOP_GUARD_MS = 30_000;

let installed = false;

function isNextChunkUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('/_next/static/chunks/') || url.includes('/_next/static/css/');
}

function recentlyReloaded(): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_MARKER_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < RELOAD_LOOP_GUARD_MS;
  } catch {
    return false;
  }
}

function markReloadAttempt(): void {
  try {
    sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()));
  } catch {
    // sessionStorage can be unavailable (private mode, blocked, etc.) —
    // we still proceed with the reload; worst case is a single retry on
    // a genuinely-broken deploy.
  }
}

function handleChunkLoadFailure(source: string): void {
  if (recentlyReloaded()) {
    // We just reloaded and it's STILL failing — assume the deploy is
    // actually broken (not just a stale tab). Stop reloading and warn
    // the user once.
    console.error(
      `[chunk-error-handler] Chunk load failed again after reload (source=${source}). Suppressing further reloads.`,
    );
    toast.error(
      'Eine Datei konnte nicht geladen werden. Bitte versuche es in ein paar Minuten erneut.',
      { id: 'chunk-load-error', duration: 8_000 },
    );
    return;
  }

  console.warn(
    `[chunk-error-handler] Detected stale chunk reference (source=${source}). Reloading…`,
  );
  markReloadAttempt();
  // Use the synchronous form; we don't want any in-flight micro-tasks
  // to enqueue another error after we've decided to reload.
  window.location.reload();
}

/**
 * Install the global error listeners. Idempotent — calling twice is a
 * no-op. Safe to call from `useEffect` in the top-level Providers.
 */
export function installChunkErrorHandler(): void {
  if (typeof window === 'undefined') return;
  if (installed) return;
  installed = true;

  // 1. Resource-load errors bubble through capture phase only.
  window.addEventListener(
    'error',
    (event: Event) => {
      const target = event.target as (HTMLScriptElement | HTMLLinkElement | null);
      if (!target) return;
      const url =
        (target as HTMLScriptElement).src ||
        (target as HTMLLinkElement).href ||
        '';
      if (isNextChunkUrl(url)) {
        handleChunkLoadFailure(`resource:${url}`);
      }
    },
    true,
  );

  // 2. Promise-based chunk loader (Next.js dynamic imports) throws
  //    `ChunkLoadError`. The runtime sometimes suppresses the synchronous
  //    error event and leaves only the rejection.
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason as { name?: string; message?: string } | string | undefined;
    const name = typeof reason === 'object' && reason !== null ? reason.name ?? '' : '';
    const message =
      typeof reason === 'string'
        ? reason
        : typeof reason === 'object' && reason !== null
          ? reason.message ?? ''
          : '';
    if (
      name === 'ChunkLoadError' ||
      message.includes('Loading chunk') ||
      message.includes('Loading CSS chunk')
    ) {
      handleChunkLoadFailure(`rejection:${name || message}`);
    }
  });
}
