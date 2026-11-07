// ==================== OFFLINE AUDIO ====================
// Downloads sentence and word audio into the Cache API so a topic plays without a network.
// Playback never goes through the Service Worker (sw.js skips /audio/ so background playback
// is not cut off). Instead, files are handed to the <audio> element as blob: URLs, prepared a
// few lines ahead of the player by app.js. Downloaded files come from the cache; the rest are
// fetched into memory, so the next line starts without a network round trip. On a phone each
// new src otherwise waits for its own request, which made the pause between lines longer.
const OfflineAudio = (() => {
  const CACHE = 'lp-audio-v1';
  const supported = typeof caches !== 'undefined';
  const MAX_BLOBS = 80;
  const cached = new Set();   // absolute URLs stored in the cache
  const blobs = new Map();    // absolute URL -> blob: URL (downloaded or fetched ahead), oldest first
  const pending = new Map();  // absolute URL -> Promise<blob: URL | null>
  let ready = null;

  const abs = src => new URL(src, window.location.href).href;

  function init() {
    if (!supported) return Promise.resolve();
    if (!ready) {
      ready = caches.open(CACHE)
        .then(cache => cache.keys())
        .then(requests => requests.forEach(r => cached.add(r.url)))
        .catch(() => {});
    }
    return ready;
  }

  function has(src) {
    return cached.has(abs(src));
  }

  // A ready blob: URL for a downloaded file, or null.
  function resolve(src) {
    const key = abs(src);
    const url = blobs.get(key);
    if (!url) return null;
    blobs.delete(key);
    blobs.set(key, url); // most recently used goes last
    return url;
  }

  function load(key) {
    if (blobs.has(key)) return Promise.resolve(blobs.get(key));
    if (pending.has(key)) return pending.get(key);
    // A downloaded file is read from the cache; any other file is fetched into memory only.
    const stored = cached.has(key);
    const source = stored
      ? caches.open(CACHE).then(cache => cache.match(key))
      : fetch(key).then(res => (res.ok ? res : null));
    const job = source
      .then(res => (res ? res.blob() : null))
      .then(blob => {
        pending.delete(key);
        if (!blob) {
          if (stored) cached.delete(key);
          return null;
        }
        // Safari needs a media type on the blob to decode it.
        const typed = blob.type && blob.type.startsWith('audio/') ? blob : new Blob([blob], { type: 'audio/mp4' });
        const url = URL.createObjectURL(typed);
        blobs.set(key, url);
        while (blobs.size > MAX_BLOBS) {
          const [oldKey, oldUrl] = blobs.entries().next().value;
          URL.revokeObjectURL(oldUrl);
          blobs.delete(oldKey);
        }
        return url;
      })
      .catch(() => {
        pending.delete(key);
        return null;
      });
    pending.set(key, job);
    return job;
  }

  // Turn files into blob: URLs ahead of time so the player can use them synchronously.
  // Only pass files that exist (listed in audio/catalog.json): others are fetched for nothing.
  function prepare(srcs) {
    if (!supported) return Promise.resolve([]);
    return init().then(() => Promise.all(srcs.map(src => load(abs(src)))));
  }

  // Fetch the files that are not stored yet. onProgress(done, total) after each file.
  async function download(srcs, onProgress, signal) {
    if (!supported) throw new Error('Cache API not available');
    await init();
    const todo = [...new Set(srcs.map(abs))].filter(key => !cached.has(key));
    const total = todo.length;
    let next = 0;
    let done = 0;
    let failed = 0;
    if (!total) return { total, failed };
    const cache = await caches.open(CACHE);
    // Ask the browser not to evict the downloads under storage pressure.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    const worker = async () => {
      while (next < todo.length) {
        if (signal && signal.aborted) return;
        const key = todo[next++];
        try {
          const res = await fetch(key);
          if (!res.ok) throw new Error(String(res.status));
          await cache.put(key, res);
          cached.add(key);
        } catch (_) {
          failed++;
        }
        done++;
        if (onProgress) onProgress(done, total);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return { total, failed };
  }

  function forget(key) {
    cached.delete(key);
    const url = blobs.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      blobs.delete(key);
    }
  }

  async function remove(srcs) {
    if (!supported) return;
    const cache = await caches.open(CACHE);
    await Promise.all(srcs.map(async src => {
      const key = abs(src);
      await cache.delete(key);
      forget(key);
    }));
  }

  async function clear() {
    if (!supported) return;
    await caches.delete(CACHE);
    [...cached].forEach(forget);
    ready = null;
  }

  // Bytes stored, from each response's Content-Length (falls back to reading the body).
  async function size() {
    if (!supported) return 0;
    const cache = await caches.open(CACHE);
    const responses = await cache.matchAll();
    let bytes = 0;
    for (const res of responses) {
      const length = parseInt(res.headers.get('content-length'), 10);
      bytes += Number.isFinite(length) ? length : (await res.blob()).size;
    }
    return bytes;
  }

  return { supported, init, has, resolve, prepare, download, remove, clear, size, count: () => cached.size };
})();
