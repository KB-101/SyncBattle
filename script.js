// Firebase Configuration - REPLACE WITH YOUR OWN FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAlKamcGfK-kUupKFfH-rjiS54gZU_csf0",
  authDomain: "playsync-arena.firebaseapp.com",
  databaseURL: "https://playsync-arena-default-rtdb.firebaseio.com",
  projectId: "playsync-arena",
  storageBucket: "playsync-arena.firebasestorage.app",
  messagingSenderId: "989668959512",
  appId: "1:989668959512:web:016b68c8fb932f2e9d2a6d"
};

// Initialize Firebase
let app;
let auth;
let database;
let isFirebaseInitialized = false;

// App State
let appState = {
    currentUser: null,
    friend: null,
    friendConnectionRef: null,
    notifications: [],
    deferredPrompt: null,
    sessionId: generateSessionId(),
    isOnline: false
};

// Game Database
const gamesDatabase = {
    'pool': {
        name: '8 Ball Pool',
        packageId: 'com.billiards.city.pool.nation.club',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.billiards.city.pool.nation.club',
        intentUrl: 'intent://details?id=com.billiards.city.pool.nation.club#Intent;scheme=market;end'
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

// Initialize App when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing app...");
    initializeApp();
});

// Initialize App
async function initializeApp() {
    console.log("Initializing app...");
    
    // Initialize Firebase first
    await initializeFirebase();
    
    // Initialize user
    await initializeUser();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check URL for friend ID
    checkUrlForFriendId();
    
    // Setup PWA install prompt
    setupPWAInstall();
    
    // Update UI
    updateConnectionStatus();
    console.log("App initialization complete");
}

// Initialize Firebase
async function initializeFirebase() {
    try {
        console.log("Initializing Firebase...");
        
        // Check if Firebase is already initialized
        if (!firebase.apps.length) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.app();
        }
        
        auth = firebase.auth();
        database = firebase.database();
        
        // Try anonymous sign-in
        try {
            await auth.signInAnonymously();
            console.log("Firebase connected successfully");
            isFirebaseInitialized = true;
            
            // Setup connection monitoring
            const connectedRef = database.ref('.info/connected');
            connectedRef.on('value', (snapshot) => {
                const connected = snapshot.val();
                appState.isOnline = connected;
                updateConnectionStatus(connected);
                console.log("Firebase connection status:", connected);
            });
            
        } catch (authError) {
            console.error("Firebase auth error:", authError);
            showToast("Authentication error. Using offline mode.", "warning");
            // Continue in offline mode
            isFirebaseInitialized = false;
        }
        
    } catch (error) {
        console.error("Firebase initialization error:", error);
        showToast("Firebase connection failed. Using offline mode.", "warning");
        isFirebaseInitialized = false;
    }
}

// Initialize User
async function initializeUser() {
    console.log("Initializing user...");
    
    let userId = localStorage.getItem('playSync_userId');
    let userName = localStorage.getItem('playSync_userName') || 'Player';
    
    // Generate new user if doesn't exist
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem('playSync_userId', userId);
        console.log("Generated new user ID:", userId);
    }
    
    // Update UI immediately
    document.getElementById('userIdDisplay').textContent = userId;
    document.getElementById('userName').value = userName;
    
    // Create/update user in Firebase if connected
    if (isFirebaseInitialized && auth.currentUser) {
        await updateUserInFirebase();
    } else {
        // Use local state if Firebase is not available
        appState.currentUser = {
            uid: 'local_' + userId,
            publicId: userId,
            name: userName,
            status: 'online'
        };
        console.log("Using local user state");
    }
}

// Generate User ID
function generateUserId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomId = '';
    for (let i = 0; i < 6; i++) {
        randomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `user_${randomId}_${Date.now()}`;
}

// Generate Session ID
function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9);
}

