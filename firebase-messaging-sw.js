// Firebase Messaging Service Worker

importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAlKamcGfK-kUupKFfH-rjiS54gZU_csf0",
  authDomain: "playsync-arena.firebaseapp.com",
  databaseURL: "https://playsync-arena-default-rtdb.firebaseio.com",
  projectId: "playsync-arena",
  storageBucket: "playsync-arena.firebasestorage.app",
  messagingSenderId: "989668959512",
  appId: "1:989668959512:web:016b68c8fb932f2e9d2a6d"
};
const messaging = firebase.messaging();

// Background message handler
messaging.setBackgroundMessageHandler(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    const notificationTitle = payload.notification?.title || 'PlaySync Arena';
    const notificationOptions = {
        body: payload.notification?.body || 'New notification',
        icon: 'icons/icon-96.png',
        badge: 'icons/icon-96.png',
        data: payload.data || {}
    };
    
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
    console.log('[firebase-messaging-sw.js] Notification click:', event);
    
    event.notification.close();
    
    const data = event.notification.data || {};
    
    // Handle different actions
    if (event.action === 'open') {
        // Focus or open the app
        event.waitUntil(
            clients.matchAll({type: 'window', includeUncontrolled: true})
            .then(function(clientList) {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === self.registration.scope && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    } else if (event.action === 'dismiss') {
        // Notification dismissed
    } else {
        // Default click behavior
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});
