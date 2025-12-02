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
let isFirebaseReady = false;
let isOnline = false;

const appState = {
    currentUser: null,
    friend: null,
    friendListener: null,
    notifications: [],
    sessionId: generateSessionId(),
    deferredPrompt: null
};

// Games database
const GAMES_DB = {
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

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    initializeApp();
});

async function initializeApp() {
    try {
        // Show app content immediately
        showAppContent();
        
        // Initialize Firebase
        await initializeFirebase();
        
        // Initialize user
        await initializeUser();
        
        // Setup event listeners
        setupEventListeners();
        
        // Check URL for friend ID
        checkUrlForFriendId();
        
        // Setup PWA install
        setupPWAInstall();
        
        console.log('App initialized successfully');
        
    } catch (error) {
        console.error('App initialization failed:', error);
        showToast('App initialization failed. Using offline mode.', 'error');
        // Continue in offline mode
        updateConnectionStatus(false);
    }
}

// =============================================
// FIREBASE INITIALIZATION
// =============================================
async function initializeFirebase() {
    console.log('Initializing Firebase...');
    
    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        showToast('Firebase SDK not loaded. Using offline mode.', 'warning');
        return;
    }
    
    try {
        // Initialize Firebase app
        firebaseApp = firebase.initializeApp(firebaseConfig);
        console.log('Firebase app initialized');
        
        // Get auth and database instances
        firebaseAuth = firebase.auth();
        firebaseDatabase = firebase.database();
        
        // Setup connection monitoring
        const connectedRef = firebaseDatabase.ref('.info/connected');
        connectedRef.on('value', function(snapshot) {
            const connected = snapshot.val() === true;
            isOnline = connected;
            updateConnectionStatus(connected);
            console.log('Firebase connection:', connected ? 'ONLINE' : 'OFFLINE');
        });
        
        // Sign in anonymously
        await firebaseAuth.signInAnonymously();
        console.log('Anonymous sign-in successful');
        
        // Listen for auth state changes
        firebaseAuth.onAuthStateChanged(function(user) {
            if (user) {
                console.log('User authenticated:', user.uid);
                isFirebaseReady = true;
                
                // Update user in database
                updateUserInFirebase();
                
                // Setup Firebase listeners
                setupFirebaseListeners();
                
                showToast('Connected to PlaySync!', 'success');
                
            } else {
                console.log('No user signed in');
                isFirebaseReady = false;
            }
        });
        
    } catch (error) {
        console.error('Firebase initialization error:', error);
        showToast('Firebase connection failed. Using offline mode.', 'warning');
        isFirebaseReady = false;
        updateConnectionStatus(false);
    }
}

// =============================================
// USER MANAGEMENT
// =============================================
async function initializeUser() {
    console.log('Initializing user...');
    
    // Load or create user ID
    let userId = localStorage.getItem('playSync_userId');
    let userName = localStorage.getItem('playSync_userName') || 'Player';
    
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem('playSync_userId', userId);
        console.log('Generated new user ID:', userId);
    }
    
    // Update UI immediately
    const idDisplay = document.getElementById('userIdDisplay');
    const nameInput = document.getElementById('userName');
    
    if (idDisplay) idDisplay.textContent = userId;
    if (nameInput) nameInput.value = userName;
    
    console.log('User initialized:', userId);
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
    if (!isFirebaseReady || !firebaseAuth.currentUser) {
        console.log('Skipping Firebase update - not ready');
        return;
    }
    
    const userId = localStorage.getItem('playSync_userId');
    const userName = localStorage.getItem('playSync_userName') || 'Player';
    
    const userData = {
        publicId: userId,
        name: userName,
        status: 'online',
        lastSeen: Date.now(),
        sessionId: appState.sessionId,
        updatedAt: Date.now()
    };
    
    try {
        await firebaseDatabase.ref('users/' + firebaseAuth.currentUser.uid).set(userData);
        console.log('User updated in Firebase');
        
        // Store in appState
        appState.currentUser = {
            uid: firebaseAuth.currentUser.uid,
            ...userData
        };
        
    } catch (error) {
        console.error('Error updating user in Firebase:', error);
    }
}

