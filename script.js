// PlaySync Arena - Main Application Script
// Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyB8g4h1J1z6L7k9G9Q2x7V6w5Y3Z8X9C0D",
    authDomain: "game-challenge-app.firebaseapp.com",
    databaseURL: "https://game-challenge-app-default-rtdb.firebaseio.com",
    projectId: "game-challenge-app",
    storageBucket: "game-challenge-app.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
let app;
let database;

try {
    app = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization failed:", error);
    showToast("Connection Error", "Failed to connect to server. Using offline mode.");
}

// DOM Elements
const usernameInput = document.getElementById('username');
const userIdDisplay = document.getElementById('userId');
const copyIdBtn = document.getElementById('copyIdBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const sessionBadge = document.getElementById('sessionBadge');
const friendIdInput = document.getElementById('friendId');
const connectBtn = document.getElementById('connectBtn');
const friendStatus = document.getElementById('friendStatus');
const challengeButtons = document.querySelectorAll('.challenge-btn');
const notificationsContainer = document.getElementById('notificationsContainer');
const notificationCount = document.getElementById('notificationCount');
const notificationToast = document.getElementById('notificationToast');
const toastTitle = document.getElementById('toastTitle');
const toastMessage = document.getElementById('toastMessage');
const requestModal = document.getElementById('requestModal');
const requestInfo = document.getElementById('requestInfo');
const acceptBtn = document.getElementById('acceptBtn');
const declineBtn = document.getElementById('declineBtn');

// User control buttons
const newUserBtn = document.getElementById('newUserBtn');
const shareIdBtn = document.getElementById('shareIdBtn');
const resetAppBtn = document.getElementById('resetAppBtn');
const clearNotificationsBtn = document.getElementById('clearNotificationsBtn');

// Modals
const shareModal = document.getElementById('shareModal');
const shareLinkInput = document.getElementById('shareLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const directIdInput = document.getElementById('directId');
const copyDirectIdBtn = document.getElementById('copyDirectIdBtn');
const qrCodeContainer = document.getElementById('qrCodeContainer');
const aboutModal = document.getElementById('aboutModal');
const aboutLink = document.getElementById('aboutLink');
const howToLink = document.getElementById('howToLink');
const refreshLink = document.getElementById('refreshLink');

// Theme toggle
const themeToggle = document.getElementById('themeToggle');
const themeText = document.querySelector('.theme-text');

// PWA Install
const installPrompt = document.getElementById('installPrompt');
const installBtn = document.getElementById('installBtn');
const dismissInstall = document.getElementById('dismissInstall');

// Firebase status
const firebaseStatus = document.getElementById('firebaseStatus');

// App state
let currentUser = {
    id: null,
    name: null,
    friendId: null,
    connected: false,
    sessionId: null,
    isOnline: false
};

let pendingRequest = null;
let notifications = [];
let friendListener = null;
let deferredPrompt = null;
let firebaseConnected = false;

// Initialize app
window.addEventListener('DOMContentLoaded', function() {
    initApp();
    setupEventListeners();
    setupPWA();
    checkFirebaseConnection();
});

// Initialize application
function initApp() {
    // Load theme preference
    loadTheme();
    
    // Check URL for user ID parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userid');
    
    let userId = localStorage.getItem('playSync_userId');
    let userName = localStorage.getItem('playSync_userName');
    
    // Generate session ID (always new each load)
    currentUser.sessionId = generateSessionId();
    sessionBadge.title = `Session: ${currentUser.sessionId}`;
    
    // Priority: URL param > localStorage > generate new
    if (urlUserId && urlUserId.startsWith('user_')) {
        userId = urlUserId;
        localStorage.setItem('playSync_userId', userId);
        showToast("ID Loaded", "Using ID from share link");
    } else if (!userId) {
        userId = generateUserId();
        localStorage.setItem('playSync_userId', userId);
        showToast("New User", "You have a new unique ID");
    }
    
    currentUser.id = userId;
    userIdDisplay.textContent = formatUserId(userId);
    userIdDisplay.title = `Full ID: ${userId}`;
    
    // Set username
    if (userName) {
        usernameInput.value = userName;
        currentUser.name = userName;
    } else {
        currentUser.name = `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
        usernameInput.value = currentUser.name;
        localStorage.setItem('playSync_userName', currentUser.name);
    }
    
    // Update status
    updateUserStatus('online');
    
    // Load notifications
    loadNotifications();
    
    // Setup Firebase listeners
    if (database) {
        setupFirebaseListeners();
    }
    
    // Show welcome message
    setTimeout(() => {
        showToast("Welcome!", `Ready to challenge friends!`);
    }, 1000);
}

// Setup all event listeners
function setupEventListeners() {
    // Username changes
    usernameInput.addEventListener('input', function() {
        const newName = this.value.trim() || `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
        currentUser.name = newName;
        localStorage.setItem('playSync_userName', newName);
        
        // Update in Firebase
        if (database && currentUser.id && currentUser.isOnline) {
            database.ref('users/' + currentUser.id).update({
                name: newName
            });
        }
    });
    
    // Copy ID button
    copyIdBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(currentUser.id).then(() => {
            showToast("ID Copied", "Your user ID has been copied");
        });
    });
    
    // New User button
    newUserBtn.addEventListener('click', createNewUser);
    
    // Share ID button
    shareIdBtn.addEventListener('click', showShareModal);
    
    // Reset App button
    resetAppBtn.addEventListener('click', resetApp);
    
    // Clear notifications button
    clearNotificationsBtn.addEventListener('click', clearAllNotifications);
    
    // Connect to friend
    connectBtn.addEventListener('click', connectToFriend);
    
    // Friend ID input - handle paste
    friendIdInput.addEventListener('paste', function(e) {
        setTimeout(() => {
            const pastedText = this.value;
            if (pastedText.includes('user_')) {
                const urlMatch = pastedText.match(/user_[a-z0-9_]+/i);
                if (urlMatch) {
                    this.value = urlMatch[0];
                }
            }
        }, 10);
    });
    
    // Game challenge buttons
    challengeButtons.forEach(button => {
        button.addEventListener('click', function() {
            sendGameChallenge(this.getAttribute('data-game'));
        });
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('show');
        });
    });
    
    // Toast close
    document.querySelector('.toast-close').addEventListener('click', function() {
        notificationToast.classList.remove('show');
    });
    
    // Copy share link
    copyLinkBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(shareLinkInput.value).then(() => {
            showToast("Link Copied", "Share link copied to clipboard");
        });
    });
    
    // Copy direct ID
    copyDirectIdBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(directIdInput.value).then(() => {
            showToast("ID Copied", "User ID copied to clipboard");
        });
    });
    
    // About links
    aboutLink.addEventListener('click', function(e) {
        e.preventDefault();
        aboutModal.classList.add('show');
    });
    
    howToLink.addEventListener('click', function(e) {
        e.preventDefault();
        aboutModal.classList.add('show');
    });
    
    refreshLink.addEventListener('click', function(e) {
        e.preventDefault();
        location.reload();
    });
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // PWA Install
    installBtn.addEventListener('click', installPWA);
    dismissInstall.addEventListener('click', function() {
        installPrompt.classList.remove('show');
        localStorage.setItem('playSync_dismissedInstall', 'true');
    });
    
    // Close modals on outside click
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
        }
    });
    
    // Handle pending requests when page becomes visible
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible' && pendingRequest) {
            showRequestModal(pendingRequest);
            pendingRequest = null;
        }
    });
    
    // Handle online/offline status
    window.addEventListener('online', function() {
        showToast("Back Online", "Reconnecting to server...");
        if (database) {
            updateUserStatus('online');
            checkFirebaseConnection();
        }
    });
    
    window.addEventListener('offline', function() {
        showToast("Offline", "Working in offline mode");
        updateUserStatus('offline');
    });
}

