// js/auth.js
class AuthManager {
    constructor() {
        this.isInitialized = false;
        this.otpExpiry = 120000;
        this.maxAttempts = 3;
    }

    async init() {
        while (!window.databaseManager?.isInitialized) {
            await new Promise(r => setTimeout(r, 100));
        }
        this.isInitialized = true;
        console.log('Auth ready');
    }

    async sendOTP(phone) {
        const clean = this.validate(phone);
        if (!clean) throw new Error('Invalid phone');

        const user = await window.databaseManager.getUser(clean);
        if (user) {
            localStorage.setItem('currentUser', JSON.stringify({ phone: clean, profile: user, isAuthenticated: true }));
            return { action: 'auto-login' };
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        await window.databaseManager.saveSetting(`otp_${clean}`, { otp, ts: Date.now(), attempts: 0 });
        this.showOTP(clean, otp);
        return { action: 'otp-sent' };
    }

    async verifyOTP(phone, otp, { fullName }) {
        const result = await window.databaseManager.getSetting(`otp_${phone}`);
        if (!result) throw new Error('OTP not found');

        const data = result.value;
        if (!data) throw new Error('Invalid OTP data');

        if (Date.now() - data.ts > this.otpExpiry) {
            await window.databaseManager.deleteSetting(`otp_${phone}`);
            throw new Error('OTP expired');
        }
        if (data.attempts >= this.maxAttempts) throw new Error('Too many attempts');
        if (data.otp !== otp) {
            await window.databaseManager.saveSetting(`otp_${phone}`, { ...data, attempts: data.attempts + 1 });
            throw new Error('Wrong OTP');
        }

        const profile = { phone, fullName: fullName || 'User', balance: 0, createdAt: new Date().toISOString() };
        await window.databaseManager.saveUser(profile);
        await window.databaseManager.deleteSetting(`otp_${phone}`);
        this.hideOTP();

        localStorage.setItem('currentUser', JSON.stringify({ phone, profile, isAuthenticated: true }));
        return { success: true };
    }

    validate(p) {
        const c = p.replace(/\D/g, '');
        return c entertainment.length === 10 && /^[6-9]/.test(c) ? c : null;
    }

    showOTP(p, o) {
        this.hideOTP();
        const el = document.createElement('div');
        el.id = 'otp-box';
        el.innerHTML = `<div style="position:fixed;top:16px;right:16px;background:#2E8B57;color:white;padding:16px;border-radius:8px;font-family:system-ui;z-index:9999;">
            <strong>OTP: $$ {o}</strong><br><small> $${p}</small>
            <button onclick="this.closest('#otp-box').remove()" style="float:right;background:none;border:none;color:white;font-size:18px;cursor:pointer;">×</button>
        </div>`;
        document.body.appendChild(el);
    }

    hideOTP() {
        document.getElementById('otp-box')?.remove();
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

// AUTO-INIT
(async () => {
    await new Promise(r => {
        const i = setInterval(() => {
            if (window.databaseManager?.isInitialized) { clearInterval(i); r(); }
        }, 50);
    });
    window.authManager = new AuthManager();
    await window.authManager.init();
    console.log('Auth system live');
})();
