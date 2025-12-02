const APP_VERSION = '1.0.1';
const BUILD_TIME = Date.now();

console.log(`PlaySync Arena v${APP_VERSION} (${BUILD_TIME})`);

// Auto-clear old service workers
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            registrations.forEach(function(registration) {
                // Keep only if it's the current version
                if (!registration.scope.includes(`v=${APP_VERSION}`)) {
                    registration.unregister();
                    console.log('Unregistered old service worker');
                }
            });
        });
    });
}

// Clear old caches on load
if ('caches' in window) {
    caches.keys().then(function(cacheNames) {
        cacheNames.forEach(function(cacheName) {
            // Delete caches that don't match current version
            if (!cacheName.includes(APP_VERSION)) {
                caches.delete(cacheName);
                console.log('Deleted old cache:', cacheName);
            }
        });
    });
}
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
// GLOBAL VARIABLES
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
    sessionId: generateSessionId(),
    isOnline: false
};

// Games database
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

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    initializeApp();
});

function initializeApp() {
    console.log('Initializing app...');
    
    // Show loading screen
    showLoadingScreen();
    
    // Initialize Firebase
    initializeFirebase();
    
    // Initialize user (even if Firebase fails)
    initializeUser();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check URL for friend ID
    checkUrlForFriendId();
    
    // Setup PWA install
    setupPWAInstall();
}

// =============================================
// FIREBASE INITIALIZATION
// =============================================
function initializeFirebase() {
    console.log('Initializing Firebase...');
    
    try {
        // Check if Firebase is loaded
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded');
            showToast('Firebase SDK not loaded. Using offline mode.', 'warning');
            hideLoadingScreen();
            return;
        }
        
        console.log('Firebase SDK version:', firebase.SDK_VERSION);
        
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
        
        // Check if modules are available
        if (!auth || !database) {
            throw new Error('Firebase modules not loaded');
        }
        
        console.log('Firebase auth and database loaded');
        
        // Sign in anonymously
        auth.signInAnonymously().then(function(userCredential) {
            console.log('Anonymous sign-in successful:', userCredential.user.uid);
            
            // Set up auth state listener
            auth.onAuthStateChanged(function(user) {
                if (user) {
                    console.log('User authenticated:', user.uid);
                    isFirebaseReady = true;
                    appState.currentUser = {
                        uid: user.uid,
                        isAnonymous: user.isAnonymous
                    };
                    
                    // Update user in database
                    updateUserInFirebase();
                    
                    // Update connection status
                    updateConnectionStatus(true);
                    showToast('Connected to PlaySync!', 'success');
                    
                    // Setup Firebase listeners
                    setupFirebaseListeners();
                    
                    // Hide loading screen
                    hideLoadingScreen();
                    
                } else {
                    console.log('No user signed in');
                    isFirebaseReady = false;
                    hideLoadingScreen();
                }
            });
            
        }).catch(function(error) {
            console.error('Anonymous sign-in failed:', error);
            showToast('Using offline mode', 'warning');
            isFirebaseReady = false;
            hideLoadingScreen();
        });
        
        // Monitor connection status
        const connectedRef = database.ref('.info/connected');
        connectedRef.on('value', function(snapshot) {
            const connected = snapshot.val() === true;
            console.log('Firebase connection:', connected ? 'ONLINE' : 'OFFLINE');
            appState.isOnline = connected;
            updateConnectionStatus(connected);
        });
        
    } catch (error) {
        console.error('Firebase initialization error:', error);
        showToast('Firebase failed. Using offline mode.', 'warning');
        isFirebaseReady = false;
        hideLoadingScreen();
    }
}

// =============================================
// USER MANAGEMENT
// =============================================
function initializeUser() {
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
    document.getElementById('userIdDisplay').textContent = userId;
    document.getElementById('userName').value = userName;
    
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
            console.log('User updated in Firebase');
            
            // Store in appState
            appState.currentUser = {
                uid: auth.currentUser.uid,
                ...userData
            };
        })
        .catch(function(error) {
            console.error('Error updating user in Firebase:', error);
        });
}

