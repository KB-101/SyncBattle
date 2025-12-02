// =============================================
// APP CONFIGURATION
// =============================================
const APP_VERSION = '2.0.2';
const APP_NAME = 'PlaySync Arena';

// Firebase Configuration - REPLACE WITH YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAlKamcGfK-kUupKFfH-rjiS54gZU_csf0",
  authDomain: "playsync-arena.firebaseapp.com",
  databaseURL: "https://playsync-arena-default-rtdb.firebaseio.com",
  projectId: "playsync-arena",
  storageBucket: "playsync-arena.firebasestorage.app",
  messagingSenderId: "989668959512",
  appId: "1:989668959512:web:016b68c8fb932f2e9d2a6d"
};

// =============================================
// GLOBAL STATE
// =============================================
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDatabase = null;
let firebaseMessaging = null;
let isFirebaseReady = false;
let isOnline = false;

const appState = {
    userId: null,
    userName: 'Player',
    friends: [],
    activeSession: null,
    notifications: [],
    unreadNotifications: 0,
    currentFriend: null,
    userFirebaseId: null,
    pushNotificationsEnabled: false,
    vapidKey: null,
    sessionId: null
};

// Games database
const GAMES_DB = {
    'pool': {
        name: '8 Ball Pool',
        packageId: 'com.miniclip.eightballpool',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.miniclip.eightballpool',
        intentUrl: 'intent://details?id=com.miniclip.eightballpool#Intent;scheme=market;end'
    },
    'chess': {
        name: 'Chess',
        packageId: 'com.chess',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.chess',
        intentUrl: 'intent://details?id=com.chess#Intent;scheme=market;end'
    },
    'ludo': {
        name: 'Ludo King',
        packageId: 'com.ludo.king',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.ludo.king',
        intentUrl: 'intent://details?id=com.ludo.king#Intent;scheme=market;end'
    }
};

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log(`${APP_NAME} v${APP_VERSION} initializing...`);
    
    try {
        // Show app content
        showAppContent();
        
        // Initialize user identity with unique ID
        initializeUserIdentity();
        
        // Initialize Firebase
        await initializeFirebase();
        
        // Setup event listeners
        setupEventListeners();
        
        // Setup realtime listeners
        if (isFirebaseReady) {
            setupRealtimeListeners();
        }
        
        // Restore previous session
        restorePreviousSession();
        
        // Update UI
        updateAllUI();
        
        // Initialize push notifications after a delay
        setTimeout(() => {
            initializePushNotifications();
        }, 3000);
        
        console.log('App initialized successfully with unique ID:', appState.userId);
        
    } catch (error) {
        console.error('App initialization failed:', error);
        showToast('App initialized in offline mode', 'warning');
        updateConnectionStatus(false);
    }
});

// =============================================
// UNIQUE ID GENERATION FUNCTIONS (FIXED)
// =============================================
function generateUniqueUserId() {
    // Generate a truly unique ID with multiple sources of randomness
    const timestamp = Date.now().toString(36); // Base36 timestamp
    
    // Use crypto.getRandomValues if available (more secure)
    let randomStr;
    if (window.crypto && window.crypto.getRandomValues) {
        const array = new Uint8Array(8);
        window.crypto.getRandomValues(array);
        randomStr = Array.from(array, byte => byte.toString(36)).join('').substring(0, 8);
    } else {
        // Fallback to Math.random
        randomStr = Math.random().toString(36).substring(2, 10);
    }
    
    // Add user agent and screen info for more uniqueness
    const userAgentHash = hashCode(navigator.userAgent).toString(36).substring(0, 4);
    const screenHash = hashCode(`${screen.width}x${screen.height}`).toString(36).substring(0, 4);
    
    // Combine all parts
    const uniqueId = `user_${timestamp}_${randomStr}_${userAgentHash}${screenHash}`;
    
    console.log('Generated unique user ID:', uniqueId);
    return uniqueId;
}

