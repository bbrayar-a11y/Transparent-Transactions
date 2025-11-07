// auth.js - Authentication and User Management for Transparent Transactions
// Updated to integrate with IndexedDB for persistent user data storage

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.otpAttempts = 0;
        this.maxOtpAttempts = 3;
        this.otpExpiryTime = 2 * 60 * 1000; // 2 minutes in milliseconds
        this.init();
    }

    // Initialize authentication system
    async init() {
        console.log('🔐 Auth Manager initializing...');
        
        try {
            // Wait for database to be ready
            if (window.databaseManager) {
                await window.databaseManager.init();
            }
            
            this.loadCurrentUser();
            this.setupEventListeners();
            console.log('✅ Auth Manager initialized successfully');
            
        } catch (error) {
            console.error('❌ Auth Manager initialization failed:', error);
        }
    }

    // Load user session from persistent storage
    async loadCurrentUser() {
        try {
            // First, try to get from localStorage (for quick access)
            const userData = localStorage.getItem('currentUser');
            
            if (userData) {
                this.currentUser = JSON.parse(userData);
                
                // Verify user still exists in database
                if (this.currentUser && this.currentUser.phone) {
                    const dbUser = await window.databaseManager.getUser(this.currentUser.phone);
                    
                    if (dbUser) {
                        // Update session with latest profile data
                        this.currentUser.profile = dbUser;
                        console.log('👤 User session loaded:', this.currentUser.phone);
                    } else {
                        // User not found in database, clear session
                        console.warn('⚠️ User not found in database, clearing session');
                        this.clearUserSession();
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Error loading user session:', error);
            this.currentUser = null;
        }
    }

    // Setup global authentication event listeners
    setupEventListeners() {
        // Listen for authentication state changes from other components
        document.addEventListener('authStateChange', (event) => {
            this.handleAuthStateChange(event.detail);
        });

        // Listen for storage changes (multiple tabs support)
        window.addEventListener('storage', (event) => {
            if (event.key === 'currentUser') {
                this.loadCurrentUser();
                this.updateAuthUI();
            }
        });

        // Update user activity on user interactions
        document.addEventListener('click', () => {
            this.updateUserActivity();
        });
    }

    // Generate a random 6-digit OTP
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Send OTP to phone number (simulated - integrate with SMS service in production)
    async sendOTP(phoneNumber) {
        return new Promise((resolve, reject) => {
            console.log(`📱 Sending OTP to ${phoneNumber}...`);

            // Validate phone number first
            const validation = this.validatePhoneNumber(phoneNumber);
            if (!validation.valid) {
                reject({
                    success: false,
                    message: validation.message
                });
                return;
            }

            // Simulate API call delay
            setTimeout(async () => {
                try {
                    // Generate and store OTP
                    const otp = this.generateOTP();
                    const otpData = {
                        code: otp,
                        phone: phoneNumber,
                        timestamp: Date.now(),
                        verified: false,
                        attempts: 0
                    };

                    // Store OTP data in database
                    await window.databaseManager.executeTransaction('settings', 'readwrite', (store) => {
                        return store.put({
                            phone: `otp_${phoneNumber}`,
                            ...otpData
                        });
                    });
                    
                    // In development, log the OTP to console
                    console.log(`🔐 OTP for ${phoneNumber}: ${otp} (Expires in ${this.getOtpExpiryMinutes()} minutes)`);
                    
                    resolve({
                        success: true,
                        message: 'OTP sent successfully',
                        expiryMinutes: this.getOtpExpiryMinutes(),
                        otp: otp // Only for development/demo
                    });
                    
                } catch (error) {
                    reject({
                        success: false,
                        message: 'Failed to send OTP',
                        error: error.message
                    });
                }
            }, 1500);
        });
    }

    // Verify OTP against stored value
    async verifyOTP(phoneNumber, enteredOTP) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get OTP data from database
                const otpData = await window.databaseManager.executeTransaction('settings', 'readonly', (store) => {
                    return store.get(`otp_${phoneNumber}`);
                });
                
                // Check if OTP exists
                if (!otpData || !otpData.code) {
                    reject({
                        success: false,
                        message: 'OTP not found. Please request a new OTP.'
                    });
                    return;
                }

                // Check if OTP is expired
                const currentTime = Date.now();
                const otpAge = currentTime - otpData.timestamp;
                
                if (otpAge > this.otpExpiryTime) {
                    // Remove expired OTP
                    await window.databaseManager.executeTransaction('settings', 'readwrite', (store) => {
                        return store.delete(`otp_${phoneNumber}`);
                    });
                    
                    reject({
                        success: false,
                        message: 'OTP has expired. Please request a new OTP.'
                    });
                    return;
                }

                // Check attempt limits
                if (otpData.attempts >= this.maxOtpAttempts) {
                    reject({
                        success: false,
                        message: 'Too many failed attempts. Please request a new OTP.'
                    });
                    return;
                }

                // Check if OTP matches
                if (otpData.code === enteredOTP) {
                    // OTP verified successfully
                    await window.databaseManager.executeTransaction('settings', 'readwrite', (store) => {
                        return store.put({
                            phone: `otp_${phoneNumber}`,
                            ...otpData,
                            verified: true,
                            verifiedAt: currentTime,
                            attempts: otpData.attempts + 1
                        });
                    });
                    
                    // Clear OTP attempts counter
                    this.otpAttempts = 0;
                    
                    resolve({
                        success: true,
                        message: 'OTP verified successfully'
                    });
                    
                } else {
                    // Invalid OTP - increment attempts
                    await window.databaseManager.executeTransaction('settings', 'readwrite', (store) => {
                        return store.put({
                            phone: `otp_${phoneNumber}`,
                            ...otpData,
                            attempts: (otpData.attempts || 0) + 1
                        });
                    });
                    
                    const attemptsLeft = this.maxOtpAttempts - (otpData.attempts + 1);
                    
                    if (attemptsLeft <= 0) {
                        // Too many failed attempts - clear OTP
                        await window.databaseManager.executeTransaction('settings', 'readwrite', (store) => {
                            return store.delete(`otp_${phoneNumber}`);
                        });
                        
                        reject({
                            success: false,
                            message: 'Too many failed attempts. Please request a new OTP.'
                        });
                    } else {
                        reject({
                            success: false,
                            message: `Invalid OTP. ${attemptsLeft} attempts left.`
                        });
                    }
                }
            } catch (error) {
                reject({
                    success: false,
                    message: 'Error verifying OTP',
                    error: error.message
                });
            }
        });
    }

    // Create new user session after successful authentication
    async createUserSession(phoneNumber, userData = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get or create user profile in database
                let userProfile = await window.databaseManager.getUser(phoneNumber);
                
                if (!userProfile) {
                    // Create basic user profile if doesn't exist
                    userProfile = {
                        phone: phoneNumber,
                        isActive: true,
                        createdAt: new Date().toISOString(),
                        ...userData
                    };
                    
                    await window.databaseManager.saveUser(userProfile);
                    console.log('✅ New user profile created:', phoneNumber);
                }

                const userSession = {
                    phone: phoneNumber,
                    isAuthenticated: true,
                    loginTime: new Date().toISOString(),
                    lastActive: new Date().toISOString(),
                    sessionId: this.generateSessionId(),
                    profile: userProfile
                };

                // Store session in localStorage for quick access
                localStorage.setItem('currentUser', JSON.stringify(userSession));
                this.currentUser = userSession;

                // Record login activity in database
                await this.recordLoginActivity(phoneNumber);

                // Trigger auth state change event
                this.triggerAuthStateChange('login', userSession);

                console.log('✅ User session created:', phoneNumber);
                
                resolve({
                    success: true,
                    user: userSession
                });
                
            } catch (error) {
                reject({
                    success: false,
                    message: 'Failed to create user session',
                    error: error.message
                });
            }
        });
    }

    // Record login activity in database
    async recordLoginActivity(phoneNumber) {
        try {
            const activity = {
                phone: phoneNumber,
                type: 'login',
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };

            await window.databaseManager.executeTransaction('settings', 'readwrite', (store) => {
                return store.put({
                    phone: `activity_${phoneNumber}_${Date.now()}`,
                    ...activity
                });
            });
            
        } catch (error) {
            console.error('❌ Error recording login activity:', error);
        }
    }

    // Generate unique session ID
    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser && this.currentUser.isAuthenticated === true;
    }

    // Get current user data
    getCurrentUser() {
        return this.currentUser;
    }

    // Update user activity timestamp
    updateUserActivity() {
        if (this.currentUser) {
            this.currentUser.lastActive = new Date().toISOString();
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
    }

    // Logout user and clear session
    async logout() {
        const userPhone = this.currentUser ? this.currentUser.phone : 'Unknown';
        
        try {
            // Record logout activity
            if (this.currentUser) {
                await this.recordLogoutActivity(userPhone);
            }
            
        } catch (error) {
            console.error('❌ Error recording logout activity:', error);
        } finally {
            // Clear session data
            this.clearUserSession();
            console.log('👋 User logged out:', userPhone);
        }
        
        return {
            success: true,
            message: 'Logged out successfully'
        };
    }

    // Record logout activity
    async recordLogoutActivity(phoneNumber) {
        try {
            const activity = {
                phone: phoneNumber,
                type: 'logout',
                timestamp: new Date().toISOString()
            };

            await window.databaseManager.executeTransaction('settings', 'readwrite', (store) => {
                return store.put({
                    phone: `activity_${phoneNumber}_${Date.now()}`,
                    ...activity
                });
            });
            
        } catch (error) {
            console.error('❌ Error recording logout activity:', error);
        }
    }

    // Clear user session completely
    clearUserSession() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;

        // Trigger auth state change event
        this.triggerAuthStateChange('logout', null);
    }

    // Clear all authentication data (for testing/debugging)
    async clearAllAuthData() {
        try {
            // Clear all OTP and session data from database
            const settings = await window.databaseManager.executeTransaction('settings', 'readonly', (store) => {
                return store.getAll();
            });

            for (const setting of settings) {
                if (setting.phone.startsWith('otp_') || setting.phone.startsWith('activity_')) {
                    await window.databaseManager.executeTransaction('settings', 'readwrite', (store) => {
                        return store.delete(setting.phone);
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Error clearing auth data from database:', error);
        } finally {
            // Clear localStorage
            localStorage.removeItem('currentUser');
            this.currentUser = null;
            this.otpAttempts = 0;
            
            console.log('🧹 All auth data cleared');
        }
    }

    // Trigger authentication state change events
    triggerAuthStateChange(action, userData) {
        const event = new CustomEvent('authStateChange', {
            detail: {
                action: action,
                user: userData,
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(event);
    }

    // Handle authentication state changes from other components
    handleAuthStateChange(detail) {
        console.log(`🔄 Auth state changed: ${detail.action}`, detail.user);
        
        // Update UI based on auth state
        this.updateAuthUI();
    }

    // Update UI elements based on authentication state
    updateAuthUI() {
        const authElements = document.querySelectorAll('[data-auth-state]');
        
        authElements.forEach(element => {
            const requiredState = element.getAttribute('data-auth-state');
            const isVisible = this.isAuthenticated() ? 
                (requiredState === 'authenticated') : 
                (requiredState === 'unauthenticated');
            
            element.style.display = isVisible ? '' : 'none';
        });

        // Update user-specific content if authenticated
        if (this.isAuthenticated() && this.currentUser.profile) {
            const userElements = document.querySelectorAll('[data-user]');
            userElements.forEach(element => {
                const userField = element.getAttribute('data-user');
                if (this.currentUser.profile[userField]) {
                    element.textContent = this.currentUser.profile[userField];
                }
            });
        }
    }

    // Validate phone number format (Indian mobile numbers)
    validatePhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.length !== 10) {
            return {
                valid: false,
                message: 'Phone number must be 10 digits'
            };
        }

        // Indian mobile numbers start with 6,7,8,9
        if (!/^[6-9]\d{9}$/.test(cleaned)) {
            return {
                valid: false,
                message: 'Please enter a valid Indian mobile number'
            };
        }

        return {
            valid: true,
            cleaned: cleaned
        };
    }

    // Get OTP expiry time in minutes
    getOtpExpiryMinutes() {
        return Math.floor(this.otpExpiryTime / (60 * 1000));
    }

    // Check if OTP exists and is valid for phone number
    async hasPendingOTP(phoneNumber) {
        try {
            const otpData = await window.databaseManager.executeTransaction('settings', 'readonly', (store) => {
                return store.get(`otp_${phoneNumber}`);
            });
            
            if (!otpData) return false;

            const currentTime = Date.now();
            return (currentTime - otpData.timestamp) <= this.otpExpiryTime;
            
        } catch (error) {
            console.error('❌ Error checking OTP status:', error);
            return false;
        }
    }

    // Get user login history
    async getUserLoginHistory(phoneNumber, limit = 10) {
        try {
            const allSettings = await window.databaseManager.executeTransaction('settings', 'readonly', (store) => {
                return store.getAll();
            });

            const loginActivities = allSettings.filter(setting => 
                setting.phone.startsWith(`activity_${phoneNumber}_`) && 
                setting.type === 'login'
            ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
             .slice(0, limit);

            return loginActivities;
            
        } catch (error) {
            console.error('❌ Error getting login history:', error);
            return [];
        }
    }

    // Validate session and refresh if needed
    async validateSession() {
        if (!this.currentUser) {
            return { valid: false, reason: 'No active session' };
        }

        // Check if session is older than 24 hours
        const sessionAge = Date.now() - new Date(this.currentUser.loginTime).getTime();
        const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours

        if (sessionAge > maxSessionAge) {
            console.log('🕒 Session expired, logging out...');
            await this.logout();
            return { valid: false, reason: 'Session expired' };
        }

        // Verify user still exists in database
        try {
            const dbUser = await window.databaseManager.getUser(this.currentUser.phone);
            if (!dbUser) {
                await this.logout();
                return { valid: false, reason: 'User not found in database' };
            }

            // Update session with latest profile data
            this.currentUser.profile = dbUser;
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

            return { valid: true, user: this.currentUser };
            
        } catch (error) {
            console.error('❌ Error validating session:', error);
            return { valid: false, reason: 'Validation error' };
        }
    }
}

// Create and initialize global auth manager instance
window.authManager = new AuthManager();

// Export for module use (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}