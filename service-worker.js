// service-worker.js - FIXED VERSION
const CACHE_NAME = 'playsync-' + Date.now(); // Unique cache name each time
const urlsToCache = [
  '/SyncBattle/',
  '/SyncBattle/index.html',
  '/SyncBattle/style.css',
  '/SyncBattle/script.js',
  '/SyncBattle/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://img.icons8.com/color/96/000000/game-controller.png'
];

// Install - DON'T cache on install during development
self.addEventListener('install', function(event) {
  console.log('Service Worker: Install');
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  // Optional: Don't cache during development
  // event.waitUntil(Promise.resolve());
});

// Activate - Clear ALL old caches
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activate');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      console.log('All old caches cleared');
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch - Network first, cache as fallback
self.addEventListener('fetch', function(event) {
  // Don't cache Firebase requests
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis')) {
    return fetch(event.request);
  }
  
  // For HTML files: network first
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          return response;
        })
        .catch(function() {
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // For CSS/JS: cache first, network fallback
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        return response || fetch(event.request);
      })
  );
});
