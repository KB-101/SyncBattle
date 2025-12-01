const firebaseConfig = {
  apiKey: "AIzaSyAlKamcGfK-kUupKFfH-rjiS54gZU_csf0",
  authDomain: "playsync-arena.firebaseapp.com",
  databaseURL: "https://playsync-arena-default-rtdb.firebaseio.com",
  projectId: "playsync-arena",
  storageBucket: "playsync-arena.firebasestorage.app",
  messagingSenderId: "989668959512",
  appId: "1:989668959512:web:016b68c8fb932f2e9d2a6d"
};

// Global variables
let currentUser = {
    id: null,
    name: null,
    publicId: null,
    firebaseUid: null,
    isOnline: false
};

let friend = {
    id: null,
    name: null,
    connected: false,
    isOnline: false
};

let database = null;
let auth = null;

// Main initialization
function initializeApp() {
    console.log('🚀 Initializing PlaySync Arena...');
    
    // Load the main HTML structure
    loadAppHTML();
    
    // Initialize user from localStorage
    initializeUser();
    
    // Initialize Firebase
    initializeFirebase().then(success => {
        if (success) {
            console.log('✅ Firebase initialized successfully');
            // Setup event listeners after HTML is loaded
            setTimeout(setupEventListeners, 500);
        }
    }).catch(error => {
        console.error('Failed to initialize Firebase:', error);
        showToast('Connection Error', 'Using offline mode', 'warning');
    });
}

