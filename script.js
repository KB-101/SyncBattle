// Firebase configuration - REPLACE WITH YOUR OWN!
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
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM Elements
const usernameInput = document.getElementById('username');
const userIdDisplay = document.getElementById('userId');
const copyIdBtn = document.getElementById('copyIdBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const friendIdInput = document.getElementById('friendId');
const connectBtn = document.getElementById('connectBtn');
const friendStatus = document.getElementById('friendStatus');
const challengeButtons = document.querySelectorAll('.challenge-btn');
const notificationsContainer = document.getElementById('notificationsContainer');
const notificationToast = document.getElementById('notificationToast');
const toastTitle = document.getElementById('toastTitle');
const toastMessage = document.getElementById('toastMessage');
const requestModal = document.getElementById('requestModal');
const requestInfo = document.getElementById('requestInfo');
const acceptBtn = document.getElementById('acceptBtn');
const declineBtn = document.getElementById('declineBtn');

// NEW: User control buttons
const newUserBtn = document.getElementById('newUserBtn');
const shareIdBtn = document.getElementById('shareIdBtn');
const resetAppBtn = document.getElementById('resetAppBtn');
const clearNotificationsBtn = document.getElementById('clearNotificationsBtn');

// NEW: Share modal elements
const shareModal = document.getElementById('shareModal');
const shareLinkInput = document.getElementById('shareLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const directIdInput = document.getElementById('directId');
const copyDirectIdBtn = document.getElementById('copyDirectIdBtn');
const qrCodeContainer = document.getElementById('qrCodeContainer');

// App state
let currentUser = {
    id: null,
    name: null,
    friendId: null,
    connected: false,
    sessionId: null // NEW: Session-specific ID
};

let pendingRequest = null;
let notifications = [];
let friendListener = null; // To track friend status listener

// Generate a unique user ID
function generateUserId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return 'user_' + randomStr + '_' + timestamp;
}

// Generate a session ID (changes on each page load)
function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

// Initialize user with enhanced features
function initUser() {
    // Check URL for user ID parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userid');
    
    let userId = localStorage.getItem('gameApp_userId');
    let userName = localStorage.getItem('gameApp_userName');
    
    // Generate session ID (always new each load)
    currentUser.sessionId = generateSessionId();
    
    // Priority: URL param > localStorage > generate new
    if (urlUserId) {
        userId = urlUserId;
        localStorage.setItem('gameApp_userId', userId);
        showToast('ID Loaded', 'Using ID from share link');
    } else if (!userId) {
        userId = generateUserId();
        localStorage.setItem('gameApp_userId', userId);
        showToast('New User Created', 'You have a new unique ID');
    }
    
    currentUser.id = userId;
    
    // Display full ID with session indicator
    userIdDisplay.textContent = userId;
    userIdDisplay.title = `Session: ${currentUser.sessionId.substring(0, 10)}...`;
    
    // Set username
    if (userName) {
        usernameInput.value = userName;
        currentUser.name = userName;
    } else {
        currentUser.name = 'Player_' + Math.floor(Math.random() * 1000);
        usernameInput.value = currentUser.name;
        localStorage.setItem('gameApp_userName', currentUser.name);
    }
    
    // Update status
    updateUserStatus('online');
    
    // Load notifications
    loadNotifications();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup Firebase listeners
    setupFirebaseListeners();
    
    // Show welcome message
    showWelcomeMessage();
}

// Show welcome message with user info
function showWelcomeMessage() {
    setTimeout(() => {
        showToast('Welcome!', `Your ID: ${currentUser.id.substring(0, 15)}...`);
    }, 1000);
}

// Setup all event listeners
function setupEventListeners() {
    // Username changes
    usernameInput.addEventListener('input', function() {
        currentUser.name = this.value || 'Anonymous Player';
        localStorage.setItem('gameApp_userName', currentUser.name);
        
        // Update in Firebase
        if (currentUser.id) {
            database.ref('users/' + currentUser.id).update({
                name: currentUser.name
            });
        }
    });
    
    // Copy ID button
    copyIdBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(currentUser.id).then(() => {
            showToast('ID Copied!', 'Your user ID has been copied to clipboard');
        });
    });
    
    // NEW: New User button
    newUserBtn.addEventListener('click', createNewUser);
    
    // NEW: Share ID button
    shareIdBtn.addEventListener('click', showShareModal);
    
    // NEW: Reset App button
    resetAppBtn.addEventListener('click', resetApp);
    
    // NEW: Clear notifications button
    clearNotificationsBtn.addEventListener('click', clearAllNotifications);
    
    // Connect to friend
    connectBtn.addEventListener('click', connectToFriend);
    
    // Friend ID input - allow pasting full URLs
    friendIdInput.addEventListener('paste', function(e) {
        setTimeout(() => {
            const pastedText = this.value;
            if (pastedText.includes('user_')) {
                // Extract user ID from URL
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
    
    // Copy link button
    copyLinkBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(shareLinkInput.value).then(() => {
            showToast('Link Copied!', 'Share link copied to clipboard');
        });
    });
    
    // Copy direct ID button
    copyDirectIdBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(directIdInput.value).then(() => {
            showToast('ID Copied!', 'User ID copied to clipboard');
        });
    });
    
    // Close modals when clicking outside
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
}