function generateShortUserId() {
    // For display purposes - shorter, readable ID
    const adjectives = ['Cool', 'Fast', 'Smart', 'Quick', 'Brave', 'Wise', 'Bold', 'Sharp', 'Epic', 'Super'];
    const nouns = ['Player', 'Gamer', 'Champ', 'Hero', 'Pro', 'Master', 'Ace', 'King', 'Ninja', 'Wizard'];
    const randomNum = Math.floor(Math.random() * 10000);
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adjective}${noun}${randomNum}`;
}

function generateSessionId() {
    // Generate unique session ID
    const timestamp = Date.now();
    let random;
    
    if (window.crypto && window.crypto.getRandomValues) {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        random = array[0].toString(36);
    } else {
        random = Math.random().toString(36).substring(2, 15);
    }
    
    return `sess_${timestamp}_${random}`.substring(0, 30);
}

function generateInviteId() {
    // Generate unique invite ID
    const timestamp = Date.now().toString(36);
    let random;
    
    if (window.crypto && window.crypto.getRandomValues) {
        const array = new Uint8Array(4);
        window.crypto.getRandomValues(array);
        random = Array.from(array, byte => byte.toString(36)).join('');
    } else {
        random = Math.random().toString(36).substring(2, 8);
    }
    
    return `inv_${timestamp}_${random}`;
}

function generateMessageId() {
    // Generate unique message ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `msg_${timestamp}_${random}`;
}

function generateNotificationId() {
    // Generate unique notification ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    return `notif_${timestamp}_${random}`;
}

function generatePushTokenId() {
    // Generate unique push token ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `token_${timestamp}_${random}`;
}

// Helper function to create hash codes
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// =============================================
// USER IDENTITY MANAGEMENT
// =============================================
function initializeUserIdentity() {
    console.log('Initializing user identity...');
    
    // Generate a unique session ID for this browser session
    appState.sessionId = generateSessionId();
    
    // Load or create user ID
    loadUserIdentity();
    
    // Ensure the ID is unique and valid
    ensureUniqueUserId();
    
    console.log('User identity initialized:', {
        userId: appState.userId,
        userName: appState.userName,
        sessionId: appState.sessionId
    });
}

function loadUserIdentity() {
    // Try to load existing user ID
    let savedUserId = localStorage.getItem('playSync_userId');
    let savedUserName = localStorage.getItem('playSync_userName');
    
    if (savedUserId) {
        console.log('Found saved user ID:', savedUserId);
        appState.userId = savedUserId;
    } else {
        // Generate new unique ID
        appState.userId = generateUniqueUserId();
        localStorage.setItem('playSync_userId', appState.userId);
        console.log('Generated new unique user ID:', appState.userId);
    }
    
    // Load or generate username
    if (savedUserName) {
        appState.userName = savedUserName;
    } else {
        appState.userName = generateShortUserId();
        localStorage.setItem('playSync_userName', appState.userName);
    }
    
    // Load other persistent data
    const savedFriends = localStorage.getItem('playSync_friends');
    if (savedFriends) {
        try {
            appState.friends = JSON.parse(savedFriends);
        } catch (e) {
            appState.friends = [];
        }
    }
    
    const savedNotifications = localStorage.getItem('playSync_notifications');
    if (savedNotifications) {
        try {
            appState.notifications = JSON.parse(savedNotifications).slice(-50);
        } catch (e) {
            appState.notifications = [];
        }
    }
    
    // Calculate unread notifications
    appState.unreadNotifications = appState.notifications.filter(n => n.unread).length;
    
    // Update UI
    document.getElementById('userIdDisplay').textContent = appState.userId;
    document.getElementById('userName').value = appState.userName;
}

function ensureUniqueUserId() {
    // Check if current ID is valid and unique
    if (!isUserIdValid(appState.userId)) {
        console.log('Current user ID is not valid, generating new one...');
        const newId = generateUniqueUserId();
        updateUserId(newId);
        return newId;
    }
    
    // Check if ID might be duplicate (too short or simple)
    if (appState.userId.length < 15 || appState.userId.split('_').length < 3) {
        console.log('User ID might not be unique enough, upgrading...');
        const newId = generateUniqueUserId();
        updateUserId(newId);
        return newId;
    }
    
    return appState.userId;
}

function isUserIdValid(userId) {
    if (!userId || typeof userId !== 'string') return false;
    if (userId.length < 8) return false;
    if (userId === 'user_123' || userId === 'test' || userId === 'player') return false;
    
    // Check for common non-unique patterns
    const invalidPatterns = [
        /^user[0-9]+$/i,
        /^player[0-9]+$/i,
        /^guest[0-9]+$/i,
        /^test.*$/i,
        /^demo.*$/i,
        /^temp.*$/i
    ];
    
    for (const pattern of invalidPatterns) {
        if (pattern.test(userId)) return false;
    }
    
    return true;
}

function updateUserId(newUserId) {
    console.log('Updating user ID:', appState.userId, '→', newUserId);
    
    const oldId = appState.userId;
    appState.userId = newUserId;
    
    // Update localStorage
    localStorage.setItem('playSync_userId', newUserId);
    
    // Update UI
    document.getElementById('userIdDisplay').textContent = newUserId;
    
    // Update Firebase if connected
    if (isFirebaseReady) {
        updateUserInFirebase();
    }
    
    // Update friends list to reference new ID
    appState.friends.forEach(friend => {
        // If friend has this user as reference, update it
        if (friend.lastChatWith === oldId) {
            friend.lastChatWith = newUserId;
        }
    });
    
    savePersistentState();
    
    return newUserId;
}

// =============================================
// PERSISTENT STATE MANAGEMENT
// =============================================
function savePersistentState() {
    localStorage.setItem('playSync_userId', appState.userId);
    localStorage.setItem('playSync_userName', appState.userName);
    localStorage.setItem('playSync_friends', JSON.stringify(appState.friends));
    localStorage.setItem('playSync_notifications', JSON.stringify(appState.notifications));
    
    if (appState.vapidKey) {
        localStorage.setItem('playSync_vapidKey', appState.vapidKey);
    }
    
    if (appState.activeSession) {
        localStorage.setItem('playSync_activeSession', JSON.stringify(appState.activeSession));
    } else {
        localStorage.removeItem('playSync_activeSession');
    }
    
    console.log('Persistent state saved');
}

function restorePreviousSession() {
    const savedSession = localStorage.getItem('playSync_activeSession');
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            if (Date.now() - session.timestamp < 3600000) { // 1 hour old max
                appState.activeSession = session;
                updateActiveSessionUI();
                showToast('Previous game session restored', 'info');
            }
        } catch (e) {
            console.error('Error restoring session:', e);
        }
    }
}

// =============================================
// ID MANAGEMENT FUNCTIONS
// =============================================
async function generateNewUserId() {
    if (!confirm('Generate a new unique ID?\n\n⚠️ This will:\n• Refresh your app\n• Disconnect from friends\n• Require re-adding friends\n\nContinue?')) {
        return;
    }
    
    try {
        showToast('Generating new unique ID...', 'info');
        
        // Generate completely new unique ID
        const newUserId = generateUniqueUserId();
        const newUserName = generateShortUserId();
        
        // Store old data for potential migration
        const oldUserId = appState.userId;
        const oldFriends = [...appState.friends];
        
        // Clear local data
        localStorage.removeItem('playSync_userId');
        localStorage.removeItem('playSync_friends');
        localStorage.removeItem('playSync_activeSession');
        localStorage.removeItem('playSync_notifications');
        
        // Set new user data
        localStorage.setItem('playSync_userId', newUserId);
        localStorage.setItem('playSync_userName', newUserName);
        
        // Update app state
        appState.userId = newUserId;
        appState.userName = newUserName;
        appState.friends = [];
        appState.notifications = [];
        appState.unreadNotifications = 0;
        appState.currentFriend = null;
        appState.activeSession = null;
        
        // Update UI immediately
        document.getElementById('userIdDisplay').textContent = newUserId;
        document.getElementById('userName').value = newUserName;
        updateFriendsUI();
        updateNotificationsUI();
        
        // Show success message
        showToast('✅ New unique ID generated!', 'success');
        
        // Add notification about the change
        addNotification({
            type: 'id_changed',
            message: `Your ID changed from ${oldUserId.substring(0, 8)}... to ${newUserId.substring(0, 8)}...`,
            timestamp: Date.now(),
            data: { oldId: oldUserId, newId: newUserId }
        });
        
        // Update Firebase if connected
        if (isFirebaseReady) {
            await updateUserInFirebase();
        }
        
        console.log('New ID generated:', { oldId: oldUserId, newId: newUserId });
        
    } catch (error) {
        console.error('Error generating new ID:', error);
        showToast('❌ Error generating new ID', 'error');
    }
}

function copyUserIdToClipboard() {
    const userId = appState.userId;
    
    navigator.clipboard.writeText(userId).then(() => {
        showToast('✅ User ID copied to clipboard!', 'success');
        
        // Visual feedback
        const idDisplay = document.getElementById('userIdDisplay');
        if (idDisplay) {
            idDisplay.classList.add('copied');
            setTimeout(() => idDisplay.classList.remove('copied'), 1000);
        }
    }).catch(err => {
        console.error('Failed to copy ID:', err);
        
        // Fallback method
        const textArea = document.createElement('textarea');
        textArea.value = userId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        showToast('✅ User ID copied!', 'success');
    });
}

// =============================================
// FIREBASE INITIALIZATION
// =============================================
async function initializeFirebase() {
    console.log('Initializing Firebase...');
    
    try {
        // Initialize Firebase
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDatabase = firebase.database();
        
        console.log('Firebase modules loaded:', {
            auth: !!firebaseAuth,
            database: !!firebaseDatabase
        });
        
        // Sign in anonymously
        const userCredential = await firebaseAuth.signInAnonymously();
        appState.userFirebaseId = userCredential.user.uid;
        console.log('Anonymous sign-in successful:', appState.userFirebaseId);
        
        // Setup connection monitoring
const connectedRef = firebaseDatabase.ref('.info/connected');
connectedRef.on('value', function(snapshot) {
    const connected = snapshot.val() === true;
    isOnline = connected;
    updateConnectionStatus(connected);
    updateConnectionUI();  // Add this line
    console.log('Firebase connection:', connected ? 'ONLINE' : 'OFFLINE');
});
        
        // Setup auth state listener
        firebaseAuth.onAuthStateChanged(function(user) {
            if (user) {
                console.log('User authenticated:', user.uid);
                isFirebaseReady = true;
                appState.userFirebaseId = user.uid;
                
                // Update user in database
                updateUserInFirebase();
                
                showToast('✅ Connected to PlaySync!', 'success');
            } else {
                console.log('No user signed in');
                isFirebaseReady = false;
            }
        });
        
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        showToast('⚠️ Firebase connection failed. Using offline mode.', 'warning');
        isFirebaseReady = false;
        updateConnectionStatus(false);
        throw error;
    }
}

function updateUserInFirebase() {
    if (!isFirebaseReady || !appState.userFirebaseId) {
        console.log('Skipping Firebase update - not ready');
        return;
    }
    
    const userData = {
        publicId: appState.userId,
        name: appState.userName,
        lastSeen: Date.now(),
        online: true,
        sessionId: appState.sessionId,
        friends: appState.friends.map(f => f.id),
        deviceInfo: {
            platform: navigator.platform,
            userAgent: navigator.userAgent.substring(0, 100),
            screen: `${screen.width}x${screen.height}`
        }
    };
    
    try {
        firebaseDatabase.ref('users/' + appState.userFirebaseId).set(userData);
        console.log('User updated in Firebase');
    } catch (error) {
        console.error('Error updating user in Firebase:', error);
    }
}

// =============================================
// CONNECTION STATUS FUNCTION
// =============================================
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    const connectionText = document.getElementById('connectionText');
    
    isOnline = connected;
    
    if (connected) {
        if (statusElement) {
            const icon = statusElement.querySelector('i');
            if (icon) icon.className = 'fas fa-circle online';
        }
        if (connectionText) connectionText.textContent = 'Online';
        if (statusText) statusText.textContent = 'Online';
        if (statusDot) statusDot.className = 'status-dot online';
        
        // Update user status in Firebase
        if (isFirebaseReady && appState.userFirebaseId) {
            firebaseDatabase.ref('status/' + appState.userFirebaseId).set({
                online: true,
                lastSeen: Date.now(),
                sessionId: appState.sessionId
            });
        }
    } else {
        if (statusElement) {
            const icon = statusElement.querySelector('i');
            if (icon) icon.className = 'fas fa-circle offline';
        }
        if (connectionText) connectionText.textContent = 'Offline';
        if (statusText) statusText.textContent = 'Offline';
        if (statusDot) statusDot.className = 'status-dot';
        
        // Show toast if was previously online
        if (isFirebaseReady) {
            showToast('⚠️ You are offline', 'warning');
        }
    }
    
    console.log('Connection status updated:', connected ? 'Online' : 'Offline');
}

// =============================================
// PUSH NOTIFICATIONS SYSTEM
// =============================================
async function initializePushNotifications() {
    console.log('Initializing push notifications...');
    
    // Check browser support
    if (!('Notification' in window)) {
        console.warn('Browser does not support notifications');
        return;
    }
    
    if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker not supported');
        return;
    }
    
    if (!isFirebaseReady || typeof firebase === 'undefined') {
        console.warn('Firebase not ready for push notifications');
        return;
    }
    
    // Request notification permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
        console.warn('Notification permission not granted:', permission);
        return;
    }
    
    // Initialize Firebase Messaging
    try {
        // Make sure messaging is imported
        if (!firebase.messaging) {
            console.warn('Firebase Messaging not available');
            return;
        }
        
        firebaseMessaging = firebase.messaging();
        
        // Register service worker for messaging
        await registerMessagingServiceWorker();
        
        // Get or set VAPID key
        if (!appState.vapidKey) {
            // You need to set this from Firebase Console
            // Project Settings → Cloud Messaging → Web configuration
            appState.vapidKey = 'BPaubqAbWzCUw7oN6et9ksGkRZEaKZhCzGWXgU5HBVn5a2pKW0VlmWcu7uAGcd87YGloZ5cdNVUX7g6HOxf8llo'; // REPLACE THIS
            localStorage.setItem('playSync_vapidKey', appState.vapidKey);
        }
        
        // Get FCM token
        await getFCMToken();
        
        // Setup message handlers
        setupFirebaseMessageHandlers();
        
        appState.pushNotificationsEnabled = true;
        console.log('Push notifications initialized successfully');
        showToast('✅ Push notifications enabled!', 'success');
        
    } catch (error) {
        console.error('Push notification initialization failed:', error);
        showToast('⚠️ Push notifications not available', 'warning');
    }
}

async function requestNotificationPermission() {
    if (Notification.permission === 'granted') {
        return 'granted';
    }
    
    if (Notification.permission === 'denied') {
        console.warn('Notification permission previously denied');
        return 'denied';
    }
    
    // Ask user for permission with a custom dialog first
    const permission = await new Promise((resolve) => {
        if (confirm('PlaySync Arena would like to send you notifications for game invites and messages. Allow notifications?')) {
            Notification.requestPermission().then(resolve);
        } else {
            resolve('denied');
        }
    });
    
    console.log('Notification permission result:', permission);
    return permission;
}

async function registerMessagingServiceWorker() {
    try {
        // Register the messaging service worker
        const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        console.log('Messaging Service Worker registered:', registration);
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('Service Worker ready for messaging');
        
        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        throw error;
    }
}

async function getFCMToken() {
    if (!firebaseMessaging || !appState.vapidKey) {
        throw new Error('Messaging not initialized');
    }
    
    try {
        const serviceWorkerRegistration = await navigator.serviceWorker.ready;
        
        const token = await firebaseMessaging.getToken({
            vapidKey: appState.vapidKey,
            serviceWorkerRegistration: serviceWorkerRegistration
        });
        
        if (!token) {
            console.log('No FCM token available');
            return null;
        }
        
        console.log('FCM token received:', token.substring(0, 20) + '...');
        
        // Save token to Firebase
        await saveFCMTokenToFirebase(token);
        
        // Setup token refresh listener
        firebaseMessaging.onTokenRefresh(async () => {
            console.log('FCM token refreshing...');
            try {
                const newToken = await firebaseMessaging.getToken({
                    vapidKey: appState.vapidKey,
                    serviceWorkerRegistration: await navigator.serviceWorker.ready
                });
                
                if (newToken) {
                    console.log('New FCM token received');
                    await saveFCMTokenToFirebase(newToken);
                }
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
            }
        });
        
        return token;
    } catch (error) {
        console.error('Error getting FCM token:', error);
        throw error;
    }
}

async function saveFCMTokenToFirebase(token) {
    if (!isFirebaseReady || !appState.userFirebaseId) {
        console.warn('Cannot save token - user not authenticated');
        return;
    }
    
    try {
        const tokenData = {
            token: token,
            platform: navigator.platform,
            userAgent: navigator.userAgent.substring(0, 100),
            timestamp: Date.now(),
            appVersion: APP_VERSION,
            userId: appState.userId
        };
        
        await firebaseDatabase.ref(`pushTokens/${appState.userFirebaseId}`).set(tokenData);
        console.log('FCM token saved to Firebase');
    } catch (error) {
        console.error('Error saving FCM token:', error);
    }
}

function setupFirebaseMessageHandlers() {
    if (!firebaseMessaging) return;
    
    // Handle foreground messages (when app is open)
    firebaseMessaging.onMessage((payload) => {
        console.log('Foreground message received:', payload);
        handlePushMessage(payload);
    });
    
    console.log('Firebase message handlers setup complete');
}

function handlePushMessage(payload) {
    const { notification, data } = payload;
    
    // Show local notification
    if (notification) {
        showLocalNotification(
            notification.title || 'PlaySync Arena',
            notification.body || 'New notification',
            data
        );
    }
    
    // Process notification data
    if (data) {
        processPushNotificationData(data);
    }
}

function processPushNotificationData(data) {
    console.log('Processing push data:', data);
    
    switch (data.type) {
        case 'game_invite':
            handleGameInvitePush(data);
            break;
        case 'message':
            handleMessagePush(data);
            break;
        case 'friend_request':
            handleFriendRequestPush(data);
            break;
        case 'session_update':
            handleSessionUpdatePush(data);
            break;
        default:
            console.warn('Unknown push notification type:', data.type);
    }
}

// =============================================
// PUSH NOTIFICATION TYPE HANDLERS
// =============================================
function handleGameInvitePush(data) {
    console.log('Game invite push received:', data);
    
    // Add to notifications list
    addNotification({
        type: 'invite_received',
        message: `${data.fromName} invited you to play ${data.gameName}`,
        timestamp: data.timestamp || Date.now(),
        data: data,
        unread: true
    });
    
    // If app is in background, we'll show notification via service worker
    // If app is in foreground, show local notification
    if (document.visibilityState === 'visible') {
        showLocalNotification(
            '🎮 Game Invite',
            `${data.fromName} invited you to play ${data.gameName}`,
            { ...data, action: 'game_invite' }
        );
    }
}

function handleMessagePush(data) {
    console.log('Message push received:', data);
    
    // Add to notifications list
    addNotification({
        type: 'message',
        message: `${data.fromName}: ${data.message}`,
        timestamp: data.timestamp || Date.now(),
        data: data,
        unread: true
    });
    
    // If app is in background, we'll show notification via service worker
    // If app is in foreground, show local notification
    if (document.visibilityState === 'visible') {
        showLocalNotification(
            '💬 New Message',
            `${data.fromName}: ${data.message}`,
            { ...data, action: 'message' }
        );
    }
}

function handleFriendRequestPush(data) {
    console.log('Friend request push received:', data);
    
    addNotification({
        type: 'friend_request',
        message: `${data.fromName} wants to be friends`,
        timestamp: data.timestamp || Date.now(),
        data: data,
        unread: true
    });
    
    if (document.visibilityState === 'visible') {
        showLocalNotification(
            '👥 Friend Request',
            `${data.fromName} wants to be friends`,
            { ...data, action: 'friend_request' }
        );
    }
}

function handleSessionUpdatePush(data) {
    console.log('Session update push received:', data);
    
    addNotification({
        type: 'session_update',
        message: data.message || 'Session updated',
        timestamp: data.timestamp || Date.now(),
        data: data,
        unread: true
    });
}

// =============================================
// NOTIFICATION UTILITIES
// =============================================
function showLocalNotification(title, body, data = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    const options = {
        body: body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-96.png',
        tag: 'playsync-notification-' + Date.now(),
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
    
    // Add vibrate pattern for mobile if supported
    if ('vibrate' in navigator) {
        options.vibrate = [100, 50, 100];
    }
    
    const notification = new Notification(title, options);
    
    notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        handleNotificationClick(data);
        notification.close();
    };
    
    // Auto-close after 10 seconds if not important
    if (!data.important) {
        setTimeout(() => notification.close(), 10000);
    }
    
    return notification;
}

function handleNotificationClick(data) {
    console.log('Notification clicked:', data);
    
    if (!data || !data.type) return;
    
    switch (data.type) {
        case 'game_invite':
            // We would fetch and show the invite here
            showToast('Opening game invite...', 'info');
            break;
        case 'message':
            // Open chat with friend
            if (data.fromName) {
                const friend = appState.friends.find(f => f.name === data.fromName);
                if (friend) {
                    setCurrentFriend(friend);
                    showToast(`Opening chat with ${friend.name}`, 'info');
                }
            }
            break;
        case 'friend_request':
            showToast('Opening friend requests...', 'info');
            break;
    }
    
    // Mark as read
    if (data.notificationId) {
        markNotificationAsRead(data.notificationId);
    }
}

// =============================================
// SEND PUSH NOTIFICATIONS TO FRIENDS
// =============================================
async function sendPushNotificationToFriend(friendId, type, data) {
    if (!isFirebaseReady || !appState.pushNotificationsEnabled) {
        console.log('Push notifications not enabled, skipping');
        return false;
    }
    
    const friend = appState.friends.find(f => f.id === friendId);
    if (!friend || !friend.firebaseId) {
        console.log('Friend not found or no Firebase ID');
        return false;
    }
    
    try {
        // Get friend's push token from Firebase
        const tokenRef = firebaseDatabase.ref(`pushTokens/${friend.firebaseId}`);
        const snapshot = await tokenRef.once('value');
        
        if (!snapshot.exists()) {
            console.log('Friend has no push token');
            return false;
        }
        
        const tokenData = snapshot.val();
        const token = tokenData.token;
        
        // Create notification data
        let notificationData = {
            to: token,
            notification: {},
            data: {}
        };
        
        switch (type) {
            case 'game_invite':
                notificationData.notification = {
                    title: '🎮 Game Invite',
                    body: `${appState.userName} invited you to play ${data.gameName}`,
                    icon: './icons/icon-192.png'
                };
                notificationData.data = {
                    type: 'game_invite',
                    gameName: data.gameName,
                    fromName: appState.userName,
                    fromId: appState.userId,
                    inviteId: data.inviteId,
                    timestamp: Date.now(),
                    action: 'game_invite'
                };
                break;
                
            case 'message':
                notificationData.notification = {
                    title: '💬 New Message',
                    body: `${appState.userName}: ${data.message.substring(0, 50)}${data.message.length > 50 ? '...' : ''}`,
                    icon: './icons/icon-192.png'
                };
                notificationData.data = {
                    type: 'message',
                    message: data.message,
                    fromName: appState.userName,
                    fromId: appState.userId,
                    timestamp: Date.now(),
                    action: 'message'
                };
                break;
                
            case 'friend_request':
                notificationData.notification = {
                    title: '👥 Friend Request',
                    body: `${appState.userName} wants to be friends`,
                    icon: './icons/icon-192.png'
                };
                notificationData.data = {
                    type: 'friend_request',
                    fromName: appState.userName,
                    fromId: appState.userId,
                    timestamp: Date.now(),
                    action: 'friend_request'
                };
                break;
        }
        
        // In a real app, you would send this to your backend server
        // which would then send to FCM. For now, we'll simulate it.
        console.log('Would send push notification:', {
            to: token.substring(0, 20) + '...',
            type: type,
            data: notificationData.data
        });
        
        return true;
        
    } catch (error) {
        console.error('Error sending push notification:', error);
        return false;
    }
}

// =============================================
// REALTIME LISTENERS
// =============================================
function setupRealtimeListeners() {
    if (!isFirebaseReady || !appState.userFirebaseId) {
        console.log('Skipping Firebase listeners - not ready');
        return;
    }
    
    console.log('Setting up realtime listeners...');
    
    // Listen for friend status changes
    appState.friends.forEach(friend => {
        if (friend.firebaseId) {
            firebaseDatabase.ref('users/' + friend.firebaseId).on('value', (snapshot) => {
                const userData = snapshot.val();
                if (userData) {
                    updateFriendStatus(friend.id, userData);
                }
            });
        }
    });
    
    // Listen for incoming game invites
    firebaseDatabase.ref('invites/' + appState.userFirebaseId).on('child_added', (snapshot) => {
        const invite = snapshot.val();
        invite.id = snapshot.key;
        invite.senderFirebaseId = snapshot.ref.parent.key;
        handleIncomingInvite(invite);
    });
    
    // Listen for messages
    firebaseDatabase.ref('messages/' + appState.userFirebaseId).on('child_added', (snapshot) => {
        const message = snapshot.val();
        message.id = snapshot.key;
        handleIncomingMessage(message);
    });
    
    // Listen for session updates
    if (appState.activeSession) {
        firebaseDatabase.ref('sessions/' + appState.activeSession.id).on('value', (snapshot) => {
            const session = snapshot.val();
            if (session) {
                updateActiveSession(session);
            }
        });
    }
}

// =============================================
// FRIEND MANAGEMENT
// =============================================
async function addFriend(friendId) {
    const inputField = document.getElementById('friendId');
    friendId = friendId || inputField.value.trim();
    
    if (!friendId) {
        showToast('Please enter a friend ID', 'error');
        return;
    }
    
    if (friendId === appState.userId) {
        showToast('You cannot add yourself as a friend', 'error');
        return;
    }
    
    // Check if already friends
    if (appState.friends.some(f => f.id === friendId)) {
        showToast('Already friends with this user', 'info');
        inputField.value = '';
        return;
    }
    
    showToast('Searching for user...', 'info');
    
    try {
    // Search in Firebase - FIXED QUERY
    const usersRef = firebaseDatabase.ref('users');
    const snapshot = await usersRef.orderByChild('publicId').once('value');
    
    let foundUser = null;
    let foundFirebaseId = null;
    
    snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        if (userData.publicId === friendId) {
            foundUser = userData;
            foundFirebaseId = childSnapshot.key;
            return true; // Stop iteration
        }
    });
    
    if (foundUser && foundFirebaseId) {
        // Add to friends list
        const friend = {
            id: friendId,
            name: foundUser.name || 'Friend',
            firebaseId: foundFirebaseId,
            status: foundUser.online ? 'online' : 'offline',
            lastSeen: foundUser.lastSeen || Date.now(),
            addedAt: Date.now()
        };
            
            appState.friends.push(friend);
            savePersistentState();
            updateFriendsUI();
            
            // Setup realtime listener for this friend
            setupFriendListener(friend);
            
            // Send push notification to friend
            await sendPushNotificationToFriend(friendId, 'friend_request', {});
            
            showToast(`✅ Added ${friend.name} as friend`, 'success');
            inputField.value = '';
            
        } else {
        showToast('User not found. Make sure they are online.', 'error');
    }
} catch (error) {
    console.error('Error adding friend:', error);
    showToast('Failed to add friend', 'error');
}
}

function setupFriendListener(friend) {
    if (!friend.firebaseId || !isFirebaseReady) return;
    
    firebaseDatabase.ref('users/' + friend.firebaseId).on('value', (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            updateFriendStatus(friend.id, userData);
        }
    });
}

function updateFriendStatus(friendId, userData) {
    const friend = appState.friends.find(f => f.id === friendId);
    if (friend) {
        friend.status = userData.online ? 'online' : 'offline';
        friend.lastSeen = userData.lastSeen;
        friend.name = userData.name || friend.name;
        
        updateFriendsUI();
        updateOnlineFriendsUI();
        
        // Show toast when friend comes online
        if (userData.online && friend.status !== 'online') {
            showToast(`✅ ${friend.name} is now online`, 'info');
        }
    }
}

function removeFriend(friendId) {
    if (!confirm('Remove this friend?')) return;
    
    const index = appState.friends.findIndex(f => f.id === friendId);
    if (index !== -1) {
        const friendName = appState.friends[index].name;
        appState.friends.splice(index, 1);
        savePersistentState();
        updateFriendsUI();
        updateOnlineFriendsUI();
        showToast(`Removed ${friendName} from friends`, 'info');
    }
}

// =============================================
// GAME SESSIONS
// =============================================
async function startGameSession(gameType, friendId) {
    const friend = appState.friends.find(f => f.id === friendId);
    if (!friend) {
        showToast('Friend not found', 'error');
        return;
    }
    
    const gameInfo = GAMES_DB[gameType] || {
        name: 'Custom Game',
        packageId: gameType,
        storeUrl: `https://play.google.com/store/apps/details?id=${gameType}`,
        intentUrl: `intent://details?id=${gameType}#Intent;scheme=market;end`
    };
    
    const sessionId = generateSessionId();
    
    appState.activeSession = {
        id: sessionId,
        game: gameType,
        gameInfo: gameInfo,
        participants: [appState.userId, friendId],
        timestamp: Date.now(),
        status: 'active'
    };
    
    // Save to Firebase
    if (isFirebaseReady) {
        try {
            await firebaseDatabase.ref('sessions/' + sessionId).set({
                game: gameType,
                gameInfo: gameInfo,
                participants: [appState.userId, friendId],
                createdBy: appState.userId,
                createdAt: Date.now(),
                status: 'active',
                updatedAt: Date.now()
            });
        } catch (error) {
            console.error('Error saving session to Firebase:', error);
        }
    }
    
    // Save locally
    savePersistentState();
    
    // Update UI
    updateActiveSessionUI();
    
    // Send invite to friend with push notification
    sendGameInvite(friend, gameInfo, sessionId);
    
    showToast(`🎮 Game session started with ${friend.name}`, 'success');
}

