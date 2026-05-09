'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration Component
 * Registers the service worker for PWA functionality
 * Only runs in production or when explicitly enabled
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      registerServiceWorker();
      installChunkErrorRecovery();
    } else {
      // Dev: aggressively kill any stale SW + caches left behind by a
      // previous `next build` / Cloudflare deploy on the same origin.
      // Without this, the prod bundle (with prod API URL baked in) keeps
      // getting served from the SW cache and dev edits never reach the
      // browser.
      unregisterAllServiceWorkers();
    }
  }, []);

  return null;
}

async function unregisterAllServiceWorkers() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return;
    await Promise.all(regs.map((r) => r.unregister()));
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
     
    console.log(
      `[PWA dev] Unregistered ${regs.length} stale service worker(s) and cleared caches. Reloading...`,
    );
    window.location.reload();
  } catch (err) {
     
    console.warn('[PWA dev] Failed to clear stale service worker:', err);
  }
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    console.log('[PWA] Service Worker registered successfully:', registration.scope);

    // Check for updates periodically (every hour)
    setInterval(async () => {
      try {
        await registration.update();
        console.log('[PWA] Service Worker update check completed');
      } catch (error) {
        console.warn('[PWA] Service Worker update check failed:', error);
      }
    }, 60 * 60 * 1000);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available, show notification to user
            console.log('[PWA] New version available. Please refresh the page.');
            
            // Optionally dispatch a custom event for the app to handle
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    // Handle controller changes (new service worker took over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[PWA] New service worker activated, reloading...');
        window.location.reload();
      }
    });

  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
  }
}

/**
 * Recover from "stale chunk" errors after a Cloudflare Worker deploy.
 *
 * The scenario:
 *   1. User loads `smart-apply.io/dashboard` — React app is now in memory
 *      with references to chunk hashes from build N.
 *   2. We deploy build N+1. Chunk hashes change; the old hashes are gone
 *      from the Worker.
 *   3. User clicks something that triggers a code-split lazy load.
 *      Webpack tries to fetch `/_next/static/chunks/<old-hash>.js`.
 *   4. The Worker can't find it, falls back to the SPA HTML, which the
 *      browser refuses to execute as a script (MIME error). React then
 *      surfaces a `ChunkLoadError`.
 *
 * Fix: detect that error and force a full page reload so the browser
 * re-fetches `index.html` and gets the fresh chunk hashes. We guard
 * against reload loops via sessionStorage — if a reload itself triggers
 * the same error, we surrender and let the user see it.
 */
function installChunkErrorRecovery(): void {
  const RELOAD_FLAG = '__smart_apply_chunk_reload__';

  const isChunkLoadError = (reason: unknown): boolean => {
    if (!reason) return false;
    // Webpack emits ChunkLoadError; Next.js wraps with name "ChunkLoadError".
    // The message contains the chunk URL, which lets us also catch the
    // "Loading CSS chunk … failed" / "Loading chunk … failed" variants.
    const name = (reason as { name?: string }).name ?? '';
    const message = String((reason as { message?: string }).message ?? reason);
    return (
      name === 'ChunkLoadError' ||
      /Loading (CSS )?chunk \S+ failed/i.test(message) ||
      /Failed to fetch dynamically imported module/i.test(message)
    );
  };

  const tryReload = (): void => {
    // One reload max — sessionStorage survives the reload itself, so a
    // second chunk error on the fresh page short-circuits and lets the
    // user/Sentry see the real failure instead of an infinite loop.
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') {
      console.error(
        '[PWA] Chunk load error after reload — giving up to avoid loop.',
      );
      return;
    }
    sessionStorage.setItem(RELOAD_FLAG, '1');
    console.warn('[PWA] Chunk load error detected — reloading to pick up new build.');
    window.location.reload();
  };

  // Clear the loop guard once we've successfully run for ~10s without
  // another chunk failure. Means a future deploy this session can also
  // self-heal.
  setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 10_000);

  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error ?? event)) {
      event.preventDefault();
      tryReload();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      tryReload();
    }
  });
}
