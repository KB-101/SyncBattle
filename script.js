const firebaseConfig = {
  apiKey: "AIzaSyAlKamcGfK-kUupKFfH-rjiS54gZU_csf0",
  authDomain: "playsync-arena.firebaseapp.com",
  databaseURL: "https://playsync-arena-default-rtdb.firebaseio.com",
  projectId: "playsync-arena",
  storageBucket: "playsync-arena.firebasestorage.app",
  messagingSenderId: "989668959512",
  appId: "1:989668959512:web:016b68c8fb932f2e9d2a6d"
};

// Firebase Service
class FirebaseService {
    constructor() {
        this.app = null;
        this.database = null;
        this.auth = null;
        this.user = null;
        this.connected = false;
    }

    // Initialize Firebase
    async initialize() {
        try {
            // Check if Firebase is already initialized
            if (!firebase.apps.length) {
                this.app = firebase.initializeApp(FIREBASE_CONFIG);
            } else {
                this.app = firebase.app();
            }
            
            this.database = firebase.database();
            this.auth = firebase.auth();
            
            console.log('✅ Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            return false;
        }
    }

    // Sign in anonymously
    async signInAnonymously() {
        try {
            const userCredential = await this.auth.signInAnonymously();
            this.user = userCredential.user;
            console.log('✅ Signed in anonymously:', this.user.uid);
            return this.user;
        } catch (error) {
            console.error('❌ Anonymous sign-in failed:', error);
            throw error;
        }
    }

    // Update user data in database
    async updateUserData(userData) {
        if (!this.user || !this.database) return;
        
        try {
            const userRef = this.database.ref(`users/${this.user.uid}`);
            await userRef.set({
                ...userData,
                lastUpdated: Date.now()
            });
            return true;
        } catch (error) {
            console.error('❌ Failed to update user data:', error);
            return false;
        }
    }

    // Listen for connection status
    setupConnectionListener() {
        if (!this.database) return;
        
        const connectedRef = this.database.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            this.connected = snap.val() === true;
            AppState.updateConnectionStatus(this.connected);
        });
    }

    // Cleanup
    cleanup() {
        if (this.database) {
            this.database.ref('.info/connected').off();
        }
    }
}

// Application State Manager
class AppState {
    static instance = null;
    
    constructor() {
        this.currentUser = {
            id: null,
            name: null,
            publicId: null,
            firebaseUid: null,
            sessionId: null,
            isOnline: false
        };
        
        this.friend = {
            id: null,
            name: null,
            firebaseUid: null,
            isOnline: false,
            connected: false
        };
        
        this.notifications = [];
        this.settings = {
            soundEnabled: true,
            desktopNotifications: false,
            showOnlineStatus: true,
            theme: 'dark'
        };
        
        this.firebaseService = new FirebaseService();
    }
    
    static getInstance() {
        if (!AppState.instance) {
            AppState.instance = new AppState();
        }
        return AppState.instance;
    }
    
    // Initialize app state
    async initialize() {
        // Load settings from localStorage
        this.loadSettings();
        
        // Load notifications
        this.loadNotifications();
        
        // Generate session ID
        this.currentUser.sessionId = this.generateSessionId();
        
        // Load or generate user ID
        await this.initializeUser();
        
        // Initialize Firebase
        const firebaseInitialized = await this.firebaseService.initialize();
        if (firebaseInitialized) {
            // Sign in anonymously
            try {
                const user = await this.firebaseService.signInAnonymously();
                this.currentUser.firebaseUid = user.uid;
                
                // Setup connection listener
                this.firebaseService.setupConnectionListener();
                
                // Update user data in Firebase
                await this.updateUserInFirebase();
                
            } catch (error) {
                console.error('Failed to initialize Firebase:', error);
                UI.showToast('Connection Error', 'Failed to connect to server. Using offline mode.');
            }
        }
        
        // Update UI
        UI.updateUserUI();
        UI.updateNotificationsUI();
    }
    
