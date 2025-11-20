// js/onboarding.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("onboarding.js: Script loaded.");
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref') || APP_CONFIG.SEED_REFERRAL_CODE;

    // Get references to important DOM elements
    const onboardingForm = document.getElementById('onboarding-form');
    const phoneInput = document.getElementById('phone-number');
    const nameInput = document.getElementById('user-name');
    const referralInput = document.getElementById('referral-code');

    // Pre-fill the referral code if it exists in the URL
    if (referralInput) {
        referralInput.value = referralCode.toUpperCase();
        console.log("onboarding.js: Referral code pre-filled:", referralInput.value);
    }

    // Add the submit event listener to the form
    // This check ensures the listener is only attached if the form element exists
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', handleSignup);
        console.log("onboarding.js: Event listener attached to form.");
    } else {
        console.error("onboarding.js: ERROR - onboarding-form element not found!");
    }
});

/**
 * Handles the form submission for new user signup.
 * @param {Event} event - The form submit event.
 */
async function handleSignup(event) {
    event.preventDefault(); // Prevent the default form submission behavior
    console.log("onboarding.js: handleSignup function called.");

    const phoneNumber = phoneInput.value;
    const name = nameInput.value;
    const referredBy = referralInput.value.trim().toUpperCase();

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

        console.log("onboarding.js: Checking for existing user with phone:", phoneNumber);
        const existingUser = await getDataByKey('users', phoneNumber);

        if (existingUser) {
            // --- Existing User Flow ---
            console.log("onboarding.js: User already exists. Redirecting to login page.");
            alert('This phone number is already registered. Please login.');
            window.location.href = 'login.html';
            return;
        }

        // --- New User Flow ---
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

        // --- Session Management ---
        console.log("onboarding.js: Storing user in localStorage and redirecting.");
        localStorage.setItem('loggedInUser', JSON.stringify(newUser));
        window.location.href = 'index.html';

    } catch (error) {
        console.error("onboarding.js: A critical error occurred during signup:", error);
        alert('An error occurred during signup. Please try again.');
    }
}

/**
 * Generates a simple, unique referral code.
 * @returns {string} A new referral code.
 */
function generateReferralCode() {
    return 'TT' + Math.random().toString(36).substr(2, 9).toUpperCase();
}