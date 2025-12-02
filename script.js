// =============================================
// APP VERSION & CONFIGURATION
// =============================================
const APP_VERSION = '1.0.1';
const APP_NAME = 'PlaySync Arena';
console.log(`${APP_NAME} v${APP_VERSION} loading...`);

// Firebase Configuration
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
    persistentConnection: null
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
    
    // Load saved state
    loadPersistentState();
    
    // Initialize Firebase
    await initializeFirebase();
    
    // Setup app
    setupEventListeners();
    setupRealtimeListeners();
    showAppContent();
    
    // Restore previous session
    restorePreviousSession();
    
    // Update UI
    updateAllUI();
    
    console.log('App initialized successfully');
});

// =============================================
// PERSISTENT STATE MANAGEMENT
// =============================================
function loadPersistentState() {
    // Load user data
    appState.userId = localStorage.getItem('playSync_userId') || generateUserId();
    appState.userName = localStorage.getItem('playSync_userName') || 'Player';
    
    // Load friends list
    const savedFriends = localStorage.getItem('playSync_friends');
    if (savedFriends) {
        appState.friends = JSON.parse(savedFriends);
    }
    
    // Load notifications
    const savedNotifications = localStorage.getItem('playSync_notifications');
    if (savedNotifications) {
        appState.notifications = JSON.parse(savedNotifications).slice(-50); // Keep last 50
    }
    
    // Update UI
    document.getElementById('userIdDisplay').textContent = appState.userId;
    document.getElementById('userName').value = appState.userName;
    
    console.log('Persistent state loaded');
}

function savePersistentState() {
    localStorage.setItem('playSync_userId', appState.userId);
    localStorage.setItem('playSync_userName', appState.userName);
    localStorage.setItem('playSync_friends', JSON.stringify(appState.friends));
    localStorage.setItem('playSync_notifications', JSON.stringify(appState.notifications));
    
    if (appState.activeSession) {
        localStorage.setItem('playSync_activeSession', JSON.stringify(appState.activeSession));
    } else {
        localStorage.removeItem('playSync_activeSession');
    }
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
// FIREBASE INITIALIZATION
// =============================================
async function initializeFirebase() {
    try {
        // Initialize Firebase
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDatabase = firebase.database();
        
        // Enable offline persistence
        firebaseDatabase.setPersistenceEnabled(true);
        
        // Sign in anonymously
        await firebaseAuth.signInAnonymously();
        
        // Setup connection monitoring
        firebaseDatabase.ref('.info/connected').on('value', (snapshot) => {
            const connected = snapshot.val() === true;
            updateConnectionStatus(connected);
            
            if (connected) {
                setupPresenceSystem();
                syncWithFirebase();
            }
        });
        
        // Setup auth state listener
        firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User authenticated:', user.uid);
                isFirebaseReady = true;
                setupRealtimeListeners();
                showToast('Connected to PlaySync!', 'success');
            }
        });
        
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        showToast('Using offline mode', 'warning');
        updateConnectionStatus(false);
    }
}

function setupPresenceSystem() {
    if (!firebaseAuth.currentUser) return;
    
    const userId = firebaseAuth.currentUser.uid;
    const userStatusRef = firebaseDatabase.ref('status/' + userId);
    const userDataRef = firebaseDatabase.ref('users/' + userId);
    
    // Create user data
    userDataRef.set({
        id: appState.userId,
        name: appState.userName,
        lastSeen: Date.now(),
        online: true,
        friends: appState.friends.map(f => f.id),
        deviceInfo: {
            platform: navigator.platform,
            userAgent: navigator.userAgent
        }
    });
    
    // Update status
    userStatusRef.onDisconnect().set({
        online: false,
        lastSeen: Date.now()
    });
    
    userStatusRef.set({
        online: true,
        lastSeen: Date.now(),
        sessionId: appState.activeSession?.id
    });
}

