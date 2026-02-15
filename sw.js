/* Minimal same-origin service worker for instant repeat loads on mobile WebKit/Android. */
const CACHE_NAME = 'scp-cache-20260215f';

const PRECACHE_PATHS = [
  './',
  './index.html',
  './properties.html',
  './new-builds.html',
  './property-new-builds.html',
  './property-buy-sell.html',
  './property-rentals.html',
  './property-management.html',
  './property-maintenance.html',
  './brochure.html',
  './reel.html',
  './tour.html',
  './client-catalog.html',
  './property-add.html',
  './account.html',
  './affiliate.html',
  './affiliate-terms.html',
  './guide.html',
  './shop.html',
  './admin-favourites.html',
  './admin-vehicles.html',
  './admin-properties.html',
  './admin-crm.html',
  './admin-shop.html',
  './admin-affiliates.html',
  './admin-ref-map.html',
  './admin-scout.html',
  './viewing-trip.html',
  './businesses.html',
  './business-buy-sell.html',
  './business-management.html',
  './business-legal-advice.html',
  './business-contracts.html',
  './business-documentation.html',
  './business-licenses.html',
  './smart-devices.html',
  './help-screen-listings.html',
  './help-verify-key-info.html',
  './help-coordinate-lawyers.html',
  './help-contract-review.html',
  './help-documentation-changes.html',
  './collaborate.html',
  './street-scout.html',
  './vehicles.html',
  './cars.html',
  './boats.html',
  './vehicle-buy-sell.html',
  './vehicle-rentals.html',
  './vehicle-management.html',
  './vehicle-add.html',
  './vehicle-import-xml.html',
  './services.html',
  './agents.html',
  './blog.html',
  './network.html',
  './network-profile.html',
  './style.css?v=20260212b',
  './site.js?v=20260215a',
  './catalog.js?v=20260211d',
  './catalog-page.js?v=20260212a',
  './vehicles.css?v=20260211d',
  './vehicles-data.js?v=20260211d',
  './vehicles.js?v=20260211h',
  './vehicle-add.js?v=20260211d',
  './property-add.js?v=20260212a',
  './vehicle-import-xml.js?v=20260211d',
  './app.js?v=20260215b',
  './client-catalog.js?v=20260212a',
  './custom-listings.js?v=20260211d',
  './inmovilla-listings.js?v=20260211d',
  './newbuilds-listings.js?v=20260213b',
  './brochure.js?v=20260213c',
  './reel.js?v=20260214a',
  './tour.js?v=20260212d',
  './tour-data.js?v=20260212a',
  './blog.js?v=20260211l',
  './blog-posts.js?v=20260211d',
  './blog-posts.json',
  './network-data.js?v=20260215f',
  './network-redsp.js?v=20260215f',
  './network-merge.js?v=20260215f',
  './network.js?v=20260215e',
  './network-profile.js?v=20260215f',
  './config.js?v=20260211d',
  './i18n.js?v=20260213b',
  './supabase-init.js?v=20260211d',
  './account.js?v=20260215d',
  './affiliate.js?v=20260215a',
  './guide.js?v=20260211d',
  './shop.js?v=20260212a',
  './basket.js?v=20260211d',
  './admin-favourites.js?v=20260211d',
  './admin-vehicles.js?v=20260211d',
  './admin-properties.js?v=20260211d',
  './admin-crm.js?v=20260211d',
  './admin-shop.js?v=20260212a',
  './admin-affiliates.js?v=20260215a',
  './admin-ref-map.js?v=20260214c',
  './admin-scout.js?v=20260214b',
  './street-scout.js?v=20260212a',
  './data.js?v=20260211d',
  './businesses-data.js?v=20260211d',
  './manifest.webmanifest?v=20260211d',
  './assets/header-logo.png',
  './assets/scp-isotipo.png',
  './assets/scp-user-manual.pdf?v=20260211d',
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

  // WooCommerce product sync file: prefer network so daily updates show up immediately.
  if (url.pathname.endsWith('/shop-products.js') || url.pathname.endsWith('/shop-products.json')) {
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

  // Listing data feeds: prefer network so daily feed syncs show up immediately.
  if (
    url.pathname.endsWith('/data.js')
    || url.pathname.endsWith('/custom-listings.js')
    || url.pathname.endsWith('/inmovilla-listings.js')
    || url.pathname.endsWith('/newbuilds-listings.js')
    || url.pathname.endsWith('/businesses-data.js')
    || url.pathname.endsWith('/vehicles-data.js')
    || url.pathname.endsWith('/blog-posts.js')
    || url.pathname.endsWith('/blog-posts.json')
    || url.pathname.endsWith('/network-data.js')
    || url.pathname.endsWith('/network-redsp.js')
    || url.pathname.endsWith('/network-merge.js')
  ) {
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