    // Initialize user
    async initializeUser() {
        // Check URL for user ID parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userid');
        
        let userId = localStorage.getItem('playSync_userId');
        let userName = localStorage.getItem('playSync_userName');
        
        // Priority: URL param > localStorage > generate new
        if (urlUserId && urlUserId.startsWith('user_')) {
            userId = urlUserId;
            localStorage.setItem('playSync_userId', userId);
            UI.showToast('ID Loaded', 'Using ID from share link');
        } else if (!userId) {
            userId = this.generateUserId();
            localStorage.setItem('playSync_userId', userId);
            UI.showToast('New User', 'You have a new unique ID');
        }
        
        this.currentUser.id = userId;
        this.currentUser.publicId = userId;
        
        // Set username
        if (userName) {
            this.currentUser.name = userName;
        } else {
            this.currentUser.name = `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
            localStorage.setItem('playSync_userName', this.currentUser.name);
        }
    }
    
    // Update user in Firebase
    async updateUserInFirebase() {
        if (!this.currentUser.firebaseUid) return;
        
        const userData = {
            publicId: this.currentUser.publicId,
            name: this.currentUser.name,
            status: this.currentUser.isOnline ? 'online' : 'offline',
            lastSeen: Date.now(),
            sessionId: this.currentUser.sessionId
        };
        
        await this.firebaseService.updateUserData(userData);
    }
    
    // Generate user ID
    generateUserId() {
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2, 10);
        return `user_${randomStr}_${timestamp}`;
    }
    
    // Generate session ID
    generateSessionId() {
        return `sess_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    }
    
    // Load settings
    loadSettings() {
        const savedSettings = localStorage.getItem('playSync_settings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
    }
    
    // Save settings
    saveSettings() {
        localStorage.setItem('playSync_settings', JSON.stringify(this.settings));
    }
    
    // Load notifications
    loadNotifications() {
        const savedNotifications = localStorage.getItem('playSync_notifications');
        if (savedNotifications) {
            this.notifications = JSON.parse(savedNotifications);
        }
    }
    
    // Save notifications
    saveNotifications() {
        localStorage.setItem('playSync_notifications', JSON.stringify(this.notifications.slice(0, 100)));
    }
    
    // Add notification
    addNotification(message, game, type) {
        const notification = {
            id: `notif_${Date.now()}`,
            message,
            game,
            type,
            timestamp: Date.now(),
            read: false
        };
        
        this.notifications.unshift(notification);
        this.saveNotifications();
        
        // Update UI
        UI.updateNotificationsUI();
        
        // Show toast if enabled
        if (this.settings.soundEnabled) {
            UI.showToast('New Notification', message);
        }
    }
    
    // Update connection status
    static updateConnectionStatus(connected) {
        const appState = AppState.getInstance();
        appState.currentUser.isOnline = connected;
        UI.updateConnectionStatus(connected);
    }
}

// UI Manager
class UI {
    // Update user UI
    static updateUserUI() {
        const appState = AppState.getInstance();
        const { currentUser } = appState;
        
        document.getElementById('username').value = currentUser.name;
        document.getElementById('userId').textContent = this.formatUserId(currentUser.publicId);
        document.getElementById('userId').title = `Full ID: ${currentUser.publicId}`;
        
        // Update status
        this.updateConnectionStatus(currentUser.isOnline);
    }
    
    // Format user ID for display
    static formatUserId(userId) {
        if (userId.length > 24) {
            return `${userId.substring(0, 12)}...${userId.substring(userId.length - 8)}`;
        }
        return userId;
    }
    
    // Update connection status
    static updateConnectionStatus(connected) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const firebaseBadge = document.getElementById('firebaseStatusBadge');
        
        if (connected) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Online';
            firebaseBadge.innerHTML = '<i class="fas fa-wifi"></i> <span>Connected</span>';
            firebaseBadge.className = 'connection-badge connected';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Offline';
            firebaseBadge.innerHTML = '<i class="fas fa-wifi-slash"></i> <span>Disconnected</span>';
            firebaseBadge.className = 'connection-badge disconnected';
        }
    }
    
