// sw.js - Fixed PWA Service Worker for GitHub Pages
const CACHE_NAME = 'transparent-transactions-pwa-v2';
const BASE_PATH = '/Transparent-Transactions/';

// Files to cache immediately
const STATIC_ASSETS = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'styles.css',
  BASE_PATH + 'db.js',
  BASE_PATH + 'auth.js',
  BASE_PATH + 'ui.js',
  BASE_PATH + 'contacts.js',
  BASE_PATH + 'transactions.js',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'sw.js'
];

self.addEventListener('install', (event) => {
  console.log('🚀 PWA Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Skip waiting for activation');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Handle navigation requests - always serve index.html for SPA routing
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(BASE_PATH + 'index.html')
        .then((response) => {
          if (response) {
            return response;
          }
          // Fallback to network
          return fetch(request);
        })
        .catch(() => {
          // Ultimate fallback
          return caches.match(BASE_PATH + 'index.html');
        })
    );
    return;
  }

  // For non-navigation requests, try cache first then network
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(request)
          .then((fetchResponse) => {
            // Don't cache non-GET requests or non-successful responses
            if (request.method !== 'GET' || !fetchResponse.ok) {
              return fetchResponse;
            }
            
            // Cache successful GET responses
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            
            return fetchResponse;
          })
          .catch(() => {
            // Network failed - return offline page for documents
            if (request.destination === 'document') {
              return caches.match(BASE_PATH + 'index.html');
            }
            return new Response('Network error happened', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' },
            });
          });
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 PWA Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take immediate control of all clients
      return self.clients.claim();
    })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
