const firebaseConfig = {
  apiKey: "AIzaSyAlKamcGfK-kUupKFfH-rjiS54gZU_csf0",
  authDomain: "playsync-arena.firebaseapp.com",
  databaseURL: "https://playsync-arena-default-rtdb.firebaseio.com",
  projectId: "playsync-arena",
  storageBucket: "playsync-arena.firebasestorage.app",
  messagingSenderId: "989668959512",
  appId: "1:989668959512:web:016b68c8fb932f2e9d2a6d"
};


// App State
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
        showToast('Firebase Error', error.message, 'error');
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
        }
    });
}

// Sign in anonymously
async function signInAnonymously() {
    try {
        const userCredential = await auth.signInAnonymously();
        currentUser.firebaseUid = userCredential.user.uid;
        console.log('✅ Signed in anonymously:', currentUser.firebaseUid);
        showToast('Authenticated', 'User signed in successfully', 'success');
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

// Initialize user
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
        showToast('ID Loaded', 'Using ID from share link', 'info');
    } else if (!userId) {
        userId = generateUserId();
        localStorage.setItem('playSync_userId', userId);
        showToast('New User', 'You have a new unique ID', 'info');
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
    
    // Update UI
    document.getElementById('username').value = currentUser.name;
    document.getElementById('userId').textContent = formatUserId(currentUser.publicId);
    document.getElementById('userId').title = `Full ID: ${currentUser.publicId}`;
}

// Generate user ID
function generateUserId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `user_${randomStr}_${timestamp}`;
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
    
    if (statusDot && statusText) {
        if (connected) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Online';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Offline';
        }
    }
    
    // Update Firebase badge if exists
    const firebaseBadge = document.getElementById('firebaseStatusBadge');
    if (firebaseBadge) {
        if (connected) {
            firebaseBadge.innerHTML = '<i class="fas fa-wifi"></i> <span>Connected</span>';
            firebaseBadge.className = 'connection-badge connected';
        } else {
            firebaseBadge.innerHTML = '<i class="fas fa-wifi-slash"></i> <span>Disconnected</span>';
            firebaseBadge.className = 'connection-badge disconnected';
        }
    }
}

// Show toast notification
function showToast(title, message, type = 'info') {
    console.log(`Toast: ${title} - ${message}`);
    
    const toast = document.getElementById('notificationToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastTitle || !toastMessage) {
        // Create temporary toast if elements don't exist
        const tempToast = document.createElement('div');
        tempToast.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; 
            background: #333; color: white; padding: 15px; 
            border-radius: 8px; z-index: 9999;
        `;
        tempToast.innerHTML = `<strong>${title}</strong><br>${message}`;
        document.body.appendChild(tempToast);
        setTimeout(() => tempToast.remove(), 3000);
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
                .then(() => showToast('Copied', 'User ID copied', 'success'))
                .catch(() => showToast('Error', 'Failed to copy', 'error'));
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
}

// Initialize app
async function initializeApp() {
    console.log('🚀 Initializing PlaySync Arena...');
    
    // Hide loading spinner
    setTimeout(() => {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.style.display = 'none';
    }, 500);
    
    // Initialize user
    initializeUser();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize Firebase
    const firebaseConnected = await initializeFirebase();
    
    if (!firebaseConnected) {
        showToast('Offline Mode', 'Using local storage only', 'warning');
        updateConnectionStatus(false);
    }
    
    // Welcome message
    setTimeout(() => {
        showToast('Welcome', 'PlaySync Arena is ready!', 'success');
    }, 1000);
}

// Start app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
