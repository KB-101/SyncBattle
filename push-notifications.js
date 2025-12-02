// Push Notifications Manager for PlaySync Arena
// Version: 2.0.1

class PushNotifications {
    constructor() {
        this.messaging = null;
        this.vapidKey = null;
        this.isInitialized = false;
        this.pushToken = null;
        this.notificationHandlers = {
            'game_invite': this.handleGameInvitePush,
            'message': this.handleMessagePush,
            'friend_request': this.handleFriendRequestPush,
            'session_update': this.handleSessionUpdatePush
        };
    }

    // Initialize push notifications
    async initialize() {
        console.log('[PushNotifications] Initializing...');
        
        // Check browser support
        if (!('Notification' in window)) {
            console.warn('[PushNotifications] Browser does not support notifications');
            return false;
        }
        
        if (!('serviceWorker' in navigator)) {
            console.warn('[PushNotifications] Service Worker not supported');
            return false;
        }
        
        // Check if Firebase Messaging is available
        if (typeof firebase === 'undefined' || !firebase.messaging) {
            console.warn('[PushNotifications] Firebase Messaging not loaded');
            return false;
        }
        
        // Request notification permission
        const permission = await this.requestPermission();
        if (permission !== 'granted') {
            console.warn('[PushNotifications] Notification permission denied');
            return false;
        }
        
        // Initialize Firebase Messaging
        try {
            this.messaging = firebase.messaging();
            
            // Get VAPID key - YOU NEED TO SET THIS IN FIREBASE CONSOLE
            // Go to Firebase Console → Project Settings → Cloud Messaging → Web configuration
            this.vapidKey = 'BPaubqAbWzCUw7oN6et9ksGkRZEaKZhCzGWXgU5HBVn5a2pKW0VlmWcu7uAGcd87YGloZ5cdNVUX7g6HOxf8llo'; // REPLACE WITH YOUR KEY
            
            // Register service worker for messaging
            await this.registerServiceWorker();
            
            // Get and save push token
            this.pushToken = await this.getPushToken();
            
            // Setup message handlers
            this.setupMessageHandlers();
            
            this.isInitialized = true;
            console.log('[PushNotifications] Initialization successful');
            return true;
            
        } catch (error) {
            console.error('[PushNotifications] Initialization failed:', error);
            return false;
        }
    }

    // Request notification permission
    async requestPermission() {
        if (Notification.permission === 'granted') {
            return 'granted';
        }
        
        if (Notification.permission === 'denied') {
            console.warn('[PushNotifications] Notification permission previously denied');
            return 'denied';
        }
        
        // Request permission
        try {
            const permission = await Notification.requestPermission();
            console.log('[PushNotifications] Permission result:', permission);
            return permission;
        } catch (error) {
            console.error('[PushNotifications] Error requesting permission:', error);
            return 'denied';
        }
    }

    // Register service worker for Firebase Messaging
    async registerServiceWorker() {
        try {
            // Check if service worker is already registered
            const registration = await navigator.serviceWorker.getRegistration();
            
            if (!registration) {
                console.log('[PushNotifications] Registering service worker for messaging');
                await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            }
            
            // Wait for service worker to be ready
            const swRegistration = await navigator.serviceWorker.ready;
            console.log('[PushNotifications] Service Worker ready:', swRegistration);
            
            return swRegistration;
            
        } catch (error) {
            console.error('[PushNotifications] Service Worker registration failed:', error);
            throw error;
        }
    }

    // Get FCM push token
    async getPushToken() {
        if (!this.messaging || !this.vapidKey) {
            throw new Error('Messaging not initialized');
        }
        
        try {
            // Get current token
            let token = await this.messaging.getToken({
                vapidKey: this.vapidKey,
                serviceWorkerRegistration: await navigator.serviceWorker.ready
            });
            
            if (!token) {
                console.log('[PushNotifications] No token available');
                return null;
            }
            
            console.log('[PushNotifications] Push token received:', token.substring(0, 20) + '...');
            
            // Save token to Firebase
            await this.saveTokenToFirebase(token);
            
            // Setup token refresh listener
            this.messaging.onTokenRefresh(async () => {
                console.log('[PushNotifications] Token refreshing...');
                try {
                    const newToken = await this.messaging.getToken({
                        vapidKey: this.vapidKey,
                        serviceWorkerRegistration: await navigator.serviceWorker.ready
                    });
                    
                    if (newToken) {
                        console.log('[PushNotifications] New token received');
                        await this.saveTokenToFirebase(newToken);
                        this.pushToken = newToken;
                    }
                } catch (refreshError) {
                    console.error('[PushNotifications] Token refresh failed:', refreshError);
                }
            });
            
            return token;
            
        } catch (error) {
            console.error('[PushNotifications] Error getting push token:', error);
            throw error;
        }
    }

