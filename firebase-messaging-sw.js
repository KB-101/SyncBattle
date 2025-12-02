// Firebase Cloud Messaging Service Worker
// Handles push notifications when app is in background or closed
// Version: 2.0.1

// Import Firebase scripts (using CDN)
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

// Initialize Firebase App in service worker
// Use the SAME config as your main app
firebase.initializeApp({
    apiKey: "AIzaSyDk4kQThV4Z-1HOGKcN48qy7XqKfB3N5dE",
    authDomain: "playsync-demo.firebaseapp.com",
    databaseURL: "https://playsync-demo-default-rtdb.firebaseio.com",
    projectId: "playsync-demo",
    storageBucket: "playsync-demo.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
});

// Retrieve Firebase Messaging instance
const messaging = firebase.messaging();

// Customize background message handler
messaging.setBackgroundMessageHandler(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    // Extract notification data
    const notificationTitle = payload.notification?.title || 'PlaySync Arena';
    const notificationBody = payload.notification?.body || 'New notification';
    const notificationData = payload.data || {};
    
    // Create notification options
    const notificationOptions = {
        body: notificationBody,
        icon: '/SyncBattle/icons/icon-192.png',  // Absolute path for service worker
        badge: '/SyncBattle/icons/icon-96.png',
        data: notificationData,
        tag: 'playsync-bg-notification-' + Date.now(),
        requireInteraction: notificationData.important || false,
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
    
    // Add vibrate pattern if supported
    if ('vibrate' in navigator) {
        notificationOptions.vibrate = [200, 100, 200];
    }
    
    // Add sound for supported platforms
    if ('sound' in Notification.prototype) {
        // Can add sound URL here if needed
    }
    
    // Show the notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
    console.log('[firebase-messaging-sw.js] Notification click received:', event);
    
    // Close the notification
    event.notification.close();
    
    const data = event.notification.data || {};
    const action = event.action || 'open';
    
    console.log('Notification action:', action, 'Data:', data);
    
    // Handle different actions
    if (action === 'open') {
        event.waitUntil(
            handleNotificationOpen(data)
        );
    } else if (action === 'dismiss') {
        // Just dismiss the notification
        console.log('[firebase-messaging-sw.js] Notification dismissed');
    }
    
    // Send message to all clients about the notification click
    event.waitUntil(
        sendMessageToClients({
            type: 'notification_clicked',
            data: data,
            action: action
        })
    );
});

// Handle opening the app from notification
function handleNotificationOpen(data) {
    const urlToOpen = new URL('/', self.location.origin).href;
    
    return clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    })
    .then(function(clientList) {
        // Check if there's already a window/tab open
        for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            
            // If the app is already open and focused
            if (client.focused && client.url.includes(self.location.origin)) {
                console.log('[firebase-messaging-sw.js] App already focused');
                return client.focus().then(() => {
                    // Send the notification data to the client
                    sendMessageToClient(client, {
                        type: 'notification_opened',
                        data: data
                    });
                });
            }
            
            // If client exists but not focused
            if (client.url.includes(self.location.origin)) {
                console.log('[firebase-messaging-sw.js] App open but not focused');
                return client.focus().then(() => {
                    sendMessageToClient(client, {
                        type: 'notification_opened',
                        data: data
                    });
                });
            }
        }
        
        // If no existing window, open a new one
        console.log('[firebase-messaging-sw.js] Opening new window');
        if (clients.openWindow) {
            return clients.openWindow(urlToOpen).then(function(newClient) {
                if (newClient) {
                    // Store the notification data to send once client loads
                    const notificationData = data;
                    
                    // Set up a message listener for when the client is ready
                    const messageHandler = function(event) {
                        if (event.data && event.data.type === 'client_ready') {
                            console.log('[firebase-messaging-sw.js] Client ready, sending notification data');
                            sendMessageToClient(newClient, {
                                type: 'notification_opened',
                                data: notificationData
                            });
                            newClient.removeEventListener('message', messageHandler);
                        }
                    };
                    
                    newClient.addEventListener('message', messageHandler);
                }
            });
        }
    });
}

// Send message to a specific client
function sendMessageToClient(client, message) {
    return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        
        channel.port1.onmessage = function(event) {
            if (event.data.error) {
                reject(event.data.error);
            } else {
                resolve(event.data);
            }
        };
        
        client.postMessage(message, [channel.port2]);
    });
}

