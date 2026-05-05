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