// Load the main app HTML
function loadAppHTML() {
    const appHTML = `
    <div class="container">
        <!-- Theme Toggle -->
        <div class="theme-toggle">
            <button id="themeToggle">
                <i class="fas fa-moon"></i> <span class="theme-text">Dark</span>
            </button>
        </div>

        <!-- Header -->
        <header>
            <div class="logo-container">
                <div class="logo">
                    <i class="fas fa-gamepad"></i>
                    <i class="fas fa-sync-alt"></i>
                </div>
                <div class="header-text">
                    <h1>PlaySync Arena</h1>
                    <p class="subtitle">Real-time game challenges with friends</p>
                </div>
            </div>
            <div class="tagline">
                <span class="tagline-badge"><i class="fas fa-bolt"></i> Instant Sync</span>
                <span class="tagline-badge"><i class="fas fa-user-friends"></i> Two-Player</span>
                <span class="tagline-badge"><i class="fas fa-cloud"></i> Cloud Powered</span>
            </div>
        </header>

        <!-- Main App -->
        <div class="app-wrapper">
            <!-- Left Panel -->
            <div class="left-panel">
                <!-- User Profile -->
                <div class="user-section card">
                    <h2><i class="fas fa-user"></i> Your Profile</h2>
                    <div class="user-info">
                        <div class="avatar">
                            <i class="fas fa-user-circle"></i>
                        </div>
                        <div class="user-details">
                            <input type="text" id="username" placeholder="Enter your name" maxlength="20">
                            <div class="user-id">
                                <span>Your ID:</span>
                                <code id="userId">Loading...</code>
                                <button id="copyIdBtn" class="icon-btn" title="Copy ID">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                            <div class="user-controls">
                                <button id="newUserBtn" class="btn secondary small">
                                    <i class="fas fa-user-plus"></i> New User
                                </button>
                                <button id="shareIdBtn" class="btn secondary small">
                                    <i class="fas fa-share-alt"></i> Share
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Status Indicator -->
                    <div class="status-indicator">
                        <div class="status-dot" id="statusDot"></div>
                        <span id="statusText">Connecting...</span>
                        <span class="connection-badge" id="firebaseStatusBadge">
                            <i class="fas fa-wifi"></i> <span>Connecting</span>
                        </span>
                    </div>
                </div>

                <!-- Friend Connection -->
                <div class="friend-section card">
                    <h2><i class="fas fa-users"></i> Connect with Friend</h2>
                    <div class="friend-input">
                        <input type="text" id="friendId" placeholder="Enter friend's ID">
                        <button id="connectBtn" class="btn primary">
                            <i class="fas fa-link"></i> Connect
                        </button>
                    </div>
                    <div class="connection-status">
                        <span>Friend Status:</span>
                        <span id="friendStatus">Not connected</span>
                    </div>
                    <div class="connection-hint">
                        <small><i class="fas fa-info-circle"></i> Share your ID with friend to connect</small>
                    </div>
                </div>
            </div>

            <!-- Right Panel -->
            <div class="right-panel">
                <!-- Games Section -->
                <div class="games-section card">
                    <h2><i class="fas fa-dice"></i> Available Games</h2>
                    <div class="games-grid">
                        <div class="game-card" data-game="pool">
                            <div class="game-icon">
                                <i class="fas fa-billiard-ball"></i>
                            </div>
                            <h3>8-Ball Pool</h3>
                            <p class="game-description">Classic pool challenge</p>
                            <button class="btn challenge-btn" data-game="pool">
                                <i class="fas fa-play"></i> Challenge
                            </button>
                        </div>
                        <div class="game-card" data-game="chess">
                            <div class="game-icon">
                                <i class="fas fa-chess"></i>
                            </div>
                            <h3>Chess</h3>
                            <p class="game-description">Strategic battle</p>
                            <button class="btn challenge-btn" data-game="chess">
                                <i class="fas fa-play"></i> Challenge
                            </button>
                        </div>
                        <div class="game-card" data-game="poker">
                            <div class="game-icon">
                                <i class="fas fa-spade"></i>
                            </div>
                            <h3>Poker</h3>
                            <p class="game-description">Texas Hold'em</p>
                            <button class="btn challenge-btn" data-game="poker">
                                <i class="fas fa-play"></i> Challenge
                            </button>
                        </div>
                        <div class="game-card" data-game="tictactoe">
                            <div class="game-icon">
                                <i class="fas fa-times"></i>
                            </div>
                            <h3>Tic-Tac-Toe</h3>
                            <p class="game-description">Quick 3-in-a-row</p>
                            <button class="btn challenge-btn" data-game="tictactoe">
                                <i class="fas fa-play"></i> Challenge
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Notifications -->
                <div class="notifications-section card">
                    <h2><i class="fas fa-bell"></i> Notifications</h2>
                    <div class="notifications-container" id="notificationsContainer">
                        <div class="empty-notifications">
                            <i class="fas fa-inbox"></i>
                            <p>No notifications yet</p>
                            <small>Game challenges will appear here</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Toast Notification -->
        <div class="notification-toast" id="notificationToast">
            <div class="toast-content">
                <i class="fas fa-bell"></i>
                <div class="toast-text">
                    <strong id="toastTitle">Notification</strong>
                    <span id="toastMessage">Message</span>
                </div>
                <button class="toast-close">&times;</button>
            </div>
        </div>

        <!-- Footer -->
        <footer>
            <p><span class="brand">PlaySync Arena</span> - Real-time game challenges</p>
            <p class="tech-info">Powered by Firebase</p>
            <div class="app-version">
                <span>Version 2.0</span>
                <span class="connection-status-badge" id="footerStatus">
                    <i class="fas fa-circle"></i> Loading...
                </span>
            </div>
        </footer>
    </div>
    `;
    
    // Remove loading screen and add app HTML
    document.querySelector('.loading').style.display = 'none';
    document.body.innerHTML = appHTML;
    
    // Now load the CSS
    loadStyles();
}

