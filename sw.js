// sw.js - PWA Service Worker for GitHub Pages
const CACHE_NAME = 'transparent-transactions-pwa-v1';
const BASE_PATH = '/Transparent-Transactions/';

self.addEventListener('install', (event) => {
  console.log('🚀 PWA Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll([
          BASE_PATH,
          BASE_PATH + 'index.html',
          BASE_PATH + 'styles.css',
          BASE_PATH + 'db.js',
          BASE_PATH + 'auth.js',
          BASE_PATH + 'ui.js',
          BASE_PATH + 'contacts.js',
          BASE_PATH + 'transactions.js',
          BASE_PATH + 'manifest.json'
        ]);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Handle PWA navigation - always serve index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(BASE_PATH + 'index.html')
        .then((response) => {
          return response || fetch(event.request);
        })
    );
    return;
  }

  // Handle other requests
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
