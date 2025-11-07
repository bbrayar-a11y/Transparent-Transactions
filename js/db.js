// db.js - Transparent Transactions Database Layer
class TransparentTransactionsDB {
    constructor() {
        this.dbName = 'TransparentTransactionsDB';
        this.version = 3;
        this.db = null;
        console.log('🗄️ Database manager created');
    }

    // Initialize database with all object stores
    async init() {
        console.log('🔄 Initializing database...');
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('❌ Database failed to open:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log('📊 Database upgrade needed, creating schema...');
                const db = event.target.result;
                this.createObjectStores(db);
                console.log('✅ Database schema created');
            };
        });
    }

    // Create all object stores for our schema
    createObjectStores(db) {
        // Users store
        if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { keyPath: 'id' });
            userStore.createIndex('phone', 'phone', { unique: true });
            console.log('✅ Users store created');
        }

        // Contacts store
        if (!db.objectStoreNames.contains('contacts')) {
            const contactStore = db.createObjectStore('contacts', {
                keyPath: 'id',
                autoIncrement: true
            });
            contactStore.createIndex('ownerPhone', 'ownerPhone', { unique: false });
            contactStore.createIndex('contactPhone', 'contactPhone', { unique: false });
            console.log('✅ Contacts store created');
        }

        // Pending transactions
        if (!db.objectStoreNames.contains('pending_transactions')) {
            const pendingStore = db.createObjectStore('pending_transactions', {
                keyPath: 'id',
                autoIncrement: true
            });
            pendingStore.createIndex('fromPhone', 'fromPhone', { unique: false });
            pendingStore.createIndex('toPhone', 'toPhone', { unique: false });
            console.log('✅ Pending transactions store created');
        }

        // Ledger - approved transactions
        if (!db.objectStoreNames.contains('ledger')) {
            const ledgerStore = db.createObjectStore('ledger', {
                keyPath: 'id',
                autoIncrement: true
            });
            ledgerStore.createIndex('fromPhone', 'fromPhone', { unique: false });
            ledgerStore.createIndex('toPhone', 'toPhone', { unique: false });
            console.log('✅ Ledger store created');
        }

        // Credit transfers
        if (!db.objectStoreNames.contains('credit_transfers')) {
            const creditStore = db.createObjectStore('credit_transfers', {
                keyPath: 'id',
                autoIncrement: true
            });
            creditStore.createIndex('initiatorPhone', 'initiatorPhone', { unique: false });
            console.log('✅ Credit transfers store created');
        }

        // User settings
        if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'phone' });
            console.log('✅ Settings store created');
        }
    }

    // User Management
    async addUser(userData) {
        console.log('👤 Adding user to database:', userData.phone);
        return this.executeTransaction('users', 'readwrite', (store) => {
            return store.add({
                ...userData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        });
    }

    async getUser(phone) {
        return this.executeTransaction('users', 'readonly', (store) => {
            return store.get(phone);
        });
    }

    // Contact Management
    async addContact(ownerPhone, contactData) {
        return this.executeTransaction('contacts', 'readwrite', (store) => {
            return store.add({
                ownerPhone: ownerPhone,
                ...contactData,
                createdAt: new Date().toISOString()
            });
        });
    }

    async getContacts(ownerPhone) {
        return this.executeTransaction('contacts', 'readonly', (store) => {
            const index = store.index('ownerPhone');
            return index.getAll(ownerPhone);
        });
    }

    // Pending Transactions
    async createPendingTransaction(transactionData) {
        return this.executeTransaction('pending_transactions', 'readwrite', (store) => {
            return store.add({
                ...transactionData,
                status: 'pending',
                createdAt: new Date().toISOString()
            });
        });
    }

    async getPendingTransactions(phone) {
        return Promise.all([
            this.executeTransaction('pending_transactions', 'readonly', (store) => {
                const index = store.index('fromPhone');
                return index.getAll(phone);
            }),
            this.executeTransaction('pending_transactions', 'readonly', (store) => {
                const index = store.index('toPhone');
                return index.getAll(phone);
            })
        ]).then(([sent, received]) => [...sent, ...received]);
    }

    async approvePendingTransaction(transactionId) {
        const transaction = await this.executeTransaction('pending_transactions', 'readonly', (store) => {
            return store.get(transactionId);
        });

        if (!transaction) throw new Error('Transaction not found');

        // Move to ledger
        await this.executeTransaction('ledger', 'readwrite', (store) => {
            return store.add({
                fromPhone: transaction.fromPhone,
                toPhone: transaction.toPhone,
                amount: transaction.amount,
                description: transaction.description,
                date: new Date().toISOString(),
                type: 'direct',
                status: 'active'
            });
        });

        // Remove from pending
        await this.executeTransaction('pending_transactions', 'readwrite', (store) => {
            return store.delete(transactionId);
        });

        return transaction;
    }

    // Ledger Operations
    async getLedgerEntries(phone) {
        return this.executeTransaction('ledger', 'readonly', (store) => {
            const fromIndex = store.index('fromPhone');
            const toIndex = store.index('toPhone');
            
            return Promise.all([
                fromIndex.getAll(phone),
                toIndex.getAll(phone)
            ]).then(([sent, received]) => [...sent, ...received]);
        });
    }

    // Generic transaction executor
    executeTransaction(storeName, mode, operation) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);
            
            const request = operation(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Utility Methods
    async clearAllData() {
        const storeNames = [
            'users', 'contacts', 'pending_transactions', 
            'ledger', 'credit_transfers', 'settings'
        ];

        for (const storeName of storeNames) {
            await this.executeTransaction(storeName, 'readwrite', (store) => {
                return store.clear();
            });
        }
    }
}

// Create and export singleton instance
const transparentDB = new TransparentTransactionsDB();

// Initialize database when module loads
transparentDB.init().then(() => {
    console.log('🎉 Database initialization complete');
}).catch(error => {
    console.error('💥 Database initialization failed:', error);
});

// Export for global access
window.transparentDB = transparentDB;