// =============================================
// EVENT LISTENERS
// =============================================
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
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
    var challengeButtons = document.querySelectorAll('.challenge-btn');
    challengeButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            var gameCard = this.closest('.game-card');
            var gameType = gameCard.dataset.game;
            var gameId = gameCard.dataset.gameId;
            sendGameChallenge(gameType, gameId);
        });
    });
    
    // Custom challenge button
    document.getElementById('customChallengeBtn').addEventListener('click', function() {
        var customGameId = document.getElementById('customGameId').value.trim();
        if (customGameId) {
            sendGameChallenge('custom', customGameId);
        } else {
            showToast("Please enter a game package ID", "error");
        }
    });
    
    // Install button
    var installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', installPWA);
    }
    
    // Modal close buttons
    var closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var modals = document.querySelectorAll('.modal');
            modals.forEach(function(modal) {
                modal.classList.remove('active');
            });
        });
    });
    
    // Copy link button
    var copyLinkBtn = document.getElementById('copyLinkBtn');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', copyShareLink);
    }
    
    // Game request buttons
    var acceptBtn = document.getElementById('acceptRequestBtn');
    var declineBtn = document.getElementById('declineRequestBtn');
    if (acceptBtn) acceptBtn.addEventListener('click', acceptGameRequest);
    if (declineBtn) declineBtn.addEventListener('click', declineGameRequest);
    
    // User name change
    document.getElementById('userName').addEventListener('change', function(e) {
        localStorage.setItem('playSync_userName', e.target.value);
        if (isFirebaseReady) {
            updateUserInFirebase();
        }
    });
}
// Clear cache button
    document.getElementById('clearCacheBtn').addEventListener('click', function() {
        if (confirm('Clear cache and reload app?')) {
            clearAppCache();
        }
    });
}

// Cache clearing function
function clearAppCache() {
    console.log('Clearing app cache...');
    
    // Show loading
    showToast('Clearing cache...', 'info');
    
    // Unregister service workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            registrations.forEach(function(registration) {
                registration.unregister();
                console.log('Unregistered service worker');
            });
        });
    }
    
    // Clear all caches
    if ('caches' in window) {
        caches.keys().then(function(cacheNames) {
            cacheNames.forEach(function(cacheName) {
                caches.delete(cacheName);
                console.log('Deleted cache:', cacheName);
            });
        });
    }
    
    // Clear localStorage (keep user data)
    const userId = localStorage.getItem('playSync_userId');
    const userName = localStorage.getItem('playSync_userName');
    localStorage.clear();
    
    // Restore user data
    if (userId) localStorage.setItem('playSync_userId', userId);
    if (userName) localStorage.setItem('playSync_userName', userName);
    
    // Reload with cache busting
    setTimeout(function() {
        showToast('Cache cleared! Reloading...', 'success');
        window.location.href = window.location.href.split('?')[0] + '?v=' + APP_VERSION + '&t=' + Date.now();
    }, 1000);
}

// =============================================
// FIREBASE LISTENERS
// =============================================
function setupFirebaseListeners() {
    if (!isFirebaseReady) {
        console.log('Skipping Firebase listeners - not connected');
        return;
    }
    
    // Listen for friend status if connected
    if (appState.friend) {
        setupFriendListener();
    }
    
    // Listen for incoming game requests
    if (auth.currentUser) {
        database.ref('requests/' + auth.currentUser.uid)
            .orderByChild('status')
            .equalTo('pending')
            .on('child_added', function(snapshot) {
                var request = snapshot.val();
                request.id = snapshot.key;
                showGameRequestModal(request);
            });
    }
}

function setupFriendListener() {
    if (!isFirebaseReady || !appState.friend) return;
    
    if (appState.friendRef) {
        appState.friendRef.off();
    }
    
    appState.friendRef = database.ref('users/' + appState.friend.uid);
    appState.friendRef.on('value', function(snapshot) {
        if (snapshot.exists()) {
            var friendData = snapshot.val();
            updateFriendInfo(friendData);
        } else {
            clearFriendInfo();
            showToast('Friend disconnected', 'info');
        }
    });
}

