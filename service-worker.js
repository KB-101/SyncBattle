// Service Worker for PlaySync Arena
const CACHE_NAME = 'playsync-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cache opened:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - simplified version
self.addEventListener('fetch', event => {
    // Skip Firebase requests
    if (event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('gstatic.com') ||
        event.request.url.includes('cdn.jsdelivr.net') ||
        event.request.url.includes('cdnjs.cloudflare.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request).catch(() => {
                    // If offline and page request, return index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                    
                    // Return error for other requests
                    return new Response('Offline', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                });
            })
    );
});