// Load CSS styles
function loadStyles() {
    // Create a minimal CSS if style.css fails to load
    const fallbackCSS = `
    :root {
        --primary: #4361ee;
        --primary-dark: #3a0ca3;
        --secondary: #4cc9f0;
        --accent: #7209b7;
        --success: #4ade80;
        --danger: #f72585;
        --dark-bg: #1a1a2e;
        --dark-card: #16213e;
        --light-bg: #f8f9fa;
        --light-card: #ffffff;
    }
    
    body {
        background: var(--dark-bg);
        color: white;
        font-family: 'Segoe UI', sans-serif;
        margin: 0;
        padding: 20px;
        min-height: 100vh;
    }
    
    .container {
        max-width: 1200px;
        margin: 0 auto;
    }
    
    header {
        text-align: center;
        margin-bottom: 30px;
    }
    
    h1 {
        color: var(--secondary);
        font-size: 2.5rem;
        margin-bottom: 10px;
    }
    
    .card {
        background: var(--dark-card);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    
    .btn {
        background: var(--primary);
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s;
    }
    
    .btn:hover {
        background: var(--primary-dark);
        transform: translateY(-2px);
    }
    
    .btn.primary {
        background: var(--primary);
    }
    
    .btn.secondary {
        background: rgba(255,255,255,0.1);
    }
    
    .games-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;
        margin-top: 15px;
    }
    
    .game-card {
        background: rgba(255,255,255,0.05);
        border-radius: 10px;
        padding: 15px;
        text-align: center;
        transition: transform 0.3s;
    }
    
    .game-card:hover {
        transform: translateY(-5px);
        background: rgba(255,255,255,0.1);
    }
    
    .notification-toast {
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: var(--dark-card);
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        display: none;
        border-left: 4px solid var(--secondary);
    }
    
    .notification-toast.show {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #f72585;
        display: inline-block;
        margin-right: 8px;
    }
    
    .status-dot.online {
        background: #4ade80;
        box-shadow: 0 0 10px #4ade80;
    }
    
    footer {
        text-align: center;
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid rgba(255,255,255,0.1);
        color: #aaa;
    }
    `;
    
    // Try to load style.css, fallback to inline CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'style.css';
    link.onerror = function() {
        // If style.css fails to load, create a style tag with fallback CSS
        console.log('📁 style.css not found, using fallback styles');
        const style = document.createElement('style');
        style.textContent = fallbackCSS;
        document.head.appendChild(style);
    };
    document.head.appendChild(link);
}