// =============================================
// FRIEND CONNECTION
// =============================================
function connectToFriend() {
    var friendPublicId = document.getElementById('friendId').value.trim();
    
    if (!friendPublicId) {
        showToast("Please enter a friend ID", "error");
        return;
    }
    
    if (!isFirebaseReady) {
        showToast("Cannot connect - Firebase not available", "error");
        return;
    }
    
    showToast('Searching for friend...', 'info');
    
    // Search for friend by public ID
    database.ref('users').once('value')
        .then(function(snapshot) {
            var friendUid = null;
            var friendData = null;
            
            snapshot.forEach(function(childSnapshot) {
                var userData = childSnapshot.val();
                if (userData.publicId === friendPublicId) {
                    friendUid = childSnapshot.key;
                    friendData = userData;
                    return true; // Stop iterating
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
                
                showToast('Connected to ' + friendData.name, 'success');
                
            } else {
                showToast("Friend not found. Make sure they're online and have shared their ID.", "error");
            }
        })
        .catch(function(error) {
            console.error("Error connecting to friend:", error);
            showToast("Error connecting to friend. Check your connection.", "error");
        });
}

function disconnectFromFriend() {
    if (appState.friendRef) {
        appState.friendRef.off();
        appState.friendRef = null;
    }
    
    appState.friend = null;
    clearFriendInfo();
    showToast("Disconnected from friend", "info");
}

function updateFriendInfo(friendData) {
    var friendInfoDiv = document.getElementById('friendInfo');
    var friendNameSpan = document.getElementById('friendName');
    var friendStatusText = document.getElementById('friendStatusText');
    var friendStatusDot = document.getElementById('friendStatusDot');
    
    if (friendInfoDiv && friendNameSpan && friendStatusText && friendStatusDot) {
        friendInfoDiv.classList.remove('hidden');
        friendNameSpan.textContent = friendData.name;
        
        var isOnline = friendData.status === 'online';
        friendStatusText.textContent = isOnline ? 'Online' : 'Offline';
        friendStatusDot.className = 'status-dot ' + (isOnline ? 'online' : 'offline');
    }
}

function clearFriendInfo() {
    var friendInfoDiv = document.getElementById('friendInfo');
    if (friendInfoDiv) {
        friendInfoDiv.classList.add('hidden');
    }
    document.getElementById('friendId').value = '';
}

// =============================================
// GAME CHALLENGES
// =============================================
function sendGameChallenge(gameType, gameId) {
    if (!appState.friend) {
        showToast("Connect to a friend first", "error");
        return;
    }
    
    if (!isFirebaseReady) {
        showToast("Cannot send challenge - offline mode", "error");
        return;
    }
    
    var gameInfo = gamesDatabase[gameType] || {
        name: 'Custom Game',
        packageId: gameId,
        storeUrl: 'https://play.google.com/store/apps/details?id=' + gameId,
        intentUrl: 'intent://details?id=' + gameId + '#Intent;scheme=market;end'
    };
    
    var requestId = 'req_' + Date.now();
    var requestData = {
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
            showToast('Challenge sent to ' + appState.friend.name, 'success');
            addNotification({
                type: 'sent',
                message: 'You challenged ' + appState.friend.name + ' to ' + gameInfo.name,
                timestamp: Date.now()
            });
        })
        .catch(function(error) {
            console.error("Error sending challenge:", error);
            showToast("Failed to send challenge", "error");
        });
}

// =============================================
// UI FUNCTIONS
// =============================================
function updateConnectionStatus(connected) {
    var statusElement = document.getElementById('connectionStatus');
    var statusText = document.getElementById('statusText');
    var statusDot = document.getElementById('statusDot');
    
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

function showToast(message, type) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    var icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = '<i class="fas fa-' + icon + '"></i><span>' + message + '</span>';
    
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

function showLoadingScreen() {
    // Already showing from HTML
}

function hideLoadingScreen() {
    var loadingScreen = document.getElementById('loadingScreen');
    var appContent = document.getElementById('appContent');
    
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    if (appContent) {
        appContent.style.display = 'block';
    }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================
function copyUserId() {
    var userId = document.getElementById('userIdDisplay').textContent;
    navigator.clipboard.writeText(userId).then(function() {
        showToast("ID copied to clipboard", "success");
    }).catch(function(err) {
        console.error('Failed to copy: ', err);
        showToast("Failed to copy ID", "error");
    });
}

function showShareModal() {
    var userId = localStorage.getItem('playSync_userId');
    var shareLink = window.location.origin + window.location.pathname + '?friend=' + encodeURIComponent(userId);
    
    var shareLinkInput = document.getElementById('shareLink');
    var shareModal = document.getElementById('shareModal');
    
    if (shareLinkInput && shareModal) {
        shareLinkInput.value = shareLink;
        shareModal.classList.add('active');
    }
}

function copyShareLink() {
    var shareLinkInput = document.getElementById('shareLink');
    if (shareLinkInput) {
        shareLinkInput.select();
        navigator.clipboard.writeText(shareLinkInput.value).then(function() {
            showToast("Link copied to clipboard", "success");
        });
    }
}

function generateNewUserId() {
    var confirm = window.confirm("Generate a new user ID? This will disconnect you from current friend.");
    
    if (confirm) {
        disconnectFromFriend();
        
        var newId = generateUserId();
        localStorage.setItem('playSync_userId', newId);
        document.getElementById('userIdDisplay').textContent = newId;
        
        if (isFirebaseReady) {
            updateUserInFirebase();
        }
        showToast("New ID generated", "success");
    }
}

function addNotification(notification) {
    appState.notifications.unshift(notification);
    updateNotificationsUI();
}

function updateNotificationsUI() {
    var container = document.getElementById('notificationsList');
    if (!container) return;
    
    if (appState.notifications.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No notifications yet</p></div>';
        return;
    }
    
    var notificationsHTML = appState.notifications.map(function(notif) {
        return '<div class="notification-item ' + notif.type + '"><div class="notification-content"><p>' + notif.message + '</p><small>' + new Date(notif.timestamp).toLocaleTimeString() + '</small></div></div>';
    }).join('');
    
    container.innerHTML = notificationsHTML;
}

function checkUrlForFriendId() {
    var urlParams = new URLSearchParams(window.location.search);
    var friendId = urlParams.get('friend');
    
    if (friendId) {
        document.getElementById('friendId').value = friendId;
        showToast("Friend ID loaded from URL. Click Connect to proceed.", "info");
    }
}

// =============================================
// GAME REQUEST MODAL
// =============================================
function showGameRequestModal(request) {
    var modal = document.getElementById('gameRequestModal');
    var message = document.getElementById('requestMessage');
    
    if (!modal || !message) return;
    
    message.innerHTML = '<strong>' + request.fromName + '</strong> wants to play <strong>' + request.gameName + '</strong> with you!<br><br><small>Game ID: ' + request.gamePackageId + '</small>';
    
    modal.dataset.requestId = request.id;
    modal.dataset.senderUid = request.from;
    modal.dataset.gameInfo = JSON.stringify(request);
    
    modal.classList.add('active');
    
    // Auto-decline after 30 seconds
    setTimeout(function() {
        if (modal.classList.contains('active')) {
            declineGameRequest();
        }
    }, 30000);
}

function acceptGameRequest() {
    var modal = document.getElementById('gameRequestModal');
    if (!modal || !isFirebaseReady) return;
    
    var requestId = modal.dataset.requestId;
    var gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    // Update request status
    database.ref('requests/' + auth.currentUser.uid + '/' + requestId).update({
        status: 'accepted',
        respondedAt: Date.now()
    })
    .then(function() {
        // Add notification
        addNotification({
            type: 'accepted',
            message: 'You accepted ' + gameInfo.fromName + "'s challenge to " + gameInfo.gameName,
            timestamp: Date.now()
        });
        
        // Open the game
        openAndroidGame(gameInfo);
        
        showToast("Challenge accepted! Opening game...", "success");
        modal.classList.remove('active');
    })
    .catch(function(error) {
        console.error("Error accepting request:", error);
        showToast("Error accepting challenge", "error");
    });
}

function declineGameRequest() {
    var modal = document.getElementById('gameRequestModal');
    if (!modal || !isFirebaseReady) return;
    
    var requestId = modal.dataset.requestId;
    var gameInfo = JSON.parse(modal.dataset.gameInfo);
    
    database.ref('requests/' + auth.currentUser.uid + '/' + requestId).update({
        status: 'declined',
        respondedAt: Date.now()
    })
    .then(function() {
        addNotification({
            type: 'declined',
            message: 'You declined ' + gameInfo.fromName + "'s challenge to " + gameInfo.gameName,
            timestamp: Date.now()
        });
        
        showToast("Challenge declined", "info");
        modal.classList.remove('active');
    })
    .catch(function(error) {
        console.error("Error declining request:", error);
        modal.classList.remove('active');
    });
}

function openAndroidGame(gameInfo) {
    // Try to open with intent:// URL (Android app)
    var intentUrl = gameInfo.intentUrl || 'intent://details?id=' + gameInfo.gamePackageId + '#Intent;scheme=market;end';
    
    // Fallback to Play Store URL
    var storeUrl = gameInfo.storeUrl || 'https://play.google.com/store/apps/details?id=' + gameInfo.gamePackageId;
    
    console.log("Opening game:", gameInfo.gameName, "URL:", intentUrl);
    
    // Try intent first, then fallback to Play Store
    window.location.href = intentUrl;
    
    // If intent fails, open Play Store after a delay
    setTimeout(function() {
        window.open(storeUrl, '_blank');
    }, 500);
}

// =============================================
// PWA INSTALLATION
// =============================================
function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        appState.deferredPrompt = e;
        var installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.classList.remove('hidden');
        }
    });
}

