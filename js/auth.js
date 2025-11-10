// js/auth.js - COMPLETE WITH REFERRAL ONBOARDING
class AuthManager {
    constructor() {
        this.isInitialized = false;
        this.otpExpiry = 120000; // 2 minutes
        this.maxPinAttempts = 3;
        this.pinLockDuration = 5 * 60 * 1000; // 5 minutes
    }

    async init() {
        // Wait for database
        while (!window.databaseManager?.isInitialized) {
            await new Promise(r => setTimeout(r, 50));
        }
        this.isInitialized = true;
        console.log('AuthManager initialized');
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
                localStorage.setItem('currentUser', JSON.stringify({
                    phone: clean,
                    profile: user,
                    isAuthenticated: true,
                    loginTime: new Date().toISOString()
                }));
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

        // === REFERRAL INTEGRATION START ===
        // NEW USER WITH REFERRAL DATA
        const referralCode = userData?.referralCode || null;
        
        const profile = {
            phone: clean,
            fullName: userData?.fullName?.trim() || 'User',
            email: userData?.email?.trim() || '',
            balance: 0,
            createdAt: new Date().toISOString(),
            securityPin: null,
            isFounder: clean === "9999999999",
            // Referral tracking
            referralCode: referralCode,
            referredBy: referralCode, // Track who referred this user
            myReferralCode: this.generateReferralCode(clean), // Generate unique code for this user
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
        
        // === REFERRAL INTEGRATION START ===
        const referralCode = userData?.referralCode || null;
        
        const profile = {
            phone: clean,
            fullName: userData?.fullName?.trim() || 'User',
            email: userData?.email?.trim() || '',
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
                    level: 1 // Direct referral
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

    // === LOGIN HELPER ===
    loginUser(phone, profile) {
        const session = {
            phone,
            profile,
            isAuthenticated: true,
            loginTime: new Date().toISOString()
        };
        localStorage.setItem('currentUser', JSON.stringify(session));
    }

    // === UTILS ===
    validatePhone(p) {
        const c = p.replace(/\D/g, '');
        return c.length === 10 && /^[6-9]/.test(c) ? c : null;
    }

    obfuscatePin(pin) {
        return btoa(pin.split('').reverse().join('')); // Simple reversible obfuscation
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
}

// === AUTO-INIT ===
(async () => {
    while (!window.databaseManager?.isInitialized) {
        await new Promise(r => setTimeout(r, 50));
    }
    window.authManager = new AuthManager();
    await window.authManager.init();
    console.log('Auth system ready');
    document.dispatchEvent(new Event('authReady'));
})();
