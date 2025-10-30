// auth.js - Phone Number Authentication and User Management (FIXED VERSION)
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.otpTimer = null;
        this.otpExpiryTime = null;
        this.pendingOTP = null; // Store OTP in memory
        this.pendingPhone = null; // Store phone in memory
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Wait for database to be ready
            if (!window.transparentDB || !window.transparentDB.db) {
                await new Promise(resolve => {
                    const checkDB = () => {
                        if (window.transparentDB && window.transparentDB.db) {
                            resolve();
                        } else {
                            setTimeout(checkDB, 100);
                        }
                    };
                    checkDB();
                });
            }

            // Check for existing session
            await this.checkExistingSession();
            this.isInitialized = true;
            console.log('Auth manager initialized');
        } catch (error) {
            console.error('Auth initialization failed:', error);
        }
    }

    // Initialize event listeners for auth UI
    initAuthEvents() {
        const sendOtpBtn = document.getElementById('sendOtpBtn');
        const verifyOtpBtn = document.getElementById('verifyOtpBtn');
        const resendOtpBtn = document.getElementById('resendOtpBtn');
        const phoneInput = document.getElementById('phoneInput');
        const otpInput = document.getElementById('otpInput');

        if (sendOtpBtn) {
            sendOtpBtn.addEventListener('click', () => this.sendOTP());
        }

        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', () => this.verifyOTP());
        }

        if (resendOtpBtn) {
            resendOtpBtn.addEventListener('click', () => this.resendOTP());
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
    }

    // Send OTP to phone number
    async sendOTP() {
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

            // Store OTP data in memory (FIXED: Using instance variables)
            this.pendingOTP = otp;
            this.pendingPhone = fullPhone;
            this.otpTimestamp = Date.now();

            // Also store in sessionStorage as backup
            sessionStorage.setItem('tt_otp_data', JSON.stringify({
                phone: fullPhone,
                otp: otp,
                timestamp: this.otpTimestamp
            }));

            // DEMO: Show OTP in console and alert for testing
            console.log(`DEMO: OTP ${otp} sent to ${fullPhone}`);
            this.showAuthStatus(`DEMO: OTP is ${otp} (check console)`, 'success');
            
            // Show OTP input section
            this.showOTPSection();
            
            // Start OTP timer
            this.startOTPTimer();
            
            // In production, you would enable this:
            // await this.sendRealSMS(fullPhone, otp);

        } catch (error) {
            console.error('Send OTP failed:', error);
            this.showAuthStatus('Failed to send OTP. Please try again.', 'error');
            document.getElementById('sendOtpBtn').disabled = false;
        }
    }

    // Verify entered OTP
    async verifyOTP() {
        try {
            const otpInput = document.getElementById('otpInput');
            const enteredOtp = otpInput.value.trim();

            if (!enteredOtp || enteredOtp.length !== 6) {
                this.showAuthStatus('Please enter 6-digit OTP', 'error');
                return;
            }

            this.showAuthStatus('Verifying OTP...', 'loading');
            document.getElementById('verifyOtpBtn').disabled = true;

            // Check OTP from memory first (FIXED: Use instance variables)
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

            console.log(`Verifying: Entered=${enteredOtp}, Expected=${validOTP}`); // Debug log

            // Verify OTP (FIXED: Direct comparison)
            if (enteredOtp === validOTP) {
                // OTP verified successfully
                await this.handleSuccessfulAuth(validPhone);
            } else {
                this.showAuthStatus('Invalid OTP. Please try again.', 'error');
                document.getElementById('verifyOtpBtn').disabled = false;
                console.log(`OTP mismatch: ${enteredOtp} vs ${validOTP}`); // Debug log
            }

        } catch (error) {
            console.error('Verify OTP failed:', error);
            this.showAuthStatus('Verification failed. Please try again.', 'error');
            document.getElementById('verifyOtpBtn').disabled = false;
        }
    }

    // Resend OTP
    async resendOTP() {
        if (this.pendingPhone) {
            // Extract phone number without country code
            const phone = this.pendingPhone.replace('+91', '');
            document.getElementById('phoneInput').value = phone;
            await this.sendOTP();
        }
    }

    // Handle successful authentication
    async handleSuccessfulAuth(phone) {
        try {
            // Clear OTP data
            this.pendingOTP = null;
            this.pendingPhone = null;
            sessionStorage.removeItem('tt_otp_data');
            
            // Stop OTP timer
            this.stopOTPTimer();

            // Create or get user
            const user = await this.createOrUpdateUser(phone);
            
            // Set current user
            this.currentUser = user;
            
            // Save session
            this.saveSession(user);
            
            // Update UI
            await uiManager.showAppScreen(user);
            
            this.showAuthStatus('Successfully signed in!', 'success');

        } catch (error) {
            console.error('Authentication failed:', error);
            this.showAuthStatus('Authentication failed. Please try again.', 'error');
            this.hideOTPSection();
        }
    }

    // Create or update user in database
    async createOrUpdateUser(phone) {
        const user = {
            id: phone, // Use phone as ID
            phone: phone,
            name: `User ${phone.slice(-4)}`, // Default name
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
                console.log('User updated:', user.phone);
            } else {
                // Create new user
                await transparentDB.addUser(user);
                console.log('New user created:', user.phone);
            }

            return user;
        } catch (error) {
            console.error('Error saving user:', error);
            throw new Error('Failed to save user data');
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
    }

    // Hide OTP input section
    hideOTPSection() {
        document.getElementById('otpSection').classList.add('hidden');
        document.getElementById('sendOtpBtn').disabled = false;
    }

    // Start OTP expiry timer
    startOTPTimer() {
        this.stopOTPTimer(); // Clear any existing timer
        
        let timeLeft = 60; // 60 seconds
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

        // Auto-hide success messages after 5 seconds
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
                const maxSessionAge = 30 * 24 * 60 * 60 * 1000; // 30 days
                
                if (sessionAge < maxSessionAge) {
                    const user = await transparentDB.getUser(session.userId);
                    if (user) {
                        this.currentUser = user;
                        this.updateSessionActivity();
                        return user;
                    }
                } else {
                    // Session expired
                    this.clearSession();
                }
            }
        } catch (error) {
            console.error('Session check failed:', error);
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
            // Clear all sessions
            this.clearSession();
            
            // Clear any pending operations
            this.currentUser = null;
            
            // Show login screen
            await uiManager.showLoginScreen();
            
            uiManager.showStatus('Successfully signed out', 'success');
            
        } catch (error) {
            console.error('Logout error:', error);
            // Force logout even if there's an error
            this.clearSession();
            window.location.reload();
        }
    }

    // Get user profile
    async getUserProfile(userId) {
        try {
            return await transparentDB.getUser(userId);
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    // Update user profile
    async updateUserProfile(updates) {
        if (!this.currentUser) {
            throw new Error('No user logged in');
        }

        try {
            const currentUser = await transparentDB.getUser(this.currentUser.id);
            const updatedUser = {
                ...currentUser,
                ...updates,
                updatedAt: new Date().toISOString()
            };

            await transparentDB.executeTransaction('users', 'readwrite', (store) => {
                return store.put(updatedUser);
            });

            this.currentUser = updatedUser;
            this.saveSession(updatedUser);
            
            return updatedUser;
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw new Error('Failed to update profile');
        }
    }

    // Validate user session (for periodic checks)
    async validateSession() {
        if (!this.currentUser) return false;

        try {
            const user = await transparentDB.getUser(this.currentUser.id);
            if (user) {
                this.currentUser = user;
                this.updateSessionActivity();
                return true;
            }
        } catch (error) {
            console.error('Session validation failed:', error);
        }

        // Session is invalid
        this.clearSession();
        return false;
    }

    // Get user statistics
    async getUserStats() {
        if (!this.currentUser) return null;

        try {
            const transactions = await transparentDB.getLedgerEntries(this.currentUser.phone);
            const pending = await transparentDB.getPendingTransactions(this.currentUser.phone);
            
            return {
                totalTransactions: transactions.length,
                pendingApprovals: pending.length,
                activeContacts: await this.getActiveContactsCount(),
                joinedDate: this.currentUser.createdAt
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }

    // Get count of active contacts
    async getActiveContactsCount() {
        if (!this.currentUser) return 0;
        
        try {
            const contacts = await transparentDB.getContacts(this.currentUser.phone);
            return contacts.length;
        } catch (error) {
            console.error('Error counting contacts:', error);
            return 0;
        }
    }

    // Real SMS sending function (placeholder for production)
    async sendRealSMS(phone, otp) {
        // In production, integrate with SMS service like:
        // - Twilio
        // - TextLocal
        // - Fast2SMS
        // - Your custom SMS gateway
        
        const message = `Your OTP for Transparent Transactions is ${otp}. Valid for 10 minutes.`;
        
        // Example with fetch API:
        /*
        const response = await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, message })
        });
        
        if (!response.ok) throw new Error('SMS sending failed');
        */
        
        console.log(`SMS would be sent to ${phone}: ${message}`);
        return true;
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
    }, 100);
});

// Session maintenance - validate every hour
setInterval(() => {
    if (authManager.currentUser) {
        authManager.validateSession().catch(console.error);
    }
}, 60 * 60 * 1000);

// Update session activity on user interaction
document.addEventListener('click', () => {
    if (authManager.currentUser) {
        authManager.updateSessionActivity();
    }
});