// =============================================
// EVENT LISTENERS SETUP
// =============================================
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // User profile buttons
    document.getElementById('copyIdBtn').addEventListener('click', copyUserId);
    document.getElementById('shareIdBtn').addEventListener('click', showShareModal);
    document.getElementById('newIdBtn').addEventListener('click', generateNewUserId);
    
    // Friend connection buttons
    document.getElementById('connectBtn').addEventListener('click', connectToFriend);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectFromFriend);
    
    // Game challenge buttons
    document.querySelectorAll('.challenge-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const gameCard = this.closest('.game-card');
            const gameType = gameCard.dataset.game;
            const gameId = gameCard.dataset.gameId || gameType;
            sendGameChallenge(gameType, gameId);
        });
    });
    
    // Custom game button
    document.getElementById('customChallengeBtn').addEventListener('click', function() {
        const gameId = document.getElementById('customGameId').value.trim();
        if (gameId) {
            sendGameChallenge('custom', gameId);
        } else {
            showToast('Please enter a game package ID', 'error');
        }
    });
    
    // Modal buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });
    
    // Share modal buttons
    document.getElementById('copyLinkBtn').addEventListener('click', copyShareLink);
    
    // Game request buttons
    document.getElementById('acceptRequestBtn').addEventListener('click', acceptGameRequest);
    document.getElementById('declineRequestBtn').addEventListener('click', declineGameRequest);
    
    // User name change
    document.getElementById('userName').addEventListener('change', function(e) {
        localStorage.setItem('playSync_userName', e.target.value);
        if (isFirebaseReady) {
            updateUserInFirebase();
        }
    });
    
    // Utility buttons
    document.getElementById('debugBtn').addEventListener('click', showDebugInfo);
    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
    document.getElementById('installBtn').addEventListener('click', installPWA);
    
    // Online/offline detection
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

// =============================================
// FIREBASE LISTENERS
// =============================================
function setupFirebaseListeners() {
    if (!isFirebaseReady) {
        console.log('Skipping Firebase listeners - not ready');
        return;
    }
    
    // Listen for incoming game requests
    if (firebaseAuth.currentUser) {
        firebaseDatabase.ref('requests/' + firebaseAuth.currentUser.uid)
            .orderByChild('status')
            .equalTo('pending')
            .on('child_added', function(snapshot) {
                const request = snapshot.val();
                request.id = snapshot.key;
                showGameRequestModal(request);
            });
    }
}

// =============================================
// FRIEND CONNECTION
// =============================================
async function connectToFriend() {
    const friendPublicId = document.getElementById('friendId').value.trim();
    
    if (!friendPublicId) {
        showToast('Please enter a friend ID', 'error');
        return;
    }
    
    if (!isFirebaseReady) {
        showToast('Cannot connect - Firebase not ready', 'error');
        return;
    }
    
    showToast('Searching for friend...', 'info');
    
    try {
        // Search for friend by public ID
        const usersSnapshot = await firebaseDatabase.ref('users').once('value');
        let friendUid = null;
        let friendData = null;
        
        usersSnapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            if (userData.publicId === friendPublicId) {
                friendUid = childSnapshot.key;
                friendData = userData;
                return true;
            }
        });
        
        if (friendUid && friendData) {
            // Store friend connection
            appState.friend = {
                uid: friendUid,
                ...friendData
            };
            
            // Setup listener for friend status
            setupFriendListener();
            
            showToast(`Connected to ${friendData.name}`, 'success');
            
        } else {
            showToast('Friend not found. Make sure they are online.', 'error');
        }
        
    } catch (error) {
        console.error('Error connecting to friend:', error);
        showToast('Error connecting to friend', 'error');
    }
}

function setupFriendListener() {
    if (!isFirebaseReady || !appState.friend) return;
    
    // Remove old listener if exists
    if (appState.friendListener) {
        appState.friendListener.off();
    }
    
    // Setup new listener
    appState.friendListener = firebaseDatabase.ref('users/' + appState.friend.uid);
    appState.friendListener.on('value', function(snapshot) {
        if (snapshot.exists()) {
            const friendData = snapshot.val();
            updateFriendInfo(friendData);
        } else {
            disconnectFromFriend();
            showToast('Friend disconnected', 'info');
        }
    });
}

function updateFriendInfo(friendData) {
    const friendInfo = document.getElementById('friendInfo');
    const friendName = document.getElementById('friendName');
    const friendStatus = document.getElementById('friendStatusText');
    const friendDot = document.getElementById('friendStatusDot');
    
    if (!friendInfo || !friendName || !friendStatus || !friendDot) return;
    
    friendInfo.classList.remove('hidden');
    friendName.textContent = friendData.name;
    
    const isOnline = friendData.status === 'online';
    friendStatus.textContent = isOnline ? 'Online' : 'Offline';
    friendDot.className = 'status-dot ' + (isOnline ? 'online' : 'offline');
}

function disconnectFromFriend() {
    if (appState.friendListener) {
        appState.friendListener.off();
        appState.friendListener = null;
    }
    
    appState.friend = null;
    
    const friendInfo = document.getElementById('friendInfo');
    if (friendInfo) friendInfo.classList.add('hidden');
    
    document.getElementById('friendId').value = '';
    showToast('Disconnected from friend', 'info');
}

