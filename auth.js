// auth.js - Phone Number Authentication and User Management (WITH SMS RESTORED)
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.otpTimer = null;
        this.pendingOTP = null;
        this.pendingPhone = null;
        console.log('🔐 Auth Manager created');
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            console.log('🔄 Initializing Auth Manager...');
            
            // Wait for database to be ready
            if (!window.transparentDB) {
                console.log('⏳ Waiting for database...');
                await new Promise(resolve => {
                    const checkDB = () => {
                        if (window.transparentDB && window.transparentDB.db) {
                            console.log('✅ Database ready for auth');
                            resolve();
                        } else {
                            setTimeout(checkDB, 100);
                        }
                    };
                    checkDB();
                });
            }

            // Check if returning from SMS app
            this.checkReturnFromSMS();

            // Check for existing session
            await this.checkExistingSession();
            this.isInitialized = true;
            console.log('✅ Auth manager initialized successfully');

        } catch (error) {
            console.error('❌ Auth initialization failed:', error);
        }
    }

    // Check for returning from SMS app
    checkReturnFromSMS() {
        try {
            const savedOtp = sessionStorage.getItem('tt_otp_data');
            if (savedOtp) {
                const otpData = JSON.parse(savedOtp);
                this.pendingOTP = otpData.otp;
                this.pendingPhone = otpData.phone;
                
                // If OTP section is hidden but we have OTP data, show it
                const otpSection = document.getElementById('otpSection');
                if (otpSection && otpSection.classList.contains('hidden')) {
                    this.showOTPSection();
                    this.showAuthStatus('Returned from SMS - enter the OTP you sent.', 'info');
                }
                console.log('📱 Detected return from SMS app');
            }
        } catch (e) {
            console.warn('Could not restore OTP from sessionStorage', e);
        }
    }

    // Initialize event listeners for auth UI
    initAuthEvents() {
        console.log('🔌 Initializing auth event listeners...');
        
        const sendOtpBtn = document.getElementById('sendOtpBtn');
        const verifyOtpBtn = document.getElementById('verifyOtpBtn');
        const resendOtpBtn = document.getElementById('resendOtpBtn');
        const phoneInput = document.getElementById('phoneInput');
        const otpInput = document.getElementById('otpInput');

        if (sendOtpBtn) {
            sendOtpBtn.addEventListener('click', () => this.sendOTP());
            console.log('✅ Send OTP button listener added');
        }

        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', () => this.verifyOTP());
            console.log('✅ Verify OTP button listener added');
        }

        if (resendOtpBtn) {
            resendOtpBtn.addEventListener('click', () => this.resendOTP());
            console.log('✅ Resend OTP button listener added');
        }

        // Enter key support
        if (phoneInput) {
            phoneInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendOTP();
            });
        }

        if (otpInput) {
            otpInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.verifyOTP();
            });
        }

        console.log('🎯 All auth event listeners initialized');
    }

    // Send OTP to phone number - WITH SMS FUNCTIONALITY
    async sendOTP() {
        console.log('📤 Starting OTP send process...');
        
        try {
            const phoneInput = document.getElementById('phoneInput');
            const phone = phoneInput.value.trim();

            // Validate phone number
            if (!this.validatePhoneNumber(phone)) {
                this.showAuthStatus('Please enter a valid 10-digit phone number', 'error');
                return;
            }

            // Show loading state
            this.showAuthStatus('Sending OTP...', 'loading');
            document.getElementById('sendOtpBtn').disabled = true;

            // Generate OTP
            const otp = this.generateOTP();
            const fullPhone = '+91' + phone;

            // Store OTP data in memory
            this.pendingOTP = otp;
            this.pendingPhone = fullPhone;
            this.otpTimestamp = Date.now();

            // Also store in sessionStorage as backup
            sessionStorage.setItem('tt_otp_data', JSON.stringify({
                phone: fullPhone,
                otp: otp,
                timestamp: this.otpTimestamp
            }));

            console.log(`✅ OTP ${otp} generated for ${fullPhone}`);
            
            // Show OTP input section
            this.showOTPSection();
            this.startOTPTimer();
            
            // Show status
            this.showAuthStatus('Opening SMS app... Please send the message to complete OTP verification.', 'success');
            
            // ✅ RESTORED SMS FUNCTIONALITY
            const message = `Your OTP for Transparent Transactions is ${otp}. Do not share. Valid for 10 minutes.`;
            const smsUrl = `sms:${fullPhone}?body=${encodeURIComponent(message)}`;
            
            console.log('📱 Opening SMS app...');
            
            // Open SMS app after a short delay
            setTimeout(() => {
                window.location.href = smsUrl;
            }, 1000);

        } catch (error) {
            console.error('❌ Send OTP failed:', error);
            this.showAuthStatus('Failed to send OTP. Please try again.', 'error');
            document.getElementById('sendOtpBtn').disabled = false;
        }
    }

    // Verify entered OTP
    async verifyOTP() {
        console.log('🔍 Starting OTP verification...');
        
        try {
            const otpInput = document.getElementById('otpInput');
            const enteredOtp = otpInput.value.trim();

            if (!enteredOtp || enteredOtp.length !== 6) {
                this.showAuthStatus('Please enter 6-digit OTP', 'error');
                return;
            }

            this.showAuthStatus('Verifying OTP...', 'loading');
            document.getElementById('verifyOtpBtn').disabled = true;

            // Check OTP from memory first
            let validOTP = this.pendingOTP;
            let validPhone = this.pendingPhone;
            let timestamp = this.otpTimestamp;

            // Fallback to sessionStorage
            if (!validOTP) {
                const otpData = JSON.parse(sessionStorage.getItem('tt_otp_data') || '{}');
                validOTP = otpData.otp;
                validPhone = otpData.phone;
                timestamp = otpData.timestamp;
            }

            // Check if OTP exists and not expired (10 minutes)
            if (!validOTP || !validPhone || (Date.now() - timestamp) > 10 * 60 * 1000) {
                this.showAuthStatus('OTP expired. Please request a new one.', 'error');
                this.hideOTPSection();
                return;
            }

            console.log(`🔐 Verifying OTP: Entered=${enteredOtp}, Expected=${validOTP}`);

            // Verify OTP
            if (enteredOtp === validOTP) {
                console.log('✅ OTP verified successfully');
                await this.handleSuccessfulAuth(validPhone);
            } else {
                console.log('❌ OTP mismatch');
                this.showAuthStatus('Invalid OTP. Please try again.', 'error');
                document.getElementById('verifyOtpBtn').disabled = false;
            }

        } catch (error) {
            console.error('❌ Verify OTP failed:', error);
            this.showAuthStatus('Verification failed. Please try again.', 'error');
            document.getElementById('verifyOtpBtn').disabled = false;
        }
    }

    // Handle successful authentication
    async handleSuccessfulAuth(phone) {
        console.log('🎉 Starting successful authentication for:', phone);
        
        try {
            // Clear OTP data
            this.pendingOTP = null;
            this.pendingPhone = null;
            sessionStorage.removeItem('tt_otp_data');
            
            // Stop OTP timer
            this.stopOTPTimer();

            // Create or get user
            console.log('👤 Creating/updating user in database...');
            const user = await this.createOrUpdateUser(phone);
            
            // Set current user
            this.currentUser = user;
            console.log('✅ User set:', user.phone);
            
            // Save session
            this.saveSession(user);
            console.log('💾 Session saved to localStorage');
            
            // Update UI
            console.log('🖥️ Showing app screen...');
            await uiManager.showAppScreen(user);
            
            this.showAuthStatus('Successfully signed in!', 'success');
            console.log('🎊 Authentication completed successfully!');

        } catch (error) {
            console.error('❌ Authentication failed:', error);
            this.showAuthStatus('Authentication failed. Please try again.', 'error');
            this.hideOTPSection();
        }
    }

    // Create or update user in database
    async createOrUpdateUser(phone) {
        const user = {
            id: phone,
            phone: phone,
            name: `User ${phone.slice(-4)}`,
            avatar: '',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };

        try {
            // Try to get existing user
            const existingUser = await transparentDB.getUser(phone);
            
            if (existingUser) {
                // Update existing user
                user.name = existingUser.name;
                user.avatar = existingUser.avatar;
                user.createdAt = existingUser.createdAt;
                await transparentDB.executeTransaction('users', 'readwrite', (store) => {
                    return store.put(user);
                });
                console.log('✅ User updated:', user.phone);
            } else {
                // Create new user
                await transparentDB.addUser(user);
                console.log('✅ New user created:', user.phone);
            }

            return user;
        } catch (error) {
            console.error('❌ Error saving user:', error);
            throw new Error('Failed to save user data');
        }
    }

    // Resend OTP
    async resendOTP() {
        if (this.pendingPhone) {
            const phone = this.pendingPhone.replace('+91', '');
            document.getElementById('phoneInput').value = phone;
            await this.sendOTP();
        }
    }

    // Generate 6-digit OTP
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Validate phone number
    validatePhoneNumber(phone) {
        return /^\d{10}$/.test(phone);
    }

    // Show OTP input section
    showOTPSection() {
        document.getElementById('otpSection').classList.remove('hidden');
        document.getElementById('otpInput').focus();
        console.log('📭 OTP input section shown');
    }

    // Hide OTP input section
    hideOTPSection() {
        document.getElementById('otpSection').classList.add('hidden');
        document.getElementById('sendOtpBtn').disabled = false;
    }

    // Start OTP expiry timer
    startOTPTimer() {
        this.stopOTPTimer();
        
        let timeLeft = 60;
        const timerElement = document.getElementById('otpTimer');
        const countElement = document.getElementById('timerCount');
        const resendBtn = document.getElementById('resendOtpBtn');
        
        timerElement.classList.remove('hidden');
        resendBtn.disabled = true;
        
        this.otpTimer = setInterval(() => {
            timeLeft--;
            countElement.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                this.stopOTPTimer();
                timerElement.classList.add('hidden');
                resendBtn.disabled = false;
            }
        }, 1000);
        
        console.log('⏰ OTP timer started (60 seconds)');
    }

    // Stop OTP timer
    stopOTPTimer() {
        if (this.otpTimer) {
            clearInterval(this.otpTimer);
            this.otpTimer = null;
        }
    }

    // Show authentication status messages
    showAuthStatus(message, type = 'info') {
        const statusElement = document.getElementById('authStatus');
        if (!statusElement) return;

        statusElement.textContent = message;
        statusElement.className = `auth-status ${type}`;
        statusElement.classList.remove('hidden');

        if (type === 'success') {
            setTimeout(() => {
                statusElement.classList.add('hidden');
            }, 5000);
        }
    }

    // Check for existing session
    async checkExistingSession() {
        try {
            const sessionData = localStorage.getItem('tt_user_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                
                // Check if session is still valid (30 days)
                const sessionAge = Date.now() - new Date(session.lastActive).getTime();
                const maxSessionAge = 30 * 24 * 60 * 60 * 1000;
                
                if (sessionAge < maxSessionAge) {
                    const user = await transparentDB.getUser(session.userId);
                    if (user) {
                        this.currentUser = user;
                        this.updateSessionActivity();
                        console.log('✅ Existing session found:', user.phone);
                        return user;
                    }
                } else {
                    console.log('📅 Session expired, clearing...');
                    this.clearSession();
                }
            }
        } catch (error) {
            console.error('❌ Session check failed:', error);
            this.clearSession();
        }
        return null;
    }

    // Save user session
    saveSession(user) {
        const session = {
            userId: user.id,
            lastActive: new Date().toISOString(),
            userPhone: user.phone
        };
        localStorage.setItem('tt_user_session', JSON.stringify(session));
    }

    // Update session activity timestamp
    updateSessionActivity() {
        const sessionData = localStorage.getItem('tt_user_session');
        if (sessionData) {
            const session = JSON.parse(sessionData);
            session.lastActive = new Date().toISOString();
            localStorage.setItem('tt_user_session', JSON.stringify(session));
        }
    }

    // Clear session data
    clearSession() {
        localStorage.removeItem('tt_user_session');
        sessionStorage.removeItem('tt_otp_data');
        this.pendingOTP = null;
        this.pendingPhone = null;
        this.currentUser = null;
        this.stopOTPTimer();
        console.log('🧹 All sessions cleared');
    }

    // Get current user
    async getCurrentUser() {
        if (this.currentUser) {
            this.updateSessionActivity();
            return this.currentUser;
        }
        
        const user = await this.checkExistingSession();
        return user;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Logout user
    async logout() {
        try {
            console.log('🚪 Logging out user...');
            this.clearSession();
            await uiManager.showLoginScreen();
            uiManager.showStatus('Successfully signed out', 'success');
            console.log('✅ User logged out successfully');
            
        } catch (error) {
            console.error('❌ Logout error:', error);
            this.clearSession();
            window.location.reload();
        }
    }
}

