// database.js - FINAL VERSION
// Fully corrected: DB inits first → AuthManager created after → New user works on first run

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = 'TransparentTransactionsDB';
        this.dbVersion = 3;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) {
            console.log('Database already initialized');
            return;
        }

        console.log('Database Manager initializing...');
        try {
            this.db = await this.openDatabase();
            await this.verifyStores();
            this.isInitialized = true;
            console.log('Database initialized successfully');

            // CRITICAL: Create AuthManager ONLY after DB is ready
            this.initializeAuthManager();

        } catch (error) {
            console.error('Database initialization failed:', error);
            alert('Database error. Please reload the app.');
            throw error;
        }
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createStoresInUpgrade(db);
            };
        });
    }

    createStoresInUpgrade(db) {
        // Users
        if (!db.objectStoreNames.contains('users')) {
            const store = db.createObjectStore('users', { keyPath: 'phone' });
            store.createIndex('phone', 'phone', { unique: true });
            console.log('Created users store');
        }

        // Settings (for OTP, etc.)
        if (!db.objectStoreNames.contains('settings')) {
            const store = db.createObjectStore('settings', { keyPath: 'key' });
            store.createIndex('key', 'key', { unique: true });
            console.log('Created settings store');
        }

        // Transactions
        if (!db.objectStoreNames.contains('transactions')) {
            const store = db.createObjectStore('transactions', {
                keyPath: 'id',
                autoIncrement: true
            });
            store.createIndex('fromPhone', 'fromPhone', { unique: false });
            store.createIndex('toPhone', 'toPhone', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            console.log('Created transactions store');
        }

        // Contacts
        if (!db.objectStoreNames.contains('contacts')) {
            const store = db.createObjectStore('contacts', {
                keyPath: 'id',
                autoIncrement: true
            });
            store.createIndex('ownerPhone', 'ownerPhone', { unique: false });
            console.log('Created contacts store');
        }
    }

    async verifyStores() {
        const stores = ['users', 'settings', 'transactions', 'contacts'];
        for (const name of stores) {
            await this.executeTransaction(name, 'readonly', store => store.count());
        }
        console.log('All stores verified');
    }

    executeTransaction(storeName, mode, operation) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], mode);
            const store = tx.objectStore(storeName);
            const request = operation(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            tx.onerror = () => reject(tx.error);
        });
    }

    // === USER METHODS ===
    async saveUser(userData) {
        return this.executeTransaction('users', 'readwrite', store => {
            return store.put({
                ...userData,
                lastUpdated: new Date().toISOString()
            });
        });
    }

    async getUser(phone) {
        return this.executeTransaction('users', 'readonly', store => {
            return store.get(phone);
        });
    }

    // === SETTINGS (OTP, etc.) ===
    async saveSetting(key, value) {
        return this.executeTransaction('settings', 'readwrite', store => {
            return store.put({ key, value, updatedAt: new Date().toISOString() });
        });
    }

    async getSetting(key) {
        return this.executeTransaction('settings', 'readonly', store => {
            return store.get(key);
        });
    }

    async deleteSetting(key) {
        return this.executeTransaction('settings', 'readwrite', store => {
            return store.delete(key);
        });
    }

    // === TRANSACTIONS ===
    async createTransaction(txData) {
        return this.executeTransaction('transactions', 'readwrite', store => {
            return store.add({
                ...txData,
                timestamp: new Date().toISOString(),
                status: txData.status || 'pending'
            });
        });
    }

    async getUserTransactions(phone) {
        const [sent, received] = await Promise.all([
            this.executeTransaction('transactions', 'readonly', store => {
                return store.index('fromPhone').getAll(phone);
            }),
            this.executeTransaction('transactions', 'readonly', store => {
                return store.index('toPhone').getAll(phone);
            })
        ]);
        return [...sent, ...received].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    }

    // === CONTACTS ===
    async addContact(contact) {
        return this.executeTransaction('contacts', 'readwrite', store => {
            return store.add(contact);
        });
    }

    async getContacts(ownerPhone) {
        return this.executeTransaction('contacts', 'readonly', store => {
            return store.index('ownerPhone').getAll(ownerPhone);
        });
    }

    // === UTILITY ===
    async clearAllData() {
        const stores = ['users', 'settings', 'transactions', 'contacts'];
        for (const store of stores) {
            await this.executeTransaction(store, 'readwrite', s => s.clear());
        }
        console.log('All data cleared');
    }

    close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
            console.log('Database closed');
        }
    }
}

// === GLOBAL INSTANCE – INIT FIRST ===
window.databaseManager = new DatabaseManager();

// === START INITIALIZATION CHAIN ===
window.databaseManager.init().then(() => {
    console.log('DB READY → AUTH STARTED');
}).catch(err => {
    console.error('FATAL: Database failed to start', err);
    document.body.innerHTML = '<h3 style="color:red;text-align:center;">Database Error. Please reload.</h3>';
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;
}