// Generate a unique user ID
function generateUserId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `user_${randomStr}_${timestamp}`;
}

// Generate session ID
function generateSessionId() {
    return `sess_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
}

// Format user ID for display
function formatUserId(userId) {
    if (userId.length > 24) {
        return `${userId.substring(0, 12)}...${userId.substring(userId.length - 8)}`;
    }
    return userId;
}

// Update user status
function updateUserStatus(status) {
    currentUser.isOnline = status === 'online';
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    
    // Update in Firebase
    if (database && currentUser.id) {
        database.ref('users/' + currentUser.id).update({
            status: status,
            lastSeen: Date.now(),
            name: currentUser.name,
            sessionId: currentUser.sessionId
        }).then(() => {
            firebaseConnected = true;
            firebaseStatus.innerHTML = '<i class="fas fa-circle"></i> Connected';
            firebaseStatus.classList.add('connected');
        }).catch(() => {
            firebaseConnected = false;
            firebaseStatus.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
            firebaseStatus.classList.remove('connected');
        });
    }
}

// Check Firebase connection
function checkFirebaseConnection() {
    if (database) {
        const connectedRef = database.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                firebaseConnected = true;
                firebaseStatus.innerHTML = '<i class="fas fa-circle"></i> Connected';
                firebaseStatus.classList.add('connected');
                updateUserStatus('online');
            } else {
                firebaseConnected = false;
                firebaseStatus.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
                firebaseStatus.classList.remove('connected');
                updateUserStatus('offline');
            }
        });
    }
}

// Setup Firebase real-time listeners
function setupFirebaseListeners() {
    if (!database) return;
    
    // Clean up on disconnect
    database.ref('users/' + currentUser.id).onDisconnect().update({
        status: 'offline',
        lastSeen: Date.now()
    });
    
    // Listen for incoming game requests
    database.ref('requests/' + currentUser.id).on('child_added', (snapshot) => {
        const request = snapshot.val();
        if (request && request.status === 'pending') {
            // Check if request is from current session
            if (request.sessionId !== currentUser.sessionId) {
                handleIncomingRequest(request, snapshot.key);
            }
        }
    });
    
    // Listen for request updates
    database.ref('requests/' + currentUser.id).on('child_changed', (snapshot) => {
        const request = snapshot.val();
        if (request) {
            if (request.status === 'accepted') {
                handleRequestAccepted(request);
            } else if (request.status === 'declined') {
                addNotification(`${request.fromName} declined your ${request.gameName} challenge`, request.game, 'declined');
            }
        }
    });
    
    // Clean up old data periodically
    setInterval(cleanupOldData, 300000); // Every 5 minutes
}

// Clean up old data from Firebase
function cleanupOldData() {
    if (!database) return;
    
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // Clean up old requests
    database.ref('requests/' + currentUser.id).once('value').then(snapshot => {
        const updates = {};
        snapshot.forEach(child => {
            const request = child.val();
            if (request.timestamp < oneHourAgo) {
                updates[child.key] = null;
            }
        });
        
        if (Object.keys(updates).length > 0) {
            database.ref('requests/' + currentUser.id).update(updates);
        }
    });
    
    // Clean up old users (offline for more than 1 hour)
    database.ref('users').once('value').then(snapshot => {
        const updates = {};
        snapshot.forEach(child => {
            const user = child.val();
            if (user.lastSeen && (Date.now() - user.lastSeen) > (60 * 60 * 1000)) {
                updates[child.key] = null;
            }
        });
        
        if (Object.keys(updates).length > 0) {
            database.ref('users').update(updates);
        }
    });
}

// Create a new user ID
function createNewUser() {
    if (confirm('Create a new user ID?\n\nThis will:\n• Generate a new ID\n• Disconnect from friend\n• Start fresh')) {
        // Disconnect from friend
        if (currentUser.connected && friendListener && database) {
            database.ref('users/' + currentUser.friendId).off('value', friendListener);
            friendListener = null;
        }
        
        // Generate new ID
        const newId = generateUserId();
        
        // Update storage and state
        localStorage.setItem('playSync_userId', newId);
        currentUser.id = newId;
        currentUser.sessionId = generateSessionId();
        currentUser.connected = false;
        currentUser.friendId = null;
        
        // Update UI
        userIdDisplay.textContent = formatUserId(newId);
        userIdDisplay.title = `Full ID: ${newId}`;
        sessionBadge.title = `Session: ${currentUser.sessionId}`;
        
        // Reset friend connection
        friendStatus.textContent = 'Not connected';
        friendIdInput.value = '';
        
        // Update Firebase
        if (database) {
            updateUserStatus('online');
        }
        
        // Clear friend listener
        if (friendListener) {
            database.ref('users/' + currentUser.friendId).off('value', friendListener);
            friendListener = null;
        }
        
        showToast("New User", `Your new ID: ${formatUserId(newId)}`);
    }
}

// Connect to friend
function connectToFriend() {
    let friendId = friendIdInput.value.trim();
    
    if (!friendId) {
        showToast("Error", "Please enter a friend ID or share link");
        return;
    }
    
    // Extract user ID from URL if full link is pasted
    if (friendId.includes('user_')) {
        const urlMatch = friendId.match(/user_[a-z0-9_]+/i);
        if (urlMatch) {
            friendId = urlMatch[0];
            friendIdInput.value = friendId;
        }
    }
    
    if (friendId === currentUser.id) {
        showToast("Error", "You cannot connect to yourself");
        return;
    }
    
    if (!friendId.startsWith('user_')) {
        showToast("Error", "Invalid user ID format");
        return;
    }
    
    // Check if friend exists
    if (database) {
        database.ref('users/' + friendId).once('value').then((snapshot) => {
            if (snapshot.exists()) {
                // Stop previous listener if exists
                if (friendListener) {
                    database.ref('users/' + currentUser.friendId).off('value', friendListener);
                }
                
                currentUser.friendId = friendId;
                currentUser.connected = true;
                
                friendStatus.textContent = 'Connecting...';
                
                // Listen for friend status changes
                friendListener = database.ref('users/' + friendId).on('value', (snap) => {
                    if (snap.exists()) {
                        const friendData = snap.val();
                        const status = friendData.status || 'offline';
                        const friendName = friendData.name || 'Friend';
                        
                        friendStatus.textContent = `${friendName}: ${status}`;
                        friendStatus.style.color = status === 'online' ? '#4ade80' : '#f72585';
                        
                        if (status === 'online') {
                            showToast("Friend Online", `${friendName} is now online`);
                        }
                    } else {
                        friendStatus.textContent = 'User not found';
                        friendStatus.style.color = '#f72585';
                        currentUser.connected = false;
                    }
                });
                
                showToast("Connected", `Connected to ${formatUserId(friendId)}`);
                
            } else {
                showToast("Error", "Friend not found or offline");
                friendStatus.textContent = 'Not found';
                friendStatus.style.color = '#f72585';
            }
        }).catch((error) => {
            console.error("Connection error:", error);
            showToast("Error", "Failed to connect to friend");
        });
    } else {
        showToast("Offline Mode", "Server connection unavailable");
    }
}

// Send game challenge
function sendGameChallenge(game) {
    if (!currentUser.connected || !currentUser.friendId) {
        showToast("Not Connected", "Please connect to a friend first");
        return;
    }
    
    const gameNames = {
        'pool': '8-Ball Pool',
        'chess': 'Chess',
        'poker': 'Poker',
        'tictactoe': 'Tic-Tac-Toe'
    };
    
    const gameIcons = {
        'pool': 'fa-billiard-ball',
        'chess': 'fa-chess',
        'poker': 'fa-spade',
        'tictactoe': 'fa-times'
    };
    
    const gameName = gameNames[game] || game;
    
    // Create request object
    const requestId = `req_${Date.now()}_${currentUser.sessionId}`;
    const request = {
        from: currentUser.id,
        fromName: currentUser.name,
        to: currentUser.friendId,
        game: game,
        gameName: gameName,
        gameIcon: gameIcons[game],
        status: 'pending',
        timestamp: Date.now(),
        sessionId: currentUser.sessionId
    };
    
    // Save to Firebase
    if (database) {
        database.ref('requests/' + currentUser.friendId + '/' + requestId).set(request)
            .then(() => {
                showToast("Challenge Sent", `You challenged to ${gameName}`);
                addNotification(`You challenged to ${gameName}`, game, 'sent');
            })
            .catch((error) => {
                console.error("Send error:", error);
                showToast("Error", "Failed to send challenge");
            });
    } else {
        showToast("Offline", "Cannot send challenge while offline");
    }
}

// Handle incoming request
function handleIncomingRequest(request, requestId) {
    pendingRequest = { ...request, id: requestId };
    
    // Show notification
    showToast("New Challenge", `${request.fromName} wants to play ${request.gameName}`);
    
    // Add to notifications
    addNotification(`${request.fromName} challenged you to ${request.gameName}`, request.game, 'received');
    
    // Show modal if user is active
    if (document.visibilityState === 'visible') {
        showRequestModal(request);
    }
}

// Show request modal
function showRequestModal(request) {
    requestInfo.innerHTML = `
        <div class="game-request-info">
            <p><strong>${request.fromName}</strong> wants to play</p>
            <p><i class="fas ${request.gameIcon || 'fa-gamepad'}"></i> <strong>${request.gameName}</strong></p>
            <p>Do you accept the challenge?</p>
        </div>
    `;
    
    // Set up accept/decline buttons
    acceptBtn.onclick = function() {
        acceptRequest(request, request.id);
        requestModal.classList.remove('show');
    };
    
    declineBtn.onclick = function() {
        declineRequest(request, request.id);
        requestModal.classList.remove('show');
    };
    
    requestModal.classList.add('show');
}

// Accept request
function acceptRequest(request, requestId) {
    // Update request status
    if (database) {
        database.ref('requests/' + currentUser.id + '/' + requestId).update({
            status: 'accepted'
        });
        
        // Notify the sender
        database.ref('requests/' + request.from + '/' + requestId).update({
            status: 'accepted'
        });
    }
    
    // Add notification
    addNotification(`You accepted ${request.fromName}'s ${request.gameName} challenge`, request.game, 'accepted');
    
    // Show success message
    setTimeout(() => {
        showToast("Game Starting", `Launching ${request.gameName}...`);
        
        // Simulate opening the game
        setTimeout(() => {
            showToast("Game Started", `Playing ${request.gameName} with ${request.fromName}`);
            // In a real app, you would launch the actual game here
            simulateGameLaunch(request.game, request.fromName);
        }, 1500);
    }, 500);
}

