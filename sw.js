const CACHE_NAME = 'listen-pro-v1.33';
const ASSETS = [
  './',
  './index.html',
  './login.html',
  './css/fonts.css',
  './css/remixicon.css',
  './css/style.css',
  './fonts/inter-latin-wght-normal.woff2',
  './fonts/remixicon.woff2?v=3.5.0',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
  './js/data.js',
  './js/topics.js',
  './js/dictionary.js',
  './js/audio.js',
  './js/offline.js',
  './js/app.js',
  './js/auth.js',
  './js/sync.js',
  './js/vendor/cloudbase.js',
  './js/auth-guard.js',
  './manifest.json',
  './icon.svg?v=2'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// On a bad connection a request can hang instead of failing. When a cached copy exists, stop
// waiting after this long and use it, so the page never sits on a half-loaded state.
const NETWORK_TIMEOUT = 4000;

self.addEventListener('fetch', e => {
  const request = e.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Media files must bypass the worker so the browser can keep playing them in the background.
  if (url.pathname.includes('/audio/')) return;

  // The network copy is still saved when the cached one was served first, ready for next time.
  let saved = Promise.resolve();
  const fromNetwork = fetch(request).then(fresh => {
    if (fresh && fresh.ok) {
      const copy = fresh.clone();
      saved = caches.open(CACHE_NAME).then(c => c.put(request, copy));
    }
    return fresh;
  });
  e.waitUntil(fromNetwork.then(() => saved, () => {}).catch(() => {}));

  const networkFirst = async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request) || await caches.match(request);
    if (!cached) {
      try {
        return await fromNetwork;
      } catch (err) {
        if (request.mode === 'navigate') {
          const fallback = await cache.match('./index.html') || await caches.match('./index.html');
          if (fallback) return fallback;
        }
        throw err;
      }
    }
    // Network first, but fall back to the cached copy on a failure, an error status or a stall.
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(cached), NETWORK_TIMEOUT);
      fromNetwork.then(fresh => {
        clearTimeout(timer);
        resolve(fresh && fresh.ok ? fresh : cached);
      }, () => {
        clearTimeout(timer);
        resolve(cached);
      });
    });
  };

  e.respondWith(networkFirst());
});

// Offline audio downloaded by the learner (js/offline.js) lives in its own cache and
// must survive app updates.
const KEEP_CACHE_PREFIX = 'lp-audio-';
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k !== CACHE_NAME && !k.startsWith(KEEP_CACHE_PREFIX))
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
