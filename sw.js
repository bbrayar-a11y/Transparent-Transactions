// sw.js - Service Worker for Transparent Transactions PWA
// Comprehensive caching and offline functionality

const CACHE_NAME = 'transparent-transactions-v1.0.0';
const DYNAMIC_CACHE = 'transparent-dynamic-v1.0.0';

// Essential assets to cache immediately on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html', 
  './dashboard.html',
  './styles.css',
  './database.js',
  './auth.js',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/app-preview.png'
];

// API routes and external resources to cache
const API_ROUTES = [
  '/api/user/',
  '/api/transactions/',
  '/api/contacts/'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
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

  // Handle different types of requests
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAssets(request));
  } else if (isApiRequest(request)) {
    event.respondWith(handleApiRequests(request));
  } else {
    event.respondWith(handleOtherRequests(request));
  }
});

// Check if request is for a static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.some(asset => 
    url.pathname.endsWith(asset.replace('./', '')) ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  );
}

// Check if request is for API
function isApiRequest(request) {
  const url = new URL(request.url);
  return API_ROUTES.some(route => url.pathname.startsWith(route));
}

// Handle static assets with cache-first strategy
async function handleStaticAssets(request) {
  try {
    // Try to get from cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Serving from cache:', request.url);
      return cachedResponse;
    }

    // If not in cache, fetch from network
    console.log('🌐 Fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache the new response for future use
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('❌ Static asset fetch failed:', error);
    
    // For HTML pages, return offline page
    if (request.destination === 'document') {
      return caches.match('./index.html');
    }
    
    // For other assets, return a fallback
    return new Response('Network error happened', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Handle API requests with network-first strategy
async function handleApiRequests(request) {
  try {
    // Try network first
    console.log('🌐 Fetching API:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful API responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('📦 API network failed, trying cache:', request.url);
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If no cache, return appropriate error response
    return new Response(
      JSON.stringify({ 
        error: 'You are offline and no cached data is available',
        message: 'Please check your internet connection'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle other requests (images, fonts, etc.)
async function handleOtherRequests(request) {
  try {
    // Try cache first for performance
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Then try network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('❌ Other request failed:', error);
    
    // Return appropriate fallbacks based on request type
    if (request.destination === 'image') {
      return caches.match('./icons/icon-192.png');
    }
    
    if (request.destination === 'font') {
      // Return a simple response for missing fonts
      return new Response('', { status: 404 });
    }
    
    return new Response('Network error', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'background-sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

// Sync pending transactions when back online
async function syncPendingTransactions() {
  try {
    // Get pending transactions from IndexedDB
    const db = await getIndexedDB();
    const pendingTransactions = await getPendingTransactions(db);
    
    for (const transaction of pendingTransactions) {
      try {
        // Try to sync each pending transaction
        await syncTransaction(transaction);
        // Mark as synced in IndexedDB
        await markTransactionAsSynced(db, transaction.id);
      } catch (error) {
        console.error('❌ Failed to sync transaction:', transaction.id, error);
      }
    }
    
    console.log('✅ Background sync completed');
    
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// Helper function to get IndexedDB connection
function getIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TransparentTransactionsDB', 2);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Get pending transactions from IndexedDB
function getPendingTransactions(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['transactions'], 'readonly');
    const store = transaction.objectStore('transactions');
    const index = store.index('by_status');
    const request = index.getAll('pending');
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Simulate transaction sync with server
async function syncTransaction(transaction) {
  // This would be your actual API call
  const response = await fetch('/api/transactions/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(transaction)
  });
  
  if (!response.ok) {
    throw new Error('Sync failed');
  }
  
  return response.json();
}

// Mark transaction as synced in IndexedDB
function markTransactionAsSynced(db, transactionId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['transactions'], 'readwrite');
    const store = transaction.objectStore('transactions');
    const request = store.get(transactionId);
    
    request.onsuccess = () => {
      const data = request.result;
      if (data) {
        data.status = 'completed';
        data.syncedAt = new Date().toISOString();
        store.put(data);
      }
      resolve();
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Push notifications support
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received');
  
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'New update from Transparent Transactions',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss', 
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Transparent Transactions', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || event.action === '') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Focus existing window or open new one
        for (const client of clientList) {
          if (client.url === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        }
        
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || './');
        }
      })
    );
  }
});

// Periodic sync for background updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-data-update') {
    console.log('🔄 Periodic background sync');
    event.waitUntil(updateCachedData());
  }
});

// Update cached data in background
async function updateCachedData() {
  try {
    // Update user data
    await updateUserData();
    
    // Update transaction history
    await updateTransactionData();
    
    console.log('✅ Periodic sync completed');
    
  } catch (error) {
    console.error('❌ Periodic sync failed:', error);
  }
}

// Update user data in cache
async function updateUserData() {
  // This would fetch and cache latest user data
  // For now, it's a placeholder for future implementation
}

// Update transaction data in cache  
async function updateTransactionData() {
  // This would fetch and cache latest transactions
  // For now, it's a placeholder for future implementation
}

// Message handling from main app
self.addEventListener('message', (event) => {
  console.log('📨 Message from app:', event.data);
  
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_API_DATA':
      cacheApiData(payload);
      break;
      
    case 'GET_CACHE_INFO':
      sendCacheInfo(event.ports[0]);
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

// Cache specific API data from main app
async function cacheApiData(payload) {
  try {
    const { url, data } = payload;
    const cache = await caches.open(DYNAMIC_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    await cache.put(url, response);
    console.log('✅ API data cached:', url);
    
  } catch (error) {
    console.error('❌ API data cache failed:', error);
  }
}

// Send cache information back to main app
async function sendCacheInfo(port) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    const info = {
      cacheName: CACHE_NAME,
      cachedItems: keys.length,
      timestamp: new Date().toISOString()
    };
    
    port.postMessage(info);
    
  } catch (error) {
    console.error('❌ Cache info failed:', error);
    port.postMessage({ error: error.message });
  }
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('💥 Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('💥 Service Worker unhandled rejection:', event.reason);
});

// Log service worker lifecycle
console.log('🛠️ Service Worker loaded successfully');
