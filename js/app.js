document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    const user = checkLoginStatus(); // Will redirect if not logged in
    loadDashboard(user);
});

function loadDashboard(user) {
    const firstTimeView = document.getElementById('first-time-view');
    const standardView = document.getElementById('standard-view');

    if (user.profileComplete === false) {
        firstTimeView.classList.remove('hidden');
        standardView.classList.add('hidden');
        setupFirstTimeView(user);
    } else {
        firstTimeView.classList.add('hidden');
        standardView.classList.remove('hidden');
        setupStandardView(user);
    }
}

function setupFirstTimeView(user) {
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-referral-code').textContent = user.referralCode;
    document.getElementById('copy-referral-link-btn').onclick = () => copyReferralLink(user.referralCode);
    document.getElementById('add-first-contact-btn').onclick = () => addContactAndCompleteProfile();
    document.getElementById('view-reports-btn').onclick = () => window.location.href = 'reports.html';
}

function setupStandardView(user) {
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-referral-code-std').textContent = user.referralCode;
    document.getElementById('copy-referral-link-btn-std').onclick = () => copyReferralLink(user.referralCode);
    document.getElementById('contacts-link').onclick = () => alert('Contacts view coming soon!');
    document.getElementById('record-txn-link').onclick = () => alert('Transaction recording coming soon!');
    document.getElementById('logout-link').onclick = logout;
}

function copyReferralLink(code) {
    const link = `${window.location.origin}/onboarding.html?ref=${code}`;
    navigator.clipboard.writeText(link).then(() => alert('Referral link copied!')).catch(() => alert('Failed to copy.'));
}

async function addContactAndCompleteProfile() {
    try {
        const contacts = await navigator.contacts.select(['name', 'tel']);
        if (contacts.length > 0) {
            for (const contact of contacts) {
                const newContact = { name: contact.name[0], phoneNumber: contact.tel[0], addedAt: new Date().toISOString() };
                await addData('contacts', newContact);
            }
            // Mark profile as complete
            const user = JSON.parse(localStorage.getItem('loggedInUser'));
            user.profileComplete = true;
            await updateData('users', user.phoneNumber, user);
            localStorage.setItem('loggedInUser', JSON.stringify(user));
            // Reload dashboard to show standard view
            location.reload();
        }
    } catch (error) {
        alert('Could not add contacts. Please ensure you have granted permission.');
    }
}