// NEW: Create a new user ID
function createNewUser() {
    if (confirm('Create a new user ID? This will:\n• Generate a completely new ID\n• Disconnect from current friend\n• Clear your current session')) {
        // Disconnect from friend if connected
        if (currentUser.connected && friendListener) {
            database.ref('users/' + currentUser.friendId).off('value', friendListener);
            friendListener = null;
        }
        
        // Generate new user ID
        const newId = generateUserId();
        
        // Update storage and state
        localStorage.setItem('gameApp_userId', newId);
        currentUser.id = newId;
        currentUser.sessionId = generateSessionId();
        currentUser.connected = false;
        currentUser.friendId = null;
        
        // Update UI
        userIdDisplay.textContent = newId;
        userIdDisplay.title = `Session: ${currentUser.sessionId.substring(0, 10)}...`;
        friendStatus.textContent = 'Not connected';
        friendStatus.style.color = '#f72585';
        friendIdInput.value = '';
        
        // Update Firebase
        updateUserStatus('online');
        
        // Clear friend status listener
        if (friendListener) {
            database.ref('users/' + currentUser.friendId).off('value', friendListener);
            friendListener = null;
        }
        
        showToast('New User Created!', `Your new ID: ${newId.substring(0, 20)}...`);
        
        // Reset the friend connection display
        const friendSection = document.querySelector('.connection-status');
        friendSection.innerHTML = `
            <span>Friend Status:</span>
            <span id="friendStatus">Not connected</span>
        `;
        friendStatus = document.getElementById('friendStatus');
    }
}

// NEW: Show share modal with options
function showShareModal() {
    const shareUrl = `${window.location.origin}${window.location.pathname}?userid=${currentUser.id}`;
    
    // Set share link
    shareLinkInput.value = shareUrl;
    
    // Set direct ID
    directIdInput.value = currentUser.id;
    
    // Generate QR code
    qrCodeContainer.innerHTML = '';
    QRCode.toCanvas(qrCodeContainer, shareUrl, {
        width: 160,
        height: 160,
        margin: 1,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    }, function(error) {
        if (error) {
            qrCodeContainer.innerHTML = '<p>QR code generation failed</p>';
            console.error('QR Code error:', error);
        }
    });
    
    // Show modal
    shareModal.classList.add('show');
}

// NEW: Reset entire app
function resetApp() {
    if (confirm('Reset the entire app? This will:\n• Clear all local data\n• Generate a new user ID\n• Clear all notifications\n• Disconnect from friend\n\nThis cannot be undone!')) {
        // Clear all localStorage
        localStorage.clear();
        
        // Disconnect from Firebase
        if (currentUser.id) {
            database.ref('users/' + currentUser.id).remove();
        }
        
        // Clear friend listener
        if (friendListener) {
            database.ref('users/' + currentUser.friendId).off('value', friendListener);
        }
        
        // Clear all Firebase listeners
        database.ref('requests/' + currentUser.id).off();
        
        // Reload the page
        window.location.href = window.location.pathname; // Reload without query params
    }
}

// NEW: Clear all notifications
function clearAllNotifications() {
    if (notifications.length === 0) return;
    
    if (confirm('Clear all notifications?')) {
        notifications = [];
        updateNotificationsUI();
        localStorage.removeItem('gameApp_notifications');
        showToast('Cleared', 'All notifications removed');
    }
}

