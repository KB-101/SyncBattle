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
let app = null;
let auth = null;
let database = null;
let isFirebaseReady = false;

let appState = {
    currentUser: null,
    friend: null,
    friendRef: null,
    notifications: [],
    sessionId: generateSessionId()
};

// Games database
const games = {
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
    console.log('DOM loaded, starting app...');
    
    // Check if Firebase is loaded first
    if (typeof firebase === 'undefined') {
        console.error('Firebase not loaded!');
        showToast('Firebase SDK failed to load. Check internet connection.', 'error');
        showAppWithFallback();
        return;
    }
    
    initApp();
});

function showAppWithFallback() {
    // Hide loading, show app in offline mode
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    
    // Set user ID from localStorage or create one
    let userId = localStorage.getItem('playSync_userId');
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem('playSync_userId', userId);
    }
    
    document.getElementById('userIdDisplay').textContent = userId;
    document.getElementById('statusText').textContent = 'Offline (Demo Mode)';
    document.getElementById('statusDot').className = 'status-dot offline';
    
    showToast('Running in offline demo mode', 'warning');
}

async function initApp() {
    try {
        console.log('Step 1: Initializing Firebase...');
        await initFirebase();
        
        console.log('Step 2: Setting up user...');
        await initUser();
        
        console.log('Step 3: Setting up UI...');
        setupUI();
        
        console.log('Step 4: Checking URL parameters...');
        checkUrlParams();
        
        console.log('App ready!');
        
        // Hide loading, show app
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('appContent').style.display = 'block';
        
    } catch (error) {
        console.error('App initialization failed:', error);
        showAppWithFallback();
        showToast('App initialization failed: ' + error.message, 'error');
    }
}

// =============================================
// FIREBASE INITIALIZATION
// =============================================
function initFirebase() {
    return new Promise((resolve, reject) => {
        console.log('Initializing Firebase v8...');
        
        try {
            // Initialize Firebase
            app = firebase.initializeApp(firebaseConfig);
            console.log('Firebase app initialized');
            
            // Get auth and database
            auth = firebase.auth();
            database = firebase.database();
            
            console.log('Firebase modules loaded:', {
                auth: !!auth,
                database: !!database
            });
            
            // Sign in anonymously
            auth.signInAnonymously().then(function(userCredential) {
                console.log('Anonymous sign-in successful, UID:', userCredential.user.uid);
                
                // Set up auth state listener
                auth.onAuthStateChanged(function(user) {
                    if (user) {
                        console.log('User authenticated:', user.uid);
                        isFirebaseReady = true;
                        appState.currentUser = {
                            uid: user.uid,
                            isAnonymous: user.isAnonymous
                        };
                        
                        updateConnectionStatus(true);
                        showToast('Connected to PlaySync!', 'success');
                        
                        // Update user in database
                        updateUserInFirebase();
                        resolve();
                    } else {
                        console.log('No user signed in');
                        isFirebaseReady = false;
                        reject(new Error('Authentication failed'));
                    }
                });
                
            }).catch(function(error) {
                console.error('Anonymous sign-in failed:', error);
                isFirebaseReady = false;
                reject(error);
            });
            
            // Monitor connection status
            const connectedRef = database.ref('.info/connected');
            connectedRef.on('value', function(snap) {
                const connected = snap.val() === true;
                console.log('Firebase connection:', connected ? 'ONLINE' : 'OFFLINE');
                updateConnectionStatus(connected);
            });
            
        } catch (error) {
            console.error('Firebase initialization error:', error);
            isFirebaseReady = false;
            reject(error);
        }
    });
}

