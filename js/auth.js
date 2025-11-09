// auth.js - Simplified Authentication for Transparent Transactions
// Builds on database.js foundation

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.isDatabaseReady = false;
        this.otpExpiryTime = 2 * 60 * 1000; // 2 minutes
        this.maxOtpAttempts = 3;
        
        // Initialize when class is created
        this.init();
    }

    async init() {
        if (this.isInitialized) {
            console.log('✅ Auth Manager already initialized');
            return;
        }

        console.log('🔐 Auth Manager initializing...');
        
        try {
            // Wait for database with longer timeout
            await this.waitForDatabase(25, 1000); // 25 seconds max
            
            // Load existing session if any
            await this.loadCurrentUser();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('✅ Auth Manager initialized successfully');
            
        } catch (error) {
            console.error('❌ Auth Manager initialization failed:', error);
            // Mark as initialized anyway to allow user to try
            this.isInitialized = true;
            console.log('🔄 Auth Manager: Continuing despite initialization issues...');
        }
    }

    async waitForDatabase(maxRetries = 25, retryDelay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (window.databaseManager && await this.checkDatabaseReady()) {
                this.isDatabaseReady = true;
                console.log('✅ Database connection established');
                return;
            }
            
            console.log(`⏳ Waiting for database... (attempt ${attempt}/${maxRetries})`);
            
            if (attempt === maxRetries) {
                console.warn('⚠️ Database not available after maximum retries, but continuing...');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

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

    // USER REGISTRATION & LOGIN

    async registerUser(userData) {
        if (!this.isInitialized) {
            throw new Error('Auth system not ready');
        }

        const validation = this.validatePhoneNumber(userData.phone);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        try {
            // Check if user already exists
            const existingUser = await window.databaseManager.getUser(validation.cleaned);
            if (existingUser) {
                throw new Error('User already exists with this phone number');
            }

            // Create user profile
            const userProfile = {
                phone: validation.cleaned,
                fullName: userData.fullName || '',
                email: userData.email || '',
                isActive: true,
                createdAt: new Date().toISOString(),
                trustScore: 100,
                balance: 0
            };

            await window.databaseManager.saveUser(userProfile);
            console.log('✅ User registered:', validation.cleaned);

            // Automatically log in after registration
            return await this.login(validation.cleaned, userProfile);

        } catch (error) {
            console.error('❌ Registration failed:', error);
            throw error;
        }
    }

    async login(phoneNumber, userProfile = null) {
        if (!this.isInitialized) {
            throw new Error('Auth system not ready');
        }

        try {
            // Get user profile if not provided
            let profile = userProfile;
            if (!profile) {
                profile = await window.databaseManager.getUser(phoneNumber);
                if (!profile) {
                    throw new Error('User not found');
                }
            }

            // Create user session
            const userSession = {
                phone: phoneNumber,
                isAuthenticated: true,
                loginTime: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                sessionId: this.generateSessionId(),
                profile: profile
            };

            // Store session in localStorage for quick access
            localStorage.setItem('currentUser', JSON.stringify(userSession));
            this.currentUser = userSession;

            // Record login activity
            await this.recordLoginActivity(phoneNumber);

            // Trigger auth state change
            this.triggerAuthStateChange('login', userSession);

            console.log('✅ User logged in:', phoneNumber);
            
            return {
                success: true,
                user: userSession
            };

        } catch (error) {
            console.error('❌ Login failed:', error);
            throw error;
        }
    }

    async logout() {
        if (!this.currentUser) {
            return { success: true, message: 'No user to logout' };
        }

        const userPhone = this.currentUser.phone;
        
        try {
            // Record logout activity
            await this.recordLogoutActivity(userPhone);
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

    // SESSION MANAGEMENT

    async loadCurrentUser() {
        try {
            const userData = localStorage.getItem('currentUser');
            
            if (userData) {
                const session = JSON.parse(userData);
                
                // Verify user still exists in database
                if (session.phone) {
                    const dbUser = await window.databaseManager.getUser(session.phone);
                    
                    if (dbUser) {
                        // Update session with latest profile data
                        session.profile = dbUser;
                        this.currentUser = session;
                        console.log('✅ User session loaded:', session.phone);
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

    clearUserSession() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;

        // Trigger auth state change
        this.triggerAuthStateChange('logout', null);
    }

    // OTP SYSTEM - WITH USER EXISTENCE CHECK

    async sendOTP(phoneNumber) {
        if (!this.isInitialized) {
            throw new Error('Auth system not ready');
        }

        const validation = this.validatePhoneNumber(phoneNumber);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        // Check if user already exists - if yes, auto-login instead of sending OTP
        const existingUser = await window.databaseManager.getUser(validation.cleaned);
        if (existingUser) {
            console.log('✅ User exists, auto-logging in:', validation.cleaned);
            return await this.login(validation.cleaned, existingUser);
        }

        return new Promise((resolve, reject) => {
            console.log(`📱 Generating OTP for new user: ${phoneNumber}...`);

            // Simulate API call delay
            setTimeout(async () => {
                try {
                    // Generate OTP
                    const otp = this.generateOTP();
                    
                    // Store OTP data with correct structure
                    const otpData = {
                        phone: phoneNumber,
                        otp: otp,
                        timestamp: Date.now(),
                        verified: false,
                        attempts: 0,
                        expiresAt: new Date(Date.now() + this.otpExpiryTime).toISOString()
                    };
                    
                    await window.databaseManager.saveSetting(`otp_${phoneNumber}`, otpData);
                    
                    // Verify the OTP was stored correctly
                    const verifyStored = await window.databaseManager.getSetting(`otp_${phoneNumber}`);
                    console.log('🔍 OTP stored verification:', verifyStored);
                    
                    // Display OTP on screen for testing
                    this.displayOTPOnScreen(phoneNumber, otp);
                    
                    resolve({
                        success: true,
                        message: 'OTP generated successfully',
                        expiryMinutes: Math.floor(this.otpExpiryTime / (60 * 1000)),
                        isNewUser: true
                    });
                    
                } catch (error) {
                    console.error('❌ OTP generation failed:', error);
                    reject({
                        success: false,
                        message: 'Failed to generate OTP',
                        error: error.message
                    });
                }
            }, 1000);
        });
    }

    async verifyOTP(phoneNumber, enteredOTP, userData = null) {
        if (!this.isInitialized) {
            throw new Error('Auth system not ready');
        }

        try {
            // Get OTP data - FIXED: Handle different return formats
            const otpResult = await window.databaseManager.getSetting(`otp_${phoneNumber}`);
            
            // Debug log to see what's actually returned
            console.log('🔍 OTP retrieval result:', otpResult);
            
            // Handle different possible return formats
            let otpData;
            if (!otpResult) {
                throw new Error('OTP not found. Please request a new OTP.');
            } else if (otpResult.value) {
                // If data is wrapped in .value property
                otpData = otpResult.value;
            } else {
                // If data is returned directly
                otpData = otpResult;
            }

            // Check if we have valid OTP data
            if (!otpData || !otpData.otp) {
                console.error('❌ Invalid OTP data structure:', otpData);
                throw new Error('OTP not found. Please request a new OTP.');
            }

            console.log('🔍 OTP data retrieved:', otpData);

            // Check if OTP is expired
            const currentTime = Date.now();
            const otpAge = currentTime - otpData.timestamp;
            
            if (otpAge > this.otpExpiryTime) {
                // Remove expired OTP
                await window.databaseManager.deleteSetting(`otp_${phoneNumber}`);
                throw new Error('OTP has expired. Please request a new OTP.');
            }

            // Check attempt limits
            if (otpData.attempts >= this.maxOtpAttempts) {
                throw new Error('Too many failed attempts. Please request a new OTP.');
            }

            // Check if OTP matches
            console.log(`🔍 Comparing: Entered OTP "${enteredOTP}" vs Stored OTP "${otpData.otp}"`);
            
            if (otpData.otp === enteredOTP) {
                // OTP verified successfully - create new user
                const userProfile = {
                    phone: phoneNumber,
                    fullName: userData?.fullName || '',
                    email: userData?.email || '',
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    trustScore: 100,
                    balance: 0
                };

                // Save new user
                await window.databaseManager.saveUser(userProfile);
                
                // Clear OTP data
                await window.databaseManager.deleteSetting(`otp_${phoneNumber}`);
                
                // Remove OTP display
                this.removeOTPDisplay();

                // Auto-login the new user
                const loginResult = await this.login(phoneNumber, userProfile);
                
                console.log('✅ New user created and logged in:', phoneNumber);
                
                return {
                    success: true,
                    message: 'Account created successfully',
                    user: loginResult.user,
                    isNewUser: true
                };
                
            } else {
                // Invalid OTP - increment attempts
                const updatedOtpData = {
                    ...otpData,
                    attempts: otpData.attempts + 1
                };
                
                await window.databaseManager.saveSetting(`otp_${phoneNumber}`, updatedOtpData);
                
                const attemptsLeft = this.maxOtpAttempts - (otpData.attempts + 1);
                
                if (attemptsLeft <= 0) {
                    // Too many failed attempts - clear OTP
                    await window.databaseManager.deleteSetting(`otp_${phoneNumber}`);
                    this.removeOTPDisplay();
                    throw new Error('Too many failed attempts. Please request a new OTP.');
                } else {
                    throw new Error(`Invalid OTP. ${attemptsLeft} attempts left.`);
                }
            }
        } catch (error) {
            console.error('❌ OTP verification error:', error);
            throw error;
        }
    }

    // Check if user exists (public method for UI)
    async checkUserExists(phoneNumber) {
        if (!this.isInitialized) {
            throw new Error('Auth system not ready');
        }

        const validation = this.validatePhoneNumber(phoneNumber);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const user = await window.databaseManager.getUser(validation.cleaned);
        return {
            exists: !!user,
            user: user
        };
    }

    // UTILITY METHODS

    isAuthenticated() {
        return this.currentUser && this.currentUser.isAuthenticated === true;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    validatePhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.length !== 10) {
            return {
                valid: false,
                message: 'Phone number must be 10 digits'
            };
        }

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

    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    // EVENT SYSTEM

    setupEventListeners() {
        // Listen for auth state changes from other components
        document.addEventListener('authStateChange', (event) => {
            this.handleAuthStateChange(event.detail);
        });

        // Update user activity on user interactions
        document.addEventListener('click', () => {
            this.updateUserActivity();
        });
    }

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

    handleAuthStateChange(detail) {
        console.log(`🔄 Auth state changed: ${detail.action}`, detail.user);
        this.updateAuthUI();
    }

    updateUserActivity() {
        if (this.currentUser) {
            this.currentUser.lastActive = new Date().toISOString();
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
    }

    // UI METHODS

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

    displayOTPOnScreen(phoneNumber, otp) {
        // Remove any existing OTP display
        this.removeOTPDisplay();

        const otpContainer = document.createElement('div');
        otpContainer.id = 'otp-display-container';
        otpContainer.innerHTML = `
            <div class="otp-display">
                <div class="otp-header">
                    <h3>📱 OTP for Testing</h3>
                    <button class="close-otp">×</button>
                </div>
                <div class="otp-content">
                    <p>Phone: <strong>${phoneNumber}</strong></p>
                    <div class="otp-code">
                        <span class="otp-digits">${otp}</span>
                    </div>
                    <p class="otp-instruction">Enter this OTP in the verification field</p>
                    <p class="otp-expiry">Expires in 2 minutes</p>
                </div>
            </div>
        `;

        // Add close button functionality
        otpContainer.querySelector('.close-otp').onclick = () => {
            this.removeOTPDisplay();
        };

        document.body.appendChild(otpContainer);

        // Auto-remove after 5 minutes
        setTimeout(() => {
            this.removeOTPDisplay();
        }, 5 * 60 * 1000);
    }

    removeOTPDisplay() {
        const existingDisplay = document.getElementById('otp-display-container');
        if (existingDisplay) {
            existingDisplay.remove();
        }
    }

    // ACTIVITY LOGGING

    async recordLoginActivity(phoneNumber) {
        try {
            const activity = {
                phone: phoneNumber,
                type: 'login',
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };

            await window.databaseManager.saveSetting(`activity_${phoneNumber}_${Date.now()}`, activity);
            
        } catch (error) {
            console.error('❌ Error recording login activity:', error);
        }
    }

    async recordLogoutActivity(phoneNumber) {
        try {
            const activity = {
                phone: phoneNumber,
                type: 'logout',
                timestamp: new Date().toISOString()
            };

            await window.databaseManager.saveSetting(`activity_${phoneNumber}_${Date.now()}`, activity);
            
        } catch (error) {
            console.error('❌ Error recording logout activity:', error);
        }
    }
}

// Create and initialize global auth manager instance
window.authManager = new AuthManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
