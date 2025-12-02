// Enhanced Service Worker with push support

const CACHE_NAME = 'playsync-v2.0.0';
const APP_VERSION = '2.0.0';

// Files to cache
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './push-notifications.js',
  './manifest.json',
  './icons/icon-96.png',
  './icons/icon-192.png'
];

// Install event
self.addEventListener('install', event => {
  console.log('[Service Worker] Install v' + APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate v' + APP_VERSION);
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - Network first, cache fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Firebase and external URLs
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the response
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            
            // Return index.html for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// Push event
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received:', event);
  
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'New notification',
    icon: 'icons/icon-96.png',
    badge: 'icons/icon-96.png',
    tag: 'playsync-push',
    data: data.data || {},
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
    self.registration.showNotification(data.title || 'PlaySync Arena', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click:', event);
  
  event.notification.close();
  
  // Handle action buttons
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({type: 'window'})
        .then(clientList => {
          for (const client of clientList) {
            if (client.url.includes(self.registration.scope) && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('./');
          }
        })
    );
  }
});

// Sync event for background sync
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Implement background data sync
  console.log('Syncing data in background...');
}