// Update User in Firebase
async function updateUserInFirebase() {
    if (!isFirebaseInitialized || !auth.currentUser) {
        console.log("Cannot update user in Firebase - not connected");
        return;
    }
    
    const userData = {
        publicId: localStorage.getItem('playSync_userId'),
        name: localStorage.getItem('playSync_userName') || 'Player',
        status: 'online',
        lastSeen: Date.now(),
        sessionId: appState.sessionId
    };
    
    try {
        await database.ref(`users/${auth.currentUser.uid}`).set(userData);
        appState.currentUser = {
            uid: auth.currentUser.uid,
            ...userData
        };
        console.log("User updated in Firebase");
    } catch (error) {
        console.error("Error updating user in Firebase:", error);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    console.log("Setting up event listeners...");
    
    // Copy ID button
    document.getElementById('copyIdBtn').addEventListener('click', copyUserId);
    
    // Share ID button
    document.getElementById('shareIdBtn').addEventListener('click', showShareModal);
    
    // New ID button
    document.getElementById('newIdBtn').addEventListener('click', generateNewUserId);
    
    // Connect button
    document.getElementById('connectBtn').addEventListener('click', connectToFriend);
    
    // Disconnect button
    document.getElementById('disconnectBtn').addEventListener('click', disconnectFromFriend);
    
    // Challenge buttons
    document.querySelectorAll('.challenge-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gameCard = e.target.closest('.game-card');
            const gameType = gameCard.dataset.game;
            const gameId = gameCard.dataset.gameId;
            sendGameChallenge(gameType, gameId);
        });
    });
    
    // Custom challenge button
    document.getElementById('customChallengeBtn').addEventListener('click', () => {
        const customGameId = document.getElementById('customGameId').value.trim();
        if (customGameId) {
            sendGameChallenge('custom', customGameId);
        } else {
            showToast("Please enter a game package ID", "error");
        }
    });
    
    // Install button
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', installPWA);
    }
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });
    
    // Copy link button
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', copyShareLink);
    }
    
    // Game request buttons
    const acceptBtn = document.getElementById('acceptRequestBtn');
    const declineBtn = document.getElementById('declineRequestBtn');
    if (acceptBtn) acceptBtn.addEventListener('click', acceptGameRequest);
    if (declineBtn) declineBtn.addEventListener('click', declineGameRequest);
    
    // User name change
    document.getElementById('userName').addEventListener('change', async (e) => {
        localStorage.setItem('playSync_userName', e.target.value);
        if (isFirebaseInitialized) {
            await updateUserInFirebase();
        }
    });
    
    // Listen for friend connection changes
    setupFriendConnectionListener();
    
    console.log("Event listeners setup complete");
}

// Setup Friend Connection Listener
function setupFriendConnectionListener() {
    if (appState.friend && isFirebaseInitialized) {
        if (appState.friendConnectionRef) {
            appState.friendConnectionRef.off(); // Remove old listener
        }
        
        appState.friendConnectionRef = database.ref(`users/${appState.friend.uid}`);
        appState.friendConnectionRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const friendData = snapshot.val();
                updateFriendInfo(friendData);
            } else {
                clearFriendInfo();
            }
        });
        
        // Listen for incoming game requests
        if (auth.currentUser) {
            database.ref(`requests/${auth.currentUser.uid}`)
                .orderByChild('status')
                .equalTo('pending')
                .on('child_added', (snapshot) => {
                    const request = snapshot.val();
                    request.id = snapshot.key;
                    showGameRequestModal(request);
                });
        }
    }
}

// Connect to Friend
async function connectToFriend() {
    const friendPublicId = document.getElementById('friendId').value.trim();
    
    if (!friendPublicId) {
        showToast("Please enter a friend ID", "error");
        return;
    }
    
    if (!isFirebaseInitialized) {
        showToast("Cannot connect - Firebase not available", "error");
        return;
    }
    
    showToast("Searching for friend...", "info");
    
    try {
        // Search for friend by public ID
        const usersSnapshot = await database.ref('users').once('value');
        let friendUid = null;
        let friendData = null;
        
        usersSnapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val();
            if (userData.publicId === friendPublicId) {
                friendUid = childSnapshot.key;
                friendData = userData;
            }
        });
        
        if (friendUid && friendData) {
            // Store friend connection
            appState.friend = {
                uid: friendUid,
                ...friendData
            };
            
            // Setup listener for friend status
            setupFriendConnectionListener();
            
            showToast(`Connected to ${friendData.name}`, "success");
            
        } else {
            showToast("Friend not found. Make sure they're online and have shared their ID.", "error");
        }
        
    } catch (error) {
        console.error("Error connecting to friend:", error);
        showToast("Error connecting to friend. Check your connection.", "error");
    }
}

// Disconnect from Friend
function disconnectFromFriend() {
    if (appState.friendConnectionRef) {
        appState.friendConnectionRef.off();
        appState.friendConnectionRef = null;
    }
    
    appState.friend = null;
    clearFriendInfo();
    showToast("Disconnected from friend", "info");
}

// Update Friend Info
function updateFriendInfo(friendData) {
    const friendInfoDiv = document.getElementById('friendInfo');
    const friendNameSpan = document.getElementById('friendName');
    const friendStatusText = document.getElementById('friendStatusText');
    const friendStatusDot = document.getElementById('friendStatusDot');
    
    if (friendInfoDiv && friendNameSpan && friendStatusText && friendStatusDot) {
        friendInfoDiv.classList.remove('hidden');
        friendNameSpan.textContent = friendData.name;
        
        const isOnline = friendData.status === 'online';
        friendStatusText.textContent = isOnline ? 'Online' : 'Offline';
        friendStatusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    }
}

