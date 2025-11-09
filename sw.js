// sw.js - Service Worker for Transparent Transactions PWA
// Fixed for GitHub Pages deployment

const CACHE_NAME = 'transparent-transactions-v1.0.1';
const DYNAMIC_CACHE = 'transparent-dynamic-v1.0.1';

// Essential assets to cache - use absolute GitHub Pages paths
const STATIC_ASSETS = [
  '/Transparent-Transactions/',
  '/Transparent-Transactions/index.html',
  '/Transparent-Transactions/login.html', 
  '/Transparent-Transactions/dashboard.html',
  '/Transparent-Transactions/styles.css',
  '/Transparent-Transactions/js/database.js',
  '/Transparent-Transactions/js/auth.js',
  '/Transparent-Transactions/js/app.js',
  '/Transparent-Transactions/manifest.json',
  '/Transparent-Transactions/icons/icon-192.png',
  '/Transparent-Transactions/icons/icon-512.png'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker installing...');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker installed');
      })
      .catch((error) => {
        console.error('❌ Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🎯 Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that don't match current version
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('🧹 Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle GitHub Pages root redirect
  if (url.pathname === '/bbrayar-a11y/Transparent-Transactions' || 
      url.pathname === '/bbrayar-a11y/Transparent-Transactions/') {
    event.respondWith(caches.match('/Transparent-Transactions/index.html'));
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('📦 Serving from cache:', request.url);
          return cachedResponse;
        }

        // Otherwise fetch from network
        console.log('🌐 Fetching from network:', request.url);
        return fetch(request)
          .then((networkResponse) => {
            // Cache the new response if successful
            if (networkResponse.ok) {
              const responseToCache = networkResponse.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error('❌ Network fetch failed:', error);
            
            // For HTML pages, return offline page
            if (request.destination === 'document') {
              return caches.match('/Transparent-Transactions/index.html');
            }
            
            // Simple fallback for other requests
            return new Response('Offline - Please check your connection', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Simple message handling
self.addEventListener('message', (event) => {
  console.log('📨 Message from app:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('🛠️ Service Worker loaded successfully');