// Send message to all clients
function sendMessageToClients(message) {
    return clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    })
    .then(function(clientList) {
        const promises = [];
        clientList.forEach(function(client) {
            if (client.url.includes(self.location.origin)) {
                promises.push(
                    sendMessageToClient(client, message).catch(err => {
                        console.warn('[firebase-messaging-sw.js] Failed to send to client:', err);
                    })
                );
            }
        });
        return Promise.all(promises);
    });
}

// Listen for messages from clients
self.addEventListener('message', function(event) {
    console.log('[firebase-messaging-sw.js] Message from client:', event.data);
    
    const { type, data } = event.data || {};
    const client = event.source;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            sendMessageToClient(client, { type: 'skip_waiting_done' });
            break;
            
        case 'TEST_NOTIFICATION':
            self.registration.showNotification('Test Notification', {
                body: 'This is a test notification from the service worker',
                icon: '/SyncBattle/icons/icon-192.png',
                badge: '/SyncBattle/icons/icon-96.png',
                tag: 'test-notification-' + Date.now(),
                actions: [
                    { action: 'open', title: 'Open' },
                    { action: 'dismiss', title: 'Dismiss' }
                ]
            }).then(() => {
                sendMessageToClient(client, { 
                    type: 'test_notification_sent',
                    success: true 
                });
            });
            break;
            
        case 'PING':
            sendMessageToClient(client, { 
                type: 'PONG',
                timestamp: Date.now(),
                swVersion: '2.0.1'
            });
            break;
            
        case 'client_ready':
            // Client is ready to receive messages
            console.log('[firebase-messaging-sw.js] Client ready:', client.id);
            sendMessageToClient(client, {
                type: 'service_worker_ready',
                version: '2.0.1'
            });
            break;
    }
});

// Install event - cache essential assets
self.addEventListener('install', function(event) {
    console.log('[firebase-messaging-sw.js] Service Worker installing v2.0.1');
    
    // Skip waiting to activate immediately
    event.waitUntil(self.skipWaiting());
    
    // Cache Firebase scripts for offline use
    event.waitUntil(
        caches.open('firebase-messaging-cache').then(cache => {
            return cache.addAll([
                'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
                'https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js'
            ]);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    console.log('[firebase-messaging-sw.js] Service Worker activating v2.0.1');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // Delete caches that aren't the messaging cache
                        if (cacheName !== 'firebase-messaging-cache') {
                            console.log('[firebase-messaging-sw.js] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            
            // Claim all clients immediately
            self.clients.claim(),
            
            // Clean up old notifications
            self.registration.getNotifications().then(notifications => {
                notifications.forEach(notification => {
                    // Close notifications older than 1 hour
                    if (Date.now() - notification.timestamp > 3600000) {
                        notification.close();
                    }
                });
            })
        ])
    );
});

// Push subscription change handler
self.addEventListener('pushsubscriptionchange', function(event) {
    console.log('[firebase-messaging-sw.js] Push subscription changed');
    
    event.waitUntil(
        self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_KEY_HERE') // Replace with your VAPID key
        })
        .then(function(newSubscription) {
            console.log('[firebase-messaging-sw.js] New subscription:', newSubscription);
            
            // Send new subscription to server
            return fetch('/update-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldSubscription: event.oldSubscription,
                    newSubscription: newSubscription
                })
            });
        })
        .catch(function(error) {
            console.error('[firebase-messaging-sw.js] Failed to renew subscription:', error);
        })
    );
});

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Handle sync events (for background sync)
self.addEventListener('sync', function(event) {
    console.log('[firebase-messaging-sw.js] Background sync:', event.tag);
    
    if (event.tag === 'sync-notifications') {
        event.waitUntil(syncNotifications());
    } else if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

async function syncNotifications() {
    console.log('[firebase-messaging-sw.js] Syncing notifications in background');
    // Implement background notification sync logic here
}

async function syncMessages() {
    console.log('[firebase-messaging-sw.js] Syncing messages in background');
    // Implement background message sync logic here
}

// Periodic sync (for periodic background updates)
self.addEventListener('periodicsync', function(event) {
    console.log('[firebase-messaging-sw.js] Periodic sync:', event.tag);
    
    if (event.tag === 'update-presence') {
        event.waitUntil(updatePresence());
    }
});

async function updatePresence() {
    console.log('[firebase-messaging-sw.js] Updating presence in background');
    // Implement periodic presence updates here
}

// Log service worker errors
self.addEventListener('error', function(event) {
    console.error('[firebase-messaging-sw.js] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', function(event) {
    console.error('[firebase-messaging-sw.js] Unhandled promise rejection:', event.reason);
});