    // Update notifications UI
    static updateNotificationsUI() {
        const appState = AppState.getInstance();
        const container = document.getElementById('notificationsContainer');
        const countElement = document.getElementById('notificationCount');
        const unreadElement = document.getElementById('unreadCount');
        
        if (appState.notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-inbox"></i>
                    <p>No notifications yet</p>
                    <small>Game challenges will appear here</small>
                </div>
            `;
            countElement.textContent = '0 notifications';
            unreadElement.style.display = 'none';
            return;
        }
        
        // Calculate unread count
        const unreadCount = appState.notifications.filter(n => !n.read).length;
        
        // Update counts
        countElement.textContent = `${appState.notifications.length} notification${appState.notifications.length !== 1 ? 's' : ''}`;
        if (unreadCount > 0) {
            unreadElement.textContent = `${unreadCount} new`;
            unreadElement.style.display = 'inline';
        } else {
            unreadElement.style.display = 'none';
        }
        
        // Render notifications
        container.innerHTML = '';
        appState.notifications.forEach(notification => {
            const notificationEl = document.createElement('div');
            notificationEl.className = `notification-item ${notification.read ? '' : 'new'}`;
            
            const timeAgo = this.getTimeAgo(notification.timestamp);
            const icon = this.getNotificationIcon(notification.type);
            
            notificationEl.innerHTML = `
                <div class="notification-content">
                    <div class="notification-game">
                        ${icon} ${notification.message}
                    </div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
            `;
            
            // Mark as read on click
            notificationEl.addEventListener('click', () => {
                notification.read = true;
                appState.saveNotifications();
                this.updateNotificationsUI();
            });
            
            container.appendChild(notificationEl);
        });
    }
    
    // Get time ago string
    static getTimeAgo(timestamp) {
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
    
    // Get notification icon
    static getNotificationIcon(type) {
        const icons = {
            sent: '<i class="fas fa-paper-plane"></i>',
            received: '<i class="fas fa-inbox"></i>',
            accepted: '<i class="fas fa-check-circle"></i>',
            declined: '<i class="fas fa-times-circle"></i>',
            game_started: '<i class="fas fa-play-circle"></i>'
        };
        return icons[type] || '<i class="fas fa-bell"></i>';
    }
    
    // Show toast notification
    static showToast(title, message, type = 'info') {
        const toast = document.getElementById('notificationToast');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = toast.querySelector('i');
        
        // Set content
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        // Set icon based on type
        const icons = {
            info: 'fa-bell',
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle',
            error: 'fa-exclamation-circle'
        };
        toastIcon.className = `fas ${icons[type] || 'fa-bell'}`;
        
        // Show toast
        toast.classList.add('show');
        
        // Auto-hide after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
    
    // Show modal
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    // Hide modal
    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    // Update friend UI
    static updateFriendUI(friend) {
        const friendStatus = document.getElementById('friendStatus');
        const friendInfo = document.getElementById('friendInfo');
        const friendName = document.getElementById('friendName');
        const friendIdDisplay = document.getElementById('friendIdDisplay');
        
        if (friend.connected && friend.id) {
            friendStatus.textContent = `${friend.name}: ${friend.isOnline ? 'Online' : 'Offline'}`;
            friendStatus.style.color = friend.isOnline ? '#4ade80' : '#f72585';
            
            friendName.textContent = friend.name;
            friendIdDisplay.textContent = UI.formatUserId(friend.id);
            friendInfo.style.display = 'flex';
        } else {
            friendStatus.textContent = 'Not connected';
            friendStatus.style.color = '#f72585';
            friendInfo.style.display = 'none';
        }
    }
}

// Game Manager
class GameManager {
    static async sendChallenge(game) {
        const appState = AppState.getInstance();
        const firebaseService = appState.firebaseService;
        
        if (!appState.friend.connected || !appState.friend.firebaseUid) {
            UI.showToast('Error', 'Please connect to a friend first', 'error');
            return;
        }
        
        if (!firebaseService.connected) {
            UI.showToast('Error', 'Cannot send challenge while offline', 'error');
            return;
        }
        
        const gameNames = {
            pool: '8-Ball Pool',
            chess: 'Chess',
            poker: 'Poker',
            tictactoe: 'Tic-Tac-Toe'
        };
        
        const gameName = gameNames[game] || game;
        
        // Create request
        const requestId = `req_${Date.now()}_${appState.currentUser.sessionId}`;
        const request = {
            from: appState.currentUser.firebaseUid,
            fromName: appState.currentUser.name,
            fromPublicId: appState.currentUser.publicId,
            to: appState.friend.firebaseUid,
            game: game,
            gameName: gameName,
            status: 'pending',
            timestamp: Date.now(),
            sessionId: appState.currentUser.sessionId
        };
        
        try {
            // Save to Firebase
            await firebaseService.database.ref(`requests/${appState.friend.firebaseUid}/${requestId}`).set(request);
            
            // Add notification
            appState.addNotification(`You challenged to ${gameName}`, game, 'sent');
            
            UI.showToast('Challenge Sent', `You challenged to ${gameName}`, 'success');
            
        } catch (error) {
            console.error('Failed to send challenge:', error);
            UI.showToast('Error', 'Failed to send challenge', 'error');
        }
    }
    
    static async acceptRequest(request, requestId) {
        const appState = AppState.getInstance();
        const firebaseService = appState.firebaseService;
        
        try {
            // Update request status
            await firebaseService.database.ref(`requests/${appState.currentUser.firebaseUid}/${requestId}`).update({
                status: 'accepted'
            });
            
            // Notify sender
            await firebaseService.database.ref(`requests/${request.from}/${requestId}`).update({
                status: 'accepted'
            });
            
            // Add notification
            appState.addNotification(`You accepted ${request.fromName}'s ${request.gameName} challenge`, request.game, 'accepted');
            
            // Show success
            UI.showToast('Challenge Accepted', `Starting ${request.gameName}...`, 'success');
            
            // Simulate game launch
            setTimeout(() => {
                this.simulateGameLaunch(request.game, request.fromName);
            }, 1000);
            
        } catch (error) {
            console.error('Failed to accept challenge:', error);
            UI.showToast('Error', 'Failed to accept challenge', 'error');
        }
    }
    