function syncWithFirebase() {
    if (!isFirebaseReady) return;
    
    const userId = firebaseAuth.currentUser.uid;
    const userRef = firebaseDatabase.ref('users/' + userId);
    
    // Sync user data
    userRef.update({
        name: appState.userName,
        lastSeen: Date.now(),
        friends: appState.friends.map(f => f.id)
    });
    
    // Sync active session
    if (appState.activeSession) {
        firebaseDatabase.ref('sessions/' + appState.activeSession.id).update({
            updatedAt: Date.now(),
            participants: appState.activeSession.participants
        });
    }
}

// =============================================
// REALTIME LISTENERS
// =============================================
function setupRealtimeListeners() {
    if (!isFirebaseReady) return;
    
    const userId = firebaseAuth.currentUser.uid;
    
    // Listen for friend status changes
    appState.friends.forEach(friend => {
        if (friend.firebaseId) {
            firebaseDatabase.ref('status/' + friend.firebaseId).on('value', (snapshot) => {
                const status = snapshot.val();
                if (status) {
                    updateFriendStatus(friend.id, status);
                }
            });
        }
    });
    
    // Listen for incoming game invites
    firebaseDatabase.ref('invites/' + userId).on('child_added', (snapshot) => {
        const invite = snapshot.val();
        invite.id = snapshot.key;
        handleIncomingInvite(invite);
    });
    
    // Listen for messages
    firebaseDatabase.ref('messages/' + userId).on('child_added', (snapshot) => {
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
    if (!friendId || friendId === appState.userId) {
        showToast('Invalid friend ID', 'error');
        return;
    }
    
    // Check if already friends
    if (appState.friends.some(f => f.id === friendId)) {
        showToast('Already friends with this user', 'info');
        return;
    }
    
    showToast('Searching for user...', 'info');
    
    try {
        // Search in Firebase
        const usersRef = firebaseDatabase.ref('users');
        const snapshot = await usersRef.orderByChild('id').equalTo(friendId).once('value');
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            const firebaseId = Object.keys(userData)[0];
            const friendData = userData[firebaseId];
            
            // Add to friends list
            const friend = {
                id: friendId,
                name: friendData.name || 'Friend',
                firebaseId: firebaseId,
                status: 'offline',
                lastSeen: Date.now()
            };
            
            appState.friends.push(friend);
            savePersistentState();
            updateFriendsUI();
            
            // Setup realtime listener for this friend
            setupFriendListener(friend);
            
            showToast(`Added ${friend.name} as friend`, 'success');
            
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
    
    firebaseDatabase.ref('status/' + friend.firebaseId).on('value', (snapshot) => {
        const status = snapshot.val();
        if (status) {
            friend.status = status.online ? 'online' : 'offline';
            friend.lastSeen = status.lastSeen;
            
            if (status.sessionId) {
                friend.status = 'playing';
            }
            
            updateFriendsUI();
            updateOnlineFriendsUI();
        }
    });
}

function updateFriendStatus(friendId, status) {
    const friend = appState.friends.find(f => f.id === friendId);
    if (friend) {
        friend.status = status.online ? 'online' : 'offline';
        friend.lastSeen = status.lastSeen;
        
        if (status.sessionId) {
            friend.status = 'playing';
        }
        
        updateFriendsUI();
        updateOnlineFriendsUI();
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
    
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
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
        await firebaseDatabase.ref('sessions/' + sessionId).set({
            game: gameType,
            gameInfo: gameInfo,
            participants: [appState.userId, friendId],
            createdBy: appState.userId,
            createdAt: Date.now(),
            status: 'active'
        });
    }
    
    // Save locally
    savePersistentState();
    
    // Update UI
    updateActiveSessionUI();
    
    // Send invite to friend
    sendGameInvite(friend, gameInfo, sessionId);
    
    showToast(`Game session started with ${friend.name}`, 'success');
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
    
    const inviteId = 'inv_' + Date.now();
    
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
        
    } catch (error) {
        console.error('Error sending invite:', error);
        showToast('Failed to send invite', 'error');
    }
}

function handleIncomingInvite(invite) {
    // Find friend who sent the invite
    const friend = appState.friends.find(f => f.id === invite.from);
    if (!friend) {
        // Add as friend if not already
        addFriend(invite.from);
    }
    
    // Add notification
    addNotification({
        type: 'invite_received',
        message: `${invite.fromName} invited you to play ${invite.game}`,
        timestamp: invite.timestamp,
        data: invite,
        unread: true
    });
    
    // Show push notification
    showPushNotification(invite.fromName, `Invited you to play ${invite.game}`);
    
    // Auto-accept if app is in foreground
    if (document.visibilityState === 'visible') {
        showGameInviteModal(invite, friend);
    }
}

async function acceptGameInvite(invite, friend) {
    if (!isFirebaseReady) return;
    
    try {
        // Update invite status
        await firebaseDatabase.ref(`invites/${firebaseAuth.currentUser.uid}/${invite.id}`).update({
            status: 'accepted',
            respondedAt: Date.now()
        });
        
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
        
        // Open the game on BOTH devices
        openAndroidGame(invite.gamePackageId, invite.gameIntentUrl);
        
        // Notify the inviter
        sendGameSyncNotification(friend, 'accepted', invite.sessionId);
        
        showToast('Game accepted! Opening...', 'success');
        
    } catch (error) {
        console.error('Error accepting invite:', error);
        showToast('Failed to accept invite', 'error');
    }
}

function openAndroidGame(packageId, intentUrl) {
    // Try to open with intent:// URL
    const intent = intentUrl || `intent://details?id=${packageId}#Intent;scheme=market;end`;
    
    // Open on this device
    window.location.href = intent;
    
    // Send sync signal to friend
    syncGameWithFriend(packageId);
}

function syncGameWithFriend(packageId) {
    // This would ideally use Firebase Cloud Messaging to send a push notification
    // For now, we'll update the session in Firebase
    if (appState.activeSession && isFirebaseReady) {
        firebaseDatabase.ref('sessions/' + appState.activeSession.id).update({
            syncTime: Date.now(),
            lastSyncBy: appState.userId
        });
    }
}

// =============================================
// MESSAGING SYSTEM
// =============================================
async function sendMessage(friendId, message) {
    const friend = appState.friends.find(f => f.id === friendId);
    if (!friend || !friend.firebaseId) return;
    
    const messageId = 'msg_' + Date.now();
    const messageData = {
        from: appState.userId,
        fromName: appState.userName,
        to: friendId,
        message: message,
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
        
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

function handleIncomingMessage(message) {
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
    
    // Show push notification
    showPushNotification(message.fromName, message.message);
}

// =============================================
// NOTIFICATIONS SYSTEM
// =============================================
function addNotification(notification) {
    notification.id = 'notif_' + Date.now();
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
}

// =============================================
// PUSH NOTIFICATIONS
// =============================================
function showPushNotification(title, body) {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
        const options = {
            body: body,
            icon: 'icons/icon-96.png',
            badge: 'icons/icon-96.png',
            tag: 'playsync-notification',
            renotify: true,
            actions: [
                {
                    action: 'open',
                    title: 'Open App'
                }
            ]
        };
        
        const notification = new Notification(title, options);
        
        notification.onclick = function() {
            window.focus();
            this.close();
        };
    }
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
                    ${friend.status === 'playing' ? '🎮 In Game' : 
                      friend.status === 'online' ? '🟢 Online' : 
                      '⚫ Last seen ' + formatTime(friend.lastSeen)}
                </div>
            </div>
            <div class="friend-actions">
                <button class="icon-btn friend-action-btn" data-action="message" title="Message">
                    <i class="fas fa-comment"></i>
                </button>
                <button class="icon-btn friend-action-btn" data-action="invite" title="Invite to Game">
                    <i class="fas fa-gamepad"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function updateOnlineFriendsUI() {
    const container = document.getElementById('onlineFriendsList');
    if (!container) return;
    
    const onlineFriends = appState.friends.filter(f => f.status === 'online' || f.status === 'playing');
    
    if (onlineFriends.length === 0) {
        container.innerHTML = `
            <div class="empty-online">
                <i class="fas fa-user-slash"></i>
                <p>No friends online</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = onlineFriends.map(friend => `
        <div class="online-friend">
            <div class="online-status ${friend.status}"></div>
            <span class="online-friend-name">${friend.name}</span>
            <span class="online-friend-game">${friend.status === 'playing' ? 'In Game' : 'Online'}</span>
        </div>
    `).join('');
    
    // Update online count
    document.getElementById('onlineCount').textContent = onlineFriends.length;
}

function updateActiveSessionUI() {
    const container = document.getElementById('activeSessionCard');
    const sessionInfo = document.getElementById('sessionInfo');
    
    if (!appState.activeSession) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    
    const session = appState.activeSession;
    const otherParticipants = session.participants.filter(p => p !== appState.userId);
    
    sessionInfo.innerHTML = `
        <div class="session-game-icon">
            <i class="fas fa-gamepad"></i>
        </div>
        <div class="session-details">
            <h3>${session.gameInfo.name}</h3>
            <div class="session-players">
                Playing with: ${otherParticipants.join(', ')}
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
    }
    
    if (countElement) {
        countElement.textContent = appState.unreadNotifications;
        countElement.style.display = appState.unreadNotifications > 0 ? 'flex' : 'none';
    }
}

function updateConnectionUI() {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    const statusDot = document.getElementById('statusDot');
    
    if (isOnline) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Online';
        statusElement.innerHTML = '<i class="fas fa-circle online"></i> Online';
    } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Offline';
        statusElement.innerHTML = '<i class="fas fa-circle offline"></i> Offline';
    }
}

// =============================================
// EVENT LISTENERS SETUP
// =============================================
function setupEventListeners() {
    // Add friend button
    document.getElementById('connectBtn').addEventListener('click', () => {
        const friendId = document.getElementById('friendId').value.trim();
        addFriend(friendId);
        document.getElementById('friendId').value = '';
    });
    
    // Send message
    document.getElementById('sendMessageBtn').addEventListener('click', () => {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        if (message && appState.currentFriend) {
            sendMessage(appState.currentFriend.id, message);
            messageInput.value = '';
        }
    });
    
    // Quick messages
    document.querySelectorAll('.quick-msg').forEach(btn => {
        btn.addEventListener('click', () => {
            const message = btn.dataset.msg;
            if (appState.currentFriend) {
                sendMessage(appState.currentFriend.id, message);
            }
        });
    });
    
    // Game challenges
    document.querySelectorAll('.game-action-btn[data-action="challenge"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const gameCard = btn.closest('.game-card');
            const gameType = gameCard.dataset.game;
            showFriendSelectorForGame(gameType);
        });
    });
    
    // Custom game challenge
    document.querySelector('.game-action-btn[data-action="challenge-custom"]').addEventListener('click', () => {
        const gameId = document.querySelector('.custom-game-input').value.trim();
        if (gameId) {
            showFriendSelectorForGame(gameId);
        } else {
            showToast('Enter game package ID', 'error');
        }
    });
    
    // Friend actions delegation
    document.getElementById('friendsList').addEventListener('click', (e) => {
        const friendItem = e.target.closest('.friend-item');
        if (!friendItem) return;
        
        const friendId = friendItem.dataset.friendId;
        const friend = appState.friends.find(f => f.id === friendId);
        
        if (e.target.closest('.friend-action-btn[data-action="message"]')) {
            setCurrentFriend(friend);
        } else if (e.target.closest('.friend-action-btn[data-action="invite"]')) {
            showGameSelectorForFriend(friend);
        } else {
            showFriendModal(friend);
        }
    });
    
    // Session actions
    document.getElementById('syncGameBtn').addEventListener('click', () => {
        if (appState.activeSession) {
            syncGameWithFriend(appState.activeSession.gameInfo.packageId);
            showToast('Sync sent to friend', 'success');
        }
    });
    
    document.getElementById('endSessionBtn').addEventListener('click', endGameSession);
    
    // Notifications panel
    document.getElementById('notificationToggle').addEventListener('click', () => {
        document.getElementById('notificationsPanel').classList.toggle('active');
    });
    
    document.getElementById('clearNotificationsBtn').addEventListener('click', clearAllNotifications);
    
    // Modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });
    
    // User name changes
    document.getElementById('userName').addEventListener('change', (e) => {
        appState.userName = e.target.value;
        savePersistentState();
        if (isFirebaseReady) {
            syncWithFirebase();
        }
    });
    
    // Copy ID
    document.getElementById('copyIdBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(appState.userId);
        showToast('ID copied to clipboard', 'success');
    });
    
    // Utility buttons
    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
    document.getElementById('settingsBtn').addEventListener('click', showSettings);
}