// Initialize auth manager when script loads
const authManager = new AuthManager();

// Export to global scope
window.authManager = authManager;

// Global auth functions
window.logout = () => {
    authManager.logout();
};

window.showProfile = async () => {
    if (authManager.currentUser) {
        const stats = await authManager.getUserStats();
        const message = `Profile Information:\n\nPhone: ${authManager.currentUser.phone}\nMember Since: ${new Date(authManager.currentUser.createdAt).toLocaleDateString()}\nTotal Transactions: ${stats?.totalTransactions || 0}\nActive Contacts: ${stats?.activeContacts || 0}`;
        alert(message);
    }
};

window.showSettings = () => {
    alert('Settings will be available in a future update');
};

window.exportData = async () => {
    if (!authManager.currentUser) return;
    
    try {
        const transactions = await transparentDB.getLedgerEntries(authManager.currentUser.phone);
        const contacts = await transparentDB.getContacts(authManager.currentUser.phone);
        const pending = await transparentDB.getPendingTransactions(authManager.currentUser.phone);
        
        const exportData = {
            user: authManager.currentUser,
            exportDate: new Date().toISOString(),
            transactions: transactions,
            contacts: contacts,
            pendingTransactions: pending
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transparent-transactions-${authManager.currentUser.phone}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        uiManager.showStatus('Data exported successfully', 'success');
    } catch (error) {
        console.error('Export failed:', error);
        uiManager.showError('Failed to export data');
    }
};

// Initialize auth events when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        authManager.initAuthEvents();
    }, 500);
});

// Session maintenance
setInterval(() => {
    if (authManager.currentUser) {
        authManager.validateSession?.().catch(console.error);
    }
}, 60 * 60 * 1000);

// Update session activity on user interaction
document.addEventListener('click', () => {
    if (authManager.currentUser) {
        authManager.updateSessionActivity();
    }
});
