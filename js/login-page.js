// js/login-page.js

document.addEventListener('DOMContentLoaded', () => {
    // Check if a user is already logged in from a previous session
    const rememberedUser = localStorage.getItem('loggedInUser');

    if (rememberedUser) {
        // A user is remembered, show their info
        showRememberedUserView(JSON.parse(rememberedUser));
    } else {
        // No user is remembered, redirect to onboarding to get them started
        window.location.href = 'onboarding.html';
    }

    // Add event listener for the "Continue" button
    document.getElementById('continue-btn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});

// This function takes the user's data and puts it into the HTML
function showRememberedUserView(user) {
    document.getElementById('remembered-name').textContent = user.name;
    document.getElementById('remembered-phone').textContent = user.phoneNumber;
}