// Decline request
function declineRequest(request, requestId) {
    // Update request status
    if (database) {
        database.ref('requests/' + currentUser.id + '/' + requestId).update({
            status: 'declined'
        });
    }
    
    // Add notification
    addNotification(`You declined ${request.fromName}'s ${request.gameName} challenge`, request.game, 'declined');
    
    showToast("Challenge Declined", `Declined ${request.gameName} challenge`);
}

// Simulate game launch
function simulateGameLaunch(game, opponent) {
    // This is where you would integrate with actual game platforms
    console.log(`Launching ${game} game with ${opponent}`);
    // Example: window.open(`game-${game}.html?opponent=${opponent}`);
}

// Handle accepted request
function handleRequestAccepted(request) {
    // Check if this is from our current session
    if (request.sessionId !== currentUser.sessionId) return;
    
    showToast("Challenge Accepted", `Your ${request.gameName} challenge was accepted`);
    
    addNotification(`Your ${request.gameName} challenge was accepted`, request.game, 'accepted');
    
    // Simulate game launch
    setTimeout(() => {
        showToast("Game Starting", `Launching ${request.gameName}...`);
        
        setTimeout(() => {
            showToast("Game Started", `Playing ${request.gameName} with your friend`);
            simulateGameLaunch(request.game, request.to);
        }, 1500);
    }, 500);
}