// Clear Friend Info
function clearFriendInfo() {
    const friendInfoDiv = document.getElementById('friendInfo');
    if (friendInfoDiv) {
        friendInfoDiv.classList.add('hidden');
    }
    document.getElementById('friendId').value = '';
}

// Send Game Challenge
async function sendGameChallenge(gameType, gameId) {
    if (!appState.friend) {
        showToast("Connect to a friend first", "error");
        return;
    }
    
    if (!isFirebaseInitialized) {
        showToast("Cannot send challenge - offline mode", "error");
        return;
    }
    
    const gameInfo = gamesDatabase[gameType] || {
        name: 'Custom Game',
        packageId: gameId,
        storeUrl: `https://play.google.com/store/apps/details?id=${gameId}`,
        intentUrl: `intent://details?id=${gameId}#Intent;scheme=market;end`
    };
    
    const requestId = 'req_' + Date.now();
    const requestData = {
        from: auth.currentUser.uid,
        fromName: localStorage.getItem('playSync_userName') || 'Player',
        fromPublicId: localStorage.getItem('playSync_userId'),
        to: appState.friend.uid,
        game: gameType,
        gameName: gameInfo.name,
        gamePackageId: gameInfo.packageId,
        intentUrl: gameInfo.intentUrl,
        storeUrl: gameInfo.storeUrl,
        status: 'pending',
        timestamp: Date.now(),
        sessionId: appState.sessionId
    };
    
    try {
        await database.ref(`requests/${appState.friend.uid}/${requestId}`).set(requestData);
        showToast(`Challenge sent to ${appState.friend.name}`, "success");
        addNotification({
            type: 'sent',
            message: `You challenged ${appState.friend.name} to ${gameInfo.name}`,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error("Error sending challenge:", error);
        showToast("Failed to send challenge", "error");
    }
}

// Show Game Request Modal
function showGameRequestModal(request) {
    const modal = document.getElementById('gameRequestModal');
    const message = document.getElementById('requestMessage');
    
    if (!modal || !message) return;
    
    message.innerHTML = `
        <strong>${request.fromName}</strong> wants to play <strong>${request.gameName}</strong> with you!
        <br><br>
        <small>Game ID: ${request.gamePackageId}</small>
    `;
    
    modal.dataset.requestId = request.id;
    modal.dataset.senderUid = request.from;
    modal.dataset.gameInfo = JSON.stringify(request);
    
    modal.classList.add('active');
    
    // Auto-decline after 30 seconds
    setTimeout(() => {
        if (modal.classList.contains('active')) {
            declineGameRequest();
        }
    }, 30000);
}

// Accept Game Request
async function acceptGameRequest() {
    const modal = document.getElementById('gameRequestModal');
    if (!modal) return;
    
    const requestId = modal.dataset.requestId;
    const senderUid = modal.dataset.senderUid;
    const gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    if (!isFirebaseInitialized) {
        showToast("Cannot accept challenge - offline", "error");
        return;
    }
    
    try {
        // Update request status
        await database.ref(`requests/${auth.currentUser.uid}/${requestId}`).update({
            status: 'accepted',
            respondedAt: Date.now()
        });
        
        // Open the game
        openAndroidGame(gameInfo);
        
        // Add notification
        addNotification({
            type: 'accepted',
            message: `You accepted ${gameInfo.fromName}'s challenge to ${gameInfo.gameName}`,
            timestamp: Date.now()
        });
        
        showToast("Challenge accepted! Opening game...", "success");
        modal.classList.remove('active');
        
    } catch (error) {
        console.error("Error accepting request:", error);
        showToast("Error accepting challenge", "error");
    }
}

// Decline Game Request
async function declineGameRequest() {
    const modal = document.getElementById('gameRequestModal');
    if (!modal) return;
    
    const requestId = modal.dataset.requestId;
    const senderUid = modal.dataset.senderUid;
    const gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    if (!isFirebaseInitialized) {
        modal.classList.remove('active');
        return;
    }
    
    try {
        // Update request status
        await database.ref(`requests/${auth.currentUser.uid}/${requestId}`).update({
            status: 'declined',
            respondedAt: Date.now()
        });
        
        // Add notification
        addNotification({
            type: 'declined',
            message: `You declined ${gameInfo.fromName}'s challenge to ${gameInfo.gameName}`,
            timestamp: Date.now()
        });
        
        showToast("Challenge declined", "info");
        modal.classList.remove('active');
        
    } catch (error) {
        console.error("Error declining request:", error);
        modal.classList.remove('active');
    }
}

// Open Android Game
function openAndroidGame(gameInfo) {
    // Try to open with intent:// URL (Android app)
    const intentUrl = gameInfo.intentUrl || `intent://details?id=${gameInfo.gamePackageId}#Intent;scheme=market;end`;
    
    // Fallback to Play Store URL
    const storeUrl = gameInfo.storeUrl || `https://play.google.com/store/apps/details?id=${gameInfo.gamePackageId}`;
    
    console.log("Opening game:", gameInfo.gameName, "URL:", intentUrl);
    
    // Try intent first, then fallback to Play Store
    window.location.href = intentUrl;
    
    // If intent fails, open Play Store after a delay
    setTimeout(() => {
        window.open(storeUrl, '_blank');
    }, 500);
}

// Copy User ID
function copyUserId() {
    const userId = document.getElementById('userIdDisplay').textContent;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(userId).then(() => {
            showToast("ID copied to clipboard", "success");
        }).catch(err => {
            fallbackCopyText(userId);
        });
    } else {
        fallbackCopyText(userId);
    }
}

// Fallback copy method
function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast("ID copied to clipboard", "success");
    } catch (err) {
        console.error('Failed to copy: ', err);
        showToast("Failed to copy ID", "error");
    }
    document.body.removeChild(textArea);
}