    // Save token to Firebase Database
    async saveTokenToFirebase(token) {
        if (!window.appState || !window.appState.userFirebaseId) {
            console.warn('[PushNotifications] Cannot save token - user not authenticated');
            return;
        }
        
        try {
            const userId = window.appState.userFirebaseId;
            const tokenData = {
                token: token,
                platform: navigator.platform,
                userAgent: navigator.userAgent.substring(0, 100),
                timestamp: Date.now(),
                appVersion: '2.0.1'
            };
            
            await firebase.database().ref(`pushTokens/${userId}`).set(tokenData);
            console.log('[PushNotifications] Token saved to Firebase');
            
        } catch (error) {
            console.error('[PushNotifications] Error saving token to Firebase:', error);
        }
    }

    // Setup Firebase Messaging message handlers
    setupMessageHandlers() {
        if (!this.messaging) return;
        
        // Handle foreground messages
        this.messaging.onMessage((payload) => {
            console.log('[PushNotifications] Foreground message received:', payload);
            this.handleMessage(payload);
        });
        
        // Handle background messages (via service worker)
        console.log('[PushNotifications] Message handlers setup complete');
    }

    // Handle incoming message
    handleMessage(payload) {
        const { notification, data } = payload;
        
        // Show notification if in foreground
        if (notification) {
            this.showLocalNotification(
                notification.title || 'PlaySync Arena',
                notification.body || 'New notification',
                data
            );
        }
        
        // Process data
        if (data && data.type) {
            this.processNotificationData(data);
        }
    }

    // Process notification data
    processNotificationData(data) {
        const handler = this.notificationHandlers[data.type];
        if (handler && typeof handler === 'function') {
            handler.call(this, data);
        } else {
            console.warn('[PushNotifications] No handler for notification type:', data.type);
        }
    }

    // Send push notification to user
    async sendNotificationToUser(userFirebaseId, notificationData) {
        if (!this.isInitialized) {
            console.warn('[PushNotifications] Cannot send notification - not initialized');
            return false;
        }
        
        try {
            // Get user's push token from Firebase
            const tokenRef = firebase.database().ref(`pushTokens/${userFirebaseId}`);
            const snapshot = await tokenRef.once('value');
            
            if (!snapshot.exists()) {
                console.warn('[PushNotifications] User has no push token:', userFirebaseId);
                return false;
            }
            
            const tokenData = snapshot.val();
            const token = tokenData.token;
            
            // Here you would typically send to your backend server
            // For now, we'll just log it
            console.log('[PushNotifications] Would send to token:', token.substring(0, 20) + '...');
            console.log('[PushNotifications] Notification data:', notificationData);
            
            return true;
            
        } catch (error) {
            console.error('[PushNotifications] Error sending notification:', error);
            return false;
        }
    }

    // Send game invite notification
    async sendGameInviteNotification(friendFirebaseId, gameName, fromName, inviteId) {
        const notificationData = {
            type: 'game_invite',
            title: 'Game Invite',
            body: `${fromName} invited you to play ${gameName}`,
            data: {
                type: 'game_invite',
                gameName: gameName,
                fromName: fromName,
                inviteId: inviteId,
                timestamp: Date.now(),
                action: 'game_invite'
            }
        };
        
        return await this.sendNotificationToUser(friendFirebaseId, notificationData);
    }

