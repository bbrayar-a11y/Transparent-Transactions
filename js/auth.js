// auth.js - Authentication and User Management for Transparent Transactions
// Updated with database readiness handling and OTP display

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.otpAttempts = 0;
        this.maxOtpAttempts = 3;
        this.otpExpiryTime = 2 * 60 * 1000; // 2 minutes in milliseconds
        this.isDatabaseReady = false;
        this.init();
    }

    // Initialize authentication system
    async init() {
        console.log('🔐 Auth Manager initializing...');
        
        try {
            // Wait for database to be ready with retry mechanism
            await this.waitForDatabase();
            
            this.loadCurrentUser();
            this.setupEventListeners();
            console.log('✅ Auth Manager initialized successfully');
            
        } catch (error) {
            console.error('❌ Auth Manager initialization failed:', error);
            this.showDatabaseError();
        }
    }

    // Wait for database to be ready with retry mechanism
    async waitForDatabase(maxRetries = 10, retryDelay = 500) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (window.databaseManager && await this.checkDatabaseReady()) {
                this.isDatabaseReady = true;
                console.log('✅ Database connection established');
                return;
            }
            
            console.log(`⏳ Waiting for database... (attempt ${attempt}/${maxRetries})`);
            
            if (attempt === maxRetries) {
                throw new Error('Database not available after maximum retries');
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    // Check if database is ready
    async checkDatabaseReady() {
        try {
            if (!window.databaseManager) {
                return false;
            }
            
            // Try a simple database operation to verify readiness
            await window.databaseManager.executeTransaction('settings', 'readonly', (store) => {
                return store.count();
            });
            
            return true;
        } catch (error) {
            return false;
        }
    }

    // Show database error to user
    showDatabaseError() {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff6b6b;
            color: white;
            padding: 15px;
            text-align: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;
        errorDiv.innerHTML = `
            <strong>⚠️ Database Connection Issue</strong>
            <p>Please refresh the page or check your browser storage settings.</p>
            <button onclick="this.parentElement.remove()" style="
                background: white;
                color: #ff6b6b;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                margin-left: 10px;
            ">Dismiss</button>
        `;
        document.body.appendChild(errorDiv);
    }

    // Load user session from persistent storage
    async loadCurrentUser() {
        if (!this.isDatabaseReady) {
            console.warn('⚠️ Database not ready, skipping user session load');
            return;
        }

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

    // Display OTP on screen for testing (instead of sending SMS)
    async sendOTP(phoneNumber) {
        // Check if database is ready
        if (!this.isDatabaseReady) {
            throw {
                success: false,
                message: 'Database not ready. Please try again in a moment.'
            };
        }

        return new Promise((resolve, reject) => {
            console.log(`📱 Generating OTP for ${phoneNumber}...`);

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
                    
                    // Display OTP on screen for user to see
                    this.displayOTPOnScreen(phoneNumber, otp);
                    
                    resolve({
                        success: true,
                        message: 'OTP generated successfully',
                        expiryMinutes: this.getOtpExpiryMinutes(),
                        otp: otp // For reference
                    });
                    
                } catch (error) {
                    reject({
                        success: false,
                        message: 'Failed to generate OTP',
                        error: error.message
                    });
                }
            }, 1000);
        });
    }

    // Display OTP on screen in a user-friendly way
    displayOTPOnScreen(phoneNumber, otp) {
        // Remove any existing OTP display
        const existingDisplay = document.getElementById('otp-display-container');
        if (existingDisplay) {
            existingDisplay.remove();
        }

        // Create OTP display container
        const otpContainer = document.createElement('div');
        otpContainer.id = 'otp-display-container';
        otpContainer.innerHTML = `
            <div class="otp-display">
                <div class="otp-header">
                    <h3>📱 OTP for Testing</h3>
                    <button class="close-otp" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="otp-content">
                    <p>Phone: <strong>${phoneNumber}</strong></p>
                    <div class="otp-code">
                        <span class="otp-digits">${otp}</span>
                    </div>
                    <p class="otp-instruction">Enter this OTP in the verification field</p>
                    <p class="otp-expiry">Expires in ${this.getOtpExpiryMinutes()} minutes</p>
                </div>
            </div>
        `;

        // Add styles
        const styles = `
            <style>
                #otp-display-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    background: white;
                    border: 2px solid #2E8B57;
                    border-radius: 10px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    max-width: 300px;
                    font-family: Arial, sans-serif;
                }
                .otp-display {
                    padding: 15px;
                }
                .otp-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }
                .otp-header h3 {
                    margin: 0;
                    color: #2E8B57;
                    font-size: 16px;
                }
                .close-otp {
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #666;
                }
                .otp-content {
                    text-align: center;
                }
                .otp-code {
                    margin: 15px 0;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 2px dashed #2E8B57;
                }
                .otp-digits {
                    font-size: 24px;
                    font-weight: bold;
                    color: #2E8B57;
                    letter-spacing: 2px;
                }
                .otp-instruction {
                    font-size: 14px;
                    color: #666;
                    margin: 10px 0;
                }
                .otp-expiry {
                    font-size: 12px;
                    color: #ff6b35;
                    font-weight: bold;
                }
            </style>
        `;

        // Add to document
        document.body.appendChild(otpContainer);
        
        // Auto-remove after 5 minutes
        setTimeout(() => {
            const container = document.getElementById('otp-display-container');
            if (container) {
                container.remove();
            }
        }, 5 * 60 * 1000);
    }

    // Verify OTP against stored value
    async verifyOTP(phoneNumber, enteredOTP) {
        // Check if database is ready
        if (!this.isDatabaseReady) {
            throw {
                success: false,
                message: 'Database not ready. Please try again in a moment.'
            };
        }

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
                    
                    // Remove OTP display
                    const otpDisplay = document.getElementById('otp-display-container');
                    if (otpDisplay) {
                        otpDisplay.remove();
                    }
                    
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
                        
                        // Remove OTP display
                        const otpDisplay = document.getElementById('otp-display-container');
                        if (otpDisplay) {
                            otpDisplay.remove();
                        }
                        
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
        if (!this.isDatabaseReady) {
            throw {
                success: false,
                message: 'Database not ready. Please try again.'
            };
        }

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
        if (!this.isDatabaseReady) return;
        
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
            if (this.currentUser && this.isDatabaseReady) {
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
        if (!this.isDatabaseReady) return;
        
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
        if (!this.isDatabaseReady) {
            console.warn('⚠️ Database not ready, skipping auth data clear');
            return;
        }

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
        if (!this.isDatabaseReady) return false;
        
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
        if (!this.isDatabaseReady) return [];
        
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
            if (!this.isDatabaseReady) {
                return { valid: false, reason: 'Database not ready' };
            }

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