// Show Share Modal
function showShareModal() {
    const userId = localStorage.getItem('playSync_userId');
    const shareLink = `${window.location.origin}${window.location.pathname}?friend=${encodeURIComponent(userId)}`;
    
    const shareLinkInput = document.getElementById('shareLink');
    const shareModal = document.getElementById('shareModal');
    
    if (shareLinkInput && shareModal) {
        shareLinkInput.value = shareLink;
        shareModal.classList.add('active');
    }
}

// Copy Share Link
function copyShareLink() {
    const shareLinkInput = document.getElementById('shareLink');
    if (shareLinkInput) {
        shareLinkInput.select();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareLinkInput.value).then(() => {
                showToast("Link copied to clipboard", "success");
            });
        } else {
            document.execCommand('copy');
            showToast("Link copied to clipboard", "success");
        }
    }
}

// Generate New User ID
async function generateNewUserId() {
    const confirm = window.confirm("Generate a new user ID? This will disconnect you from current friend.");
    
    if (confirm) {
        disconnectFromFriend();
        
        const newId = generateUserId();
        localStorage.setItem('playSync_userId', newId);
        document.getElementById('userIdDisplay').textContent = newId;
        
        if (isFirebaseInitialized) {
            await updateUserInFirebase();
        }
        showToast("New ID generated", "success");
    }
}

// Update Connection Status
function updateConnectionStatus(connected = false) {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    
    if (statusElement && statusText) {
        if (connected) {
            statusElement.innerHTML = '<i class="fas fa-circle online"></i> Online';
            statusElement.classList.remove('offline');
            statusText.textContent = 'Online';
            appState.isOnline = true;
        } else {
            statusElement.innerHTML = '<i class="fas fa-circle offline"></i> Offline';
            statusElement.classList.add('offline');
            statusText.textContent = 'Offline';
            appState.isOnline = false;
        }
    }
}

// Add Notification
function addNotification(notification) {
    appState.notifications.unshift(notification);
    updateNotificationsUI();
}

// Update Notifications UI
function updateNotificationsUI() {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    if (appState.notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = appState.notifications.map(notif => `
        <div class="notification-item ${notif.type}">
            <div class="notification-content">
                <p>${notif.message}</p>
                <small>${new Date(notif.timestamp).toLocaleTimeString()}</small>
            </div>
        </div>
    `).join('');
}

// Show Toast
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
        if (toast.parentNode === container) {
            container.removeChild(toast);
        }
    }, 5000);
}

// Get Toast Icon
function getToastIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// Check URL for Friend ID
function checkUrlForFriendId() {
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friend');
    
    if (friendId) {
        document.getElementById('friendId').value = friendId;
        showToast("Friend ID loaded from URL. Click Connect to proceed.", "info");
    }
}

// PWA Functions
function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        appState.deferredPrompt = e;
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.classList.remove('hidden');
        }
    });
}

async function installPWA() {
    if (appState.deferredPrompt) {
        appState.deferredPrompt.prompt();
        const { outcome } = await appState.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            const installBtn = document.getElementById('installBtn');
            if (installBtn) {
                installBtn.classList.add('hidden');
            }
        }
        
        appState.deferredPrompt = null;
    }
}

// Handle offline/online events
window.addEventListener('online', () => {
    updateConnectionStatus(true);
    showToast("Back online", "success");
    
    // Try to reconnect Firebase
    if (!isFirebaseInitialized) {
        initializeFirebase();
    }
});

window.addEventListener('offline', () => {
    updateConnectionStatus(false);
    showToast("You're offline", "warning");
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (isFirebaseInitialized && auth.currentUser) {
        database.ref(`users/${auth.currentUser.uid}`).update({
            status: 'offline',
            lastSeen: Date.now()
        });
    }
    
    if (appState.friendConnectionRef) {
        appState.friendConnectionRef.off();
    }
});

// Initialize Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}
