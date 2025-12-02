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
// service-worker.js - SIMPLE VERSION (disable caching)
self.addEventListener('install', function(e) {
  console.log('Service Worker: Installed');
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  console.log('Service Worker: Activated');
  e.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  // Don't cache anything - always fetch from network
  e.respondWith(fetch(e.request));
});
