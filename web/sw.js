const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = 'nownote-shell:' + encodeURIComponent(SCOPE.pathname) + ':';
const CACHE_NAME = CACHE_PREFIX + 'v2.4.1';
const WIKI = SCOPE.pathname.endsWith('/wiki/');
const APP_SHELL = WIKI
  ? ['./', './index.html', './wiki.html', './styles.css', './wiki.css', './wiki-core.js', './wiki-shell.js', './wiki-runtime.js', './icons/nownote-icon.svg']
  : ['./', './index.html', './styles.css', './app.js', './help.html', './manifest.webmanifest', './icons/nownote-icon.svg'];
const CACHEABLE = new Set([...APP_SHELL, './wiki-runtime.js'].map(path => new URL(path, SCOPE).href));

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== SCOPE.origin) return;
  url.search = ''; url.hash = '';
  if (!CACHEABLE.has(url.href)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type !== 'opaque' && (!response.url || new URL(response.url).origin === SCOPE.origin)) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(url.href, copy)));
      }
      return response;
    } catch (error) {
      const cache = await caches.open(CACHE_NAME), cached = await cache.match(url.href);
      if (cached) return cached;
      throw error;
    }
  })());
});