// Add notification
function addNotification(message, game, type) {
    const notificationId = `notif_${Date.now()}`;
    const notification = {
        id: notificationId,
        message: message,
        game: game,
        type: type,
        timestamp: Date.now(),
        read: false
    };
    
    notifications.unshift(notification);
    updateNotificationsUI();
    
    // Save to localStorage (keep last 50)
    localStorage.setItem('playSync_notifications', JSON.stringify(notifications.slice(0, 50)));
}

// Update notifications UI
function updateNotificationsUI() {
    notificationsContainer.innerHTML = '';
    
    if (notifications.length === 0) {
        notificationsContainer.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-inbox"></i>
                <p>No notifications yet</p>
                <small>Game challenges will appear here</small>
            </div>
        `;
        notificationCount.textContent = '0 notifications';
        return;
    }
    
    let unreadCount = 0;
    
    notifications.forEach(notification => {
        if (!notification.read) unreadCount++;
        
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification-item ${notification.read ? '' : 'new'}`;
        
        const timeAgo = getTimeAgo(notification.timestamp);
        const typeIcon = getNotificationIcon(notification.type);
        const gameIcon = getGameIcon(notification.game);
        
        notificationEl.innerHTML = `
            <div class="notification-content">
                <div class="notification-game">
                    <i class="fas ${gameIcon}"></i> ${notification.message}
                </div>
                <div class="notification-time">${timeAgo}</div>
            </div>
            <div class="notification-type">${typeIcon}</div>
        `;
        
        // Mark as read on click
        notificationEl.addEventListener('click', () => {
            notification.read = true;
            notificationEl.classList.remove('new');
            updateNotificationsUI();
        });
        
        notificationsContainer.appendChild(notificationEl);
    });
    
    notificationCount.textContent = `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`;
    if (unreadCount > 0) {
        notificationCount.innerHTML += ` <span style="color: var(--accent)">(${unreadCount} new)</span>`;
    }
}