// =============================================
// USER MANAGEMENT
// =============================================
function initUser() {
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
    
    return Promise.resolve();
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

function updateUserInFirebase() {
    if (!isFirebaseReady || !auth.currentUser) {
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
    
    database.ref('users/' + auth.currentUser.uid).set(userData)
        .then(function() {
            console.log('User saved to Firebase');
            
            // Store in appState
            appState.currentUser = {
                uid: auth.currentUser.uid,
                ...userData
            };
        })
        .catch(function(error) {
            console.error('Error saving user to Firebase:', error);
        });
}

// =============================================
// UI SETUP
// =============================================
function setupUI() {
    console.log('Setting up UI event listeners...');
    
    // Copy ID button
    document.getElementById('copyIdBtn').addEventListener('click', copyUserId);
    
    // Share ID button
    document.getElementById('shareIdBtn').addEventListener('click', showShareModal);
    
    // New ID button
    document.getElementById('newIdBtn').addEventListener('click', generateNewUserId);
    
    // Connect button
    document.getElementById('connectBtn').addEventListener('click', connectToFriend);
    
    // Disconnect button
    document.getElementById('disconnectBtn').addEventListener('click', disconnectFriend);
    
    // Game buttons
    document.querySelectorAll('.challenge-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const gameCard = this.closest('.game-card');
            const gameType = gameCard.dataset.game;
            const gameId = gameCard.dataset.gameId;
            sendChallenge(gameType, gameId);
        });
    });
    
    // Custom game button
    document.getElementById('customChallengeBtn').addEventListener('click', function() {
        const gameId = document.getElementById('customGameId').value.trim();
        if (gameId) {
            sendChallenge('custom', gameId);
        } else {
            showToast('Please enter a game package ID', 'error');
        }
    });
    
    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });
    
    // Copy link button
    document.getElementById('copyLinkBtn').addEventListener('click', copyShareLink);
    
    // Game request buttons
    document.getElementById('acceptRequestBtn').addEventListener('click', acceptChallenge);
    document.getElementById('declineRequestBtn').addEventListener('click', declineChallenge);
    
    // User name change
    document.getElementById('userName').addEventListener('change', function(e) {
        localStorage.setItem('playSync_userName', e.target.value);
        if (isFirebaseReady) {
            updateUserInFirebase();
        }
    });
    
    // Setup friend listener if already connected
    if (appState.friend) {
        setupFriendListener();
    }
}

// =============================================
// CONNECTION STATUS
// =============================================
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    
    if (connected) {
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-circle online"></i> Online';
        if (statusText) statusText.textContent = 'Online';
        if (statusDot) statusDot.className = 'status-dot online';
        appState.isOnline = true;
    } else {
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-circle offline"></i> Offline';
        if (statusText) statusText.textContent = 'Offline';
        if (statusDot) statusDot.className = 'status-dot offline';
        appState.isOnline = false;
    }
}

// =============================================
// FRIEND CONNECTION
// =============================================
function connectToFriend() {
    const friendId = document.getElementById('friendId').value.trim();
    
    if (!friendId) {
        showToast('Please enter a friend ID', 'error');
        return;
    }
    
    if (!isFirebaseReady) {
        showToast('Cannot connect - Firebase not ready', 'error');
        return;
    }
    
    console.log('Searching for friend:', friendId);
    showToast('Searching for friend...', 'info');
    
    // Search all users for this public ID
    database.ref('users').once('value')
        .then(function(snapshot) {
            let friendFound = null;
            let friendUid = null;
            
            snapshot.forEach(function(childSnapshot) {
                const userData = childSnapshot.val();
                if (userData.publicId === friendId) {
                    friendFound = userData;
                    friendUid = childSnapshot.key;
                    return true; // Stop iterating
                }
            });
            
            if (friendFound && friendUid) {
                console.log('Friend found:', friendFound.name);
                
                // Store friend info
                appState.friend = {
                    uid: friendUid,
                    ...friendFound
                };
                
                // Setup real-time listener for friend
                setupFriendListener();
                
                // Update UI
                updateFriendInfo(friendFound);
                
                showToast(`Connected to ${friendFound.name}`, 'success');
                
            } else {
                showToast('Friend not found. Make sure they are online.', 'error');
            }
        })
        .catch(function(error) {
            console.error('Error connecting to friend:', error);
            showToast('Error connecting to friend', 'error');
        });
}

function setupFriendListener() {
    if (!appState.friend || !isFirebaseReady) return;
    
    // Remove old listener if exists
    if (appState.friendRef) {
        appState.friendRef.off();
    }
    
    // Setup new listener
    appState.friendRef = database.ref('users/' + appState.friend.uid);
    appState.friendRef.on('value', function(snapshot) {
        if (snapshot.exists()) {
            const friendData = snapshot.val();
            updateFriendInfo(friendData);
        } else {
            // Friend removed their account
            disconnectFriend();
            showToast('Friend disconnected', 'info');
        }
    });
    
    // Listen for game requests
    if (auth.currentUser) {
        const requestsRef = database.ref('requests/' + auth.currentUser.uid);
        requestsRef.orderByChild('status').equalTo('pending').on('child_added', function(snapshot) {
            const request = snapshot.val();
            request.id = snapshot.key;
            showRequestModal(request);
        });
    }
}

