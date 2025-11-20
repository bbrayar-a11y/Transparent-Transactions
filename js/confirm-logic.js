document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    const urlParams = new URLSearchParams(window.location.search);
    const txnId = urlParams.get('txn');
    const refCode = urlParams.get('ref');

    let user = checkLoginStatus();
    if (!user) {
        showMiniOnboarding(txnId, refCode);
    } else {
        showConfirmationInterface(txnId);
    }
});

function showMiniOnboarding(txnId, refCode) {
    const container = document.getElementById('main-container');
    container.innerHTML = `
        <h2>Join to Confirm Transaction</h2>
        <p>You need to be a member of Transparent Transactions to view this request.</p>
        <form id="mini-onboarding-form">
            <label for="phone-number">Your Phone Number</label>
            <input type="tel" id="phone-number" required>
            <label for="user-name">Your Name</label>
            <input type="text" id="user-name" required>
            <button type="submit">Join & Confirm</button>
        </form>
    `;
    document.getElementById('mini-onboarding-form').addEventListener('submit', (e) => handleMiniSignup(e, txnId, refCode));
}

async function handleMiniSignup(event, txnId, refCode) {
    event.preventDefault();
    const phoneNumber = document.getElementById('phone-number').value;
    const name = document.getElementById('user-name').value;

    try {
        const newUser = { phoneNumber, name, referredBy: refCode, referralCode: generateReferralCode(), createdAt: new Date().toISOString(), profileComplete: true };
        await addData('users', newUser);
        localStorage.setItem('loggedInUser', JSON.stringify(newUser));
        // Reload the page logic to show confirmation
        location.reload();
    } catch (error) {
        console.error('Mini-signup failed:', error);
        alert('Signup failed. Please try again.');
    }
}

async function showConfirmationInterface(txnId) {
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    const transaction = await getDataByKey('transactions', txnId);
    if (!transaction || transaction.withPhoneNumber !== user.phoneNumber) {
        document.getElementById('main-container').innerHTML = `<h2>Transaction Not Found</h2><p>This transaction could not be found or is not for you.</p>`;
        return;
    }

    const container = document.getElementById('main-container');
    container.innerHTML = `
        <h2>Confirm Transaction</h2>
        <div class="transaction-details">
            <p><strong>From:</strong> ${transaction.userPhoneNumber}</p>
            <p><strong>To:</strong> ${transaction.withPhoneNumber}</p>
            <p><strong>Amount:</strong> ₹${transaction.amount}</p>
            <p><strong>Type:</strong> ${transaction.type}</p>
        </div>
        <button class="confirm-btn" onclick="confirmTxn('${txnId}')">Confirm</button>
        <button class="deny-btn" onclick="denyTxn('${txnId}')">Deny</button>
    `;
}

async function confirmTxn(txnId) {
    try {
        const transaction = await getDataByKey('transactions', txnId);
        transaction.status = 'confirmed';
        await updateData('transactions', txnId, transaction);
        alert('Transaction confirmed!');
        window.location.href = 'index.html';
    } catch (error) { console.error('Confirmation failed:', error); alert('Failed to confirm.'); }
}

async function denyTxn(txnId) {
    try {
        const transaction = await getDataByKey('transactions', txnId);
        transaction.status = 'denied';
        await updateData('transactions', txnId, transaction);
        alert('Transaction denied.');
        window.location.href = 'index.html';
    } catch (error) { console.error('Denial failed:', error); alert('Failed to deny.'); }
}

function generateReferralCode() {
    return 'TT' + Math.random().toString(36).substr(2, 9).toUpperCase();
}