// Initialize user from localStorage
function initializeUser() {
    // Check URL for user ID
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userid');
    
    let userId = localStorage.getItem('playSync_userId');
    let userName = localStorage.getItem('playSync_userName');
    
    // Generate or load user ID
    if (urlUserId && urlUserId.startsWith('user_')) {
        userId = urlUserId;
        localStorage.setItem('playSync_userId', userId);
    } else if (!userId) {
        userId = generateUserId();
        localStorage.setItem('playSync_userId', userId);
    }
    
    currentUser.id = userId;
    currentUser.publicId = userId;
    
    // Set username
    if (userName) {
        currentUser.name = userName;
    } else {
        currentUser.name = `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
        localStorage.setItem('playSync_userName', currentUser.name);
    }
}

// Generate user ID
function generateUserId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `user_${randomStr}_${timestamp}`;
}

// Initialize Firebase
async function initializeFirebase() {
    console.log('🔄 Initializing Firebase...');
    
    try {
        // Check if Firebase is already initialized
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
            console.log('✅ Firebase app initialized');
        } else {
            console.log('✅ Using existing Firebase app');
        }
        
        database = firebase.database();
        auth = firebase.auth();
        
        console.log('✅ Firebase services initialized');
        
        // Setup connection listener
        setupConnectionListener();
        
        // Sign in anonymously
        await signInAnonymously();
        
        return true;
        
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        showToast('Firebase Error', 'Check console for details', 'error');
        return false;
    }
}

// Setup connection listener
function setupConnectionListener() {
    if (!database) return;
    
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        const connected = snap.val() === true;
        currentUser.isOnline = connected;
        
        console.log(`📡 Firebase connection: ${connected ? '✅ ONLINE' : '❌ OFFLINE'}`);
        
        // Update UI
        updateConnectionStatus(connected);
        
        if (connected) {
            showToast('Connected', 'Successfully connected to Firebase', 'success');
            updateUserInFirebase();
            
            // Update user ID display
            updateUserUI();
        }
    });
}

// Sign in anonymously
async function signInAnonymously() {
    try {
        const userCredential = await auth.signInAnonymously();
        currentUser.firebaseUid = userCredential.user.uid;
        console.log('✅ Signed in anonymously:', currentUser.firebaseUid);
        return userCredential.user;
    } catch (error) {
        console.error('❌ Anonymous sign-in failed:', error);
        showToast('Auth Error', 'Failed to sign in', 'error');
        throw error;
    }
}

// Update user in Firebase
async function updateUserInFirebase() {
    if (!currentUser.firebaseUid || !database) return;
    
    try {
        const userData = {
            publicId: currentUser.publicId,
            name: currentUser.name,
            status: currentUser.isOnline ? 'online' : 'offline',
            lastSeen: Date.now(),
            timestamp: Date.now()
        };
        
        await database.ref(`users/${currentUser.firebaseUid}`).set(userData);
        console.log('✅ User data saved to Firebase');
        
    } catch (error) {
        console.error('❌ Failed to save user data:', error);
    }
}

// Update user UI
function updateUserUI() {
    const userIdElement = document.getElementById('userId');
    const usernameElement = document.getElementById('username');
    const statusElement = document.getElementById('statusText');
    
    if (userIdElement) {
        userIdElement.textContent = formatUserId(currentUser.publicId);
        userIdElement.title = `Full ID: ${currentUser.publicId}`;
    }
    
    if (usernameElement) {
        usernameElement.value = currentUser.name;
    }
    
    if (statusElement) {
        statusElement.textContent = currentUser.isOnline ? 'Online' : 'Offline';
    }
}

// Format user ID for display
function formatUserId(userId) {
    if (userId.length > 24) {
        return `${userId.substring(0, 12)}...${userId.substring(userId.length - 8)}`;
    }
    return userId;
}

// Update connection status in UI
function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const firebaseBadge = document.getElementById('firebaseStatusBadge');
    const footerStatus = document.getElementById('footerStatus');
    
    if (statusDot && statusText) {
        if (connected) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Online';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Offline';
        }
    }
    
    if (firebaseBadge) {
        if (connected) {
            firebaseBadge.innerHTML = '<i class="fas fa-wifi"></i> <span>Connected</span>';
            firebaseBadge.className = 'connection-badge connected';
        } else {
            firebaseBadge.innerHTML = '<i class="fas fa-wifi-slash"></i> <span>Disconnected</span>';
            firebaseBadge.className = 'connection-badge disconnected';
        }
    }
    
    if (footerStatus) {
        if (connected) {
            footerStatus.innerHTML = '<i class="fas fa-circle"></i> Connected';
            footerStatus.className = 'connection-status-badge connected';
        } else {
            footerStatus.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
            footerStatus.className = 'connection-status-badge disconnected';
        }
    }
}

// Show toast notification
function showToast(title, message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastTitle || !toastMessage) {
        console.log(`Toast: ${title} - ${message}`);
        return;
    }
    
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Set icon
    const toastIcon = toast.querySelector('i');
    if (toastIcon) {
        const icons = {
            info: 'fa-bell',
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle'
        };
        toastIcon.className = `fas ${icons[type] || 'fa-bell'}`;
    }
    
    // Show toast
    toast.classList.add('show');
    
    // Auto-hide
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Setup event listeners
function setupEventListeners() {
    // Username input
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('input', (e) => {
            currentUser.name = e.target.value || `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
            localStorage.setItem('playSync_userName', currentUser.name);
            updateUserInFirebase();
        });
    }
    
    // Copy ID button
    const copyIdBtn = document.getElementById('copyIdBtn');
    if (copyIdBtn) {
        copyIdBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(currentUser.publicId)
                .then(() => showToast('Copied', 'User ID copied to clipboard', 'success'))
                .catch(() => showToast('Error', 'Failed to copy ID', 'error'));
        });
    }
    
    // New User button
    const newUserBtn = document.getElementById('newUserBtn');
    if (newUserBtn) {
        newUserBtn.addEventListener('click', () => {
            if (confirm('Create a new user ID? This will disconnect you from current connections.')) {
                const newId = generateUserId();
                currentUser.publicId = newId;
                localStorage.setItem('playSync_userId', newId);
                friend.connected = false;
                friend.id = null;
                
                updateUserInFirebase();
                updateUserUI();
                
                showToast('New User', `Your new ID: ${formatUserId(newId)}`, 'success');
            }
        });
    }
    
    // Share button
    const shareBtn = document.getElementById('shareIdBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const shareUrl = `${window.location.origin}${window.location.pathname}?userid=${currentUser.publicId}`;
            navigator.clipboard.writeText(shareUrl)
                .then(() => showToast('Copied', 'Share link copied to clipboard', 'success'))
                .catch(() => showToast('Error', 'Failed to copy link', 'error'));
        });
    }
    
    // Connect to friend button
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', connectToFriend);
    }
    
    // Challenge buttons
    document.querySelectorAll('.challenge-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const game = e.target.closest('[data-game]').getAttribute('data-game');
            sendGameChallenge(game);
        });
    });
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Toast close
    const toastClose = document.querySelector('.toast-close');
    if (toastClose) {
        toastClose.addEventListener('click', () => {
            const toast = document.getElementById('notificationToast');
            if (toast) toast.classList.remove('show');
        });
    }
}

