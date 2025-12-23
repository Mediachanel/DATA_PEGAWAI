const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;

const CORE_ASSETS = [
  './',
  'index.html',
  'loader.js',
  'tailwind.css',
  'header.html',
  'sidebar.html',
  'footer.html',
  'foto/Dinkes.png',
  'dashboard/index.html',
  'data-pegawai/index.html',
  'profil/index.html',
  'usulan-mutasi/index.html',
  'pemutusan-jf/index.html',
  'bezetting/index.html',
  'ubah-password/index.html',
  'qna/index.html'
];

const shouldCacheResponse = (response) => {
  if (!response) return false;
  return response.ok || response.type === 'opaque';
};

const precacheAll = async () => {
  const cache = await caches.open(STATIC_CACHE);
  const base = new URL(self.registration.scope);
  const tasks = CORE_ASSETS.map((asset) => {
    const url = new URL(asset, base).toString();
    return fetch(url, { cache: 'no-cache' })
      .then((res) => {
        if (!shouldCacheResponse(res)) return null;
        return cache.put(url, res);
      })
      .catch(() => null);
  });
  await Promise.allSettled(tasks);
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheAll().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

const isApiRequest = (url) => url.searchParams.has('action');

const shouldBypassApiCache = (url) => {
  const noCache = (url.searchParams.get('nocache') || '').toLowerCase();
  const cache = (url.searchParams.get('cache') || '').toLowerCase();
  if (['1', 'true', 'yes'].includes(noCache)) return true;
  if (['0', 'false', 'no'].includes(cache)) return true;
  return false;
};

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (shouldCacheResponse(response)) cache.put(request, response.clone());
  return response;
};

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (shouldCacheResponse(response)) cache.put(request, response.clone());
    return response;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw _;
  }
};

const staleWhileRevalidate = async (request, cacheName, event) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (shouldCacheResponse(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || null);

  if (cached) {
    if (event && event.waitUntil) event.waitUntil(fetchPromise);
    return cached;
  }
  return fetchPromise;
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isHtml = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  if (isHtml && url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  if (isApiRequest(url) && !shouldBypassApiCache(url)) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE, event));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});
