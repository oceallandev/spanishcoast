/* Minimal same-origin service worker for instant repeat loads on mobile WebKit/Android. */
const CACHE_NAME = 'scp-cache-20260210j';

const PRECACHE_PATHS = [
  './',
  './index.html',
  './properties.html',
  './brochure.html',
  './account.html',
  './admin-favourites.html',
  './admin-crm.html',
  './viewing-trip.html',
  './businesses.html',
  './business-buy-sell.html',
  './business-management.html',
  './business-legal-advice.html',
  './business-contracts.html',
  './business-documentation.html',
  './help-screen-listings.html',
  './help-verify-key-info.html',
  './help-coordinate-lawyers.html',
  './help-contract-review.html',
  './help-documentation-changes.html',
  './collaborate.html',
  './vehicles.html',
  './services.html',
  './agents.html',
  './style.css?v=20260210j',
  './site.js?v=20260210j',
  './catalog.js?v=20260210j',
  './catalog-page.js?v=20260210j',
  './app.js?v=20260210j',
  './custom-listings.js?v=20260210j',
  './inmovilla-listings.js?v=20260210j',
  './brochure.js?v=20260210j',
  './config.js?v=20260210j',
  './supabase-init.js?v=20260210j',
  './account.js?v=20260210j',
  './admin-favourites.js?v=20260210j',
  './admin-crm.js?v=20260210j',
  './data.js?v=20260210j',
  './businesses-data.js?v=20260210j',
  './manifest.webmanifest?v=20260210j',
  './assets/header-logo.png',
  './assets/scp-isotipo.png',
  './assets/placeholder.png',
  './robots.txt',
  './sitemap.xml'
];

function cacheKeyFor(request) {
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return request;
    // Keep query strings for versioned static assets (we use ?v=...).
    // For navigations like properties.html?ref=... we already do network-first.
    const keepSearch = /\.(js|css|webmanifest)$/i.test(url.pathname);
    const keyUrl = url.origin + url.pathname + (keepSearch ? url.search : '');
    return new Request(keyUrl, {
      method: request.method,
      headers: request.headers,
      mode: request.mode,
      credentials: request.credentials,
      redirect: request.redirect,
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
      integrity: request.integrity,
      cache: request.cache
    });
  } catch {
    return request;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_PATHS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => {
      if (name !== CACHE_NAME && name.startsWith('scp-cache-')) {
        return caches.delete(name);
      }
      return null;
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const key = cacheKeyFor(req);

  // Config: always prefer network so config changes are picked up quickly.
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(key, fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match(key);
        return cached || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // HTML navigations: network-first, fallback to cache (supports offline).
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(req);
        cache.put(key, fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match(key);
        return cached || cache.match('./index.html');
      }
    })());
    return;
  }

  // Static assets: stale-while-revalidate (fast).
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(key);
    const fetchPromise = fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(key, res.clone());
        return res;
      })
      .catch(() => null);

    return cached || (await fetchPromise) || new Response('', { status: 504 });
  })());
});