    // Send message notification
    async sendMessageNotification(friendFirebaseId, message, fromName) {
        const notificationData = {
            type: 'message',
            title: 'New Message',
            body: `${fromName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
            data: {
                type: 'message',
                message: message,
                fromName: fromName,
                timestamp: Date.now(),
                action: 'message'
            }
        };
        
        return await this.sendNotificationToUser(friendFirebaseId, notificationData);
    }

    // Send friend request notification
    async sendFriendRequestNotification(friendFirebaseId, fromName) {
        const notificationData = {
            type: 'friend_request',
            title: 'Friend Request',
            body: `${fromName} wants to be your friend`,
            data: {
                type: 'friend_request',
                fromName: fromName,
                timestamp: Date.now(),
                action: 'friend_request'
            }
        };
        
        return await this.sendNotificationToUser(friendFirebaseId, notificationData);
    }

    // Show local notification (for foreground)
    showLocalNotification(title, body, data = {}) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }
        
        const options = {
            body: body,
            icon: './icons/icon-192.png',
            badge: './icons/icon-96.png',
            tag: 'playsync-notification',
            data: data,
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
            requireInteraction: data.important || false
        };
        
        // Add vibrate pattern for mobile
        if ('vibrate' in navigator) {
            options.vibrate = [100, 50, 100];
        }
        
        const notification = new Notification(title, options);
        
        notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            this.handleNotificationClick(data);
            notification.close();
        };
        
        notification.onclose = () => {
            console.log('[PushNotifications] Notification closed');
        };
        
        // Auto-close after 10 seconds if not important
        if (!data.important) {
            setTimeout(() => notification.close(), 10000);
        }
        
        return notification;
    }

    // Handle notification click
    handleNotificationClick(data) {
        console.log('[PushNotifications] Notification clicked:', data);
        
        if (!data || !data.type) return;
        
        switch (data.type) {
            case 'game_invite':
                // Open game invite modal
                if (window.showGameInviteModal && data.inviteId) {
                    // You would fetch the invite from Firebase here
                    console.log('Opening game invite:', data.inviteId);
                }
                break;
                
            case 'message':
                // Open chat with friend
                if (window.appState && data.fromName) {
                    const friend = window.appState.friends.find(f => f.name === data.fromName);
                    if (friend && window.setCurrentFriend) {
                        window.setCurrentFriend(friend);
                    }
                }
                break;
                
            case 'friend_request':
                // Open friends panel
                console.log('Opening friend request');
                break;
        }
        
        // Add notification to app's notification list
        if (window.addNotification) {
            window.addNotification({
                type: data.type,
                message: data.body || 'Notification',
                timestamp: data.timestamp || Date.now(),
                data: data,
                unread: false // Already clicked
            });
        }
    }

    // Notification type handlers
    handleGameInvitePush(data) {
        console.log('[PushNotifications] Game invite push:', data);
        
        if (window.addNotification) {
            window.addNotification({
                type: 'invite_received',
                message: `${data.fromName} invited you to play ${data.gameName}`,
                timestamp: data.timestamp || Date.now(),
                data: data,
                unread: true
            });
        }
        
        // If app is in background, show notification
        if (document.visibilityState !== 'visible') {
            this.showLocalNotification(
                'Game Invite',
                `${data.fromName} invited you to play ${data.gameName}`,
                data
            );
        }
    }

    handleMessagePush(data) {
        console.log('[PushNotifications] Message push:', data);
        
        if (window.addNotification) {
            window.addNotification({
                type: 'message',
                message: `${data.fromName}: ${data.message}`,
                timestamp: data.timestamp || Date.now(),
                data: data,
                unread: true
            });
        }
        
        // If app is in background, show notification
        if (document.visibilityState !== 'visible') {
            this.showLocalNotification(
                'New Message',
                `${data.fromName}: ${data.message}`,
                data
            );
        }
    }

    handleFriendRequestPush(data) {
        console.log('[PushNotifications] Friend request push:', data);
        
        if (window.addNotification) {
            window.addNotification({
                type: 'friend_request',
                message: `${data.fromName} wants to be friends`,
                timestamp: data.timestamp || Date.now(),
                data: data,
                unread: true
            });
        }
        
        // If app is in background, show notification
        if (document.visibilityState !== 'visible') {
            this.showLocalNotification(
                'Friend Request',
                `${data.fromName} wants to be friends`,
                data
            );
        }
    }

    handleSessionUpdatePush(data) {
        console.log('[PushNotifications] Session update push:', data);
        
        if (window.addNotification) {
            window.addNotification({
                type: 'session_update',
                message: data.message || 'Session updated',
                timestamp: data.timestamp || Date.now(),
                data: data,
                unread: true
            });
        }
    }

    // Get notification permission status
    getPermissionStatus() {
        return Notification.permission;
    }

    // Check if notifications are supported and enabled
    isSupported() {
        return 'Notification' in window && 
               'serviceWorker' in navigator && 
               'PushManager' in window;
    }

    // Cleanup
    destroy() {
        if (this.messaging) {
            // Cleanup Firebase messaging listeners
            this.messaging.onMessage(() => {});
            this.messaging.onTokenRefresh(() => {});
        }
        
        this.isInitialized = false;
        this.pushToken = null;
        this.messaging = null;
        
        console.log('[PushNotifications] Destroyed');
    }
}

// Create global instance
window.pushNotifications = new PushNotifications();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[PushNotifications] DOM loaded, initializing...');
    
    // Wait a bit for Firebase to load
    setTimeout(async () => {
        if (typeof firebase !== 'undefined' && firebase.messaging) {
            const initialized = await window.pushNotifications.initialize();
            
            if (initialized) {
                console.log('[PushNotifications] Ready to send/receive notifications');
                
                // Add to global app state
                if (window.appState) {
                    window.appState.pushNotificationsEnabled = true;
                }
                
                // Show welcome notification
                if (Notification.permission === 'granted') {
                    window.pushNotifications.showLocalNotification(
                        'PlaySync Arena',
                        'Push notifications are now enabled!',
                        { type: 'welcome', important: true }
                    );
                }
            }
        } else {
            console.warn('[PushNotifications] Firebase not loaded yet, will retry...');
            // Retry after 5 seconds
            setTimeout(async () => {
                if (typeof firebase !== 'undefined' && firebase.messaging) {
                    await window.pushNotifications.initialize();
                }
            }, 5000);
        }
    }, 3000);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PushNotifications;
}