function updateActiveSession(sessionData) {
    if (!appState.activeSession || appState.activeSession.id !== sessionData.id) return;
    
    appState.activeSession = {
        ...appState.activeSession,
        ...sessionData
    };
    
    updateActiveSessionUI();
    savePersistentState();
}

function endGameSession() {
    if (!appState.activeSession) return;
    
    const sessionId = appState.activeSession.id;
    
    // Update Firebase
    if (isFirebaseReady) {
        firebaseDatabase.ref('sessions/' + sessionId).update({
            status: 'ended',
            endedAt: Date.now()
        });
    }
    
    appState.activeSession = null;
    localStorage.removeItem('playSync_activeSession');
    
    // Update UI
    document.getElementById('activeSessionCard').classList.add('hidden');
    
    showToast('Game session ended', 'info');
}

// =============================================
// GAME INVITES
// =============================================
async function sendGameInvite(friend, gameInfo, sessionId) {
    if (!isFirebaseReady || !friend.firebaseId) return;
    
    const inviteId = generateInviteId();
    
    const inviteData = {
        from: appState.userId,
        fromName: appState.userName,
        game: gameInfo.name,
        gamePackageId: gameInfo.packageId,
        gameIntentUrl: gameInfo.intentUrl,
        sessionId: sessionId,
        timestamp: Date.now(),
        status: 'pending'
    };
    
    try {
        await firebaseDatabase.ref(`invites/${friend.firebaseId}/${inviteId}`).set(inviteData);
        
        // Add notification
        addNotification({
            type: 'invite_sent',
            message: `Invited ${friend.name} to play ${gameInfo.name}`,
            timestamp: Date.now(),
            data: { friendId: friend.id, game: gameInfo.name }
        });
        
        // Send push notification
        await sendPushNotificationToFriend(friend.id, 'game_invite', {
            gameName: gameInfo.name,
            inviteId: inviteId
        });
        
    } catch (error) {
        console.error('Error sending invite:', error);
        showToast('Failed to send invite', 'error');
    }
}

