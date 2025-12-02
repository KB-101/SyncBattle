// Main Service Worker for PlaySync Arena
// Handles caching, offline support, and coordinates with messaging SW
// Version: 2.0.1

const CACHE_NAME = 'playsync-v2.0.1';
const APP_VERSION = '2.0.1';

// Core app files to cache
const CORE_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './firebase-messaging-sw.js',
    './icons/icon-96.png',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// External resources to cache
const EXTERNAL_CACHE = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
    'https://www.gstatic.com/firebasejs/8.10.0/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js',
    'https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js'
];

// Install event - cache all essential files
self.addEventListener('install', function(event) {
    console.log('[Service Worker] Installing v' + APP_VERSION);
    
    event.waitUntil(
        Promise.all([
            // Cache core app files
            caches.open(CACHE_NAME).then(cache => {
                console.log('[Service Worker] Caching core app files');
                return cache.addAll(CORE_CACHE);
            }),
            
            // Cache external resources separately
            caches.open(CACHE_NAME + '-externals').then(cache => {
                console.log('[Service Worker] Caching external resources');
                return Promise.all(
                    EXTERNAL_CACHE.map(url => {
                        return fetch(url).then(response => {
                            if (response.ok) {
                                return cache.put(url, response);
                            }
                            throw new Error(`Failed to cache ${url}: ${response.status}`);
                        }).catch(error => {
                            console.warn(`[Service Worker] Failed to cache ${url}:`, error);
                        });
                    })
                );
            }),
            
            // Skip waiting to activate immediately
            self.skipWaiting()
        ]).then(() => {
            console.log('[Service Worker] Installation complete');
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    console.log('[Service Worker] Activating v' + APP_VERSION);
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // Delete caches that aren't current
                        if (!cacheName.startsWith('playsync-v') || 
                            (cacheName !== CACHE_NAME && cacheName !== CACHE_NAME + '-externals')) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            
            // Claim all clients immediately
            self.clients.claim(),
            
            // Register for periodic sync if supported
            registerPeriodicSync()
        ]).then(() => {
            console.log('[Service Worker] Activation complete');
            
            // Notify all clients that SW is activated
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'service_worker_activated',
                        version: APP_VERSION
                    });
                });
            });
        })
    );
});

// Fetch event - Network first, cache fallback strategy
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip Chrome extensions
    if (url.protocol === 'chrome-extension:') return;
    
    // Skip Firebase and external API calls (they handle their own caching)
    if (url.href.includes('firebase') || 
        url.href.includes('googleapis') ||
        url.href.includes('gstatic.com')) {
        return;
    }
    
    // For same-origin requests, use cache-first strategy
    if (url.origin === self.location.origin) {
        event.respondWith(
            handleSameOriginFetch(event)
        );
    } else {
        // For external resources, use cache-first with network update
        event.respondWith(
            handleExternalFetch(event)
        );
    }
});

// Handle same-origin fetch requests
async function handleSameOriginFetch(event) {
    const cache = await caches.open(CACHE_NAME);
    
    try {
        // Try network first
        const networkResponse = await fetch(event.request);
        
        // If successful, cache the response
        if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            cache.put(event.request, responseToCache);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache:', event.request.url);
        
        // Network failed, try cache
        const cachedResponse = await cache.match(event.request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If HTML request and nothing in cache, return offline page or index.html
        if (event.request.headers.get('accept').includes('text/html')) {
            return cache.match('/SyncBattle/index.html');
        }
        
        // Return a generic offline response
        return new Response('Network error', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Handle external fetch requests
async function handleExternalFetch(event) {
    const cache = await caches.open(CACHE_NAME + '-externals');
    const cachedResponse = await cache.match(event.request);
    
    // Return cached response immediately
    if (cachedResponse) {
        // Update cache in background
        event.waitUntil(
            updateCache(event.request, cache)
        );
        return cachedResponse;
    }
    
    // Nothing in cache, fetch from network
    try {
        const networkResponse = await fetch(event.request);
        
        if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            cache.put(event.request, responseToCache);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] External fetch failed:', error);
        return new Response('External resource unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Update cache in background
async function updateCache(request, cache) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
    } catch (error) {
        console.log('[Service Worker] Background cache update failed:', error);
    }
}

// Push event handler (for standard web push - backup)
self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push event received');
    
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { 
                title: 'PlaySync Arena', 
                body: event.data.text() || 'New notification' 
            };
        }
    }
    
    const options = {
        body: data.body || 'New notification from PlaySync Arena',
        icon: '/SyncBattle/icons/icon-192.png',
        badge: '/SyncBattle/icons/icon-96.png',
        tag: 'playsync-push-' + Date.now(),
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
        ],
        vibrate: [100, 50, 100]
    };
    
    event.waitUntil(
        self.registration.showNotification(
            data.title || 'PlaySync Arena',
            options
        )
    );
});

// Notification click handler (backup)
self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Notification click:', event.notification.tag);
    
    event.notification.close();
    
    const data = event.notification.data || {};
    const action = event.action || 'open';
    
    event.waitUntil(
        handleNotificationAction(action, data)
    );
});

