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

// Initialize Firebase
let app;
let auth;
let database;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    database = firebase.database();
} catch (error) {
    console.error("Firebase initialization error:", error);
}

// App State
let appState = {
    currentUser: null,
    friend: null,
    friendConnectionRef: null,
    notifications: [],
    deferredPrompt: null,
    sessionId: generateSessionId()
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

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Initialize Firebase
    await initializeFirebase();
    
    // Load or create user
    await initializeUser();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup Firebase listeners
    setupFirebaseListeners();
    
    // Check URL for friend ID
    checkUrlForFriendId();
    
    // Setup PWA install prompt
    setupPWAInstall();
    
    // Update connection status
    updateConnectionStatus();
}

async function initializeFirebase() {
    try {
        // Sign in anonymously
        await auth.signInAnonymously();
        console.log("Firebase connected successfully");
        
        // Setup connection monitoring
        database.ref('.info/connected').on('value', (snapshot) => {
            const connected = snapshot.val();
            updateConnectionStatus(connected);
        });
        
    } catch (error) {
        console.error("Firebase initialization error:", error);
        showToast("Connection error. Working in offline mode.", "error");
    }
}

async function initializeUser() {
    let userId = localStorage.getItem('playSync_userId');
    let userName = localStorage.getItem('playSync_userName') || 'Player';
    
    // Generate new user if doesn't exist
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem('playSync_userId', userId);
    }
    
    // Update UI
    document.getElementById('userIdDisplay').textContent = userId;
    document.getElementById('userName').value = userName;
    
    // Create/update user in Firebase
    await updateUserInFirebase();
    
    // Listen for name changes
    document.getElementById('userName').addEventListener('change', async (e) => {
        localStorage.setItem('playSync_userName', e.target.value);
        await updateUserInFirebase();
    });
}

function generateUserId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomId = '';
    for (let i = 0; i < 6; i++) {
        randomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `user_${randomId}_${Date.now()}`;
}

function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9);
}

async function updateUserInFirebase() {
    if (!auth.currentUser) return;
    
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
    } catch (error) {
        console.error("Error updating user in Firebase:", error);
    }
}

function setupEventListeners() {
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
    document.getElementById('installBtn').addEventListener('click', installPWA);
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });
    
    // Copy link button
    document.getElementById('copyLinkBtn').addEventListener('click', copyShareLink);
    
    // Game request buttons
    document.getElementById('acceptRequestBtn').addEventListener('click', acceptGameRequest);
    document.getElementById('declineRequestBtn').addEventListener('click', declineGameRequest);
}

function setupFirebaseListeners() {
    // Listen for friend status changes
    if (appState.friendConnectionRef) {
        appState.friendConnectionRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const friendData = snapshot.val();
                updateFriendInfo(friendData);
            } else {
                clearFriendInfo();
            }
        });
    }
    
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

function checkUrlForFriendId() {
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friend');
    
    if (friendId) {
        document.getElementById('friendId').value = friendId;
        showToast("Friend ID loaded from URL. Click Connect to proceed.", "info");
    }
}

async function connectToFriend() {
    const friendPublicId = document.getElementById('friendId').value.trim();
    
    if (!friendPublicId) {
        showToast("Please enter a friend ID", "error");
        return;
    }
    
    if (!auth.currentUser) {
        showToast("Please wait for connection...", "error");
        return;
    }
    
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
        
        if (friendUid) {
            // Store friend connection
            appState.friend = {
                uid: friendUid,
                ...friendData
            };
            
            // Setup listener for friend status
            appState.friendConnectionRef = database.ref(`users/${friendUid}`);
            appState.friendConnectionRef.on('value', (snapshot) => {
                if (snapshot.exists()) {
                    const updatedFriendData = snapshot.val();
                    updateFriendInfo(updatedFriendData);
                }
            });
            
            showToast(`Connected to ${friendData.name}`, "success");
            
        } else {
            showToast("Friend not found. Make sure they're online.", "error");
        }
        
    } catch (error) {
        console.error("Error connecting to friend:", error);
        showToast("Error connecting to friend", "error");
    }
}

function disconnectFromFriend() {
    if (appState.friendConnectionRef) {
        appState.friendConnectionRef.off();
        appState.friendConnectionRef = null;
    }
    
    appState.friend = null;
    clearFriendInfo();
    showToast("Disconnected from friend", "info");
}

function updateFriendInfo(friendData) {
    const friendInfoDiv = document.getElementById('friendInfo');
    const friendNameSpan = document.getElementById('friendName');
    const friendStatusText = document.getElementById('friendStatusText');
    const friendStatusDot = document.getElementById('friendStatusDot');
    
    friendInfoDiv.classList.remove('hidden');
    friendNameSpan.textContent = friendData.name;
    
    const isOnline = friendData.status === 'online';
    friendStatusText.textContent = isOnline ? 'Online' : 'Offline';
    friendStatusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
}

function clearFriendInfo() {
    const friendInfoDiv = document.getElementById('friendInfo');
    friendInfoDiv.classList.add('hidden');
    document.getElementById('friendId').value = '';
}

