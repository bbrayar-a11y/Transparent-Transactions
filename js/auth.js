// js/auth.js - COMPLETE WITH STORAGE DETECTIVE INTEGRATION
class AuthManager {
    constructor() {
        this.isInitialized = false;
        this.otpExpiry = 120000; // 2 minutes
        this.maxPinAttempts = 3;
        this.pinLockDuration = 5 * 60 * 1000; // 5 minutes
        this.storageStrategy = 'standard'; // Default
    }

    async init() {
        console.log('🟡 Auth Manager INIT started');
        
        // Wait for Storage Detective results
        await this.waitForStorageDetective();
        
        // Set storage strategy based on detection
        this.setStorageStrategy();
        
        // Wait for database
        while (!window.databaseManager?.isInitialized) {
            await new Promise(r => setTimeout(r, 50));
        }
        
        this.isInitialized = true;
        console.log('✅ Auth Manager initialized successfully');
        console.log('💾 Storage strategy:', this.storageStrategy);
    }

    // === STORAGE DETECTIVE INTEGRATION ===
    async waitForStorageDetective() {
        const maxWait = 10000; // 10 seconds max
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (window.storageCapabilities) {
                console.log('✅ Storage Detective ready:', window.storageCapabilities.strategy);
                return;
            }
            
            // Wait for storageReady event or timeout
            try {
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Storage Detective timeout')), 2000);
                    document.addEventListener('storageReady', () => {
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                });
                break;
            } catch (error) {
                console.log('⏳ Waiting for Storage Detective...');
                await new Promise(r => setTimeout(r, 500));
            }
        }
        
