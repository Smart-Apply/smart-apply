'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration Component
 * Registers the service worker for PWA functionality
 * Only runs in production or when explicitly enabled
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only register service worker in production or when PWA is enabled
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      registerServiceWorker();
    }
  }, []);

  return null;
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
