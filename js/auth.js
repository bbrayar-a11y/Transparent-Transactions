// js/auth.js
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.otpExpiry = 120000; // 2 min
        this.maxAttempts = 3;
    }

    async init() {
        if (this.isInitialized) return;
        await this.waitForDB();
        await this.loadSession();
        this.isInitialized = true;
        console.log('AuthManager ready');
    }

    async waitForDB() {
        while (!window.databaseManager?.isInitialized) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    async loadSession() {
        const data = localStorage.getItem('currentUser');
        if (data) {
            const session = JSON.parse(data);
            const user = await window.databaseManager.getUser(session.phone);
            if (user) {
                session.profile = user;
                this.currentUser = session;
            } else {
                localStorage.removeItem('currentUser');
            }
        }
    }

    async sendOTP(phone) {
        const clean = this.validatePhone(phone);
        if (!clean) throw new Error('Invalid 10-digit Indian number');

        const user = await window.databaseManager.getUser(clean);
        if (user) {
            await this.login(clean, user);
            return { action: 'auto-login', user: this.currentUser };
        }

        const otp = this.genOTP();
        const otpData = { phone, otp, ts: Date.now(), attempts: 0 };
        await window.databaseManager.saveSetting(`otp_${phone}`, otpData);
        this.showOTP(phone, otp);
        return { action: 'otp-sent' };
    }

    async verifyOTP(phone, otp, { fullName }) {
        const result = await window.databaseManager.getSetting(`otp_${phone}`);
        if (!result?.value) throw new Error('OTP not found');

        const data = result.value;
        if (Date.now() - data.ts > this.otpExpiry) {
            await window.databaseManager.deleteSetting(`otp_${phone}`);
            throw new Error('OTP expired');
        }
        if (data.attempts >= this.maxAttempts) throw new Error('Too many attempts');
        if (data.otp !== otp) {
            await window.databaseManager.saveSetting(`otp_${phone}`, { ...data, attempts: data.attempts + 1 });
            throw new Error('Wrong OTP');
        }

        const profile = {
            phone,
            fullName: fullName || 'User',
            balance: 0,
            createdAt: new Date().toISOString()
        };

        await window.databaseManager.saveUser(profile);
        await window.databaseManager.deleteSetting(`otp_${phone}`);
        this.hideOTP();
        await this.login(phone, profile);
        return { success: true };
    }

    async login(phone, profile) {
        const session = { phone, isAuthenticated: true, profile };
        localStorage.setItem('currentUser', JSON.stringify(session));
        this.currentUser = session;
    }

    validatePhone(p) {
        const c = p.replace(/\D/g, '');
        return c.length === 10 && /^[6-9]/.test(c) ? c : null;
    }

    genOTP() {
        return String(Math.floor(100000 + Math.random() * 900000));
    }

    showOTP(phone, otp) {
        this.hideOTP();
        const el = document.createElement('div');
        el.id = 'otp-popup';
        el.innerHTML = `
            <div style="position:fixed;top:20px;right:20px;background:#2E8B57;color:white;padding:16px;border-radius:8px;z-index:9999;font-family:system-ui;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <strong>OTP: ${otp}</strong>
                    <button onclick="this.closest('#otp-popup').remove()" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">×</button>
                </div>
                <small>Phone: ${phone}</small>
            </div>`;
        document.body.appendChild(el);
    }

    hideOTP() {
        document.getElementById('otp-popup')?.remove();
    }

    showMessage(msg, type = 'info') {
        const el = document.createElement('div');
        el.textContent = msg;
        el.style = `margin:10px 0;padding:12px;border-radius:8px;text-align:center;font-weight:bold;
            ${type === 'error' ? 'background:#ffebee;color:#c62828;' : 'background:#e8f5e9;color:#2e7d32;'}`;
        document.querySelector('.phone-form')?.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }
}

// AUTO-START AFTER DB
(async () => {
    await new Promise(r => {
        const check = setInterval(() => {
            if (window.databaseManager?.isInitialized) {
                clearInterval(check);
                r();
            }
        }, 50);
    });
    window.authManager = new AuthManager();
    await window.authManager.init();
    console.log('Auth system fully ready');
})();