// Connect to friend
function connectToFriend() {
    let friendId = friendIdInput.value.trim();
    
    if (!friendId) {
        showToast('Error', 'Please enter a friend ID or share link');
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
        showToast('Error', 'You cannot connect to yourself');
        return;
    }
    
    // Check if friend exists
    database.ref('users/' + friendId).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            // Stop previous listener if exists
            if (friendListener) {
                database.ref('users/' + currentUser.friendId).off('value', friendListener);
            }
            
            currentUser.friendId = friendId;
            currentUser.connected = true;
            
            friendStatus.textContent = 'Connecting...';
            friendStatus.style.color = '#4cc9f0';
            
            // Listen for friend status changes
            friendListener = database.ref('users/' + friendId).on('value', (snap) => {
                if (snap.exists()) {
                    const friendData = snap.val();
                    const status = friendData.status || 'offline';
                    const friendName = friendData.name || 'Unknown';
                    
                    friendStatus.textContent = `${friendName}: ${status}`;
                    friendStatus.style.color = status === 'online' ? '#4ade80' : '#f72585';
                    
                    if (status === 'online') {
                        showToast('Friend Online!', `${friendName} is now online`);
                    }
                } else {
                    friendStatus.textContent = 'User not found';
                    friendStatus.style.color = '#f72585';
                }
            });
            
            showToast('Connected!', `You are now connected to ${friendId.substring(0, 15)}...`);
            
        } else {
            showToast('Error', 'Friend ID not found or user is offline');
            friendStatus.textContent = 'Not found';
            friendStatus.style.color = '#f72585';
        }
    }).catch((error) => {
        console.error('Error connecting to friend:', error);
        showToast('Error', 'Failed to connect to friend');
    });
}

// Send game challenge
function sendGameChallenge(game) {
    if (!currentUser.connected || !currentUser.friendId) {
        showToast('Not Connected', 'Please connect to a friend first');
        return;
    }
    
    const gameNames = {
        'pool': '8-Ball Pool',
        'chess': 'Chess',
        'poker': 'Poker',
        'tictactoe': 'Tic-Tac-Toe'
    };
    
    // Create request object
    const requestId = 'req_' + Date.now() + '_' + currentUser.sessionId;
    const request = {
        from: currentUser.id,
        fromName: currentUser.name || 'Anonymous',
        to: currentUser.friendId,
        game: game,
        gameName: gameNames[game],
        status: 'pending',
        timestamp: Date.now(),
        sessionId: currentUser.sessionId
    };
    
    // Save to Firebase
    database.ref('requests/' + currentUser.friendId + '/' + requestId).set(request)
        .then(() => {
            showToast('Challenge Sent!', `You challenged your friend to ${gameNames[game]}`);
            addNotification(`You challenged friend to ${gameNames[game]}`, game, 'sent');
        })
        .catch((error) => {
            console.error('Error sending challenge:', error);
            showToast('Error', 'Failed to send challenge');
        });
}

// Update user status in Firebase
function updateUserStatus(status) {
    statusDot.className = 'status-dot ' + status;
    statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    
    // Update in Firebase
    if (currentUser.id) {
        database.ref('users/' + currentUser.id).update({
            status: status,
            lastSeen: Date.now(),
            name: currentUser.name || 'Anonymous',
            sessionId: currentUser.sessionId
        });
    }
}

// Setup Firebase real-time listeners
function setupFirebaseListeners() {
    // Clean up on disconnect
    database.ref('users/' + currentUser.id).onDisconnect().update({
        status: 'offline',
        lastSeen: Date.now()
    });
    
    // Listen for incoming game requests
    database.ref('requests/' + currentUser.id).on('child_added', (snapshot) => {
        const request = snapshot.val();
        if (request && request.status === 'pending') {
            // Check if request is from current session (avoid duplicates)
            if (request.sessionId !== currentUser.sessionId) {
                handleIncomingRequest(request, snapshot.key);
            }
        }
    });
    
    // Listen for request updates
    database.ref('requests/' + currentUser.id).on('child_changed', (snapshot) => {
        const request = snapshot.val();
        if (request && request.status === 'accepted') {
            handleRequestAccepted(request);
        }
    });
    
    // Clean up old requests periodically
    cleanupOldRequests();
}

