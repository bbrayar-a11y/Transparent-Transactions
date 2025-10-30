// sw.js - Service Worker with proper PWA routing
const CACHE_NAME = 'transparent-transactions-v3';
const urlsToCache = [
  '/Transparent-Transactions/',
  '/Transparent-Transactions/index.html',
  '/Transparent-Transactions/styles.css',
  '/Transparent-Transactions/db.js',
  '/Transparent-Transactions/auth.js',
  '/Transparent-Transactions/ui.js',
  '/Transparent-Transactions/contacts.js',
  '/Transparent-Transactions/transactions.js',
  '/Transparent-Transactions/manifest.json',
  '/Transparent-Transactions/404.html'
];

self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // ✅ FIX: Handle all navigation requests by serving index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/Transparent-Transactions/index.html')
        .then((response) => {
          return response || fetch(event.request);
        })
        .catch(() => {
          return caches.match('/Transparent-Transactions/index.html');
        })
    );
    return;
  }

  // For all other requests, try cache first
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
