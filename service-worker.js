// A real service worker would cache files for offline use.
// This is a placeholder to satisfy the PWA manifest.
const CACHE_NAME = 'trust-txn-cache-v1';
const urlsToCache = [
  '/',
  '/onboarding.html',
  '/index.html',
  '/confirm.html',
  '/login.html',
  '/js/app.js',
  '/js/auth.js',
  '/js/database.js',
  '/js/config.js',
  // ... add other files as needed
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});