// Connect to friend
async function connectToFriend() {
    const friendIdInput = document.getElementById('friendId');
    let friendId = friendIdInput.value.trim();
    
    if (!friendId) {
        showToast('Error', 'Please enter a friend ID', 'error');
        return;
    }
    
    // Extract ID from URL
    if (friendId.includes('user_')) {
        const match = friendId.match(/user_[a-z0-9_]+/i);
        if (match) friendId = match[0];
    }
    
    if (friendId === currentUser.publicId) {
        showToast('Error', 'Cannot connect to yourself', 'error');
        return;
    }
    
    if (!friendId.startsWith('user_')) {
        showToast('Error', 'Invalid ID format', 'error');
        return;
    }
    
    if (!database) {
        showToast('Error', 'Database not connected', 'error');
        return;
    }
    
    showToast('Searching', 'Looking for friend...', 'info');
    
    try {
        const snapshot = await database.ref('users')
            .orderByChild('publicId')
            .equalTo(friendId)
            .once('value');
        
        if (snapshot.exists()) {
            let friendData = null;
            let friendFirebaseUid = null;
            
            snapshot.forEach((child) => {
                friendFirebaseUid = child.key;
                friendData = child.val();
                return true;
            });
            
            if (friendData) {
                friend = {
                    id: friendData.publicId,
                    name: friendData.name,
                    firebaseUid: friendFirebaseUid,
                    connected: true,
                    isOnline: friendData.status === 'online'
                };
                
                updateFriendUI();
                showToast('Connected', `Connected to ${friendData.name}`, 'success');
                
            } else {
                showToast('Error', 'Friend data not found', 'error');
            }
            
        } else {
            showToast('Error', 'Friend not found', 'error');
        }
        
    } catch (error) {
        console.error('Connect error:', error);
        showToast('Error', 'Connection failed', 'error');
    }
}

// Update friend UI
function updateFriendUI() {
    const friendStatus = document.getElementById('friendStatus');
    
    if (friend.connected) {
        friendStatus.textContent = `${friend.name}: ${friend.isOnline ? 'Online' : 'Offline'}`;
        friendStatus.style.color = friend.isOnline ? '#4ade80' : '#f72585';
    } else {
        friendStatus.textContent = 'Not connected';
        friendStatus.style.color = '#f72585';
    }
}

// Send game challenge
async function sendGameChallenge(game) {
    if (!friend.connected || !friend.firebaseUid) {
        showToast('Error', 'Connect to a friend first', 'error');
        return;
    }
    
    if (!database) {
        showToast('Error', 'Database not connected', 'error');
        return;
    }
    
    const gameNames = {
        pool: '8-Ball Pool',
        chess: 'Chess',
        poker: 'Poker',
        tictactoe: 'Tic-Tac-Toe'
    };
    
    const gameName = gameNames[game] || game;
    
    try {
        const requestId = `req_${Date.now()}`;
        const request = {
            from: currentUser.firebaseUid,
            fromName: currentUser.name,
            fromPublicId: currentUser.publicId,
            to: friend.firebaseUid,
            game: game,
            gameName: gameName,
            status: 'pending',
            timestamp: Date.now()
        };
        
        await database.ref(`requests/${friend.firebaseUid}/${requestId}`).set(request);
        
        showToast('Sent', `Challenge sent: ${gameName}`, 'success');
        
    } catch (error) {
        console.error('Send error:', error);
        showToast('Error', 'Failed to send challenge', 'error');
    }
}

// Toggle theme
function toggleTheme() {
    const body = document.body;
    const toggle = document.getElementById('themeToggle');
    const text = toggle.querySelector('.theme-text');
    
    if (body.classList.contains('light-theme')) {
        body.classList.remove('light-theme');
        localStorage.setItem('playSync_theme', 'dark');
        text.textContent = 'Dark';
        toggle.innerHTML = '<i class="fas fa-moon"></i> <span class="theme-text">Dark</span>';
    } else {
        body.classList.add('light-theme');
        localStorage.setItem('playSync_theme', 'light');
        text.textContent = 'Light';
        toggle.innerHTML = '<i class="fas fa-sun"></i> <span class="theme-text">Light</span>';
    }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM already loaded
    initializeApp();
}