function installPWA() {
    if (appState.deferredPrompt) {
        appState.deferredPrompt.prompt();
        appState.deferredPrompt.userChoice.then(function(choiceResult) {
            if (choiceResult.outcome === 'accepted') {
                var installBtn = document.getElementById('installBtn');
                if (installBtn) {
                    installBtn.classList.add('hidden');
                }
            }
            appState.deferredPrompt = null;
        });
    }
}

// =============================================
// SERVICE WORKER
// =============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('service-worker.js')
            .then(function(registration) {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(function(error) {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// =============================================
// CLEANUP ON EXIT
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

// Handle online/offline events
window.addEventListener('online', function() {
    showToast("Back online", "success");
    updateConnectionStatus(true);
});

window.addEventListener('offline', function() {
    showToast("You're offline", "warning");
    updateConnectionStatus(false);
});

// =============================================
// DEBUG FUNCTIONS
// =============================================
function testFirebaseConnection() {
    console.log('=== FIREBASE CONNECTION TEST ===');
    console.log('Firebase SDK loaded:', typeof firebase !== 'undefined');
    console.log('Firebase app:', app);
    console.log('Auth:', auth);
    console.log('Database:', database);
    console.log('Current user:', auth ? auth.currentUser : null);
    console.log('Firebase initialized:', isFirebaseReady);
    console.log('==============================');
    
    // Test database write
    if (auth && auth.currentUser) {
        database.ref('test').set({
            test: 'Firebase is working!',
            timestamp: Date.now()
        }).then(function() {
            console.log('Firebase write successful!');
            showToast('Firebase connection test: PASSED', 'success');
        }).catch(function(error) {
            console.error('Firebase write failed:', error);
            showToast('Firebase connection test: FAILED', 'error');
        });
    }
}

// Run connection test after 3 seconds
setTimeout(testFirebaseConnection, 3000);
