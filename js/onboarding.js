// js/onboarding.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("onboarding.js: DOMContentLoaded. Starting script.");

    // Get referral code from URL, with a fallback to the seed code
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref') || APP_CONFIG.SEED_REFERRAL_CODE;
    
    // Get the form and input elements
    const onboardingForm = document.getElementById('onboarding-form');
    const phoneInput = document.getElementById('phone-number');
    const nameInput = document.getElementById('user-name');
    const referralInput = document.getElementById('referral-code');

    // Pre-fill the referral code
    if (referralInput) {
        referralInput.value = referralCode.toUpperCase();
        console.log("onboarding.js: Referral code pre-filled:", referralInput.value);
    }

    // Add the submit event listener
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', handleSignup);
        console.log("onboarding.js: Event listener attached to form.");
    } else {
        console.error("onboarding.js: ERROR - onboarding-form element not found!");
    }
});

async function handleSignup(event) {
    event.preventDefault();
    console.log("onboarding.js: handleSignup function called.");

    const phoneNumber = phoneInput.value;
    const name = nameInput.value;
    const referredBy = referralInput.value.trim().toUpperCase();

    console.log("onboarding.js: Collected data:", { phoneNumber, name, referredBy });

    // --- Client-Side Validation ---
    if (!/^\d{10}$/.test(phoneNumber)) {
        console.error("onboarding.js: Validation failed - Invalid phone number.");
        alert('Please enter a valid 10-digit phone number.');
        return;
    }

    if (!name) {
        console.error("onboarding.js: Validation failed - Name is empty.");
        alert('Please enter your name.');
        return;
    }

    try {
        console.log("onboarding.js: Initializing database...");
        // Ensure the database is initialized before we try to use it
        await initDB(); 
        console.log("onboarding.js: Database initialized.");

        const existingUser = await getDataByKey('users', phoneNumber);
        console.log("onboarding.js: Checked for existing user:", existingUser);

        if (existingUser) {
            console.log("onboarding.js: User already exists. Redirecting to login.");
            alert('This number is already registered. Please login.');
            window.location.href = 'login.html';
            return;
        }

        console.log("onboarding.js: Creating new user object...");
        const newUser = {
            phoneNumber: phoneNumber,
            name: name,
            referredBy: referredBy,
            referralCode: generateReferralCode(),
            createdAt: new Date().toISOString(),
            profileComplete: false // Key flag for dashboard state
        };
        console.log("onboarding.js: New user object:", newUser);

        console.log("onboarding.js: Adding new user to database...");
        await addData('users', newUser);
        console.log("onboarding.js: New user added successfully.");

        // Store the new user in localStorage to log them in
        localStorage.setItem('loggedInUser', JSON.stringify(newUser));
        console.log("onboarding.js: User logged in and stored in localStorage.");

        // Redirect to the dashboard
        console.log("onboarding.js: Redirecting to index.html...");
        window.location.href = 'index.html';

    } catch (error) {
        console.error('onboarding.js: A critical error occurred during signup:', error);
        alert('An error occurred during signup. Please try again.');
    }
}

function generateReferralCode() {
    return 'TT' + Math.random().toString(36).substr(2, 9).toUpperCase();
}