function handleIncomingInvite(invite) {
    console.log('Incoming invite:', invite);
    
    // Find friend who sent the invite
    const friend = appState.friends.find(f => f.id === invite.from);
    const friendName = friend ? friend.name : invite.fromName;
    
    // Add notification
    addNotification({
        type: 'invite_received',
        message: `${friendName} invited you to play ${invite.game}`,
        timestamp: invite.timestamp,
        data: invite,
        unread: true
    });
    
    // Show modal if app is in foreground
    if (document.visibilityState === 'visible') {
        showGameInviteModal(invite, friend);
    } else {
        // Show browser notification
        showLocalNotification(
            '🎮 Game Invite',
            `${friendName} invited you to play ${invite.game}`,
            { type: 'game_invite', ...invite }
        );
    }
}

function showGameInviteModal(invite, friend) {
    const modal = document.getElementById('gameInviteModal');
    const infoDiv = document.getElementById('inviteInfo');
    const friendName = friend ? friend.name : invite.fromName;
    
    infoDiv.innerHTML = `
        <div class="invite-info">
            <div class="invite-avatar">
                <i class="fas fa-user-circle"></i>
            </div>
            <div>
                <h4>${friendName}</h4>
                <p>Invited you to play:</p>
                <h3>${invite.game}</h3>
                <p class="invite-time">${formatTime(invite.timestamp)}</p>
            </div>
        </div>
    `;
    
    // Store invite data on buttons
    document.getElementById('acceptInviteBtn').dataset.invite = JSON.stringify(invite);
    document.getElementById('acceptInviteBtn').dataset.friendId = friend ? friend.id : invite.from;
    
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

async function acceptGameInvite() {
    const modal = document.getElementById('gameInviteModal');
    const acceptBtn = document.getElementById('acceptInviteBtn');
    const invite = JSON.parse(acceptBtn.dataset.invite);
    const friendId = acceptBtn.dataset.friendId;
    
    if (!isFirebaseReady) {
        showToast('Cannot accept invite - offline', 'error');
        return;
    }
    
    try {
        // Update invite status in Firebase
        if (invite.senderFirebaseId) {
            await firebaseDatabase.ref(`invites/${appState.userFirebaseId}/${invite.id}`).update({
                status: 'accepted',
                respondedAt: Date.now()
            });
        }
        
        // Join the session
        appState.activeSession = {
            id: invite.sessionId,
            game: invite.game,
            gameInfo: GAMES_DB[invite.game] || {
                name: invite.game,
                packageId: invite.gamePackageId,
                intentUrl: invite.gameIntentUrl
            },
            participants: [invite.from, appState.userId],
            timestamp: Date.now(),
            status: 'active'
        };
        
        // Save locally
        savePersistentState();
        
        // Update UI
        updateActiveSessionUI();
        
        // Add notification
        addNotification({
            type: 'invite_accepted',
            message: `You accepted ${invite.fromName}'s invite to ${invite.game}`,
            timestamp: Date.now()
        });
        
        // Open the game
        openAndroidGame(invite.gamePackageId, invite.gameIntentUrl);
        
        // Close modal
        modal.classList.add('hidden');
        modal.classList.remove('active');
        
        showToast('✅ Game accepted! Opening...', 'success');
        
    } catch (error) {
        console.error('Error accepting invite:', error);
        showToast('❌ Failed to accept invite', 'error');
    }
}

function declineGameInvite() {
    const modal = document.getElementById('gameInviteModal');
    const acceptBtn = document.getElementById('acceptInviteBtn');
    const invite = JSON.parse(acceptBtn.dataset.invite);
    
    // Update invite status in Firebase
    if (isFirebaseReady && invite.senderFirebaseId) {
        firebaseDatabase.ref(`invites/${appState.userFirebaseId}/${invite.id}`).update({
            status: 'declined',
            respondedAt: Date.now()
        });
    }
    
    // Add notification
    addNotification({
        type: 'invite_declined',
        message: `You declined ${invite.fromName}'s invite to ${invite.game}`,
        timestamp: Date.now()
    });
    
    // Close modal
    modal.classList.add('hidden');
    modal.classList.remove('active');
    
    showToast('Invite declined', 'info');
}

function openAndroidGame(packageId, intentUrl) {
    console.log('Opening game:', packageId);
    
    // Try to open with intent:// URL (Android)
    if (intentUrl) {
        window.location.href = intentUrl;
    } else {
        // Fallback to Play Store
        const storeUrl = `https://play.google.com/store/apps/details?id=${packageId}`;
        window.open(storeUrl, '_blank');
    }
}

// =============================================
// MESSAGING SYSTEM
// =============================================
async function sendMessage(friendId, message) {
    if (!message || !message.trim()) return;
    
    const friend = appState.friends.find(f => f.id === friendId);
    if (!friend || !friend.firebaseId) {
        showToast('Friend not found or offline', 'error');
        return;
    }
    
    const messageId = generateMessageId();
    const messageData = {
        from: appState.userId,
        fromName: appState.userName,
        to: friendId,
        message: message.trim(),
        timestamp: Date.now(),
        type: 'text'
    };
    
    try {
        // Save to Firebase
        await firebaseDatabase.ref(`messages/${friend.firebaseId}/${messageId}`).set(messageData);
        
        // Add to local chat
        addChatMessage({
            ...messageData,
            direction: 'sent'
        });
        
        // Clear input
        document.getElementById('messageInput').value = '';
        
        // Send push notification
        await sendPushNotificationToFriend(friendId, 'message', {
            message: message.trim()
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }
}

function handleIncomingMessage(message) {
    console.log('Incoming message:', message);
    
    // Add to chat if from current friend
    if (appState.currentFriend && appState.currentFriend.id === message.from) {
        addChatMessage({
            ...message,
            direction: 'received'
        });
    }
    
    // Add notification
    addNotification({
        type: 'message',
        message: `${message.fromName}: ${message.message}`,
        timestamp: message.timestamp,
        unread: true
    });
    
    // Show browser notification
    if (document.visibilityState !== 'visible') {
        showLocalNotification(
            '💬 New Message',
            `${message.fromName}: ${message.message}`,
            { type: 'message', ...message }
        );
    }
}

function addChatMessage(message) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.direction}`;
    messageDiv.innerHTML = `
        <div class="message-content">${message.message}</div>
        <div class="message-time">${formatTime(message.timestamp)}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// =============================================
// NOTIFICATIONS SYSTEM
// =============================================
function addNotification(notification) {
    notification.id = generateNotificationId();
    appState.notifications.unshift(notification);
    
    if (notification.unread) {
        appState.unreadNotifications++;
    }
    
    // Keep only last 100 notifications
    if (appState.notifications.length > 100) {
        appState.notifications = appState.notifications.slice(0, 100);
    }
    
    // Save and update UI
    savePersistentState();
    updateNotificationsUI();
}

function markNotificationAsRead(notificationId) {
    const notification = appState.notifications.find(n => n.id === notificationId);
    if (notification && notification.unread) {
        notification.unread = false;
        appState.unreadNotifications = Math.max(0, appState.unreadNotifications - 1);
        updateNotificationsUI();
        savePersistentState();
    }
}

function clearAllNotifications() {
    appState.notifications = [];
    appState.unreadNotifications = 0;
    updateNotificationsUI();
    savePersistentState();
    showToast('All notifications cleared', 'info');
}

// =============================================
// UI UPDATES
// =============================================
function updateAllUI() {
    updateFriendsUI();
    updateOnlineFriendsUI();
    updateNotificationsUI();
    updateConnectionUI();
}

function updateFriendsUI() {
    const container = document.getElementById('friendsList');
    if (!container) return;
    
    if (appState.friends.length === 0) {
        container.innerHTML = `
            <div class="empty-friends">
                <i class="fas fa-user-friends"></i>
                <p>No friends yet. Add someone to play with!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = appState.friends.map(friend => `
        <div class="friend-item" data-friend-id="${friend.id}">
            <div class="friend-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="friend-details">
                <div class="friend-name">${friend.name}</div>
                <div class="friend-status ${friend.status}">
                    ${friend.status === 'online' ? '🟢 Online' : `⚫ Last seen ${formatTime(friend.lastSeen)}`}
                </div>
            </div>
            <div class="friend-actions">
                <button class="icon-btn friend-message-btn" data-friend-id="${friend.id}" title="Message">
                    <i class="fas fa-comment"></i>
                </button>
                <button class="icon-btn friend-invite-btn" data-friend-id="${friend.id}" title="Invite to Game">
                    <i class="fas fa-gamepad"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners to new buttons
    document.querySelectorAll('.friend-message-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const friendId = btn.dataset.friendId;
            const friend = appState.friends.find(f => f.id === friendId);
            setCurrentFriend(friend);
        });
    });
    
    document.querySelectorAll('.friend-invite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const friendId = btn.dataset.friendId;
            showGameSelectorForFriend(friendId);
        });
    });
}

