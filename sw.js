const CACHE_NAME = 'listen-pro-v1.18';
const ASSETS = [
  './',
  './index.html',
  './login.html',
  './css/style.css',
  './js/data.js',
  './js/topics.js',
  './js/dictionary.js',
  './js/audio.js',
  './js/app.js',
  './js/auth.js',
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

self.addEventListener('fetch', e => {
  const request = e.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Media files must bypass the worker so the browser can keep playing them in the background.
  if (url.pathname.includes('/audio/')) return;

  const networkFirst = async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) {
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const cached = await cache.match(request) || await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const fallback = await cache.match('./index.html') || await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  };

  if (request.mode === 'navigate') {
    e.respondWith(networkFirst());
    return;
  }
  e.respondWith(networkFirst());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
