// js/transactions.js

document.addEventListener('DOMContentLoaded', () => {
    // Get references to the modal elements
    const modal = document.getElementById('transaction-modal');
    const openBtn = document.getElementById('open-transaction-modal-btn');
    const closeBtn = document.querySelector('.close-btn');
    const transactionForm = document.getElementById('transaction-form');
    const contactSelect = document.getElementById('contact-select');

    // Open modal
    openBtn.addEventListener('click', () => {
        modal.style.display = 'block';
        loadContacts(); // Load contacts when the modal opens
    });

    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal if clicked outside of it
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Handle form submission
    transactionForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveTransaction();
    });
});

/**
 * Loads user's contacts from IndexedDB and populates the select dropdown.
 */
async function loadContacts() {
    const contactSelect = document.getElementById('contact-select');
    contactSelect.innerHTML = '<option value="">-- Choose a contact --</option>'; // Clear existing options

    try {
        const contacts = await getAllData('contacts');
        contacts.forEach(contact => {
            const option = document.createElement('option');
            option.value = contact.phoneNumber;
            option.textContent = `${contact.name} (${contact.phoneNumber})`;
            contactSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading contacts:', error);
        alert('Could not load contacts. Please try again.');
    }
}

/**
 * Saves the transaction data to IndexedDB.
 */
async function saveTransaction() {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const withPhoneNumber = document.getElementById('contact-select').value;
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    const type = document.querySelector('input[name="type"]:checked').value;
    const date = document.getElementById('transaction-date').value;
    const notes = document.getElementById('transaction-notes').value;

    if (!withPhoneNumber) {
        alert('Please select a contact.');
        return;
    }

    const transaction = {
        transactionId: `TXN_${Date.now()}`, // Unique ID
        userPhoneNumber: loggedInUser.phoneNumber,
        withPhoneNumber: withPhoneNumber,
        amount: amount,
        type: type, // 'gave' or 'got'
        date: date,
        notes: notes,
        createdAt: new Date().toISOString(),
        status: 'pending', // pending, confirmed, settled
        // TODO: Add digital shakehand status later
    };

    try {
        await addData('transactions', transaction);
        console.log('Transaction saved:', transaction);
        alert('Transaction recorded successfully!');
        
        // Close the modal and reset the form
        document.getElementById('transaction-modal').style.display = 'none';
        document.getElementById('transaction-form').reset();

        // TODO: Reload the recent activity list on the dashboard
        // loadRecentTransactions();

    } catch (error) {
        console.error('Error saving transaction:', error);
        alert('An error occurred while saving the transaction.');
    }
}