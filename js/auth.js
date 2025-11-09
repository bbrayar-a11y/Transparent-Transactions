// auth.js - DEBUG VERSION with enhanced logging
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.isDatabaseReady = false;
        this.otpExpiryTime = 2 * 60 * 1000;
        this.maxOtpAttempts = 3;
        this.init();
    }

    async init() {
        console.log('🟡 Auth Manager INIT started');
        if (this.isInitialized) {
            console.log('✅ Auth Manager already initialized');
            return;
        }

        try {
            await this.waitForDatabase(25, 1000);
            await this.loadCurrentUser();
            this.setupEventListeners();
            this.isInitialized = true;
            console.log('✅ Auth Manager initialized successfully');
        } catch (error) {
            console.error('❌ Auth Manager initialization failed:', error);
            this.isInitialized = true;
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
                console.warn('⚠️ Database not available after maximum retries');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    async checkDatabaseReady() {
        try {
            if (!window.databaseManager) {
                console.log('🟡 databaseManager not found');
                return false;
            }
            await window.databaseManager.executeTransaction('settings', 'readonly', (store) => {
                return store.count();
            });
            return true;
        } catch (error) {
            console.log('🟡 Database check failed:', error);
            return false;
        }
    }

    async loadCurrentUser() {
        try {
            const userData = localStorage.getItem('currentUser');
            if (userData) {
                const session = JSON.parse(userData);
                if (session.phone) {
                    const dbUser = await window.databaseManager.getUser(session.phone);
                    if (dbUser) {
                        session.profile = dbUser;
                        this.currentUser = session;
                        console.log('✅ User session loaded:', session.phone);
                    } else {
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

    setupEventListeners() {
        document.addEventListener('authStateChange', (event) => {
            this.handleAuthStateChange(event.detail);
        });
        document.addEventListener('click', () => {
            this.updateUserActivity();
        });
    }

    // OTP SYSTEM - WITH ENHANCED DEBUGGING
    async sendOTP(phoneNumber) {
        console.log('🟡 sendOTP called with:', phoneNumber);
        
        if (!this.isInitialized) {
            console.error('❌ Auth system not ready in sendOTP');
            throw new Error('Auth system not ready');
        }

        const validation = this.validatePhoneNumber(phoneNumber);
        if (!validation.valid) {
            console.error('❌ Phone validation failed:', validation.message);
            throw new Error(validation.message);
        }

        console.log('🟡 Checking if user exists...');
        const existingUser = await window.databaseManager.getUser(validation.cleaned);
        console.log('🟡 User existence check result:', existingUser);

        if (existingUser) {
            console.log('✅ User exists, auto-logging in:', validation.cleaned);
            return await this.login(validation.cleaned, existingUser);
        }

        console.log('🟡 New user, generating OTP...');
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                try {
                    const otp = this.generateOTP();
                    console.log('🟡 Generated OTP:', otp);
                    
                    const otpData = {
                        phone: phoneNumber,
                        otp: otp,
                        timestamp: Date.now(),
                        verified: false,
                        attempts: 0,
                        expiresAt: new Date(Date.now() + this.otpExpiryTime).toISOString()
                    };
                    
                    console.log('🟡 Saving OTP data:', otpData);
                    await window.databaseManager.saveSetting(`otp_${phoneNumber}`, otpData);
                    
                    // Verify storage
                    const verifyStored = await window.databaseManager.getSetting(`otp_${phoneNumber}`);
                    console.log('🔍 OTP storage verification:', verifyStored);
                    
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
        console.log('🟡 verifyOTP called with:', { phoneNumber, enteredOTP, userData });
        
        if (!this.isInitialized) {
            throw new Error('Auth system not ready');
        }

        try {
            console.log('🟡 Retrieving OTP from database...');
            const otpResult = await window.databaseManager.getSetting(`otp_${phoneNumber}`);
            console.log('🔍 RAW OTP retrieval result:', otpResult);
            
            let otpData;
            if (!otpResult) {
                console.error('❌ OTP result is null/undefined');
                throw new Error('OTP not found. Please request a new OTP.');
            } else if (otpResult.value) {
                otpData = otpResult.value;
                console.log('🟡 OTP data extracted from .value property');
            } else {
                otpData = otpResult;
                console.log('🟡 OTP data used directly');
            }

            console.log('🔍 Processed OTP data:', otpData);

            if (!otpData || !otpData.otp) {
                console.error('❌ Invalid OTP data structure:', otpData);
                throw new Error('OTP not found. Please request a new OTP.');
            }

            // Check expiration
            const currentTime = Date.now();
            const otpAge = currentTime - otpData.timestamp;
            console.log(`🟡 OTP age: ${otpAge}ms, expiry: ${this.otpExpiryTime}ms`);
            
            if (otpAge > this.otpExpiryTime) {
                console.log('❌ OTP expired');
                await window.databaseManager.deleteSetting(`otp_${phoneNumber}`);
                throw new Error('OTP has expired. Please request a new OTP.');
            }

            // Check attempts
            if (otpData.attempts >= this.maxOtpAttempts) {
                console.log('❌ Too many OTP attempts');
                throw new Error('Too many failed attempts. Please request a new OTP.');
            }

            // Verify OTP
            console.log(`🔍 OTP comparison: "${enteredOTP}" === "${otpData.otp}"`);
            
            if (otpData.otp === enteredOTP) {
                console.log('✅ OTP matched, creating user...');
                
                const userProfile = {
                    phone: phoneNumber,
                    fullName: userData?.fullName || '',
                    email: userData?.email || '',
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    trustScore: 100,
                    balance: 0
                };

                await window.databaseManager.saveUser(userProfile);
                await window.databaseManager.deleteSetting(`otp_${phoneNumber}`);
                this.removeOTPDisplay();

                const loginResult = await this.login(phoneNumber, userProfile);
                console.log('✅ New user created and logged in');
                
                return {
                    success: true,
                    message: 'Account created successfully',
                    user: loginResult.user,
                    isNewUser: true
                };
                
            } else {
                console.log('❌ OTP mismatch');
                const updatedOtpData = {
                    ...otpData,
                    attempts: otpData.attempts + 1
                };
                
                await window.databaseManager.saveSetting(`otp_${phoneNumber}`, updatedOtpData);
                
                const attemptsLeft = this.maxOtpAttempts - (otpData.attempts + 1);
                console.log(`🟡 Attempts left: ${attemptsLeft}`);
                
                if (attemptsLeft <= 0) {
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

    async login(phoneNumber, userProfile = null) {
        console.log('🟡 login called with:', phoneNumber);
        try {
            let profile = userProfile;
            if (!profile) {
                profile = await window.databaseManager.getUser(phoneNumber);
                if (!profile) {
                    console.error('❌ User not found in database during login');
                    throw new Error('User not found');
                }
            }

            const userSession = {
                phone: phoneNumber,
                isAuthenticated: true,
                loginTime: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                sessionId: this.generateSessionId(),
                profile: profile
            };

            localStorage.setItem('currentUser', JSON.stringify(userSession));
            this.currentUser = userSession;
            await this.recordLoginActivity(phoneNumber);
            this.triggerAuthStateChange('login', userSession);

            console.log('✅ User logged in successfully:', phoneNumber);
            return { success: true, user: userSession };

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
            await this.recordLogoutActivity(userPhone);
        } catch (error) {
            console.error('❌ Error recording logout activity:', error);
        } finally {
            this.clearUserSession();
            console.log('👋 User logged out:', userPhone);
        }
        
        return { success: true, message: 'Logged out successfully' };
    }

    clearUserSession() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;
        this.triggerAuthStateChange('logout', null);
    }

    async registerUser(userData) {
        if (!this.isInitialized) {
            throw new Error('Auth system not ready');
        }

        const validation = this.validatePhoneNumber(userData.phone);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        try {
            const existingUser = await window.databaseManager.getUser(validation.cleaned);
            if (existingUser) {
                throw new Error('User already exists with this phone number');
            }

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
            return await this.login(validation.cleaned, userProfile);

        } catch (error) {
            console.error('❌ Registration failed:', error);
            throw error;
        }
    }

    async validateSession() {
        if (!this.currentUser) {
            return { valid: false, reason: 'No active session' };
        }

        const sessionAge = Date.now() - new Date(this.currentUser.loginTime).getTime();
        const maxSessionAge = 24 * 60 * 60 * 1000;

        if (sessionAge > maxSessionAge) {
            console.log('🕒 Session expired, logging out...');
            await this.logout();
            return { valid: false, reason: 'Session expired' };
        }

        try {
            const dbUser = await window.databaseManager.getUser(this.currentUser.phone);
            if (!dbUser) {
                await this.logout();
                return { valid: false, reason: 'User not found in database' };
            }

            this.currentUser.profile = dbUser;
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            return { valid: true, user: this.currentUser };
            
        } catch (error) {
            console.error('❌ Error validating session:', error);
            return { valid: false, reason: 'Validation error' };
        }
    }

    async checkUserExists(phoneNumber) {
        if (!this.isInitialized) {
            throw new Error('Auth system not ready');
        }

        const validation = this.validatePhoneNumber(phoneNumber);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const user = await window.databaseManager.getUser(validation.cleaned);
        return { exists: !!user, user: user };
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
            return { valid: false, message: 'Phone number must be 10 digits' };
        }
        if (!/^[6-9]\d{9}$/.test(cleaned)) {
            return { valid: false, message: 'Please enter a valid Indian mobile number' };
        }
        return { valid: true, cleaned: cleaned };
    }

    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    // EVENT SYSTEM
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

        otpContainer.querySelector('.close-otp').onclick = () => {
            this.removeOTPDisplay();
        };
        document.body.appendChild(otpContainer);

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
