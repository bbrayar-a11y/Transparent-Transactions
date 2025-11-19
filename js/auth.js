const SEED_REFERRAL_CODE = 'SEEDTT001';

document.addEventListener('DOMContentLoaded', () => {
    initDB().then(() => {
        document.getElementById('phone-form').addEventListener('submit', sendOTP);
        document.getElementById('otp-form').addEventListener('submit', verifyOTP);
    }).catch(error => console.error("Auth: Failed to initialize DB.", error));
});

function sendOTP(event) {
    event.preventDefault();
    const phoneNumber = document.getElementById('phone-number').value;
    const referralCode = document.getElementById('referral-code').value.trim().toUpperCase();
    if (!/^\d{10}$/.test(phoneNumber)) { alert('Please enter a valid 10-digit phone number.'); return; }
    if (!referralCode) { alert('A referral code is required to sign up.'); return; }
    sessionStorage.setItem('phoneNumber', phoneNumber); sessionStorage.setItem('referralCode', referralCode); sessionStorage.setItem('simulatedOTP', '123456');
    document.getElementById('phone-section').classList.add('hidden'); document.getElementById('otp-section').classList.remove('hidden');
}

async function verifyOTP(event) {
    event.preventDefault();
    const enteredOTP = document.getElementById('otp-input').value;
    const simulatedOTP = sessionStorage.getItem('simulatedOTP');
    if (enteredOTP === simulatedOTP) {
        const phoneNumber = sessionStorage.getItem('phoneNumber');
        const referralCodeUsed = sessionStorage.getItem('referralCode');
        await handleLogin(phoneNumber, referralCodeUsed);
        sessionStorage.clear();
        window.location.href = 'index.html';
    } else { alert('Invalid OTP. Please try again.'); }
}

async function handleLogin(phoneNumber, referralCodeUsed) {
    try {
        let user = await getDataByKey('users', phoneNumber);
        if (!user) {
            const referrer = await validateReferralCode(referralCodeUsed);
            if (!referrer) { alert('Invalid or expired referral code.'); document.getElementById('otp-section').classList.add('hidden'); document.getElementById('phone-section').classList.remove('hidden'); return; }
            user = { phoneNumber: phoneNumber, name: `User ${phoneNumber.slice(-4)}`, referralCode: generateReferralCode(), referredBy: referralCodeUsed, createdAt: new Date().toISOString(), totalEarnings: 0, pendingPayouts: 0 };
            await addData('users', user);
            console.log(`User ${phoneNumber} was referred by ${referrer.phoneNumber || 'SYSTEM'} using code ${referralCodeUsed}`);
        } else { console.log('Auth: Existing user logged in.', user); }
        localStorage.setItem('loggedInUser', JSON.stringify(user));
    } catch (error) { console.error('Auth: Error during login.', error); alert('An error occurred during login. Please try again.'); }
}

async function validateReferralCode(code) {
    if (code === SEED_REFERRAL_CODE) { return { phoneNumber: 'SYSTEM', referralCode: SEED_REFERRAL_CODE }; }
    const referrer = await getDataByIndex('users', 'referralCode', code);
    return referrer;
}

function logout() { localStorage.removeItem('loggedInUser'); window.location.href = 'login.html'; }
function checkLoginStatus() { const loggedInUser = localStorage.getItem('loggedInUser'); if (!loggedInUser) { window.location.href = 'login.html'; } return JSON.parse(loggedInUser); }
function generateReferralCode() { return 'TT' + Math.random().toString(36).substr(2, 9).toUpperCase(); }