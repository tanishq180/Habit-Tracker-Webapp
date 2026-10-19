// Self-cleanup service worker for Zero-JS SSR mode
// Clears any previous service worker caches and unregisters immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Pass through all requests directly to the network without caching
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
