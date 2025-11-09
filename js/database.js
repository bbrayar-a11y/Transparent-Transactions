// database.js - Fresh start for Transparent Transactions Database
class DatabaseManager {
    constructor() {
        this.dbName = 'TransparentTransactionsDB';
        this.version = 1; // Start fresh with version 1
        this.db = null;
        this.isInitialized = false;
        this.initializing = false;
    }

    async init() {
        if (this.isInitialized) {
            console.log('✅ Database already initialized');
            return true;
        }

        if (this.initializing) {
            console.log('🔄 Database initializing in progress...');
            // Wait for current initialization to complete
            return new Promise((resolve) => {
                const checkInit = () => {
                    if (this.isInitialized) {
                        resolve(true);
                    } else {
                        setTimeout(checkInit, 100);
                    }
                };
                checkInit();
            });
        }

        console.log('🔄 Database Manager initializing...');
        this.initializing = true;

        try {
            // Check browser support
            if (!window.indexedDB) {
                throw new Error('IndexedDB not supported');
            }

            const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.version);

                request.onerror = () => {
                    reject(new Error(`Database error: ${request.error}`));
                };

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onupgradeneeded = (event) => {
                    console.log('📊 Creating new database schema...');
                    const db = event.target.result;
                    this.createSchema(db);
                };
            });

            this.db = db;
            this.isInitialized = true;
            console.log('✅ Database Manager initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            this.initializing = false;
            throw error;
        } finally {
            this.initializing = false;
        }
    }

    createSchema(db) {
        // Users store
        if (!db.objectStoreNames.contains('users')) {
            const store = db.createObjectStore('users', { keyPath: 'phone' });
            store.createIndex('email', 'email', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            console.log('✅ Created users store');
        }

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
            const store = db.createObjectStore('transactions', {
                keyPath: 'id',
                autoIncrement: true
            });
            store.createIndex('fromPhone', 'fromPhone', { unique: false });
            store.createIndex('toPhone', 'toPhone', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('createdDate', 'createdDate', { unique: false });
            console.log('✅ Created transactions store');
        }

        // Contacts store
        if (!db.objectStoreNames.contains('contacts')) {
            const store = db.createObjectStore('contacts', {
                keyPath: 'id',
                autoIncrement: true
            });
            store.createIndex('ownerPhone', 'ownerPhone', { unique: false });
            store.createIndex('contactPhone', 'contactPhone', { unique: false });
            console.log('✅ Created contacts store');
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
            const store = db.createObjectStore('settings', { keyPath: 'key' });
            console.log('✅ Created settings store');
        }
    }

    // Generic transaction helper
    async executeTransaction(storeName, mode, operation) {
        if (!this.isInitialized) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            
            const request = operation(store);
            if (request) {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }
        });
    }

    // User methods
    async saveUser(userData) {
        return this.executeTransaction('users', 'readwrite', (store) => {
            return store.put({
                ...userData,
                createdAt: userData.createdAt || new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
        });
    }

    async getUser(phone) {
        return this.executeTransaction('users', 'readonly', (store) => {
            return store.get(phone);
        });
    }

    // Settings methods
    async saveSetting(key, value) {
        return this.executeTransaction('settings', 'readwrite', (store) => {
            return store.put({
                key: key,
                value: value,
                updatedAt: new Date().toISOString()
            });
        });
    }

    async getSetting(key) {
        return this.executeTransaction('settings', 'readonly', (store) => {
            return store.get(key);
        });
    }

    // Transaction methods
    async createTransaction(txData) {
        return this.executeTransaction('transactions', 'readwrite', (store) => {
            return store.add({
                ...txData,
                createdDate: new Date().toISOString(),
                status: txData.status || 'pending'
            });
        });
    }

    async getUserTransactions(userPhone) {
        return Promise.all([
            this.executeTransaction('transactions', 'readonly', (store) => {
                const index = store.index('fromPhone');
                return index.getAll(userPhone);
            }),
            this.executeTransaction('transactions', 'readonly', (store) => {
                const index = store.index('toPhone');
                return index.getAll(userPhone);
            })
        ]).then(([sent, received]) => {
            return [...sent, ...received].sort((a, b) => 
                new Date(b.createdDate) - new Date(a.createdDate)
            );
        });
    }

    // Contact methods
    async addContact(contactData) {
        return this.executeTransaction('contacts', 'readwrite', (store) => {
            return store.add({
                ...contactData,
                createdDate: new Date().toISOString()
            });
        });
    }

    async getContacts(ownerPhone) {
        return this.executeTransaction('contacts', 'readonly', (store) => {
            const index = store.index('ownerPhone');
            return index.getAll(ownerPhone);
        });
    }

    // Utility methods
    isReady() {
        return this.isInitialized && this.db !== null;
    }

    async healthCheck() {
        try {
            await this.executeTransaction('users', 'readonly', (store) => store.count());
            return { status: 'healthy', message: 'Database working correctly' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    async clearAllData() {
        const stores = ['users', 'transactions', 'contacts', 'settings'];
        for (const storeName of stores) {
            await this.executeTransaction(storeName, 'readwrite', (store) => {
                return store.clear();
            });
        }
        console.log('🧹 All database data cleared');
    }

    close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
            console.log('🔒 Database connection closed');
        }
    }
}

// Create global instance
window.databaseManager = new DatabaseManager();

// Initialize but don't block on load
setTimeout(() => {
    window.databaseManager.init().then(success => {
        console.log('🎯 Database auto-init result:', success);
    }).catch(error => {
        console.error('💥 Database auto-init failed:', error);
    });
}, 100);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;
}