    static async declineRequest(request, requestId) {
        const appState = AppState.getInstance();
        const firebaseService = appState.firebaseService;
        
        try {
            await firebaseService.database.ref(`requests/${appState.currentUser.firebaseUid}/${requestId}`).update({
                status: 'declined'
            });
            
            appState.addNotification(`You declined ${request.fromName}'s ${request.gameName} challenge`, request.game, 'declined');
            UI.showToast('Challenge Declined', `Declined ${request.gameName} challenge`, 'warning');
            
        } catch (error) {
            console.error('Failed to decline challenge:', error);
            UI.showToast('Error', 'Failed to decline challenge', 'error');
        }
    }
    
    static simulateGameLaunch(game, opponent) {
        // In a real app, this would launch the actual game
        console.log(`Launching ${game} game with ${opponent}`);
        
        // Show game starting message
        setTimeout(() => {
            UI.showToast('Game Started', `Playing with ${opponent}`, 'success');
        }, 2000);
    }
}

// Event Manager
class EventManager {
    static initialize() {
        this.setupUserEvents();
        this.setupFriendEvents();
        this.setupGameEvents();
        this.setupModalEvents();
        this.setupThemeEvents();
        this.setupPWAEvents();
    }
    
    static setupUserEvents() {
        const appState = AppState.getInstance();
        
        // Username input
        document.getElementById('username').addEventListener('input', (e) => {
            appState.currentUser.name = e.target.value || `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
            localStorage.setItem('playSync_userName', appState.currentUser.name);
            appState.updateUserInFirebase();
        });
        
        // Copy ID button
        document.getElementById('copyIdBtn').addEventListener('click', () => {
            navigator.clipboard.writeText(appState.currentUser.publicId)
                .then(() => UI.showToast('Copied', 'User ID copied to clipboard', 'success'))
                .catch(() => UI.showToast('Error', 'Failed to copy ID', 'error'));
        });
        
        // New User button
        document.getElementById('newUserBtn').addEventListener('click', async () => {
            if (confirm('Create a new user ID? This will disconnect you from current connections.')) {
                const newId = appState.generateUserId();
                appState.currentUser.publicId = newId;
                localStorage.setItem('playSync_userId', newId);
                appState.friend.connected = false;
                appState.friend.id = null;
                
                // Update Firebase
                await appState.updateUserInFirebase();
                
                // Update UI
                UI.updateUserUI();
                UI.updateFriendUI(appState.friend);
                
                UI.showToast('New User', `Your new ID: ${UI.formatUserId(newId)}`, 'success');
            }
        });
        
        // Share button
        document.getElementById('shareIdBtn').addEventListener('click', () => {
            const shareUrl = `${window.location.origin}${window.location.pathname}?userid=${appState.currentUser.publicId}`;
            document.getElementById('shareLink').value = shareUrl;
            document.getElementById('directId').value = appState.currentUser.publicId;
            
            // Generate QR code
            const qrContainer = document.getElementById('qrCodeContainer');
            qrContainer.innerHTML = '';
            try {
                QRCode.toCanvas(qrContainer, shareUrl, {
                    width: 160,
                    height: 160,
                    margin: 1,
                    color: { dark: '#000000', light: '#FFFFFF' }
                });
            } catch (error) {
                qrContainer.innerHTML = '<div class="qr-placeholder"><i class="fas fa-qrcode"></i><p>QR code error</p></div>';
            }
            
            UI.showModal('shareModal');
        });
        
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            location.reload();
        });
    }
    
    static setupFriendEvents() {
        const appState = AppState.getInstance();
        
        // Connect button
        document.getElementById('connectBtn').addEventListener('click', async () => {
            const friendIdInput = document.getElementById('friendId');
            let friendId = friendIdInput.value.trim();
            
            if (!friendId) {
                UI.showToast('Error', 'Please enter a friend ID', 'error');
                return;
            }
            
            // Extract ID from URL if needed
            if (friendId.includes('user_')) {
                const match = friendId.match(/user_[a-z0-9_]+/i);
                if (match) friendId = match[0];
            }
            
            if (friendId === appState.currentUser.publicId) {
                UI.showToast('Error', 'Cannot connect to yourself', 'error');
                return;
            }
            
            if (!friendId.startsWith('user_')) {
                UI.showToast('Error', 'Invalid user ID format', 'error');
                return;
            }
            
            // Show connecting status
            const friendStatus = document.getElementById('friendStatus');
            friendStatus.textContent = 'Searching...';
            friendStatus.style.color = '#f8961e';
            
            try {
                // Search for friend in Firebase
                const snapshot = await appState.firebaseService.database.ref('users')
                    .orderByChild('publicId')
                    .equalTo(friendId)
                    .once('value');
                
                if (snapshot.exists()) {
                    let friendFirebaseUid = null;
                    let friendData = null;
                    
                    snapshot.forEach((child) => {
                        friendFirebaseUid = child.key;
                        friendData = child.val();
                        return true;
                    });
                    
                    if (friendFirebaseUid && friendData) {
                        appState.friend = {
                            id: friendData.publicId,
                            name: friendData.name,
                            firebaseUid: friendFirebaseUid,
                            isOnline: friendData.status === 'online',
                            connected: true
                        };
                        
                        // Setup friend status listener
                        appState.firebaseService.database.ref(`users/${friendFirebaseUid}`)
                            .on('value', (snap) => {
                                if (snap.exists()) {
                                    const data = snap.val();
                                    appState.friend.isOnline = data.status === 'online';
                                    appState.friend.name = data.name;
                                    UI.updateFriendUI(appState.friend);
                                }
                            });
                        
                        UI.showToast('Connected', `Connected to ${friendData.name}`, 'success');
                        
                    } else {
                        throw new Error('Friend data not found');
                    }
                    
                } else {
                    UI.showToast('Error', 'Friend not found or offline', 'error');
                    friendStatus.textContent = 'Not found';
                }
                
            } catch (error) {
                console.error('Connection error:', error);
                UI.showToast('Error', 'Failed to connect to friend', 'error');
                friendStatus.textContent = 'Error';
            }
        });
        
        // Disconnect button
        document.getElementById('disconnectBtn').addEventListener('click', () => {
            appState.friend.connected = false;
            appState.friend.id = null;
            appState.friend.firebaseUid = null;
            UI.updateFriendUI(appState.friend);
            UI.showToast('Disconnected', 'Friend connection ended', 'warning');
        });
        
        // Friend ID input paste handling
        document.getElementById('friendId').addEventListener('paste', (e) => {
            setTimeout(() => {
                const pasted = e.target.value;
                if (pasted.includes('user_')) {
                    const match = pasted.match(/user_[a-z0-9_]+/i);
                    if (match) e.target.value = match[0];
                }
            }, 10);
        });
    }
    
    static setupGameEvents() {
        // Challenge buttons
        document.querySelectorAll('.challenge-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const game = e.target.closest('[data-game]').getAttribute('data-game');
                GameManager.sendChallenge(game);
            });
        });
        
        // Quick action buttons
        document.getElementById('quickPoolBtn').addEventListener('click', () => GameManager.sendChallenge('pool'));
        document.getElementById('quickChessBtn').addEventListener('click', () => GameManager.sendChallenge('chess'));
        
        // Test connection button
        document.getElementById('sendTestBtn').addEventListener('click', () => {
            const appState = AppState.getInstance();
            UI.showToast('Test', `Connection: ${appState.firebaseService.connected ? 'OK' : 'Offline'}`, 'info');
        });
    }
    
    static setupModalEvents() {
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(button => {
            button.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.classList.remove('show');
            });
        });
        
        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
        
        // Copy link button
        document.getElementById('copyLinkBtn').addEventListener('click', () => {
            const input = document.getElementById('shareLink');
            input.select();
            navigator.clipboard.writeText(input.value)
                .then(() => UI.showToast('Copied', 'Link copied to clipboard', 'success'));
        });
        
        // Copy direct ID button
        document.getElementById('copyDirectIdBtn').addEventListener('click', () => {
            const input = document.getElementById('directId');
            input.select();
            navigator.clipboard.writeText(input.value)
                .then(() => UI.showToast('Copied', 'ID copied to clipboard', 'success'));
        });
        
        // Toast close
        document.querySelector('.toast-close').addEventListener('click', () => {
            document.getElementById('notificationToast').classList.remove('show');
        });
    }
    
    static setupThemeEvents() {
        const toggle = document.getElementById('themeToggle');
        const text = toggle.querySelector('.theme-text');
        
        toggle.addEventListener('click', () => {
            const body = document.body;
            const isLight = body.classList.contains('light-theme');
            
            if (isLight) {
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
        });
        
        // Load saved theme
        const savedTheme = localStorage.getItem('playSync_theme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            text.textContent = 'Light';
            toggle.innerHTML = '<i class="fas fa-sun"></i> <span class="theme-text">Light</span>';
        }
    }
    
    static setupPWAEvents() {
        let deferredPrompt;
        
        // Before install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Show install prompt after delay
            setTimeout(() => {
                const dismissed = localStorage.getItem('playSync_dismissedInstall');
                if (!dismissed && deferredPrompt) {
                    document.getElementById('installPrompt').classList.add('show');
                }
            }, 5000);
        });
        
        // Install button
        document.getElementById('installBtn').addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    deferredPrompt = null;
                    document.getElementById('installPrompt').classList.remove('show');
                });
            }
        });
        
        // Dismiss install
        document.getElementById('dismissInstall').addEventListener('click', () => {
            document.getElementById('installPrompt').classList.remove('show');
            localStorage.setItem('playSync_dismissedInstall', 'true');
        });
        
        // App installed
        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            UI.showToast('Installed', 'PlaySync Arena is now installed!', 'success');
        });
    }
}

// Database Listener
class DatabaseListener {
    static initialize() {
        const appState = AppState.getInstance();
        const firebaseService = appState.firebaseService;
        
        if (!firebaseService.user || !firebaseService.database) return;
        
        // Listen for incoming requests
        firebaseService.database.ref(`requests/${firebaseService.user.uid}`)
            .on('child_added', (snapshot) => {
                const request = snapshot.val();
                if (request && request.status === 'pending') {
                    if (request.sessionId !== appState.currentUser.sessionId) {
                        this.handleIncomingRequest(request, snapshot.key);
                    }
                }
            });
        
        // Listen for request updates
        firebaseService.database.ref(`requests/${firebaseService.user.uid}`)
            .on('child_changed', (snapshot) => {
                const request = snapshot.val();
                if (request) {
                    if (request.status === 'accepted') {
                        this.handleRequestAccepted(request);
                    } else if (request.status === 'declined') {
                        appState.addNotification(
                            `${request.fromName} declined your ${request.gameName} challenge`,
                            request.game,
                            'declined'
                        );
                    }
                }
            });
    }
    
    static handleIncomingRequest(request, requestId) {
        const appState = AppState.getInstance();
        
        // Show notification
        UI.showToast('New Challenge', `${request.fromName} wants to play ${request.gameName}`);
        
        // Add to notifications
        appState.addNotification(
            `${request.fromName} challenged you to ${request.gameName}`,
            request.game,
            'received'
        );
        
        // Show modal if page is visible
        if (document.visibilityState === 'visible') {
            this.showRequestModal(request, requestId);
        } else {
            // Store for later
            appState.pendingRequest = { request, requestId };
        }
    }
    
    static showRequestModal(request, requestId) {
        const modal = document.getElementById('requestModal');
        const requestInfo = document.getElementById('requestInfo');
        
        requestInfo.innerHTML = `
            <div class="game-request-info">
                <p><strong>${request.fromName}</strong> wants to play</p>
                <p><i class="fas fa-${request.game}"></i> <strong>${request.gameName}</strong></p>
                <p>Do you accept the challenge?</p>
            </div>
        `;
        
        // Setup buttons
        document.getElementById('acceptBtn').onclick = () => {
            GameManager.acceptRequest(request, requestId);
            modal.classList.remove('show');
        };
        
        document.getElementById('declineBtn').onclick = () => {
            GameManager.declineRequest(request, requestId);
            modal.classList.remove('show');
        };
        
        document.getElementById('blockBtn').onclick = () => {
            if (confirm(`Block ${request.fromName}? They won't be able to send you challenges.`)) {
                // In a real app, you would implement blocking logic
                UI.showToast('Blocked', `${request.fromName} has been blocked`, 'warning');
                modal.classList.remove('show');
            }
        };
        
        // Show modal
        modal.classList.add('show');
    }
    
