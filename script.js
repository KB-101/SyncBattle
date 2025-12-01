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

// ====================
// GLOBAL VARIABLES
// ====================
let app = null;
let auth = null;
let database = null;
let isFirebaseInitialized = false;
let firebaseConnectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

// App State
let appState = {
    currentUser: null,
    friend: null,
    friendConnectionRef: null,
    notifications: [],
    deferredPrompt: null,
    sessionId: generateSessionId(),
    isOnline: false,
    firebaseReady: false
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

// ====================
// INITIALIZATION
// ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    showLoading('Starting PlaySync Arena...');
    initializeApp();
});

async function initializeApp() {
    try {
        console.log('Step 1: Initializing Firebase...');
        await initializeFirebase();
        
        console.log('Step 2: Initializing User...');
        await initializeUser();
        
        console.log('Step 3: Setting up event listeners...');
        setupEventListeners();
        
        console.log('Step 4: Setting up Firebase listeners...');
        setupFirebaseListeners();
        
        console.log('Step 5: Checking URL for friend ID...');
        checkUrlForFriendId();
        
        console.log('Step 6: Setting up PWA...');
        setupPWAInstall();
        
        console.log('Step 7: Updating connection status...');
        updateConnectionStatus(true);
        
        console.log('App initialization complete!');
        hideLoading();
        
    } catch (error) {
        console.error('App initialization failed:', error);
        showToast('App initialization failed: ' + error.message, 'error');
        hideLoading();
    }
}

// ====================
// FIREBASE INITIALIZATION
// ====================
async function initializeFirebase() {
    return new Promise(async (resolve, reject) => {
        try {
            showLoading('Connecting to Firebase...');
            
            // Check if Firebase is available
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK not loaded. Check your internet connection.');
            }
            
            console.log('Firebase SDK loaded:', firebase.SDK_VERSION);
            
            // Initialize Firebase app
            if (!firebase.apps.length) {
                app = firebase.initializeApp(firebaseConfig);
                console.log('Firebase app initialized');
            } else {
                app = firebase.app();
                console.log('Using existing Firebase app');
            }
            
            // Get auth and database instances
            auth = firebase.auth();
            database = firebase.database();
            
            // Test database connection
            const testRef = database.ref('.info/connected');
            testRef.on('value', (snapshot) => {
                const connected = snapshot.val();
                console.log('Firebase connection status:', connected);
                appState.isOnline = connected;
                updateConnectionStatus(connected);
                
                if (connected) {
                    showLoading('Authenticating...');
                }
            });
            
            // Sign in anonymously
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('User authenticated:', user.uid);
                    appState.currentUser = {
                        uid: user.uid,
                        isAnonymous: user.isAnonymous
                    };
                    isFirebaseInitialized = true;
                    appState.firebaseReady = true;
                    
                    // Update user in database
                    await updateUserInFirebase();
                    
                    showLoading('Firebase connected!');
                    setTimeout(() => {
                        showToast('Connected to PlaySync!', 'success');
                        resolve();
                    }, 1000);
                    
                } else {
                    // No user, try to sign in anonymously
                    try {
                        const result = await auth.signInAnonymously();
                        console.log('Anonymous sign-in successful:', result.user.uid);
                    } catch (authError) {
                        console.error('Anonymous sign-in failed:', authError);
                        showToast('Using offline mode', 'warning');
                        isFirebaseInitialized = false;
                        resolve(); // Continue without Firebase
                    }
                }
            });
            
            // Set timeout for Firebase initialization
            setTimeout(() => {
                if (!isFirebaseInitialized) {
                    console.warn('Firebase initialization timeout');
                    showToast('Using limited offline mode', 'warning');
                    resolve(); // Continue anyway
                }
            }, 10000);
            
        } catch (error) {
            console.error('Firebase initialization error:', error);
            showToast('Firebase connection failed. Using offline mode.', 'warning');
            isFirebaseInitialized = false;
            resolve(); // Continue without Firebase
        }
    });
}