function updateConnectionUI() {
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionText = document.getElementById('connectionText');
    
    if (!connectionStatus || !connectionText) return;
    
    if (isOnline) {
        const icon = connectionStatus.querySelector('i');
        if (icon) icon.className = 'fas fa-circle online';
        connectionText.textContent = 'Online';
    } else {
        const icon = connectionStatus.querySelector('i');
        if (icon) icon.className = 'fas fa-circle offline';
        connectionText.textContent = 'Offline';
    }
}

function updateOnlineFriendsUI() {
    const container = document.getElementById('onlineFriendsList');
    if (!container) return;
    
    const onlineFriends = appState.friends.filter(f => f.status === 'online');
    
    if (onlineFriends.length === 0) {
        container.innerHTML = `
            <div class="empty-online">
                <i class="fas fa-user-slash"></i>
                <p>No friends online</p>
            </div>
        `;
    } else {
        container.innerHTML = onlineFriends.map(friend => `
            <div class="online-friend">
                <div class="online-status ${friend.status}"></div>
                <span class="online-friend-name">${friend.name}</span>
                <span class="online-friend-game">Online</span>
            </div>
        `).join('');
    }
    
    // Update online count
    const onlineCountElement = document.getElementById('onlineCount');
    if (onlineCountElement) {
        onlineCountElement.textContent = onlineFriends.length;
    }
}

