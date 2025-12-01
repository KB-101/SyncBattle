// PlaySync Arena Service Worker
const CACHE_NAME = 'playsync-arena-v2.1.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Opened cache:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✅ All resources cached');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ Cache installation failed:', error);
            })
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
        }).then(() => {
            console.log('✅ Service worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    // Skip Firebase requests
    if (event.request.url.includes('firebaseio.com') ||
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('gstatic.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                // Clone the request
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                }).catch(() => {
                    // If offline and not in cache, show offline page
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                    
                    // For API requests, return error
                    if (event.request.url.includes('/api/')) {
                        return new Response(JSON.stringify({
                            error: 'You are offline',
                            timestamp: Date.now()
                        }), {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    
                    // For other requests
                    return new Response('Offline', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });
            })
    );
});

// Background sync for offline requests
self.addEventListener('sync', event => {
    if (event.tag === 'sync-game-requests') {
        event.waitUntil(syncGameRequests());
    }
});

async function syncGameRequests() {
    console.log('🔄 Background sync: Game requests');
    
    // Get pending requests from IndexedDB
    const db = await openDB();
    const pendingRequests = await db.getAll('pendingRequests');
    
    // Send each pending request
    for (const request of pendingRequests) {
        try {
            const response = await fetch(request.url, request.options);
            if (response.ok) {
                // Remove from pending
                await db.delete('pendingRequests', request.id);
                console.log('✅ Synced request:', request.id);
            }
        } catch (error) {
            console.error('❌ Failed to sync request:', error);
        }
    }
}

// IndexedDB helper
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PlaySyncOfflineDB', 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object store for pending requests
            if (!db.objectStoreNames.contains('pendingRequests')) {
                const store = db.createObjectStore('pendingRequests', { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            // Create object store for offline data
            if (!db.objectStoreNames.contains('offlineData')) {
                db.createObjectStore('offlineData', { keyPath: 'id' });
            }
        };
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            
            // Add helper methods
            db.getAll = function(storeName) {
                return new Promise((resolve, reject) => {
                    const transaction = this.transaction([storeName], 'readonly');
                    const store = transaction.objectStore(storeName);
                    const request = store.getAll();
                    
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            };
            
            db.delete = function(storeName, key) {
                return new Promise((resolve, reject) => {
                    const transaction = this.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.delete(key);
                    
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            };
            
            resolve(db);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Push notifications (if implemented later)
self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body || 'New game challenge!',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: 'game-challenge',
        renotify: true,
        silent: false,
        data: {
            url: data.url || '/'
        },
        actions: [
            {
                action: 'accept',
                title: 'Accept'
            },
            {
                action: 'decline',
                title: 'Decline'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'PlaySync Arena', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'accept') {
        // Handle accept action
        console.log('User accepted challenge via notification');
    } else if (event.action === 'decline') {
        // Handle decline action
        console.log('User declined challenge via notification');
    }
    
    // Open the app
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Message handler for communication with main app
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_DATA') {
        // Cache additional resources
        caches.open(CACHE_NAME).then(cache => {
            cache.addAll(event.data.urls);
        });
    }
});