// Handle notification actions
async function handleNotificationAction(action, data) {
    if (action === 'open') {
        // Focus or open the app
        const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        });
        
        for (const client of clients) {
            if (client.url.includes(self.location.origin)) {
                await client.focus();
                client.postMessage({
                    type: 'notification_opened',
                    data: data
                });
                return;
            }
        }
        
        // No existing window, open a new one
        if (self.clients.openWindow) {
            const newClient = await self.clients.openWindow('/SyncBattle/');
            if (newClient) {
                // Wait a bit for client to load, then send data
                setTimeout(() => {
                    newClient.postMessage({
                        type: 'notification_opened',
                        data: data
                    });
                }, 1000);
            }
        }
    }
}

// Listen for messages from clients
self.addEventListener('message', function(event) {
    console.log('[Service Worker] Message from client:', event.data);
    
    const { type, data } = event.data || {};
    const client = event.source;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CLEAR_CACHE':
            clearCache();
            break;
            
        case 'UPDATE_CACHE':
            updateAppCache();
            break;
            
        case 'GET_CACHE_INFO':
            getCacheInfo().then(info => {
                client.postMessage({
                    type: 'CACHE_INFO',
                    data: info
                });
            });
            break;
            
        case 'TEST_SERVICE_WORKER':
            client.postMessage({
                type: 'SERVICE_WORKER_TEST',
                data: { 
                    status: 'active',
                    version: APP_VERSION,
                    timestamp: Date.now()
                }
            });
            break;
            
        case 'REGISTER_BACKGROUND_SYNC':
            registerBackgroundSync(data.tag);
            break;
    }
});

// Register periodic sync if supported
async function registerPeriodicSync() {
    if ('periodicSync' in self.registration) {
        try {
            await self.registration.periodicSync.register('update-presence', {
                minInterval: 24 * 60 * 60 * 1000 // 24 hours
            });
            console.log('[Service Worker] Periodic sync registered');
        } catch (error) {
            console.log('[Service Worker] Periodic sync not supported:', error);
        }
    }
}

// Register background sync
async function registerBackgroundSync(tag) {
    if ('sync' in self.registration) {
        try {
            await self.registration.sync.register(tag);
            console.log('[Service Worker] Background sync registered:', tag);
            return true;
        } catch (error) {
            console.error('[Service Worker] Background sync failed:', error);
            return false;
        }
    }
    return false;
}

// Get cache information
async function getCacheInfo() {
    const cacheNames = await caches.keys();
    const cacheInfo = [];
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        cacheInfo.push({
            name: cacheName,
            size: requests.length,
            urls: requests.map(req => req.url).slice(0, 5) // First 5 URLs
        });
    }
    
    return {
        version: APP_VERSION,
        caches: cacheInfo,
        totalSize: cacheInfo.reduce((sum, cache) => sum + cache.size, 0)
    };
}

// Clear all caches
async function clearCache() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    console.log('[Service Worker] All caches cleared');
}

// Update app cache
async function updateAppCache() {
    console.log('[Service Worker] Updating app cache');
    
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const updatePromises = CORE_CACHE.map(url => {
        return fetch(url).then(response => {
            if (response.ok) {
                return cache.put(url, response);
            }
        }).catch(error => {
            console.warn(`[Service Worker] Failed to update ${url}:`, error);
        });
    });
    
    await Promise.all(updatePromises);
    console.log('[Service Worker] App cache updated');
}

// Background sync handlers
self.addEventListener('sync', function(event) {
    console.log('[Service Worker] Background sync:', event.tag);
    
    switch (event.tag) {
        case 'sync-messages':
            event.waitUntil(syncPendingMessages());
            break;
        case 'sync-notifications':
            event.waitUntil(syncPendingNotifications());
            break;
        case 'sync-user-data':
            event.waitUntil(syncUserData());
            break;
    }
});

// Sync pending messages
async function syncPendingMessages() {
    // Get pending messages from IndexedDB or localStorage
    // Send them to server
    console.log('[Service Worker] Syncing pending messages');
    return Promise.resolve();
}

// Sync pending notifications
async function syncPendingNotifications() {
    console.log('[Service Worker] Syncing pending notifications');
    return Promise.resolve();
}

// Sync user data
async function syncUserData() {
    console.log('[Service Worker] Syncing user data');
    return Promise.resolve();
}

// Periodic sync handler
self.addEventListener('periodicsync', function(event) {
    console.log('[Service Worker] Periodic sync:', event.tag);
    
    if (event.tag === 'update-presence') {
        event.waitUntil(updateUserPresence());
    }
});

// Update user presence
async function updateUserPresence() {
    console.log('[Service Worker] Updating user presence');
    // Implement presence update logic here
    return Promise.resolve();
}

// Error handling
self.addEventListener('error', function(event) {
    console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', function(event) {
    console.error('[Service Worker] Unhandled rejection:', event.reason);
});

// Log service worker state
console.log('[Service Worker] Loaded v' + APP_VERSION);