function updateActiveSessionUI() {
    const container = document.getElementById('activeSessionCard');
    const sessionInfo = document.getElementById('sessionInfo');
    
    if (!appState.activeSession) {
        if (container) container.classList.add('hidden');
        return;
    }
    
    if (container) container.classList.remove('hidden');
    if (!sessionInfo) return;
    
    const session = appState.activeSession;
    const otherParticipants = session.participants.filter(p => p !== appState.userId);
    const otherNames = otherParticipants.map(id => {
        const friend = appState.friends.find(f => f.id === id);
        return friend ? friend.name : id;
    }).join(', ');
    
    sessionInfo.innerHTML = `
        <div class="session-game-icon">
            <i class="fas fa-gamepad"></i>
        </div>
        <div class="session-details">
            <h3>${session.gameInfo.name}</h3>
            <div class="session-players">
                Playing with: ${otherNames || 'Friends'}
            </div>
            <div class="session-time">
                Started: ${formatTime(session.timestamp)}
            </div>
        </div>
    `;
}

function updateNotificationsUI() {
    const container = document.getElementById('notificationsList');
    const countElement = document.getElementById('notificationCount');
    
    if (!container) return;
    
    if (appState.notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications</p>
            </div>
        `;
    } else {
        container.innerHTML = appState.notifications.map(notif => `
            <div class="notification-item ${notif.unread ? 'unread' : ''}" data-notif-id="${notif.id}">
                <div class="notification-content">
                    <p>${notif.message}</p>
                    <div class="notification-time">${formatTime(notif.timestamp)}</div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const notifId = item.dataset.notifId;
                markNotificationAsRead(notifId);
                item.classList.remove('unread');
            });
        });
    }
    
    if (countElement) {
        if (appState.unreadNotifications > 0) {
            countElement.textContent = appState.unreadNotifications;
            countElement.classList.remove('hidden');
        } else {
            countElement.classList.add('hidden');
        }
    }
}
// =============================================
// CONNECTION UI FUNCTION (MISSING - ADD THIS)
// =============================================
function updateConnectionUI() {
    // This function updates the connection status in the footer
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionText = document.getElementById('connectionText');
    
    if (!connectionStatus || !connectionText) return;
    
    if (isOnline) {
        // Update icon
        const icon = connectionStatus.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-circle online';
        }
        connectionText.textContent = 'Online';
    } else {
        // Update icon
        const icon = connectionStatus.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-circle offline';
        }
        connectionText.textContent = 'Offline';
    }
    
    // Also update the status dot in user profile
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (statusDot) {
        statusDot.className = isOnline ? 'status-dot online' : 'status-dot';
    }
    if (statusText) {
        statusText.textContent = isOnline ? 'Online' : 'Offline';
    }
}
// =============================================
// UTILITY FUNCTIONS
// =============================================
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return date.toLocaleDateString();
}