// ====================
// USER MANAGEMENT
// ====================
async function initializeUser() {
    // Load or create user ID
    let userId = localStorage.getItem('playSync_userId');
    let userName = localStorage.getItem('playSync_userName') || 'Player';
    
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem('playSync_userId', userId);
        console.log('Generated new user ID:', userId);
    }
    
    // Update UI
    document.getElementById('userIdDisplay').textContent = userId;
    document.getElementById('userName').value = userName;
    
    // Save to Firebase if connected
    if (isFirebaseInitialized) {
        await updateUserInFirebase();
    }
    
    // Listen for name changes
    document.getElementById('userName').addEventListener('change', async (e) => {
        localStorage.setItem('playSync_userName', e.target.value);
        if (isFirebaseInitialized) {
            await updateUserInFirebase();
        }
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
    if (!isFirebaseInitialized || !auth.currentUser) {
        console.log('Skipping Firebase update - not connected');
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
        await database.ref(`users/${auth.currentUser.uid}`).set(userData);
        console.log('User updated in Firebase');
        
        // Store in appState
        appState.currentUser = {
            uid: auth.currentUser.uid,
            ...userData
        };
        
    } catch (error) {
        console.error('Error updating user in Firebase:', error);
    }
}

// ====================
// EVENT LISTENERS
// ====================
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
    
    // Game challenge buttons
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
    
    // Modal close buttons
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

// ====================
// FIREBASE LISTENERS
// ====================
function setupFirebaseListeners() {
    if (!isFirebaseInitialized) {
        console.log('Skipping Firebase listeners - not connected');
        return;
    }
    
    // Listen for friend status if connected
    if (appState.friend) {
        setupFriendListener();
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

function setupFriendListener() {
    if (!isFirebaseInitialized || !appState.friend) return;
    
    if (appState.friendConnectionRef) {
        appState.friendConnectionRef.off();
    }
    
    appState.friendConnectionRef = database.ref(`users/${appState.friend.uid}`);
    appState.friendConnectionRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const friendData = snapshot.val();
            updateFriendInfo(friendData);
        } else {
            clearFriendInfo();
            showToast('Friend disconnected', 'info');
        }
    });
}

// ====================
// FRIEND CONNECTION
// ====================
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
    
    showLoading('Searching for friend...');
    
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
            setupFriendListener();
            
            showToast(`Connected to ${friendData.name}`, "success");
            hideLoading();
            
        } else {
            hideLoading();
            showToast("Friend not found. Make sure they're online and have shared their ID.", "error");
        }
        
    } catch (error) {
        console.error("Error connecting to friend:", error);
        hideLoading();
        showToast("Error connecting to friend. Check your connection.", "error");
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
    
    if (friendInfoDiv && friendNameSpan && friendStatusText && friendStatusDot) {
        friendInfoDiv.classList.remove('hidden');
        friendNameSpan.textContent = friendData.name;
        
        const isOnline = friendData.status === 'online';
        friendStatusText.textContent = isOnline ? 'Online' : 'Offline';
        friendStatusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    }
}

function clearFriendInfo() {
    const friendInfoDiv = document.getElementById('friendInfo');
    if (friendInfoDiv) {
        friendInfoDiv.classList.add('hidden');
    }
    document.getElementById('friendId').value = '';
}

// ====================
// GAME CHALLENGES
// ====================
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

// ====================
// UI FUNCTIONS
// ====================
function updateConnectionStatus(connected = false) {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    
    if (connected) {
        if (statusElement) statusElement.innerHTML = '<i class="fas fa-circle online"></i> Online';
        if (statusText) statusText.textContent = 'Online';
        if (statusDot) statusDot.className = 'status-dot online';
        appState.isOnline = true;
    } else {
        if (statusElement) statusElement.innerHTML = '<i class="fas fa-circle offline"></i> Offline';
        if (statusText) statusText.textContent = 'Offline';
        if (statusDot) statusDot.className = 'status-dot offline';
        appState.isOnline = false;
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
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

function showLoading(message = '') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    
    if (overlay) {
        overlay.style.display = 'flex';
    }
    
    if (messageEl && message) {
        messageEl.textContent = message;
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 500);
    }
}