    static handleRequestAccepted(request) {
        const appState = AppState.getInstance();
        
        if (request.sessionId !== appState.currentUser.sessionId) return;
        
        UI.showToast('Challenge Accepted', `Your ${request.gameName} challenge was accepted`, 'success');
        
        appState.addNotification(
            `Your ${request.gameName} challenge was accepted`,
            request.game,
            'accepted'
        );
        
        // Simulate game launch
        setTimeout(() => {
            GameManager.simulateGameLaunch(request.game, 'your friend');
        }, 1000);
    }
}

// Initialize application
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize app state
        const appState = AppState.getInstance();
        await appState.initialize();
        
        // Initialize event listeners
        EventManager.initialize();
        
        // Initialize database listeners
        DatabaseListener.initialize();
        
        // Hide loading spinner
        setTimeout(() => {
            document.getElementById('loadingSpinner').style.display = 'none';
            UI.showToast('Welcome', 'PlaySync Arena is ready!', 'success');
        }, 1000);
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        document.getElementById('loadingSpinner').innerHTML = `
            <div style="text-align: center;">
                <p style="color: #f72585; margin-bottom: 20px;">Failed to load application</p>
                <button onclick="location.reload()" style="
                    background: #4361ee;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                ">Retry</button>
            </div>
        `;
    }
});

// Handle visibility changes
document.addEventListener('visibilitychange', () => {
    const appState = AppState.getInstance();
    
    if (document.visibilityState === 'visible' && appState.pendingRequest) {
        const { request, requestId } = appState.pendingRequest;
        DatabaseListener.showRequestModal(request, requestId);
        appState.pendingRequest = null;
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    UI.showToast('Back Online', 'Reconnecting to server...', 'info');
});

window.addEventListener('offline', () => {
    UI.showToast('Offline', 'Working in offline mode', 'warning');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    const appState = AppState.getInstance();
    if (appState.firebaseService) {
        appState.firebaseService.cleanup();
    }
});