function showAppContent() {
    const loadingScreen = document.getElementById('loadingScreen');
    const appContent = document.getElementById('appContent');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas fa-${icons[type] || 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

function clearCache() {
    if (confirm('Clear all cache and restart app? This will log you out.')) {
        try {
            localStorage.clear();
            sessionStorage.clear();
            
            if ('caches' in window) {
                caches.keys().then(keys => {
                    keys.forEach(key => caches.delete(key));
                });
            }
            
            showToast('Cache cleared. Reloading...', 'success');
            
            setTimeout(() => {
                window.location.href = window.location.href.split('?')[0];
            }, 1000);
            
        } catch (error) {
            console.error('Error clearing cache:', error);
            showToast('Error clearing cache', 'error');
        }
    }
}

// =============================================
// EVENT LISTENERS SETUP
// =============================================
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Add friend button
    document.getElementById('connectBtn').addEventListener('click', () => addFriend());
    
    // Enter key in friend ID field
    document.getElementById('friendId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addFriend();
    });
    
    // Send message button
    document.getElementById('sendMessageBtn').addEventListener('click', sendMessageFromInput);
    
    // Enter key in message input
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessageFromInput();
    });
    
    // Quick messages
    document.querySelectorAll('.quick-msg').forEach(btn => {
        btn.addEventListener('click', () => {
            const message = btn.dataset.msg;
            if (appState.currentFriend) {
                sendMessage(appState.currentFriend.id, message);
            } else {
                showToast('Select a friend first', 'error');
            }
        });
    });
    
    // Game challenge buttons
    document.querySelectorAll('.challenge-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const gameType = btn.dataset.game;
            showFriendSelectorForGame(gameType);
        });
    });
    
    // Custom game challenge
    document.getElementById('customChallengeBtn').addEventListener('click', () => {
        const gameId = document.getElementById('customGameId').value.trim();
        if (gameId) {
            showFriendSelectorForGame(gameId);
        } else {
            showToast('Enter game package ID', 'error');
        }
    });
    
    // Session actions
    document.getElementById('syncGameBtn').addEventListener('click', () => {
        if (appState.activeSession) {
            showToast('Game sync requested', 'info');
        }
    });
    
    document.getElementById('endSessionBtn').addEventListener('click', endGameSession);
    
    // Notifications panel
    document.getElementById('notificationToggle').addEventListener('click', () => {
        const panel = document.getElementById('notificationsPanel');
        panel.classList.toggle('hidden');
        panel.classList.toggle('active');
    });
    
    document.getElementById('clearNotificationsBtn').addEventListener('click', clearAllNotifications);
    
    // Modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.add('hidden');
                modal.classList.remove('active');
            });
        });
    });
    
    // Game invite modal buttons
    document.getElementById('acceptInviteBtn').addEventListener('click', acceptGameInvite);
    document.getElementById('declineInviteBtn').addEventListener('click', declineGameInvite);
    
    // User name changes
    document.getElementById('userName').addEventListener('change', (e) => {
        appState.userName = e.target.value;
        savePersistentState();
        if (isFirebaseReady) {
            updateUserInFirebase();
        }
    });
    
    // Copy ID button
    document.getElementById('copyIdBtn').addEventListener('click', copyUserIdToClipboard);
    
    // Generate new ID button
    document.getElementById('newIdBtn').addEventListener('click', generateNewUserId);
    
    // Utility buttons
    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
    document.getElementById('settingsBtn').addEventListener('click', showSettings);
    
    // Click outside modals to close
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
            e.target.classList.remove('active');
        }
    });
    
    // Add notification permission button
    setTimeout(() => {
        setupNotificationPermissionButton();
    }, 2000);
}

