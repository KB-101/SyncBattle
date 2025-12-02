importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

// Initialize Firebase App in service worker
firebase.initializeApp({
  apiKey: "AIzaSyAlKamcGfK-kUupKFfH-rjiS54gZU_csf0",
  authDomain: "playsync-arena.firebaseapp.com",
  databaseURL: "https://playsync-arena-default-rtdb.firebaseio.com",
  projectId: "playsync-arena",
  storageBucket: "playsync-arena.firebasestorage.app",
  messagingSenderId: "989668959512",
  appId: "1:989668959512:web:016b68c8fb932f2e9d2a6d"
});

// Retrieve Firebase Messaging instance
const messaging = firebase.messaging();

// Customize background message handler
messaging.setBackgroundMessageHandler(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    const notificationTitle = payload.notification?.title || 'PlaySync Arena';
    const notificationOptions = {
        body: payload.notification?.body || 'New notification',
        icon: './icons/icon-192.png',
        badge: './icons/icon-96.png',
        data: payload.data || {},
        tag: 'playsync-bg-notification',
        requireInteraction: payload.data?.important || false,
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
    
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
    console.log('[firebase-messaging-sw.js] Notification click received:', event);
    
    event.notification.close();
    
    const data = event.notification.data || {};
    const action = event.action || 'open';
    
    // Handle different actions
    if (action === 'open') {
        event.waitUntil(
            handleNotificationOpen(data)
        );
    } else if (action === 'dismiss') {
        // Just dismiss the notification
        console.log('[firebase-messaging-sw.js] Notification dismissed');
    }
    
    // Send message to all clients
    event.waitUntil(
        sendMessageToClients({
            type: 'notification_click',
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
            
            // If client is focused, return
            if (client.focused) {
                return client.focus().then(() => {
                    // Send data to the client
                    client.postMessage({
                        type: 'notification_data',
                        data: data
                    });
                });
            }
            
            // If client exists but not focused, focus it
            if (client.url.includes(self.location.origin)) {
                return client.focus().then(() => {
                    // Send data to the client
                    client.postMessage({
                        type: 'notification_data',
                        data: data
                    });
                });
            }
        }
        
        // If no existing window, open a new one
        if (clients.openWindow) {
            return clients.openWindow(urlToOpen).then(function(newClient) {
                if (newClient) {
                    // Wait for client to load, then send data
                    setTimeout(() => {
                        newClient.postMessage({
                            type: 'notification_data',
                            data: data
                        });
                    }, 1000);
                }
            });
        }
    });
}

// Send message to all clients
function sendMessageToClients(message) {
    return clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    })
    .then(function(clientList) {
        clientList.forEach(function(client) {
            client.postMessage(message);
        });
    });
}

// Listen for messages from clients
self.addEventListener('message', function(event) {
    console.log('[firebase-messaging-sw.js] Message from client:', event.data);
    
    const { type, data } = event.data || {};
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'NOTIFICATION_TEST':
            self.registration.showNotification('Test Notification', {
                body: 'This is a test notification from the service worker',
                icon: './icons/icon-192.png',
                badge: './icons/icon-96.png',
                tag: 'test-notification'
            });
            break;
    }
});

// Install event
self.addEventListener('install', function(event) {
    console.log('[firebase-messaging-sw.js] Service Worker installed');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', function(event) {
    console.log('[firebase-messaging-sw.js] Service Worker activated');
    event.waitUntil(self.clients.claim());
});

// Push subscription change handler
self.addEventListener('pushsubscriptionchange', function(event) {
    console.log('[firebase-messaging-sw.js] Push subscription changed');
    
    event.waitUntil(
        self.registration.pushManager.subscribe(event.oldSubscription.options)
        .then(function(subscription) {
            console.log('[firebase-messaging-sw.js] Subscription renewed:', subscription);
            // Here you would send the new subscription to your server
        })
    );
});