// =============================================
// UTILITY FUNCTIONS
// =============================================
function generateUserId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return date.toLocaleDateString();
}

function showAppContent() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function clearCache() {
    if (confirm('Clear all cache and restart?')) {
        localStorage.clear();
        sessionStorage.clear();
        if ('caches' in window) {
            caches.keys().then(keys => {
                keys.forEach(key => caches.delete(key));
            });
        }
        location.reload();
    }
}

// =============================================
// MODAL FUNCTIONS
// =============================================
function showFriendModal(friend) {
    const modal = document.getElementById('friendModal');
    const infoDiv = document.getElementById('selectedFriendInfo');
    
    infoDiv.innerHTML = `
        <div class="friend-modal-info">
            <div class="friend-avatar-large">
                <i class="fas fa-user-circle"></i>
            </div>
            <div>
                <h4>${friend.name}</h4>
                <p>ID: ${friend.id}</p>
                <p>Status: <span class="status-${friend.status}">${friend.status}</span></p>
                <p>Last seen: ${formatTime(friend.lastSeen)}</p>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

function showFriendSelectorForGame(gameType) {
    // Implementation for friend selection modal
    console.log('Select friend for game:', gameType);
}

function showGameSelectorForFriend(friend) {
    // Implementation for game selection modal
    console.log('Select game for friend:', friend.name);
}

function showGameInviteModal(invite, friend) {
    const modal = document.getElementById('gameInviteModal');
    const infoDiv = document.getElementById('inviteInfo');
    
    infoDiv.innerHTML = `
        <div class="invite-info">
            <div class="invite-avatar">
                <i class="fas fa-user-circle"></i>
            </div>
            <div>
                <h4>${invite.fromName}</h4>
                <p>Invited you to play:</p>
                <h3>${invite.game}</h3>
                <p class="invite-time">${formatTime(invite.timestamp)}</p>
            </div>
        </div>
    `;
    
    modal.dataset.inviteId = invite.id;
    modal.dataset.friendId = friend?.id;
    
    modal.classList.add('active');
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
    showToast('Back online', 'success');
    updateConnectionStatus(true);
});

window.addEventListener('offline', () => {
    showToast('You are offline', 'warning');
    updateConnectionStatus(false);
});

// =============================================
// CLEANUP ON EXIT
// =============================================
window.addEventListener('beforeunload', () => {
    if (isFirebaseReady && firebaseAuth.currentUser) {
        // Update last seen
        firebaseDatabase.ref('status/' + firebaseAuth.currentUser.uid).update({
            online: false,
            lastSeen: Date.now()
        });
    }
    
    // Save state
    savePersistentState();
});

// =============================================
// DEBUG
// =============================================
function showSettings() {
    console.log('App State:', appState);
    console.log('Firebase Ready:', isFirebaseReady);
    console.log('Online:', isOnline);
    showToast('Debug info in console', 'info');
}