function sendMessageFromInput() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message && appState.currentFriend) {
        sendMessage(appState.currentFriend.id, message);
        messageInput.value = '';
    } else if (!appState.currentFriend) {
        showToast('Select a friend first', 'error');
    }
}

function setCurrentFriend(friend) {
    appState.currentFriend = friend;
    // Clear chat messages
    const chatContainer = document.getElementById('chatMessages');
    if (chatContainer) {
        chatContainer.innerHTML = '';
    }
    showToast(`Now chatting with ${friend.name}`, 'info');
}

function showFriendSelectorForGame(gameType) {
    if (appState.friends.length === 0) {
        showToast('Add a friend first', 'error');
        return;
    }
    
    // Simple implementation - just select first online friend
    const onlineFriend = appState.friends.find(f => f.status === 'online');
    if (onlineFriend) {
        startGameSession(gameType, onlineFriend.id);
    } else {
        showToast('No friends online to play with', 'error');
    }
}

function showGameSelectorForFriend(friendId) {
    const friend = appState.friends.find(f => f.id === friendId);
    if (!friend) return;
    
    // Simple implementation - just start with pool game
    startGameSession('pool', friendId);
}

function setupNotificationPermissionButton() {
    const notificationBtn = document.createElement('button');
    notificationBtn.className = 'btn secondary small';
    notificationBtn.innerHTML = '<i class="fas fa-bell"></i> Notifications';
    notificationBtn.onclick = requestNotificationPermission;
    notificationBtn.style.marginLeft = '10px';
    
    const footerSection = document.querySelector('.footer-section');
    if (footerSection) {
        footerSection.appendChild(notificationBtn);
    }
}

function showSettings() {
    console.log('=== APP DEBUG INFO ===');
    console.log('App Version:', APP_VERSION);
    console.log('Firebase Ready:', isFirebaseReady);
    console.log('Online:', isOnline);
    console.log('User ID:', appState.userId);
    console.log('User Name:', appState.userName);
    console.log('Session ID:', appState.sessionId);
    console.log('Friends:', appState.friends.length);
    console.log('Active Session:', appState.activeSession);
    console.log('Notifications:', appState.notifications.length);
    console.log('Unread Notifications:', appState.unreadNotifications);
    console.log('Push Enabled:', appState.pushNotificationsEnabled);
    console.log('=====================');
    
    showToast('Debug info logged to console', 'info');
}

// =============================================
// PWA INSTALLATION
// =============================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.addEventListener('click', installPWA);
    }
});

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                document.getElementById('installBtn').classList.add('hidden');
            }
            deferredPrompt = null;
        });
    }
}

// =============================================
// ONLINE/OFFLINE HANDLING
// =============================================
window.addEventListener('online', () => {
    showToast('✅ Back online', 'success');
    updateConnectionStatus(true);
});

window.addEventListener('offline', () => {
    showToast('⚠️ You are offline', 'warning');
    updateConnectionStatus(false);
});

// =============================================
// CLEANUP ON EXIT
// =============================================
window.addEventListener('beforeunload', () => {
    if (isFirebaseReady && appState.userFirebaseId) {
        // Update last seen
        firebaseDatabase.ref('users/' + appState.userFirebaseId).update({
            online: false,
            lastSeen: Date.now()
        });
    }
    
    // Save state
    savePersistentState();
});

// =============================================
// INITIALIZE APP
// =============================================
console.log(`${APP_NAME} v${APP_VERSION} loaded successfully`);

// Make functions available globally for service worker
window.appState = appState;
window.addNotification = addNotification;
window.setCurrentFriend = setCurrentFriend;
window.showGameInviteModal = showGameInviteModal;