// Handle incoming request
function handleIncomingRequest(request, requestId) {
    pendingRequest = { ...request, id: requestId };
    
    // Show notification
    showToast('New Challenge!', `${request.fromName} wants to play ${request.gameName}`);
    
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
            <p><i class="fas fa-${getGameIcon(request.game)}"></i> <strong>${request.gameName}</strong></p>
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
    database.ref('requests/' + currentUser.id + '/' + requestId).update({
        status: 'accepted'
    });
    
    // Notify the sender
    database.ref('requests/' + request.from + '/' + requestId).update({
        status: 'accepted'
    });
    
    // Add notification
    addNotification(`You accepted ${request.fromName}'s ${request.gameName} challenge`, request.game, 'accepted');
    
    // Show success message with game launch simulation
    setTimeout(() => {
        showToast('Game Starting!', `Launching ${request.gameName}...`);
        
        // Simulate opening the game
        setTimeout(() => {
            showToast('Game Started!', `You're now playing ${request.gameName} with ${request.fromName}`);
        }, 1500);
    }, 500);
}

// Decline request
function declineRequest(request, requestId) {
    // Update request status
    database.ref('requests/' + currentUser.id + '/' + requestId).update({
        status: 'declined'
    });
    
    // Add notification
    addNotification(`You declined ${request.fromName}'s ${request.gameName} challenge`, request.game, 'declined');
    
    showToast('Challenge Declined', `You declined the ${request.gameName} challenge`);
}

// Handle accepted request
function handleRequestAccepted(request) {
    // Check if this is from our current session
    if (request.sessionId !== currentUser.sessionId) return;
    
    showToast('Challenge Accepted!', `Your ${request.gameName} challenge was accepted`);
    
    addNotification(`Your ${request.gameName} challenge was accepted`, request.game, 'accepted');
    
    // Simulate game launch
    setTimeout(() => {
        showToast('Game Starting!', `Launching ${request.gameName}...`);
        
        setTimeout(() => {
            showToast('Game Started!', `You're now playing ${request.gameName} with your friend`);
        }, 1500);
    }, 500);
}

// Add notification to UI
function addNotification(message, game, type) {
    const notificationId = 'notif_' + Date.now();
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
    
    // Save to localStorage (keep last 30)
    localStorage.setItem('gameApp_notifications', JSON.stringify(notifications.slice(0, 30)));
}

// Update notifications UI
function updateNotificationsUI() {
    // Clear container
    notificationsContainer.innerHTML = '';
    
    if (notifications.length === 0) {
        notificationsContainer.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-inbox"></i>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }
    
    notifications.forEach(notification => {
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification-item ${notification.read ? '' : 'new'}`;
        
        const timeAgo = getTimeAgo(notification.timestamp);
        const typeIcon = getNotificationIcon(notification.type);
        
        notificationEl.innerHTML = `
            <div class="notification-content">
                <div class="notification-game">
                    <i class="fas fa-${getGameIcon(notification.game)}"></i> ${notification.message}
                </div>
                <div class="notification-time">${timeAgo}</div>
            </div>
            <div class="notification-type">${typeIcon}</div>
        `;
        
        notificationsContainer.appendChild(notificationEl);
    });
}

// Clean up old requests from Firebase
function cleanupOldRequests() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // Clean up user's own old requests
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
}

// Load notifications from localStorage
function loadNotifications() {
    const savedNotifications = localStorage.getItem('gameApp_notifications');
    if (savedNotifications) {
        try {
            notifications = JSON.parse(savedNotifications);
            updateNotificationsUI();
        } catch (e) {
            console.error('Error loading notifications:', e);
            notifications = [];
        }
    }
}

// Helper functions
function getGameIcon(game) {
    const icons = {
        'pool': 'billiard-ball',
        'chess': 'chess',
        'poker': 'spade',
        'tictactoe': 'times'
    };
    return icons[game] || 'gamepad';
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
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hr ago';
    return Math.floor(seconds / 86400) + ' days ago';
}

function showToast(title, message) {
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    notificationToast.classList.add('show');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        notificationToast.classList.remove('show');
    }, 5000);
}

// Initialize the app
window.addEventListener('DOMContentLoaded', function() {
    initUser();
});