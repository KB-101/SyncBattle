// service-worker.js - VERSIONED CACHING
const APP_VERSION = '1.0.1';
const CACHE_NAME = `playsync-${APP_VERSION}-${Date.now()}`;
const urlsToCache = [
  './',
  './index.html?v=' + APP_VERSION,
  './style.css?v=' + APP_VERSION,
  './script.js?v=' + APP_VERSION,
  './manifest.json?v=' + APP_VERSION,
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install
self.addEventListener('install', function(event) {
  console.log('Service Worker installing for version', APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Caching app shell for version', APP_VERSION);
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        console.log('Skip waiting for version', APP_VERSION);
        return self.skipWaiting();
      })
  );
});

// Activate - Delete ALL old caches
self.addEventListener('activate', function(event) {
  console.log('Service Worker activating for version', APP_VERSION);
  
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Delete any cache that's not the current version
          if (!cacheName.includes(APP_VERSION)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      console.log('Claiming clients for version', APP_VERSION);
      return self.clients.claim();
    })
  );
});

// Fetch - Network first, cache fallback
self.addEventListener('fetch', function(event) {
  // Skip Firebase requests
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis')) {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Cache successful responses
        if (response.status === 200) {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(function() {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});
