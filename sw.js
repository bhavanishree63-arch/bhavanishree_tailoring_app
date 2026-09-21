// BHAVANISHREE TAILORING SHOP - Service Worker
// Caches the app shell so it works fully offline after the first load.

const CACHE_VERSION = 'bhavanishree-v12';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/app.js',
  './manifest.json',
  './logo.png',
  './icons/icon-48.png',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Files that change whenever we ship a fix. These use "stale-while-
// revalidate": the cached copy is served instantly (so the app opens fast,
// no waiting on the network), while a fresh copy is fetched in the
// background and saved for the *next* load. So a fix you ship shows up
// automatically the next time the app is reopened, without you needing to
// bump a cache version, and without slowing down every single load.
const STALE_WHILE_REVALIDATE = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/app.js'
];

function isStaleWhileRevalidate(url) {
  return STALE_WHILE_REVALIDATE.some((suffix) => url.pathname.endsWith(suffix.replace('./', '/')));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const swr = request.mode === 'navigate' || isStaleWhileRevalidate(url);

  if (swr) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);

        // Kick off a network fetch regardless, to refresh the cache for
        // next time. Don't let the page wait on it.
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        // Serve the cached copy immediately if we have one (fast). If
        // nothing is cached yet (first-ever load), wait on the network.
        if (cached) return cached;
        const fresh = await networkFetch;
        return fresh || cache.match('./index.html');
      })
    );
    return;
  }

  // Cache-first for everything else (icons, manifest, etc.) — these rarely
  // change, so serving them instantly from cache is safe.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
