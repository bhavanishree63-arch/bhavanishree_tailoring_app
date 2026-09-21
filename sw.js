// BHAVANISHREE TAILORING SHOP - Service Worker
// Caches the app shell so it works fully offline after the first load.

const CACHE_VERSION = 'bhavanishree-v11';
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

// Files that change whenever we ship a fix — these must always be fetched
// from the network first, so a bug fix takes effect the moment the app is
// reopened instead of waiting on the person to notice and force-clear the
// cache. If the network is unreachable (offline), we fall back to whatever
// was last cached so the app still opens.
const NETWORK_FIRST = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/app.js'
];

function isNetworkFirst(url) {
  return NETWORK_FIRST.some((suffix) => url.pathname.endsWith(suffix.replace('./', '/')));
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
  const networkFirst = request.mode === 'navigate' || isNetworkFirst(url);

  if (networkFirst) {
    // Always try the network first for the app's own code, so edits you
    // ship are picked up on the very next load. Only fall back to the
    // cached copy if there's no connectivity.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./index.html'))
        )
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
