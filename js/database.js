// js/database.js
class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = 'TransparentTransactionsDB';
        this.dbVersion = 3;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        console.log('Initializing database...');
        try {
            this.db = await this.openDB();
            await this.verifyStores();
            this.isInitialized = true;
            console.log('Database ready');
        } catch (err) {
            console.error('DB init failed:', err);
            this.showError('Database failed to load. Please reload.');
            throw err;
        }
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.dbVersion);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('users')) {
                    const store = db.createObjectStore('users', { keyPath: 'phone' });
                    store.createIndex('phone', 'phone', { unique: true });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('transactions')) {
                    const store = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fromPhone', 'fromPhone');
                    store.createIndex('toPhone', 'toPhone');
                }
                if (!db.objectStoreNames.contains('contacts')) {
                    db.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    async verifyStores() {
        const stores = ['users', 'settings', 'transactions', 'contacts'];
        for (const name of stores) {
            await this.execute('readonly', name, s => s.count());
        }
    }

    execute(mode, storeName, operation) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], mode);
            const store = tx.objectStore(storeName);
            const req = operation(store);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            tx.onerror = () => reject(tx.error);
        });
    }

    // USER
    async saveUser(user) {
        return this.execute('readwrite', 'users', s => s.put(user));
    }
    async getUser(phone) {
        return this.execute('readonly', 'users', s => s.get(phone));
    }

    // SETTINGS
    async saveSetting(key, value) {
        return this.execute('readwrite', 'settings', s => s.put({ key, value }));
    }
    async getSetting(key) {
        return this.execute('readonly', 'settings', s => s.get(key));
    }
    async deleteSetting(key) {
        return this.execute('readwrite', 'settings', s => s.delete(key));
    }

    // TRANSACTIONS
    async createTransaction(data) {
        return this.execute('readwrite', 'transactions', s => s.add(data));
    }

    // CONTACTS
    async addContact(contact) {
        return this.execute('readwrite', 'contacts', s => s.add(contact));
    }

    showError(msg) {
        const el = document.getElementById('db-error');
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
        }
    }
}

// GLOBAL: Start DB init
window.databaseManager = new DatabaseManager();
window.databaseManager.init().catch(() => {});
