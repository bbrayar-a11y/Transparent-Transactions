// db.js - Transparent Transactions Database Layer
class TransparentTransactionsDB {
    constructor() {
        this.dbName = 'TransparentTransactionsDB';
        this.version = 3; // Increment when schema changes
        this.db = null;
    }

    // Initialize database with all object stores
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Database failed to open:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createObjectStores(db);
                console.log('Database upgrade completed');
            };
        });
    }

    // Create all object stores for our schema
    createObjectStores(db) {
        // Users store - for app users
        if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { 
                keyPath: 'id' 
            });
            userStore.createIndex('phone', 'phone', { unique: true });
            userStore.createIndex('email', 'email', { unique: true });
            userStore.createIndex('googleId', 'googleId', { unique: true });
        }

        // Contacts store - user's business contacts
        if (!db.objectStoreNames.contains('contacts')) {
            const contactStore = db.createObjectStore('contacts', {
                keyPath: 'id',
                autoIncrement: true
            });
            contactStore.createIndex('ownerPhone', 'ownerPhone', { unique: false });
            contactStore.createIndex('contactPhone', 'contactPhone', { unique: false });
            contactStore.createIndex('name', 'name', { unique: false });
        }

        // Pending transactions - waiting for approval
        if (!db.objectStoreNames.contains('pending_transactions')) {
            const pendingStore = db.createObjectStore('pending_transactions', {
                keyPath: 'id',
                autoIncrement: true
            });
            pendingStore.createIndex('fromPhone', 'fromPhone', { unique: false });
            pendingStore.createIndex('toPhone', 'toPhone', { unique: false });
            pendingStore.createIndex('status', 'status', { unique: false }); // pending, approved, rejected
            pendingStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Ledger - approved transactions
        if (!db.objectStoreNames.contains('ledger')) {
            const ledgerStore = db.createObjectStore('ledger', {
                keyPath: 'id',
                autoIncrement: true
            });
            ledgerStore.createIndex('fromPhone', 'fromPhone', { unique: false });
            ledgerStore.createIndex('toPhone', 'toPhone', { unique: false });
            ledgerStore.createIndex('amount', 'amount', { unique: false });
            ledgerStore.createIndex('date', 'date', { unique: false });
            ledgerStore.createIndex('type', 'type', { unique: false }); // direct, credit_transfer
            ledgerStore.createIndex('status', 'status', { unique: false }); // active, settled
        }

        // Credit transfers - three-party agreements
        if (!db.objectStoreNames.contains('credit_transfers')) {
            const creditStore = db.createObjectStore('credit_transfers', {
                keyPath: 'id',
                autoIncrement: true
            });
            creditStore.createIndex('initiatorPhone', 'initiatorPhone', { unique: false });
            creditStore.createIndex('fromPhone', 'fromPhone', { unique: false });
            creditStore.createIndex('toPhone', 'toPhone', { unique: false });
            creditStore.createIndex('amount', 'amount', { unique: false });
            creditStore.createIndex('status', 'status', { unique: false }); // pending, completed, rejected
            creditStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // User settings and preferences
        if (!db.objectStoreNames.contains('settings')) {
            const settingsStore = db.createObjectStore('settings', {
                keyPath: 'phone'
            });
            settingsStore.createIndex('language', 'language', { unique: false });
            settingsStore.createIndex('currency', 'currency', { unique: false });
        }
    }

    // User Management
    async addUser(userData) {
        return this.executeTransaction('users', 'readwrite', (store) => {
            return store.add({
                id: userData.phone, // Use phone as ID for now
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
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            });
        });
    }

    async getPendingTransactions(phone) {
        return Promise.all([
            // Transactions where user is sender
            this.executeTransaction('pending_transactions', 'readonly', (store) => {
                const index = store.index('fromPhone');
                return index.getAll(phone);
            }),
            // Transactions where user is receiver
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
                status: 'active',
                createdAt: new Date().toISOString()
            });
        });

        // Remove from pending
        await this.executeTransaction('pending_transactions', 'readwrite', (store) => {
            return store.delete(transactionId);
        });

        return transaction;
    }

    async rejectPendingTransaction(transactionId) {
        return this.executeTransaction('pending_transactions', 'readwrite', (store) => {
            return store.delete(transactionId);
        });
    }

    // Ledger Operations
    async getLedgerEntries(phone) {
        return this.executeTransaction('ledger', 'readonly', (store) => {
            const fromIndex = store.index('fromPhone');
            const toIndex = store.index('toPhone');
            
            return Promise.all([
                fromIndex.getAll(phone), // Transactions where user sent money
                toIndex.getAll(phone)    // Transactions where user received money
            ]).then(([sent, received]) => [...sent, ...received]);
        });
    }

    async getBalanceWithContact(userPhone, contactPhone) {
        const ledgerEntries = await this.getLedgerEntries(userPhone);
        
        let balance = 0;
        ledgerEntries.forEach(entry => {
            if (entry.fromPhone === userPhone && entry.toPhone === contactPhone) {
                balance -= entry.amount; // User sent money to contact
            } else if (entry.toPhone === userPhone && entry.fromPhone === contactPhone) {
                balance += entry.amount; // User received money from contact
            }
        });

        return balance;
    }

    // Credit Transfer Operations
    async createCreditTransfer(transferData) {
        return this.executeTransaction('credit_transfers', 'readwrite', (store) => {
            return store.add({
                ...transferData,
                status: 'pending',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
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

    async getDatabaseSize() {
        // Estimate database size (approximate)
        let totalSize = 0;
        const storeNames = Array.from(this.db.objectStoreNames);

        for (const storeName of storeNames) {
            const count = await this.executeTransaction(storeName, 'readonly', (store) => {
                return store.count();
            });
            totalSize += count * 1024; // Approximate 1KB per record
        }

        return totalSize;
    }
}

// Create and export singleton instance
const transparentDB = new TransparentTransactionsDB();

// Initialize database when module loads
transparentDB.init().catch(console.error);

export default transparentDB;