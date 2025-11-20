function checkLoginStatus() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
        // Redirect to onboarding if not logged in
        window.location.href = 'onboarding.html';
        return null;
    }
    return JSON.parse(loggedInUser);
}

function logout() {
    localStorage.removeItem('loggedInUser');
    window.location.href = 'onboarding.html';
}