        if (!window.storageCapabilities) {
            console.warn('⚠️ Storage Detective not available, using fallback strategy');
            window.storageCapabilities = {
                strategy: 'standard',
                score: 50
            };
        }
    }

    setStorageStrategy() {
        this.storageStrategy = window.storageCapabilities?.strategy || 'standard';
        
        // Log storage capabilities for debugging
        console.log('🕵️ Storage Report:', {
            strategy: this.storageStrategy,
            score: window.storageCapabilities?.score,
            browser: window.storageCapabilities?.capabilities?.browser
        });
    }

    // === STORAGE-AWARE SESSION MANAGEMENT ===
    getStorage() {
        switch (this.storageStrategy) {
            case 'full-persistence':
            case 'standard':
                try {
                    return localStorage;
                } catch (e) {
                    return sessionStorage; // Fallback
                }
            case 'session-only':
                return sessionStorage;
            case 'temporary':
            case 'emergency':
                // Memory fallback or sessionStorage
                return sessionStorage;
            default:
                return localStorage;
        }
    }

    // === CHECK IF USER IS AUTHENTICATED ===
    isAuthenticated() {
        try {
            const storage = this.getStorage();
            const currentUser = storage.getItem('currentUser');
            if (!currentUser) return false;
            
            const userData = JSON.parse(currentUser);
            return userData.isAuthenticated === true;
        } catch (error) {
            console.log('Auth check error:', error);
            return false;
        }
    }

    // === SEND OTP ===
    async sendOTP(phone) {
        if (!this.isInitialized) throw new Error('Auth system not ready');
        const clean = this.validatePhone(phone);
        if (!clean) throw new Error('Invalid 10-digit Indian number');

        // FOUNDER BYPASS
        if (clean === "9999999999") {
            const user = await window.databaseManager.getUser(clean);
            if (user) {
                console.log("FOUNDER LOGIN:", clean);
                this.loginUser(clean, user);
                this.showMessage("Founder access granted.", "success");
                return { action: 'auto-login' };
            }
        }

        // NORMAL USER
        const existing = await window.databaseManager.getUser(clean);
        if (existing) {
            if (existing.securityPin) {
                return { action: 'prompt-pin', phone: clean };
            } else {
                return { action: 'auto-login' };
            }
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        await window.databaseManager.saveSetting(`otp_${clean}`, {
            otp,
            phone: clean,
            ts: Date.now(),
            attempts: 0
        });
        this.showOTP(clean, otp);
        return { action: 'otp-sent' };
    }

    // === VERIFY OTP & CREATE USER ===
    async verifyOTP(phone, otp, userData = null) {
        if (!this.isInitialized) throw new Error('Auth system not ready');
        const clean = this.validatePhone(phone);
        const result = await window.databaseManager.getSetting(`otp_${clean}`);
        if (!result?.value) throw new Error('OTP not found or expired');

        const data = result.value;
        if (Date.now() - data.ts > this.otpExpiry) {
            await window.databaseManager.deleteSetting(`otp_${clean}`);
            throw new Error('OTP expired');
        }
        if (data.attempts >= 3) throw new Error('Too many attempts');
        if (data.otp !== otp) {
            await window.databaseManager.saveSetting(`otp_${clean}`, { ...data, attempts: data.attempts + 1 });
            throw new Error('Wrong OTP');
        }

        await window.databaseManager.deleteSetting(`otp_${clean}`);
        this.hideOTP();

        // USER EXISTS? → LOGIN
        const user = await window.databaseManager.getUser(clean);
        if (user) {
            if (user.securityPin) {
                return { action: 'prompt-pin', phone: clean };
            } else {
                this.loginUser(clean, user);
                return { success: true, isNewUser: false };
            }
        }

        // === REFERRAL INTEGRATION ===
        // NEW USER WITH REFERRAL DATA
        const referralCode = userData?.referralCode || null;
        
        // SAFE PROFILE CREATION
        const profile = {
            phone: clean,
            fullName: (userData?.fullName || '').trim() || 'User',
            email: (userData?.email || '').trim() || '',
            balance: 0,
            createdAt: new Date().toISOString(),
            securityPin: null,
            isFounder: clean === "9999999999",
            // Referral tracking
            referralCode: referralCode,
            referredBy: referralCode,
            myReferralCode: this.generateReferralCode(clean),
            joinDate: new Date().toISOString()
        };

        await window.databaseManager.saveUser(profile);
        
        // Store referral relationship if exists
        if (referralCode) {
            await this.storeReferralRelationship(clean, referralCode);
        }
        
        this.loginUser(clean, profile);
        // === REFERRAL INTEGRATION END ===

        return { success: true, isNewUser: true };
    }

    // === SETUP SECURITY PIN ===
    async setupPin(phone, pin, userData = null) {
        const clean = this.validatePhone(phone);
        if (pin.length !== 6 || !/^\d+$/.test(pin)) throw new Error('PIN must be 6 digits');

        const obfuscated = this.obfuscatePin(pin);
        
        // === REFERRAL INTEGRATION ===
        const referralCode = userData?.referralCode || null;
        
        const profile = {
            phone: clean,
            fullName: (userData?.fullName || '').trim() || 'User',
            email: (userData?.email || '').trim() || '',
            balance: 0,
            createdAt: new Date().toISOString(),
            securityPin: obfuscated,
            isFounder: clean === "9999999999",
            // Referral tracking
            referralCode: referralCode,
            referredBy: referralCode,
            myReferralCode: this.generateReferralCode(clean),
            joinDate: new Date().toISOString()
        };

        await window.databaseManager.saveUser(profile);
        
        // Store referral relationship if exists
        if (referralCode) {
            await this.storeReferralRelationship(clean, referralCode);
        }
        // === REFERRAL INTEGRATION END ===

        this.loginUser(clean, profile);
        return { success: true };
    }

    // === REFERRAL SYSTEM METHODS ===
    async storeReferralRelationship(userPhone, referralCode) {
        try {
            console.log('🔗 Storing referral relationship:', userPhone, 'referred by:', referralCode);
            
            // Get referrer user data
            const referrer = await this.findUserByReferralCode(referralCode);
            if (referrer) {
                // Update referrer's referral chain
                const referrals = referrer.referrals || [];
                referrals.push({
                    phone: userPhone,
                    joinedAt: new Date().toISOString(),
                    level: 1
                });
                
                await window.databaseManager.saveUser({
                    ...referrer,
                    referrals: referrals
                });
                
                console.log('✅ Referral relationship stored successfully');
            }
        } catch (error) {
            console.error('❌ Failed to store referral relationship:', error);
        }
    }

    async findUserByReferralCode(referralCode) {
        try {
            // This would need to be implemented in database.js
            // For now, we'll get all users and find by referral code
            const allUsers = await window.databaseManager.getAllUsers();
            return allUsers.find(user => user.myReferralCode === referralCode);
        } catch (error) {
            console.error('Error finding user by referral code:', error);
            return null;
        }
    }

    generateReferralCode(phone) {
        // Generate a unique referral code based on phone + random string
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const randomPart = Array(4).fill().map(() => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        return phone.slice(-4) + randomPart;
    }

    // === VERIFY PIN ===
    async verifyPin(phone, pin) {
        const user = await window.databaseManager.getUser(phone);
        if (!user) throw new Error('User not found');

        if (user.pinLockUntil && Date.now() < user.pinLockUntil) {
            const mins = Math.ceil((user.pinLockUntil - Date.now()) / 60000);
            throw new Error(`Account locked. Try again in ${mins} min(s)`);
        }

        if (this.obfuscatePin(pin) !== user.securityPin) {
            const attempts = (user.pinAttempts || 0) + 1;
            if (attempts >= this.maxPinAttempts) {
                await window.databaseManager.saveUser({
                    ...user,
                    pinAttempts: 0,
                    pinLockUntil: Date.now() + this.pinLockDuration
                });
                throw new Error('Too many attempts. Account locked for 5 minutes.');
            }
            await window.databaseManager.saveUser({ ...user, pinAttempts: attempts });
            throw new Error(`Wrong PIN. Attempt ${attempts}/${this.maxPinAttempts}`);
        }

        // Reset attempts
        if (user.pinAttempts) {
            await window.databaseManager.saveUser({ ...user, pinAttempts: 0, pinLockUntil: null });
        }

        this.loginUser(phone, user);
        return { success: true };
    }

    // === STORAGE-AWARE LOGIN HELPER ===
    loginUser(phone, profile) {
        // SAFETY CHECK - ensure profile exists
        if (!profile) {
            console.warn('⚠️ No profile provided, creating fallback');
            profile = {
                phone: phone,
                fullName: 'User',
                balance: 0,
                createdAt: new Date().toISOString()
            };
        }

        const session = {
            phone,
            profile,
            isAuthenticated: true,
            loginTime: new Date().toISOString(),
            storageStrategy: this.storageStrategy // Track which storage we're using
        };

        const storage = this.getStorage();
        try {
            storage.setItem('currentUser', JSON.stringify(session));
            console.log('✅ User logged in with storage:', this.storageStrategy);
        } catch (error) {
            console.error('❌ Storage write failed, trying fallback:', error);
            // Try sessionStorage as fallback
            try {
                sessionStorage.setItem('currentUser', JSON.stringify(session));
                console.log('✅ User logged in with sessionStorage fallback');
            } catch (fallbackError) {
                console.error('❌ All storage failed, user session not persisted');
            }
        }
    }

    // === SESSION VALIDATION ===
    async validateSession() {
        try {
            const storage = this.getStorage();
            const currentUser = storage.getItem('currentUser');
            if (!currentUser) {
                return { valid: false, reason: 'No session found' };
            }

            const userData = JSON.parse(currentUser);
            if (!userData.isAuthenticated) {
                return { valid: false, reason: 'Session not authenticated' };
            }

            // Verify user still exists in database
            const user = await window.databaseManager.getUser(userData.phone);
            if (!user) {
                return { valid: false, reason: 'User not found in database' };
            }

            return { valid: true, user: { ...userData, profile: user } };
        } catch (error) {
            return { valid: false, reason: 'Session validation error' };
        }
    }

    // === LOGOUT ===
    async logout() {
        try {
            const storage = this.getStorage();
            storage.removeItem('currentUser');
            // Also clear sessionStorage as backup
            sessionStorage.removeItem('currentUser');
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    // === UTILS ===
    validatePhone(p) {
        const c = p.replace(/\D/g, '');
        return c.length === 10 && /^[6-9]/.test(c) ? c : null;
    }

    obfuscatePin(pin) {
        return btoa(pin.split('').reverse().join(''));
    }

    showOTP(phone, otp) {
        this.hideOTP();
        const el = document.createElement('div');
        el.id = 'otp-display';
        el.innerHTML = `
            <div style="position:fixed;top:20px;right:20px;background:#2E8B57;color:white;padding:16px;border-radius:8px;z-index:9999;font-family:system-ui;">
                <strong>OTP: ${otp}</strong><br>
                <small>${phone}</small>
                <button onclick="this.closest('#otp-display').remove()" style="float:right;background:none;border:none;color:white;font-size:18px;cursor:pointer;">×</button>
            </div>`;
        document.body.appendChild(el);
    }

    hideOTP() {
        document.getElementById('otp-display')?.remove();
    }

    showMessage(msg, type = 'info') {
        const container = document.querySelector('.form-container') || document.body;
        const el = document.createElement('div');
        el.textContent = msg;
        el.style = `margin:12px 0;padding:12px;border-radius:8px;text-align:center;font-weight:bold;
            ${type === 'error' ? 'background:#ffebee;color:#c62828;' : 'background:#e8f5e9;color:#2e7d32;'}`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }

    // === ACTIVITY TRACKING ===
    async updateUserActivity() {
        // Update last active timestamp
        try {
            const storage = this.getStorage();
            const currentUser = storage.getItem('currentUser');
            if (currentUser) {
                const userData = JSON.parse(currentUser);
                userData.lastActive = new Date().toISOString();
                storage.setItem('currentUser', JSON.stringify(userData));
            }
        } catch (error) {
            console.log('Activity update failed:', error);
        }
    }
}

// === STORAGE-AWARE AUTO-INIT ===
(async () => {
    console.log('🔧 Auth system initializing...');
    
    try {
        // Wait for database first (it has its own storage detection)
        while (!window.databaseManager?.isInitialized) {
            await new Promise(r => setTimeout(r, 50));
        }
        
        // Then create and initialize auth manager
        window.authManager = new AuthManager();
        await window.authManager.init();
        
        console.log('✅ Auth system ready with storage strategy');
        document.dispatchEvent(new Event('authReady'));
        
    } catch (error) {
        console.error('❌ Auth system initialization failed:', error);
        // Create emergency auth manager anyway
        window.authManager = new AuthManager();
        window.authManager.isInitialized = true;
        console.log('🆘 Auth system in emergency mode');
    }
})();