async function sendGameChallenge(gameType, gameId) {
    if (!appState.friend) {
        showToast("Connect to a friend first", "error");
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

function showGameRequestModal(request) {
    const modal = document.getElementById('gameRequestModal');
    const message = document.getElementById('requestMessage');
    
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

async function acceptGameRequest() {
    const modal = document.getElementById('gameRequestModal');
    const requestId = modal.dataset.requestId;
    const senderUid = modal.dataset.senderUid;
    const gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    try {
        // Update request status
        await database.ref(`requests/${auth.currentUser.uid}/${requestId}`).update({
            status: 'accepted',
            respondedAt: Date.now()
        });
        
        // Notify sender
        const notificationId = 'notif_' + Date.now();
        await database.ref(`requests/${senderUid}/${notificationId}`).set({
            type: 'response',
            from: auth.currentUser.uid,
            fromName: localStorage.getItem('playSync_userName') || 'Player',
            to: senderUid,
            requestId: requestId,
            status: 'accepted',
            timestamp: Date.now()
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

async function declineGameRequest() {
    const modal = document.getElementById('gameRequestModal');
    const requestId = modal.dataset.requestId;
    const senderUid = modal.dataset.senderUid;
    const gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    try {
        // Update request status
        await database.ref(`requests/${auth.currentUser.uid}/${requestId}`).update({
            status: 'declined',
            respondedAt: Date.now()
        });
        
        // Notify sender
        const notificationId = 'notif_' + Date.now();
        await database.ref(`requests/${senderUid}/${notificationId}`).set({
            type: 'response',
            from: auth.currentUser.uid,
            fromName: localStorage.getItem('playSync_userName') || 'Player',
            to: senderUid,
            requestId: requestId,
            status: 'declined',
            timestamp: Date.now()
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
        showToast("Error declining challenge", "error");
    }
}

function openAndroidGame(gameInfo) {
    // Try to open with intent:// URL (Android app)
    const intentUrl = gameInfo.intentUrl || `intent://details?id=${gameInfo.gamePackageId}#Intent;scheme=market;end`;
    
    // Fallback to Play Store URL
    const storeUrl = gameInfo.storeUrl || `https://play.google.com/store/apps/details?id=${gameInfo.gamePackageId}`;
    
    // Try intent first, then fallback to Play Store
    window.location.href = intentUrl;
    
    // If intent fails, open Play Store after a delay
    setTimeout(() => {
        window.open(storeUrl, '_blank');
    }, 500);
}

function copyUserId() {
    const userId = document.getElementById('userIdDisplay').textContent;
    navigator.clipboard.writeText(userId).then(() => {
        showToast("ID copied to clipboard", "success");
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast("Failed to copy ID", "error");
    });
}

function showShareModal() {
    const userId = localStorage.getItem('playSync_userId');
    const shareLink = `${window.location.origin}${window.location.pathname}?friend=${encodeURIComponent(userId)}`;
    
    document.getElementById('shareLink').value = shareLink;
    document.getElementById('shareModal').classList.add('active');
}

function copyShareLink() {
    const shareLinkInput = document.getElementById('shareLink');
    shareLinkInput.select();
    navigator.clipboard.writeText(shareLinkInput.value).then(() => {
        showToast("Link copied to clipboard", "success");
    });
}

async function generateNewUserId() {
    const confirm = window.confirm("Generate a new user ID? This will disconnect you from current friend.");
    
    if (confirm) {
        disconnectFromFriend();
        
        const newId = generateUserId();
        localStorage.setItem('playSync_userId', newId);
        document.getElementById('userIdDisplay').textContent = newId;
        
        await updateUserInFirebase();
        showToast("New ID generated", "success");
    }
}

function updateConnectionStatus(connected = true) {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    
    if (connected) {
        statusElement.innerHTML = '<i class="fas fa-circle online"></i> Online';
        statusElement.classList.remove('offline');
        statusText.textContent = 'Online';
    } else {
        statusElement.innerHTML = '<i class="fas fa-circle offline"></i> Offline';
        statusElement.classList.add('offline');
        statusText.textContent = 'Offline';
    }
}

function addNotification(notification) {
    appState.notifications.unshift(notification);
    updateNotificationsUI();
}

function updateNotificationsUI() {
    const container = document.getElementById('notificationsList');
    
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

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function getToastIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// PWA Functions
function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        appState.deferredPrompt = e;
        document.getElementById('installBtn').classList.remove('hidden');
    });
}

async function installPWA() {
    if (appState.deferredPrompt) {
        appState.deferredPrompt.prompt();
        const { outcome } = await appState.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            document.getElementById('installBtn').classList.add('hidden');
        }
        
        appState.deferredPrompt = null;
    }
}

// Handle offline/online events
window.addEventListener('online', () => {
    updateConnectionStatus(true);
    showToast("Back online", "success");
});

window.addEventListener('offline', () => {
    updateConnectionStatus(false);
    showToast("You're offline", "warning");
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (auth.currentUser) {
        database.ref(`users/${auth.currentUser.uid}`).update({
            status: 'offline',
            lastSeen: Date.now()
        });
    }
    
    if (appState.friendConnectionRef) {
        appState.friendConnectionRef.off();
    }
});