function updateFriendInfo(friendData) {
    const friendInfo = document.getElementById('friendInfo');
    const friendName = document.getElementById('friendName');
    const friendStatus = document.getElementById('friendStatusText');
    const friendDot = document.getElementById('friendStatusDot');
    
    if (friendInfo) friendInfo.classList.remove('hidden');
    if (friendName) friendName.textContent = friendData.name;
    
    const isOnline = friendData.status === 'online';
    if (friendStatus) friendStatus.textContent = isOnline ? 'Online' : 'Offline';
    if (friendDot) friendDot.className = 'status-dot ' + (isOnline ? 'online' : 'offline');
}

function disconnectFriend() {
    if (appState.friendRef) {
        appState.friendRef.off();
        appState.friendRef = null;
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
function sendChallenge(gameType, gameId) {
    if (!appState.friend) {
        showToast('Connect to a friend first', 'error');
        return;
    }
    
    if (!isFirebaseReady) {
        showToast('Cannot send challenge - offline', 'error');
        return;
    }
    
    const gameInfo = games[gameType] || {
        name: 'Custom Game',
        packageId: gameId,
        storeUrl: 'https://play.google.com/store/apps/details?id=' + gameId,
        intentUrl: 'intent://details?id=' + gameId + '#Intent;scheme=market;end'
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
    
    database.ref('requests/' + appState.friend.uid + '/' + requestId).set(requestData)
        .then(function() {
            showToast(`Challenge sent to ${appState.friend.name}`, 'success');
            
            // Add notification
            addNotification({
                type: 'sent',
                message: `You challenged ${appState.friend.name} to ${gameInfo.name}`,
                timestamp: Date.now()
            });
        })
        .catch(function(error) {
            console.error('Error sending challenge:', error);
            showToast('Failed to send challenge', 'error');
        });
}

// =============================================
// REQUEST HANDLING
// =============================================
function showRequestModal(request) {
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
    setTimeout(function() {
        if (modal.classList.contains('active')) {
            declineChallenge();
        }
    }, 30000);
}

function acceptChallenge() {
    const modal = document.getElementById('gameRequestModal');
    if (!modal || !isFirebaseReady) return;
    
    const requestId = modal.dataset.requestId;
    const senderUid = modal.dataset.senderUid;
    const gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    // Update request status
    database.ref('requests/' + auth.currentUser.uid + '/' + requestId).update({
        status: 'accepted',
        respondedAt: Date.now()
    })
    .then(function() {
        // Open game
        openGame(gameInfo);
        
        // Add notification
        addNotification({
            type: 'accepted',
            message: `You accepted ${gameInfo.fromName}'s challenge to ${gameInfo.gameName}`,
            timestamp: Date.now()
        });
        
        showToast('Challenge accepted! Opening game...', 'success');
        modal.classList.remove('active');
    })
    .catch(function(error) {
        console.error('Error accepting challenge:', error);
        showToast('Error accepting challenge', 'error');
    });
}

function declineChallenge() {
    const modal = document.getElementById('gameRequestModal');
    if (!modal || !isFirebaseReady) return;
    
    const requestId = modal.dataset.requestId;
    const senderUid = modal.dataset.senderUid;
    const gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    database.ref('requests/' + auth.currentUser.uid + '/' + requestId).update({
        status: 'declined',
        respondedAt: Date.now()
    })
    .then(function() {
        addNotification({
            type: 'declined',
            message: `You declined ${gameInfo.fromName}'s challenge to ${gameInfo.gameName}`,
            timestamp: Date.now()
        });
        
        showToast('Challenge declined', 'info');
        modal.classList.remove('active');
    })
    .catch(function(error) {
        console.error('Error declining challenge:', error);
        modal.classList.remove('active');
    });
}

function openGame(gameInfo) {
    // Try intent URL first (Android app)
    const intentUrl = gameInfo.intentUrl || `intent://details?id=${gameInfo.gamePackageId}#Intent;scheme=market;end`;
    
    // Fallback to Play Store
    const storeUrl = gameInfo.storeUrl || `https://play.google.com/store/apps/details?id=${gameInfo.gamePackageId}`;
    
    console.log('Opening game:', gameInfo.gameName);
    
    // Try intent URL
    window.location.href = intentUrl;
    
    // If intent fails, open Play Store
    setTimeout(function() {
        window.open(storeUrl, '_blank');
    }, 500);
}

// =============================================
// UTILITY FUNCTIONS
// =============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
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
    setTimeout(function() {
        toast.style.opacity = '0';
        setTimeout(function() {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

function copyUserId() {
    const userId = document.getElementById('userIdDisplay').textContent;
    navigator.clipboard.writeText(userId).then(function() {
        showToast('ID copied to clipboard', 'success');
    }).catch(function(err) {
        console.error('Failed to copy:', err);
        showToast('Failed to copy ID', 'error');
    });
}

function showShareModal() {
    const userId = localStorage.getItem('playSync_userId');
    const shareLink = window.location.origin + window.location.pathname + '?friend=' + encodeURIComponent(userId);
    
    const shareInput = document.getElementById('shareLink');
    const modal = document.getElementById('shareModal');
    
    if (shareInput) shareInput.value = shareLink;
    if (modal) modal.classList.add('active');
}

function copyShareLink() {
    const shareInput = document.getElementById('shareLink');
    if (shareInput) {
        shareInput.select();
        navigator.clipboard.writeText(shareInput.value).then(function() {
            showToast('Link copied to clipboard', 'success');
        });
    }
}

function generateNewUserId() {
    if (!confirm('Generate a new user ID? This will disconnect you from your current friend.')) {
        return;
    }
    
    disconnectFriend();
    
    const newId = generateUserId();
    localStorage.setItem('playSync_userId', newId);
    
    const idDisplay = document.getElementById('userIdDisplay');
    if (idDisplay) idDisplay.textContent = newId;
    
    if (isFirebaseReady) {
        updateUserInFirebase();
    }
    
    showToast('New ID generated', 'success');
}

function addNotification(notification) {
    appState.notifications.unshift(notification);
    updateNotifications();
}

function updateNotifications() {
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
    
    container.innerHTML = appState.notifications.map(function(notif) {
        return `
            <div class="notification-item ${notif.type}">
                <div class="notification-content">
                    <p>${notif.message}</p>
                    <small>${new Date(notif.timestamp).toLocaleTimeString()}</small>
                </div>
            </div>
        `;
    }).join('');
}

function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friend');
    
    if (friendId) {
        document.getElementById('friendId').value = friendId;
        showToast('Friend ID loaded from URL. Click Connect to proceed.', 'info');
    }
}

// =============================================
// CLEANUP
// =============================================
window.addEventListener('beforeunload', function() {
    if (isFirebaseReady && auth.currentUser) {
        database.ref('users/' + auth.currentUser.uid).update({
            status: 'offline',
            lastSeen: Date.now()
        });
    }
    
    if (appState.friendRef) {
        appState.friendRef.off();
    }
});

// Online/offline detection
window.addEventListener('online', function() {
    showToast('Back online', 'success');
    updateConnectionStatus(true);
});

window.addEventListener('offline', function() {
    showToast('You are offline', 'warning');
    updateConnectionStatus(false);
});

// =============================================
// DEBUG FUNCTION
// =============================================
function testFirebase() {
    console.log('=== FIREBASE TEST ===');
    console.log('Firebase loaded:', typeof firebase !== 'undefined');
    console.log('Firebase SDK version:', firebase.SDK_VERSION);
    console.log('Firebase auth:', firebase.auth);
    console.log('Firebase database:', firebase.database);
    console.log('Current user:', auth?.currentUser);
    console.log('Firebase ready:', isFirebaseReady);
    console.log('=====================');
    
    // Test database write
    if (auth?.currentUser) {
        database.ref('test/' + Date.now()).set({
            test: 'Firebase is working!',
            timestamp: Date.now()
        }).then(function() {
            console.log('Firebase write test: SUCCESS');
            showToast('Firebase connection test: PASSED', 'success');
        }).catch(function(error) {
            console.error('Firebase write test: FAILED', error);
            showToast('Firebase connection test: FAILED', 'error');
        });
    }
}

// Run test after 3 seconds
setTimeout(testFirebase, 3000);
