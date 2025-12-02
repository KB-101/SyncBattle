// Push Notifications for PlaySync Arena

let messaging = null;
let vapidKey = null;

async function initializePushNotifications() {
    // Check if push notifications are supported
    if (!('Notification' in window)) {
        console.log('Push notifications not supported');
        return;
    }
    
    // Request permission
    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Notification permission denied');
            return;
        }
    }
    
    // Initialize Firebase Messaging
    if (typeof firebase !== 'undefined' && firebase.messaging) {
        messaging = firebase.messaging();
        
        // Get VAPID key from Firebase
        vapidKey = 'BPaubqAbWzCUw7oN6et9ksGkRZEaKZhCzGWXgU5HBVn5a2pKW0VlmWcu7uAGcd87YGloZ5cdNVUX7g6HOxf8llo'; // Get from Firebase Console
        
        // Request permission and get token
        try {
            const token = await messaging.getToken({ vapidKey: vapidKey });
            if (token) {
                console.log('Push token:', token);
                savePushToken(token);
            }
        } catch (error) {
            console.error('Error getting push token:', error);
        }
        
        // Handle incoming messages
        messaging.onMessage((payload) => {
            console.log('Message received:', payload);
            handlePushMessage(payload);
        });
        
        // Handle token refresh
        messaging.onTokenRefresh(async () => {
            try {
                const newToken = await messaging.getToken({ vapidKey: vapidKey });
                savePushToken(newToken);
            } catch (error) {
                console.error('Error refreshing token:', error);
            }
        });
    }
}

function savePushToken(token) {
    if (!firebase.auth || !firebase.auth().currentUser) return;
    
    const userId = firebase.auth().currentUser.uid;
    firebase.database().ref('pushTokens/' + userId).set({
        token: token,
        updatedAt: Date.now(),
        platform: navigator.platform,
        userAgent: navigator.userAgent
    });
}

function handlePushMessage(payload) {
    const { title, body, data } = payload.notification || payload.data;
    
    // Show notification
    if ('Notification' in window && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title || 'PlaySync Arena', {
                body: body || 'New notification',
                icon: 'icons/icon-96.png',
                badge: 'icons/icon-96.png',
                tag: 'playsync-push',
                data: data,
                actions: [
                    {
                        action: 'open',
                        title: 'Open'
                    },
                    {
                        action: 'dismiss',
                        title: 'Dismiss'
                    }
                ]
            });
        });
    }
    
    // Handle different message types
    if (data) {
        switch(data.type) {
            case 'game_invite':
                handleGameInvitePush(data);
                break;
            case 'message':
                handleMessagePush(data);
                break;
            case 'friend_request':
                handleFriendRequestPush(data);
                break;
        }
    }
}

function handleGameInvitePush(data) {
    // Add notification
    addNotification({
        type: 'invite_received',
        message: `${data.fromName} invited you to play ${data.game}`,
        timestamp: Date.now(),
        data: data,
        unread: true
    });
    
    // If app is in background, show alert
    if (document.hidden) {
        if (confirm(`${data.fromName} invited you to play ${data.game}. Open now?`)) {
            window.focus();
            // Handle the invite
        }
    }
}

function handleMessagePush(data) {
    addNotification({
        type: 'message',
        message: `${data.fromName}: ${data.message}`,
        timestamp: Date.now(),
        unread: true
    });
}

function handleFriendRequestPush(data) {
    addNotification({
        type: 'friend_request',
        message: `${data.fromName} wants to be friends`,
        timestamp: Date.now(),
        unread: true
    });
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePushNotifications);
} else {
    initializePushNotifications();
}

// Helper function to add notifications (should be in main script)
function addNotification(notification) {
    // This should match the addNotification function in main script
    console.log('Notification:', notification);
}
