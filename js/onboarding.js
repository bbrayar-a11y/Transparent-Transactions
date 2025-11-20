document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref') || APP_CONFIG.SEED_REFERRAL_CODE;
    document.getElementById('referral-code').value = referralCode.toUpperCase();

    document.getElementById('onboarding-form').addEventListener('submit', handleSignup);
});

async function handleSignup(event) {
    event.preventDefault();
    const phoneNumber = document.getElementById('phone-number').value;
    const name = document.getElementById('user-name').value;
    const referredBy = document.getElementById('referral-code').value.trim().toUpperCase();

    if (!/^\d{10}$/.test(phoneNumber)) { alert('Please enter a valid 10-digit phone number.'); return; }
    if (!name) { alert('Please enter your name.'); return; }

    try {
        await initDB();
        const existingUser = await getDataByKey('users', phoneNumber);
        if (existingUser) {
            alert('This number is already registered. Please login.');
            window.location.href = 'login.html';
            return;
        }

        const newUser = {
            phoneNumber, name, referredBy,
            referralCode: generateReferralCode(),
            createdAt: new Date().toISOString(),
            profileComplete: false // Key flag for dashboard state
        };
        await addData('users', newUser);
        localStorage.setItem('loggedInUser', JSON.stringify(newUser));
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Signup failed:', error);
        alert('An error occurred during signup. Please try again.');
    }
}

function generateReferralCode() {
    return 'TT' + Math.random().toString(36).substr(2, 9).toUpperCase();
}