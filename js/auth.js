// auth.js - FINAL VERSION
// Fully corrected: No window.authManager creation here
// Waits for databaseManager → New user works on first run

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.isDatabaseReady = false;
        this.otpExpiryTime = 2 * 60 * 1000; // 2 minutes
        this.maxOtpAttempts = 3;
    }

    async init() {
        console.log('Auth Manager INIT started');
        if (this.isInitialized) {
            console.log('Auth Manager already initialized');
            return;
        }

        try {
            await this.waitForDatabase(25, 1000);
            await this.loadCurrentUser();
            this.setupEventListeners();
            this.isInitialized = true;
            console.log('Auth Manager initialized successfully');
        } catch (error) {
            console.error('Auth Manager initialization failed:', error);
            this.isInitialized = true; // Prevent retry loops
        }
    }

    async waitForDatabase(maxRetries = 25, retryDelay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (window.databaseManager && await this.checkDatabaseReady()) {
                this.isDatabaseReady = true;
                console.log('Database connection established');
                return;
            }

            console.log(`Waiting for database... (attempt ${attempt}/${maxRetries})`);

            if (attempt === maxRetries) {
                console.warn('Database not available after maximum retries');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    async checkDatabaseReady() {
        try {
            if (!window.databaseManager) {
                console.log('databaseManager not found');
                return false;
            }

            // Simple count to verify DB is alive
            await window.databaseManager.executeTransaction('settings', 'readonly', store => {
                return store.count();
            });

            return true;
        } catch (error) {
            console.log('Database check failed:', error);
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
                        console.log('User session loaded:', session.phone);
                    } else {
                        console.warn('User not found in DB, clearing session');
                        this.clearUserSession();
                    }
                }
            }
        } catch (error) {
            console.error('Error loading user session:', error);
            this.currentUser = null;
        }
    }

    setupEventListeners() {
        document.addEventListener('authStateChange', (event) => {
            this.handleAuthStateChange(event.detail);
        });
        document.addEventListener('click', () => this.updateUserActivity());
    }

    // === OTP FLOW ===
    async sendOTP(phoneNumber) {
        console.log('sendOTP called with:', phoneNumber);

        if (!this.isInitialized) {
            throw new Error('Auth system not ready');
        }

        const validation = this.validatePhoneNumber(phoneNumber);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const existingUser = await window.databaseManager.getUser(validation.cleaned);
        if (existingUser) {
            console.log('User exists, auto-logging in:', validation.cleaned);
            const loginResult = await this.login(validation.cleaned, existingUser);
            return {
                success: true,
                message: 'Auto-login successful',
                user: loginResult.user,
                action: 'auto-login',
                isNewUser: false
            };
        }

        console.log('New user, generating OTP...');
        return new Promise((resolve) => {
            setTimeout(async () => {
                try {
                    const otp = this.generateOTP();
                    console.log('Generated OTP:', otp);

                    const otpData = {
                        phone: phoneNumber,
                        otp: otp,
                        timestamp: Date.now(),
                        verified: false,
                        attempts: 0,
                        expiresAt: new Date(Date.now() + this.otpExpiryTime).toISOString()
                    };

                    await window.databaseManager.saveSetting(`otp_${phoneNumber}`, otpData);
                    const verify = await window.databaseManager.getSetting(`otp_${phoneNumber}`);
                    console.log('OTP storage verified:', verify);

                    this.displayOTPOnScreen(phoneNumber, otp);

                    resolve({
                        success: true,
                        message: 'OTP generated successfully',
                        expiryMinutes: 2,
                        action: 'otp-sent',
                        isNewUser: true
                    });
                } catch (error) {
                    console.error('OTP generation failed:', error);
                    resolve({
                        success: false,
                        message: 'Failed to generate OTP',
                        error: error.message
                    });
                }
            }, 1000);
        });
    }

    async verifyOTP(phoneNumber, enteredOTP, userData = null) {
        console.log('verifyOTP called with:', { phoneNumber, enteredOTP });

        if (!this.isInitialized) {
            throw new Error('Auth system not ready');
        }

        try {
            const otpResult = await window.databaseManager.getSetting(`otp_${phoneNumber}`);
            console.log('RAW OTP retrieval:', otpResult);

            let otpData;
            if (!otpResult) {
                throw new Error('OTP not found. Please request a new OTP.');
            } else if (otpResult.value) {
                otpData = otpResult.value;
            } else {
                otpData = otpResult;
            }

            if (!otpData || !otpData.otp) {
                throw new Error('Invalid OTP data. Please request a new OTP.');
            }

            const currentTime = Date.now();
            const otpAge = currentTime - otpData.timestamp;

            if (otpAge > this.otpExpiryTime) {
                await window.databaseManager.deleteSetting(`otp_${phoneNumber}`);
                throw new Error('OTP has expired. Please request a new OTP.');
            }

            if (otpData.attempts >= this.maxOtpAttempts) {
                throw new Error('Too many failed attempts. Please request a new OTP.');
            }

            if (otpData.otp === enteredOTP) {
                console.log('OTP matched, creating user...');

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
                console.log('New user created and logged in');

                return {
                    success: true,
                    message: 'Account created successfully',
                    user: loginResult.user,
                    isNewUser: true
                };
            } else {
                const updatedOtpData = {
                    ...otpData,
                    attempts: otpData.attempts + 1
                };
                await window.databaseManager.saveSetting(`otp_${phoneNumber}`, updatedOtpData);

                const attemptsLeft = this.maxOtpAttempts - (otpData.attempts + 1);
                if (attemptsLeft <= 0) {
                    await window.databaseManager.deleteSetting(`otp_${phoneNumber}`);
                    this.removeOTPDisplay();
                    throw new Error('Too many failed attempts. Please request a new OTP.');
                } else {
                    throw new Error(`Invalid OTP. ${attemptsLeft} attempts left.`);
                }
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            throw error;
        }
    }

    // === LOGIN & SESSION ===
    async login(phoneNumber, userProfile = null) {
        console.log('login called with:', phoneNumber);
        try {
            let profile = userProfile;
            if (!profile) {
                profile = await window.databaseManager.getUser(phoneNumber);
                if (!profile) {
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

            console.log('User logged in successfully:', phoneNumber);
            return { success: true, user: userSession };
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    async logout() {
        if (!this.currentUser) {
            return { success: true, message: 'No user to logout' };
        }
        const phone = this.currentUser.phone;
        try {
            await this.recordLogoutActivity(phone);
        } catch (error) {
            console.error('Error recording logout:', error);
        } finally {
            this.clearUserSession();
            console.log('User logged out:', phone);
        }
        return { success: true, message: 'Logged out successfully' };
    }

    clearUserSession() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;
        this.triggerAuthStateChange('logout', null);
    }

    // === UTILITY ===
    validatePhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length !== 10) {
            return { valid: false, message: 'Phone number must be 10 digits' };
        }
        if (!/^[6-9]\d{9}$/.test(cleaned)) {
            return { valid: false, message: 'Please enter a valid Indian mobile number' };
        }
        return { valid: true, cleaned };
    }

    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    updateUserActivity() {
        if (this.currentUser) {
            this.currentUser.lastActive = new Date().toISOString();
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
    }

    // === UI ===
    displayOTPOnScreen(phoneNumber, otp) {
        this.removeOTPDisplay();
        const container = document.createElement('div');
        container.id = 'otp-display-container';
        container.innerHTML = `
            <div class="otp-display" style="position:fixed;top:20px;right:20px;background:#2E8B57;color:white;padding:16px;border-radius:8px;z-index:10000;font-family:system-ui;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:16px;">OTP for Testing</h3>
                    <button class="close-otp" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;">×</button>
                </div>
                <p style="margin:8px 0 4px;">Phone: <strong>${phoneNumber}</strong></p>
                <div style="background:#fff;color:#000;padding:8px;border-radius:4px;font-size:20px;font-weight:bold;letter-spacing:2px;text-align:center;">
                    ${otp}
                </div>
                <p style="margin:4px 0;font-size:12px;">Enter this OTP in the field</p>
                <p style="margin:4px 0;font-size:12px;">Expires in 2 minutes</p>
            </div>
        `;
        container.querySelector('.close-otp').onclick = () => this.removeOTPDisplay();
        document.body.appendChild(container);

        setTimeout(() => this.removeOTPDisplay(), 5 * 60 * 1000);
    }

    removeOTPDisplay() {
        const el = document.getElementById('otp-display-container');
        if (el) el.remove();
    }

    showMessage(message, type = 'info') {
        const existing = document.getElementById('auth-message');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'auth-message';
        div.textContent = message;
        div.style.cssText = `
            padding: 12px; margin: 10px 0; border-radius: 4px; text-align: center; font-weight: bold;
            ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : ''}
            ${type === 'error' ? 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' : ''}
            ${type === 'info' ? 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' : ''}
        `;

        const form = document.querySelector('.phone-form') || document.getElementById('phoneForm');
        if (form && form.parentNode) {
            form.parentNode.insertBefore(div, form.nextSibling);
        } else {
            document.body.insertBefore(div, document.body.firstChild);
        }

        setTimeout(() => div.remove(), 5000);
    }

    // === EVENTS ===
    triggerAuthStateChange(action, userData) {
        document.dispatchEvent(new CustomEvent('authStateChange', {
            detail: { action, user: userData, timestamp: new Date().toISOString() }
        }));
    }

    handleAuthStateChange(detail) {
        console.log(`Auth state: ${detail.action}`, detail.user);
        this.updateAuthUI();
    }

    updateAuthUI() {
        document.querySelectorAll('[data-auth-state]').forEach(el => {
            const state = el.getAttribute('data-auth-state');
            const shouldShow = this.isAuthenticated() ?
                state === 'authenticated' :
                state === 'unauthenticated';
            el.style.display = shouldShow ? '' : 'none';
        });

        if (this.isAuthenticated() && this.currentUser.profile) {
            document.querySelectorAll('[data-user]').forEach(el => {
                const field = el.getAttribute('data-user');
                if (this.currentUser.profile[field]) {
                    el.textContent = this.currentUser.profile[field];
                }
            });
        }
    }

    // === ACTIVITY LOGGING ===
    async recordLoginActivity(phone) {
        try {
            const activity = {
                phone, type: 'login', timestamp: new Date().toISOString(), userAgent: navigator.userAgent
            };
            await window.databaseManager.saveSetting(`activity_${phone}_${Date.now()}`, activity);
        } catch (error) {
            console.error('Login activity log failed:', error);
        }
    }

    async recordLogoutActivity(phone) {
        try {
            const activity = { phone, type: 'logout', timestamp: new Date().toISOString() };
            await window.databaseManager.saveSetting(`activity_${phone}_${Date.now()}`, activity);
        } catch (error) {
            console.error('Logout activity log failed:', error);
        }
    }

    // === GETTERS ===
    isAuthenticated() {
        return this.currentUser && this.currentUser.isAuthenticated === true;
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// === DO NOT CREATE window.authManager HERE ===
// It is created in database.js after DB is ready

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