// =============================================
// GAME CHALLENGES
// =============================================
async function sendGameChallenge(gameType, gameId) {
    if (!appState.friend) {
        showToast('Connect to a friend first', 'error');
        return;
    }
    
    if (!isFirebaseReady) {
        showToast('Cannot send challenge - offline mode', 'error');
        return;
    }
    
    const gameInfo = GAMES_DB[gameType] || {
        name: 'Custom Game',
        packageId: gameId,
        storeUrl: `https://play.google.com/store/apps/details?id=${gameId}`,
        intentUrl: `intent://details?id=${gameId}#Intent;scheme=market;end`
    };
    
    const requestId = 'req_' + Date.now();
    const requestData = {
        from: firebaseAuth.currentUser.uid,
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
        await firebaseDatabase.ref(`requests/${appState.friend.uid}/${requestId}`).set(requestData);
        showToast(`Challenge sent to ${appState.friend.name}`, 'success');
        
        addNotification({
            type: 'sent',
            message: `You challenged ${appState.friend.name} to ${gameInfo.name}`,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Error sending challenge:', error);
        showToast('Failed to send challenge', 'error');
    }
}

// =============================================
// GAME REQUEST HANDLING
// =============================================
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
    if (!modal || !isFirebaseReady) return;
    
    const requestId = modal.dataset.requestId;
    const gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    try {
        // Update request status
        await firebaseDatabase.ref(`requests/${firebaseAuth.currentUser.uid}/${requestId}`).update({
            status: 'accepted',
            respondedAt: Date.now()
        });
        
        // Add notification
        addNotification({
            type: 'accepted',
            message: `You accepted ${gameInfo.fromName}'s challenge to ${gameInfo.gameName}`,
            timestamp: Date.now()
        });
        
        // Open the game
        openAndroidGame(gameInfo);
        
        showToast('Challenge accepted! Opening game...', 'success');
        modal.classList.remove('active');
        
    } catch (error) {
        console.error('Error accepting request:', error);
        showToast('Error accepting challenge', 'error');
    }
}

async function declineGameRequest() {
    const modal = document.getElementById('gameRequestModal');
    if (!modal || !isFirebaseReady) return;
    
    const requestId = modal.dataset.requestId;
    const gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    try {
        await firebaseDatabase.ref(`requests/${firebaseAuth.currentUser.uid}/${requestId}`).update({
            status: 'declined',
            respondedAt: Date.now()
        });
        
        addNotification({
            type: 'declined',
            message: `You declined ${gameInfo.fromName}'s challenge to ${gameInfo.gameName}`,
            timestamp: Date.now()
        });
        
        showToast('Challenge declined', 'info');
        modal.classList.remove('active');
        
    } catch (error) {
        console.error('Error declining request:', error);
        modal.classList.remove('active');
    }
}

function openAndroidGame(gameInfo) {
    // Try to open with intent:// URL (Android app)
    const intentUrl = gameInfo.intentUrl || `intent://details?id=${gameInfo.gamePackageId}#Intent;scheme=market;end`;
    
    // Fallback to Play Store URL
    const storeUrl = gameInfo.storeUrl || `https://play.google.com/store/apps/details?id=${gameInfo.gamePackageId}`;
    
    console.log('Opening game:', gameInfo.gameName);
    
    // Try intent first
    window.location.href = intentUrl;
    
    // If intent fails, open Play Store after delay
    setTimeout(() => {
        window.open(storeUrl, '_blank');
    }, 500);
}

// =============================================
// UI UTILITIES
// =============================================
function showAppContent() {
    const loadingScreen = document.getElementById('loadingScreen');
    const appContent = document.getElementById('appContent');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
}

function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    
    if (connected) {
        if (statusElement) {
            statusElement.innerHTML = '<i class="fas fa-circle online"></i> Online';
            statusElement.classList.remove('offline');
        }
        if (statusText) statusText.textContent = 'Online';
        if (statusDot) statusDot.className = 'status-dot online';
        isOnline = true;
    } else {
        if (statusElement) {
            statusElement.innerHTML = '<i class="fas fa-circle offline"></i> Offline';
            statusElement.classList.add('offline');
        }
        if (statusText) statusText.textContent = 'Offline';
        if (statusDot) statusDot.className = 'status-dot offline';
        isOnline = false;
    }
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

function addNotification(notification) {
    appState.notifications.unshift(notification);
    updateNotificationsUI();
}

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

// =============================================
// UTILITY FUNCTIONS
// =============================================
function copyUserId() {
    const userId = document.getElementById('userIdDisplay').textContent;
    navigator.clipboard.writeText(userId)
        .then(() => showToast('ID copied to clipboard', 'success'))
        .catch(err => {
            console.error('Failed to copy:', err);
            showToast('Failed to copy ID', 'error');
        });
}

function showShareModal() {
    const userId = localStorage.getItem('playSync_userId');
    const shareLink = `${window.location.origin}${window.location.pathname}?friend=${encodeURIComponent(userId)}`;
    
    const shareInput = document.getElementById('shareLink');
    const modal = document.getElementById('shareModal');
    
    if (shareInput && modal) {
        shareInput.value = shareLink;
        modal.classList.add('active');
    }
}

function copyShareLink() {
    const shareInput = document.getElementById('shareLink');
    if (shareInput) {
        shareInput.select();
        navigator.clipboard.writeText(shareInput.value)
            .then(() => showToast('Link copied to clipboard', 'success'));
    }
}

async function generateNewUserId() {
    if (!confirm('Generate a new user ID? This will disconnect you from your current friend.')) {
        return;
    }
    
    disconnectFromFriend();
    
    const newId = generateUserId();
    localStorage.setItem('playSync_userId', newId);
    
    const idDisplay = document.getElementById('userIdDisplay');
    if (idDisplay) idDisplay.textContent = newId;
    
    if (isFirebaseReady) {
        await updateUserInFirebase();
    }
    
    showToast('New ID generated', 'success');
}

function checkUrlForFriendId() {
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friend');
    
    if (friendId) {
        document.getElementById('friendId').value = friendId;
        showToast('Friend ID loaded from URL. Click Connect to proceed.', 'info');
    }
}

// =============================================
// CACHE MANAGEMENT
// =============================================
async function clearCache() {
    if (confirm('Clear all cache and restart app? This will log you out.')) {
        try {
            // Clear localStorage
            localStorage.clear();
            
            // Clear sessionStorage
            sessionStorage.clear();
            
            // Clear caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                console.log('Caches cleared:', cacheNames.length);
            }
            
            // Unregister service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
                console.log('Service workers unregistered:', registrations.length);
            }
            
            showToast('Cache cleared. Reloading...', 'success');
            
            // Force reload without cache
            setTimeout(() => {
                window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
            }, 1000);
            
        } catch (error) {
            console.error('Error clearing cache:', error);
            showToast('Error clearing cache', 'error');
        }
    }
}