// ====================
// UTILITY FUNCTIONS
// ====================
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
        
        if (isFirebaseInitialized) {
            await updateUserInFirebase();
        }
        showToast("New ID generated", "success");
    }
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

function checkUrlForFriendId() {
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friend');
    
    if (friendId) {
        document.getElementById('friendId').value = friendId;
        showToast("Friend ID loaded from URL. Click Connect to proceed.", "info");
    }
}

// ====================
// GAME REQUEST MODAL
// ====================
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

async function acceptGameRequest() {
    const modal = document.getElementById('gameRequestModal');
    if (!modal || !isFirebaseInitialized) return;
    
    const requestId = modal.dataset.requestId;
    const senderUid = modal.dataset.senderUid;
    const gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    try {
        // Update request status
        await database.ref(`requests/${auth.currentUser.uid}/${requestId}`).update({
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
        
        showToast("Challenge accepted! Opening game...", "success");
        modal.classList.remove('active');
        
    } catch (error) {
        console.error("Error accepting request:", error);
        showToast("Error accepting challenge", "error");
    }
}

async function declineGameRequest() {
    const modal = document.getElementById('gameRequestModal');
    if (!modal || !isFirebaseInitialized) return;
    
    const requestId = modal.dataset.requestId;
    const senderUid = modal.dataset.senderUid;
    const gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    try {
        await database.ref(`requests/${auth.currentUser.uid}/${requestId}`).update({
            status: 'declined',
            respondedAt: Date.now()
        });
        
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

function openAndroidGame(gameInfo) {
    const intentUrl = gameInfo.intentUrl || `intent://details?id=${gameInfo.gamePackageId}#Intent;scheme=market;end`;
    const storeUrl = gameInfo.storeUrl || `https://play.google.com/store/apps/details?id=${gameInfo.gamePackageId}`;
    
    // Try to open with intent (Android app)
    window.location.href = intentUrl;
    
    // Fallback to Play Store after delay
    setTimeout(() => {
        window.open(storeUrl, '_blank');
    }, 500);
}

// ====================
// PWA INSTALLATION
// ====================
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

// ====================
// SERVICE WORKER
// ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// ====================
// CLEANUP ON EXIT
// ====================
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

// Handle online/offline events
window.addEventListener('online', () => {
    showToast("Back online", "success");
    updateConnectionStatus(true);
});

window.addEventListener('offline', () => {
    showToast("You're offline", "warning");
    updateConnectionStatus(false);
});

// ====================
// DEBUG FUNCTIONS
// ====================
function testFirebaseConnection() {
    console.log('=== FIREBASE CONNECTION TEST ===');
    console.log('Firebase SDK loaded:', typeof firebase !== 'undefined');
    console.log('Firebase app:', app);
    console.log('Auth:', auth);
    console.log('Database:', database);
    console.log('Current user:', auth?.currentUser);
    console.log('Firebase initialized:', isFirebaseInitialized);
    console.log('==============================');
    
    // Test database write
    if (auth.currentUser) {
        const testRef = database.ref('test');
        testRef.set({
            test: 'Firebase is working!',
            timestamp: Date.now()
        }).then(() => {
            console.log('Firebase write successful!');
            showToast('Firebase connection test: PASSED', 'success');
        }).catch(error => {
            console.error('Firebase write failed:', error);
            showToast('Firebase connection test: FAILED', 'error');
        });
    }
}

// Run connection test on page load (for debugging)
setTimeout(() => {
    testFirebaseConnection();
}, 3000);
