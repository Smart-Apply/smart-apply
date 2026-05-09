/// <reference lib="webworker" />

// IMPORTANT: bump this whenever you change cache behaviour or want to force
// every existing user's browser to drop the previous SW's caches on next
// visit. Anything not matching the current version below is deleted on
// activation.
const CACHE_VERSION = 'v5';
const CACHE_NAME = `smart-apply-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `smart-apply-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `smart-apply-dynamic-${CACHE_VERSION}`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/Logo/favicon-icon.png',
  '/Logo/Medium Logo.png',
  '/Logo/Full Logo.png',
  '/offline.html',
];

// API routes that should use network-first strategy
const API_ROUTES = ['/api/'];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('[SW] Some static assets failed to cache:', error);
        // Continue even if some assets fail to cache
        return Promise.resolve();
      });
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - aggressively purge ALL old caches.
//
// Why aggressive? When we cut frontend hosting from VM → Cloudflare Worker,
// any user who'd visited before still has the old SW + caches in their
// browser. Their cached cross-origin API responses are stale and cause
// CORS errors against the new backend config. Wiping everything not
// matching the CURRENT version forces a clean state on the next visit.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Drop everything that isn't one of THIS version's caches.
            return (
              name !== CACHE_NAME &&
              name !== STATIC_CACHE_NAME &&
              name !== DYNAMIC_CACHE_NAME
            );
          })
          .map((name) => {
            console.log('[SW] Deleting stale cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately so the next request goes
  // through this SW's logic, not the previous version's.
  self.clients.claim();
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except for allowed CDNs)
  if (url.origin !== self.location.origin) {
    // Allow Google Fonts and other trusted CDNs
    const allowedOrigins = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ];
    if (!allowedOrigins.some((origin) => url.href.startsWith(origin))) {
      return;
    }
  }

  // API requests - Network first, cache fallback
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE_NAME));
    return;
  }

  // Hashed Next.js build artefacts (`/_next/static/...`) — always go to
  // network. After a deploy these hashes change; if the SW served a
  // cached 404 (or a stale chunk from a previous deploy) the browser
  // refuses the response with a MIME error and the React tree breaks
  // half-mounted. Network-only with NO caching is the only safe option:
  // hashed URLs are immutable so the browser HTTP cache already handles
  // repeat-visit perf.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(networkOnlyPassthrough(request));
    return;
  }

  // Static assets - Cache first, network fallback
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
    return;
  }

  // HTML pages - Network first with offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Default - Stale while revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE_NAME));
});

// Cache-first strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    // Only cache successful 2xx responses. A 404 here typically means we
    // hit a stale chunk hash after a deploy; caching that response would
    // permanently brick the user.
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first network fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network-only passthrough — no caching, no fallback. Used for hashed
// build artefacts where stale-cache responses would do more harm than
// good.
async function networkOnlyPassthrough(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.error('[SW] Network-only fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Network-first with offline HTML fallback
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch {
    console.log('[SW] Serving offline page');
    const cache = await caches.open(STATIC_CACHE_NAME);
    const offlinePage = await cache.match('/offline.html');
    return offlinePage || new Response('Offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    // If both the network AND the cache miss, the .catch must still
    // resolve to a Response — returning undefined here makes the browser
    // throw "Failed to convert value to 'Response'" and crash the
    // FetchEvent. Falling back to a generic 503 keeps the SW honest;
    // the page-level fetch will retry naturally.
    .catch(
      () =>
        cachedResponse ||
        new Response('Service unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        }),
    );

  // Same defensive guarantee on the synchronous path: if the cache had
  // nothing AND the network promise hasn't resolved yet, returning
  // `undefined || fetchPromise` is fine, but we keep the pattern
  // explicit so a future edit doesn't accidentally regress it.
  return cachedResponse || fetchPromise;
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.webp', '.avif'
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

// Handle push notifications (future enhancement)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Neue Benachrichtigung',
    icon: '/Logo/favicon-icon.png',
    badge: '/Logo/favicon-icon.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Smart Apply', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data.url);
      }
    })
  );
});

console.log('[SW] Smart Apply Service Worker loaded');