// =============================================
// DEBUG FUNCTIONS
// =============================================
function showDebugInfo() {
    console.log('=== DEBUG INFO ===');
    console.log('App Version:', APP_VERSION);
    console.log('Firebase Ready:', isFirebaseReady);
    console.log('Online:', isOnline);
    console.log('Current User:', appState.currentUser);
    console.log('Friend:', appState.friend);
    console.log('Firebase Auth:', firebaseAuth?.currentUser);
    console.log('LocalStorage User ID:', localStorage.getItem('playSync_userId'));
    console.log('==================');
    
    showToast('Debug info logged to console', 'info');
}

// =============================================
// PWA INSTALLATION
// =============================================
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

function installPWA() {
    if (appState.deferredPrompt) {
        appState.deferredPrompt.prompt();
        appState.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                const installBtn = document.getElementById('installBtn');
                if (installBtn) {
                    installBtn.classList.add('hidden');
                }
            }
            appState.deferredPrompt = null;
        });
    }
}

// =============================================
// ONLINE/OFFLINE HANDLING
// =============================================
function handleOnline() {
    showToast('Back online', 'success');
    updateConnectionStatus(true);
}

function handleOffline() {
    showToast('You are offline', 'warning');
    updateConnectionStatus(false);
}

// =============================================
// CLEANUP ON EXIT
// =============================================
window.addEventListener('beforeunload', () => {
    if (isFirebaseReady && firebaseAuth.currentUser) {
        firebaseDatabase.ref('users/' + firebaseAuth.currentUser.uid).update({
            status: 'offline',
            lastSeen: Date.now()
        });
    }
    
    if (appState.friendListener) {
        appState.friendListener.off();
    }
});

// =============================================
// TEST FIREBASE CONNECTION
// =============================================
setTimeout(() => {
    if (isFirebaseReady && firebaseAuth.currentUser) {
        firebaseDatabase.ref('test/' + Date.now()).set({
            test: 'Firebase connection working',
            timestamp: Date.now()
        }).then(() => {
            console.log('Firebase test write successful');
        }).catch(error => {
            console.error('Firebase test write failed:', error);
        });
    }
}, 5000);