// Clear all notifications
function clearAllNotifications() {
    if (notifications.length === 0) return;
    
    if (confirm('Clear all notifications?')) {
        notifications = [];
        updateNotificationsUI();
        localStorage.removeItem('playSync_notifications');
        showToast("Cleared", "All notifications removed");
    }
}

// Load notifications from localStorage
function loadNotifications() {
    const savedNotifications = localStorage.getItem('playSync_notifications');
    if (savedNotifications) {
        try {
            notifications = JSON.parse(savedNotifications);
            updateNotificationsUI();
        } catch (e) {
            console.error("Error loading notifications:", e);
            notifications = [];
        }
    }
}

// Show share modal
function showShareModal() {
    const shareUrl = `${window.location.origin}${window.location.pathname}?userid=${currentUser.id}`;
    
    // Set share link
    shareLinkInput.value = shareUrl;
    
    // Set direct ID
    directIdInput.value = currentUser.id;
    
    // Generate QR code
    qrCodeContainer.innerHTML = '';
    try {
        QRCode.toCanvas(qrCodeContainer, shareUrl, {
            width: 160,
            height: 160,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
    } catch (error) {
        qrCodeContainer.innerHTML = '<div class="qr-placeholder"><i class="fas fa-qrcode"></i></div>';
    }
    
    // Show modal
    shareModal.classList.add('show');
}

// Reset entire app
function resetApp() {
    if (confirm('Reset the entire app?\n\nThis will:\n• Clear all local data\n• Generate new user ID\n• Clear notifications\n• Disconnect from friend\n\nThis cannot be undone!')) {
        // Clear all localStorage
        localStorage.clear();
        
        // Disconnect from Firebase
        if (database && currentUser.id) {
            database.ref('users/' + currentUser.id).remove();
        }
        
        // Clear friend listener
        if (friendListener && database) {
            database.ref('users/' + currentUser.friendId).off('value', friendListener);
        }
        
        // Clear Firebase listeners
        if (database) {
            database.ref('requests/' + currentUser.id).off();
        }
        
        // Reload the page
        window.location.href = window.location.pathname;
    }
}

// Theme functions
function loadTheme() {
    const savedTheme = localStorage.getItem('playSync_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeText.textContent = 'Light';
        themeToggle.innerHTML = '<i class="fas fa-sun"></i> <span class="theme-text">Light</span>';
    }
}

function toggleTheme() {
    const body = document.body;
    const isLight = body.classList.contains('light-theme');
    
    if (isLight) {
        body.classList.remove('light-theme');
        localStorage.setItem('playSync_theme', 'dark');
        themeText.textContent = 'Dark';
        themeToggle.innerHTML = '<i class="fas fa-moon"></i> <span class="theme-text">Dark</span>';
        showToast("Theme", "Switched to Dark Mode");
    } else {
        body.classList.add('light-theme');
        localStorage.setItem('playSync_theme', 'light');
        themeText.textContent = 'Light';
        themeToggle.innerHTML = '<i class="fas fa-sun"></i> <span class="theme-text">Light</span>';
        showToast("Theme", "Switched to Light Mode");
    }
}

// PWA Functions
function setupPWA() {
    // Check if install prompt was previously dismissed
    const dismissed = localStorage.getItem('playSync_dismissedInstall');
    if (dismissed === 'true') return;
    
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install prompt after 5 seconds
        setTimeout(() => {
            if (deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
                installPrompt.classList.add('show');
            }
        }, 5000);
    });
    
    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        installPrompt.classList.remove('show');
        showToast("App Installed", "PlaySync Arena is now installed!");
    });
}

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            installPrompt.classList.remove('show');
        });
    }
}

// Show toast notification
function showToast(title, message) {
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    notificationToast.classList.add('show');
    
    // Auto hide after 4 seconds
    setTimeout(() => {
        notificationToast.classList.remove('show');
    }, 4000);
}

// Helper functions
function getGameIcon(game) {
    const icons = {
        'pool': 'fa-billiard-ball',
        'chess': 'fa-chess',
        'poker': 'fa-spade',
        'tictactoe': 'fa-times'
    };
    return icons[game] || 'fa-gamepad';
}

function getNotificationIcon(type) {
    const icons = {
        'sent': '<i class="fas fa-paper-plane" title="Sent"></i>',
        'received': '<i class="fas fa-inbox" title="Received"></i>',
        'accepted': '<i class="fas fa-check-circle" title="Accepted"></i>',
        'declined': '<i class="fas fa-times-circle" title="Declined"></i>'
    };
    return icons[type] || '<i class="fas fa-bell"></i>';
}

function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        return `${mins} min${mins !== 1 ? 's' : ''} ago`;
    }
    if (seconds < 86400) {
        const hrs = Math.floor(seconds / 3600);
        return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(seconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}
