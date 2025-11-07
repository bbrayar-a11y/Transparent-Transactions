// contacts.js - Complete Contacts Management with Phone Book Import
class ContactsManager {
    constructor() {
        this.dbName = 'TransparentTransactionsDB';
        this.dbVersion = 1;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(new Error('Failed to open database'));
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.initialized = true;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('contacts')) {
                    const store = db.createObjectStore('contacts', { keyPath: 'id' });
                    store.createIndex('phone', 'phone', { unique: true });
                    store.createIndex('name', 'name', { unique: false });
                }
            };
        });
    }

    // Save contact to database
    async saveContact(contact) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['contacts'], 'readwrite');
            const store = transaction.objectStore('contacts');
            const request = store.put(contact);
            
            request.onsuccess = () => resolve(contact);
            request.onerror = () => reject(new Error('Failed to save contact'));
        });
    }

    // Get all contacts
    async getAllContacts() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['contacts'], 'readonly');
            const store = transaction.objectStore('contacts');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(new Error('Failed to get contacts'));
        });
    }

    // Delete contact
    async deleteContact(contactId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['contacts'], 'readwrite');
            const store = transaction.objectStore('contacts');
            const request = store.delete(contactId);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(new Error('Failed to delete contact'));
        });
    }

    // Import from phone book
    async importFromPhoneBook() {
        try {
            // Method 1: Contact Picker API (modern browsers)
            if ('contacts' in navigator && 'select' in navigator.contacts) {
                return await this.importViaContactPicker();
            }
            // Method 2: Web Share API fallback
            else if (navigator.share) {
                return await this.importViaWebShare();
            }
            // Method 3: Manual entry
            else {
                return await this.importViaManualEntry();
            }
        } catch (error) {
            console.error('Contact import failed:', error);
            this.showImportError(error);
            return null;
        }
    }

    // Contact Picker API method
    async importViaContactPicker() {
        try {
            const properties = ['name', 'tel'];
            const options = { multiple: true };
            
            const contacts = await navigator.contacts.select(properties, options);
            const importedContacts = [];
            
            for (const contact of contacts) {
                if (contact.tel && contact.tel.length > 0) {
                    const phone = this.normalizePhone(contact.tel[0]);
                    const name = contact.name ? contact.name[0] : 'Unknown';
                    
                    const newContact = {
                        id: this.generateId(),
                        name: name,
                        phone: phone,
                        importedFrom: 'phonebook',
                        createdAt: new Date().toISOString()
                    };
                    
                    await this.saveContact(newContact);
                    importedContacts.push(newContact);
                }
            }
            
            this.showImportSuccess(importedContacts.length);
            return importedContacts;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Contact selection cancelled');
                return null;
            }
            throw error;
        }
    }

    // Web Share API method
    async importViaWebShare() {
        return new Promise((resolve) => {
            this.showWebShareInstructions();
            resolve(null);
        });
    }

    // Manual entry method
    async importViaManualEntry() {
        this.showManualImportGuide();
        return null;
    }

    // Search contacts
    async searchContacts(query) {
        const allContacts = await this.getAllContacts();
        return allContacts.filter(contact => 
            contact.name.toLowerCase().includes(query.toLowerCase()) ||
            contact.phone.includes(query)
        );
    }

    // Get contact by phone
    async getContactByPhone(phone) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['contacts'], 'readonly');
            const store = transaction.objectStore('contacts');
            const index = store.index('phone');
            const request = index.get(phone);
            
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(new Error('Failed to get contact'));
        });
    }

    // Update contact
    async updateContact(contactId, updates) {
        const contact = await this.getContactById(contactId);
        if (!contact) throw new Error('Contact not found');
        
        const updatedContact = { ...contact, ...updates, updatedAt: new Date().toISOString() };
        return await this.saveContact(updatedContact);
    }

    // Get contact by ID
    async getContactById(contactId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['contacts'], 'readonly');
            const store = transaction.objectStore('contacts');
            const request = store.get(contactId);
            
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(new Error('Failed to get contact'));
        });
    }

    // Utility methods
    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    normalizePhone(phone) {
        return phone.replace(/\D/g, '').replace(/^91/, '').substr(-10);
    }

    validatePhone(phone) {
        return /^\d{10}$/.test(phone);
    }

    // UI feedback methods
    showImportSuccess(count) {
        if (window.uiManager && window.uiManager.showStatus) {
            window.uiManager.showStatus(`Successfully imported ${count} contacts!`, 'success');
        } else {
            alert(`Successfully imported ${count} contacts!`);
        }
    }

    showImportError(error) {
        const errorMessage = this.getErrorMessage(error);
        if (window.uiManager && window.uiManager.showError) {
            window.uiManager.showError(`Failed to import contacts: ${errorMessage}`);
        } else {
            alert(`Import failed: ${errorMessage}`);
        }
    }

    getErrorMessage(error) {
        if (error.name === 'AbortError') return 'Selection cancelled';
        if (error.name === 'NotSupportedError') return 'Feature not supported on this device';
        if (error.message.includes('permission')) return 'Permission denied';
        return 'Please try manual entry';
    }

    showWebShareInstructions() {
        const message = `To import contacts:\n\n1. Open your phone's contacts app\n2. Select contacts you want to import\n3. Use the "Share" option\n4. Choose "Transparent Transactions"`;
        alert(message);
    }

    showManualImportGuide() {
        const message = `How to add contacts:\n\n1. Open your phone's contacts app\n2. Copy the phone number\n3. Come back here and use "Add Contact"\n4. Paste the phone number`;
        alert(message);
    }

    // Get contacts statistics
    async getContactsStats() {
        const contacts = await this.getAllContacts();
        return {
            total: contacts.length,
            imported: contacts.filter(c => c.importedFrom === 'phonebook').length,
            manual: contacts.filter(c => !c.importedFrom).length
        };
    }

    // Export contacts data
    async exportContacts() {
        const contacts = await this.getAllContacts();
        const dataStr = JSON.stringify(contacts, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        return URL.createObjectURL(dataBlob);
    }

    // Import contacts from JSON
    async importFromJSON(jsonData) {
        try {
            const contacts = JSON.parse(jsonData);
            let importedCount = 0;
            
            for (const contact of contacts) {
                contact.id = this.generateId();
                contact.importedAt = new Date().toISOString();
                await this.saveContact(contact);
                importedCount++;
            }
            
            this.showImportSuccess(importedCount);
            return importedCount;
        } catch (error) {
            throw new Error('Invalid contacts data format');
        }
    }
}

// Initialize and expose globally
const contactsManager = new ContactsManager();
window.contactsManager = contactsManager;

// Auto-initialize when loaded
document.addEventListener('DOMContentLoaded', function() {
    contactsManager.init().catch(console.error);
    
    // Add event listener for import button if it exists
    const importBtn = document.getElementById('importContactsBtn');
    if (importBtn) {
        importBtn.addEventListener('click', async function() {
            await contactsManager.importFromPhoneBook();
        });
    }
});
