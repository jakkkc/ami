const CACHE_NAME = 'ami-designs-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/assets/logo.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isCacheable(request) {
  // Only GET requests over http/https can be stored in the Cache API.
  // This excludes HEAD/POST requests and browser-extension-injected requests.
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.protocol === 'http:' || url.protocol === 'https:';
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (!isCacheable(request)) {
    // Let uncacheable requests (extensions, HEAD, etc.) pass straight through.
    return;
  }

  const isCoreAsset =
    request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js');

  if (isCoreAsset || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).catch(() => caches.match('/offline.html'));
    })
  );
});
