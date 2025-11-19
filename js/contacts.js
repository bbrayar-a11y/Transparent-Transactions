document.addEventListener('DOMContentLoaded', () => {
    const addContactBtn = document.getElementById('add-contact-btn');
    if (addContactBtn) { addContactBtn.addEventListener('click', addContact); }
});

async function addContact() {
    if (!('contacts' in navigator)) { alert('Sorry, the Contact Picker API is not supported by your browser. This feature is currently only available on modern mobile browsers (like Chrome for Android).'); return; }
    try {
        const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
        if (contacts.length > 0) {
            console.log('Selected contacts:', contacts);
            for (const contact of contacts) {
                const name = contact.name ? contact.name[0] : 'Unknown';
                const phoneNumber = contact.tel ? contact.tel[0] : null;
                if (phoneNumber) {
                    const newContact = { name: name, phoneNumber: phoneNumber, addedAt: new Date().toISOString() };
                    await addData('contacts', newContact);
                    console.log(`Saved contact: ${name} - ${phoneNumber}`);
                }
            }
            alert(`${contacts.length} contact(s) added successfully!`);
        } else { console.log('No contacts selected.'); }
    } catch (error) { console.error('Error selecting contacts:', error); alert('An error occurred while accessing your contacts. Please ensure you have granted permission.'); }
}