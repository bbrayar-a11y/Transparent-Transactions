// database.js - Fixed initialization
class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = 'TransparentTransactionsDB';
        this.dbVersion = 3;
        this.isInitialized = false;
        
        // Initialize immediately
        this.init();
    }

    async init() {
        if (this.isInitialized) return;

        try {
            this.db = await this.openDatabase();
            await this.createStores();
            this.isInitialized = true;
            console.log('✅ Database initialized successfully');
            
            // NOW create auth manager after DB is ready
            this.initializeAuthManager();
            
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    initializeAuthManager() {
        // Load and initialize auth manager only after DB is ready
        if (typeof AuthManager !== 'undefined') {
            window.authManager = new AuthManager();
            console.log('✅ Auth Manager created after DB ready');
        } else {
            console.error('❌ AuthManager class not found');
        }
    }

    async openDatabase() {
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
        if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { keyPath: 'phone' });
            userStore.createIndex('phone', 'phone', { unique: true });
        }
        
        if (!db.objectStoreNames.contains('settings')) {
            const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
            settingsStore.createIndex('key', 'key', { unique: true });
        }
        
        if (!db.objectStoreNames.contains('transactions')) {
            const txStore = db.createObjectStore('transactions', { 
                keyPath: 'id', 
                autoIncrement: true 
            });
            txStore.createIndex('phone', 'phone', { unique: false });
            txStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
    }

    async createStores() {
        // Verify all stores exist and are accessible
        const storeNames = ['users', 'settings', 'transactions'];
        for (const storeName of storeNames) {
            await this.executeTransaction(storeName, 'readonly', (store) => {
                return store.count();
            });
        }
    }

    // ... keep all existing methods exactly the same (getUser, saveUser, etc.)
    async getUser(phone) {
        return this.executeTransaction('users', 'readonly', (store) => {
            return store.get(phone);
        });
    }

    async saveUser(userData) {
        return this.executeTransaction('users', 'readwrite', (store) => {
            return store.put(userData);
        });
    }

    async getSetting(key) {
        return this.executeTransaction('settings', 'readonly', (store) => {
            return store.get(key);
        });
    }

    async saveSetting(key, value) {
        const setting = { key, value };
        return this.executeTransaction('settings', 'readwrite', (store) => {
            return store.put(setting);
        });
    }

    async deleteSetting(key) {
        return this.executeTransaction('settings', 'readwrite', (store) => {
            return store.delete(key);
        });
    }

    executeTransaction(storeName, mode, operation) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);
            
            const request = operation(store);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// Create database manager immediately - this starts the initialization chain
window.databaseManager = new DatabaseManager();
