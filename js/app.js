document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    const user = checkLoginStatus();
    loadDashboard(user);
});

function loadDashboard(user) {
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('trust-score').textContent = '---';
    const referralCodeElement = document.getElementById('user-referral-code');
    referralCodeElement.textContent = user.referralCode;
    const copyButton = document.getElementById('copy-referral-link-btn');
    const referralLink = `${window.location.origin}/login.html?ref=${user.referralCode}`;
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(referralLink).then(() => {
            const originalText = copyButton.textContent; copyButton.textContent = 'Copied!'; setTimeout(() => { copyButton.textContent = originalText; }, 2000);
        }).catch(err => { console.error('Failed to copy: ', err); alert('Failed to copy link. Please copy it manually: ' + referralLink); });
    });
    console.log('Dashboard loaded for user:', user.phoneNumber);
}