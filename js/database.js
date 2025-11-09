// database.js - Simple IndexedDB wrapper for Transparent Transactions
// Foundation layer - all other components depend on this

class DatabaseManager {
    constructor() {
        this.dbName = 'TransparentTransactionsDB';
        this.version = 2; // Increased version for schema updates
        this.db = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) {
            console.log('✅ Database already initialized');
            return this.db;
        }

        console.log('🔄 Database initializing...');
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('❌ Database opening error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log('✅ Database initialized successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                console.log('🔄 Database upgrade needed, creating schema...');
                const db = event.target.result;
                this.createSchema(db);
            };
        });
    }

    createSchema(db) {
        // Settings store - for auth data, OTPs, sessions, device info
        if (!db.objectStoreNames.contains('settings')) {
            const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
            settingsStore.createIndex('by_phone', 'phone', { unique: false });
            console.log('✅ Created settings store');
        }

        // Users store - user profiles and account data
        if (!db.objectStoreNames.contains('users')) {
            const usersStore = db.createObjectStore('users', { keyPath: 'phone' });
            usersStore.createIndex('by_email', 'email', { unique: false });
            usersStore.createIndex('by_status', 'isActive', { unique: false });
            console.log('✅ Created users store');
        }

        // Transactions store - payment and transfer records
        if (!db.objectStoreNames.contains('transactions')) {
            const transactionsStore = db.createObjectStore('transactions', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            transactionsStore.createIndex('by_user', 'userPhone', { unique: false });
            transactionsStore.createIndex('by_date', 'createdDate', { unique: false });
            transactionsStore.createIndex('by_status', 'status', { unique: false });
            console.log('✅ Created transactions store');
        }

        // Contacts store - user's contact list
        if (!db.objectStoreNames.contains('contacts')) {
            const contactsStore = db.createObjectStore('contacts', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            contactsStore.createIndex('by_owner', 'ownerPhone', { unique: false });
            contactsStore.createIndex('by_contact', 'contactPhone', { unique: false });
            console.log('✅ Created contacts store');
        }

        // Commissions store - referral earnings
        if (!db.objectStoreNames.contains('commissions')) {
            const commissionsStore = db.createObjectStore('commissions', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            commissionsStore.createIndex('by_user', 'userPhone', { unique: false });
            commissionsStore.createIndex('by_status', 'status', { unique: false });
            commissionsStore.createIndex('by_date', 'createdDate', { unique: false });
            console.log('✅ Created commissions store');
        }
    }

    // Generic transaction executor
    async executeTransaction(storeName, mode, operation) {
        if (!this.isInitialized) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            
            const result = operation(store);
            if (result !== undefined) {
                if (result instanceof IDBRequest) {
                    result.onsuccess = () => resolve(result.result);
                    result.onerror = () => reject(result.error);
                } else {
                    resolve(result);
                }
            }
        });
    }

    // USER MANAGEMENT METHODS

    async saveUser(userData) {
        return this.executeTransaction('users', 'readwrite', (store) => {
            return store.put({
                phone: userData.phone,
                fullName: userData.fullName || '',
                email: userData.email || '',
                isActive: true,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                ...userData
            });
        });
    }

    async getUser(phone) {
        return this.executeTransaction('users', 'readonly', (store) => {
            return store.get(phone);
        });
    }

    async updateUser(phone, updates) {
        const user = await this.getUser(phone);
        if (user) {
            return this.saveUser({
                ...user,
                ...updates,
                lastUpdated: new Date().toISOString()
            });
        }
        return null;
    }

    // SETTINGS MANAGEMENT (for auth, sessions, OTPs)

    async saveSetting(key, data) {
        return this.executeTransaction('settings', 'readwrite', (store) => {
            return store.put({
                key: key,
                ...data,
                updatedAt: new Date().toISOString()
            });
        });
    }

    async getSetting(key) {
        return this.executeTransaction('settings', 'readonly', (store) => {
            return store.get(key);
        });
    }

    async deleteSetting(key) {
        return this.executeTransaction('settings', 'readwrite', (store) => {
            return store.delete(key);
        });
    }

    // TRANSACTION MANAGEMENT

    async createTransaction(transactionData) {
        return this.executeTransaction('transactions', 'readwrite', (store) => {
            return store.add({
                fromPhone: transactionData.fromPhone,
                toPhone: transactionData.toPhone,
                amount: transactionData.amount,
                description: transactionData.description || '',
                type: transactionData.type || 'transfer',
                status: 'pending',
                createdDate: new Date().toISOString(),
                ...transactionData
            });
        });
    }

    async getUserTransactions(userPhone, limit = 50) {
        return this.executeTransaction('transactions', 'readonly', (store) => {
            const index = store.index('by_user');
            const range = IDBKeyRange.only(userPhone);
            return index.getAll(range, limit);
        });
    }

    async updateTransaction(transactionId, updates) {
        return this.executeTransaction('transactions', 'readwrite', (store) => {
            const request = store.get(transactionId);
            request.onsuccess = () => {
                const transaction = request.result;
                if (transaction) {
                    store.put({
                        ...transaction,
                        ...updates,
                        updatedDate: new Date().toISOString()
                    });
                }
            };
            return request;
        });
    }

    // CONTACTS MANAGEMENT

    async addContact(contactData) {
        return this.executeTransaction('contacts', 'readwrite', (store) => {
            return store.add({
                ownerPhone: contactData.ownerPhone,
                contactPhone: contactData.contactPhone,
                contactName: contactData.contactName,
                createdDate: new Date().toISOString(),
                ...contactData
            });
        });
    }

    async getContacts(ownerPhone) {
        return this.executeTransaction('contacts', 'readonly', (store) => {
            const index = store.index('by_owner');
            const range = IDBKeyRange.only(ownerPhone);
            return index.getAll(range);
        });
    }

    // COMMISSIONS MANAGEMENT

    async createCommission(commissionData) {
        return this.executeTransaction('commissions', 'readwrite', (store) => {
            return store.add({
                userPhone: commissionData.userPhone,
                amount: commissionData.amount,
                source: commissionData.source || 'referral',
                status: 'pending',
                createdDate: new Date().toISOString(),
                ...commissionData
            });
        });
    }

    async getUserCommissions(userPhone) {
        return this.executeTransaction('commissions', 'readonly', (store) => {
            const index = store.index('by_user');
            const range = IDBKeyRange.only(userPhone);
            return index.getAll(range);
        });
    }

    // UTILITY METHODS

    async clearAllData() {
        const storeNames = ['settings', 'users', 'transactions', 'contacts', 'commissions'];
        
        for (const storeName of storeNames) {
            await this.executeTransaction(storeName, 'readwrite', (store) => {
                return store.clear();
            });
        }
        
        console.log('🧹 All database data cleared');
    }

    async getDatabaseSize() {
        const stores = await this.db.objectStoreNames;
        let totalCount = 0;

        for (const storeName of stores) {
            const count = await this.executeTransaction(storeName, 'readonly', (store) => {
                return store.count();
            });
            totalCount += count;
        }

        return totalCount;
    }

    // Check if database is ready
    isReady() {
        return this.isInitialized && this.db;
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
            console.log('🔒 Database connection closed');
        }
    }
}

// Global instance - all other components will use this
window.databaseManager = new DatabaseManager();

// Auto-initialize when loaded
window.databaseManager.init().catch(error => {
    console.error('💥 Database initialization failed:', error);
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;
}﻿// database.js - Local Database Management for Transparent Transactions
// This file handles all IndexedDB operations for local data storage

class DatabaseManager {
    constructor() {
        this.dbName = 'TransparentTransactionsDB';
        this.version = 4; // Increment when changing schema
        this.db = null;
        this.init();
    }

    // Initialize database
    async init() {
        console.log('🗄️ Database Manager initializing...');
        
        // Check if IndexedDB is supported
        if (!window.indexedDB) {
            console.error('❌ IndexedDB is not supported in this browser');
            throw new Error('IndexedDB not supported. Please use a modern browser.');
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (event) => {
                console.error('❌ Database failed to open:', event.target.error);
                reject(new Error(`Database error: ${event.target.error.message}`));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ Database opened successfully');
                
                // Set up database version change handler
                this.db.onversionchange = () => {
                    this.db.close();
                    console.log('🔄 Database version changed, reloading page...');
                    window.location.reload();
                };
                
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log('📊 Database upgrade needed');
                const db = event.target.result;
                this.createObjectStores(db);
                console.log('✅ Database schema created/updated');
            };
        });
    }

    // Create all object stores (tables)
    createObjectStores(db) {
        // Users store - stores user profile information
        if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { keyPath: 'phone' });
            userStore.createIndex('pinCode', 'pinCode', { unique: false });
            userStore.createIndex('joinedDate', 'joinedDate', { unique: false });
            console.log('✅ Users store created');
        }

        // Contacts store - stores user's contact list
        if (!db.objectStoreNames.contains('contacts')) {
            const contactStore = db.createObjectStore('contacts', {
                keyPath: 'id',
                autoIncrement: true
            });
            contactStore.createIndex('ownerPhone', 'ownerPhone', { unique: false });
            contactStore.createIndex('contactPhone', 'contactPhone', { unique: false });
            contactStore.createIndex('name', 'name', { unique: false });
            console.log('✅ Contacts store created');
        }

        // Transactions store - stores all financial transactions
        if (!db.objectStoreNames.contains('transactions')) {
            const transactionStore = db.createObjectStore('transactions', {
                keyPath: 'id',
                autoIncrement: true
            });
            transactionStore.createIndex('fromPhone', 'fromPhone', { unique: false });
            transactionStore.createIndex('toPhone', 'toPhone', { unique: false });
            transactionStore.createIndex('status', 'status', { unique: false });
            transactionStore.createIndex('createdDate', 'createdDate', { unique: false });
            transactionStore.createIndex('settledDate', 'settledDate', { unique: false });
            console.log('✅ Transactions store created');
        }

        // Trust scores store - stores calculated trust scores
        if (!db.objectStoreNames.contains('trustScores')) {
            const trustStore = db.createObjectStore('trustScores', { keyPath: 'phone' });
            trustStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
            trustStore.createIndex('score', 'score', { unique: false });
            console.log('✅ Trust scores store created');
        }

        // Payments store - stores payment history
        if (!db.objectStoreNames.contains('payments')) {
            const paymentStore = db.createObjectStore('payments', {
                keyPath: 'id',
                autoIncrement: true
            });
            paymentStore.createIndex('userPhone', 'userPhone', { unique: false });
            paymentStore.createIndex('type', 'type', { unique: false });
            paymentStore.createIndex('date', 'date', { unique: false });
            paymentStore.createIndex('status', 'status', { unique: false });
            console.log('✅ Payments store created');
        }

        // Referral data store - stores referral information
        if (!db.objectStoreNames.contains('referrals')) {
            const referralStore = db.createObjectStore('referrals', { keyPath: 'id' });
            referralStore.createIndex('referrerCode', 'referrerCode', { unique: false });
            referralStore.createIndex('referredPhone', 'referredPhone', { unique: false });
            referralStore.createIndex('date', 'date', { unique: false });
            console.log('✅ Referrals store created');
        }

        // Settings store - stores user preferences and settings
        if (!db.objectStoreNames.contains('settings')) {
            const settingsStore = db.createObjectStore('settings', { keyPath: 'phone' });
            console.log('✅ Settings store created');
        }

        // Commission store - stores commission records
        if (!db.objectStoreNames.contains('commissions')) {
            const commissionStore = db.createObjectStore('commissions', {
                keyPath: 'id',
                autoIncrement: true
            });
            commissionStore.createIndex('recipientPhone', 'recipientPhone', { unique: false });
            commissionStore.createIndex('status', 'status', { unique: false });
            commissionStore.createIndex('createdDate', 'createdDate', { unique: false });
            console.log('✅ Commissions store created');
        }
    }

    // Generic method to execute database transactions
    executeTransaction(storeName, mode, operation) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized. Call init() first.'));
                return;
            }

            try {
                const transaction = this.db.transaction([storeName], mode);
                const store = transaction.objectStore(storeName);
                
                transaction.onerror = (event) => {
                    console.error('Transaction error:', event.target.error);
                    reject(new Error(`Transaction failed: ${event.target.error.message}`));
                };
                
                transaction.oncomplete = () => {
                    // Transaction completed successfully
                };

                const request = operation(store);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);

            } catch (error) {
                reject(new Error(`Transaction setup failed: ${error.message}`));
            }
        });
    }

    // USER MANAGEMENT METHODS

    // Add or update user
    async saveUser(userData) {
        return this.executeTransaction('users', 'readwrite', (store) => {
            return store.put({
                ...userData,
                lastUpdated: new Date().toISOString()
            });
        });
    }

    // Get user by phone number
    async getUser(phone) {
        return this.executeTransaction('users', 'readonly', (store) => {
            return store.get(phone);
        });
    }

    // Get all users (for admin purposes)
    async getAllUsers() {
        return this.executeTransaction('users', 'readonly', (store) => {
            return store.getAll();
        });
    }

    // CONTACTS MANAGEMENT METHODS

    // Add contact
    async addContact(contactData) {
        return this.executeTransaction('contacts', 'readwrite', (store) => {
            return store.add({
                ...contactData,
                createdDate: new Date().toISOString()
            });
        });
    }

    // Get all contacts for a user
    async getContacts(ownerPhone) {
        return this.executeTransaction('contacts', 'readonly', (store) => {
            const index = store.index('ownerPhone');
            return index.getAll(ownerPhone);
        });
    }

    // Update contact
    async updateContact(contactId, updates) {
        return this.executeTransaction('contacts', 'readwrite', async (store) => {
            const contact = await store.get(contactId);
            if (!contact) throw new Error('Contact not found');
            
            const updatedContact = {
                ...contact,
                ...updates,
                lastUpdated: new Date().toISOString()
            };
            return store.put(updatedContact);
        });
    }

    // Delete contact
    async deleteContact(contactId) {
        return this.executeTransaction('contacts', 'readwrite', (store) => {
            return store.delete(contactId);
        });
    }

    // TRANSACTIONS MANAGEMENT METHODS

    // Create new transaction
    async createTransaction(transactionData) {
        return this.executeTransaction('transactions', 'readwrite', (store) => {
            return store.add({
                ...transactionData,
                createdDate: new Date().toISOString(),
                status: transactionData.status || 'pending'
            });
        });
    }

    // Get transactions for a user (both sent and received)
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

    // Update transaction status
    async updateTransactionStatus(transactionId, newStatus, settlementData = {}) {
        return this.executeTransaction('transactions', 'readwrite', async (store) => {
            const transaction = await store.get(transactionId);
            if (!transaction) throw new Error('Transaction not found');
            
            const updatedTransaction = {
                ...transaction,
                status: newStatus,
                lastUpdated: new Date().toISOString()
            };

            if (newStatus === 'settled') {
                updatedTransaction.settledDate = new Date().toISOString();
                updatedTransaction.settlementDetails = settlementData;
            }

            return store.put(updatedTransaction);
        });
    }

    // Get pending transactions for a user
    async getPendingTransactions(userPhone) {
        return this.executeTransaction('transactions', 'readonly', (store) => {
            const fromIndex = store.index('fromPhone');
            const toIndex = store.index('toPhone');
            
            return Promise.all([
                fromIndex.getAll(userPhone),
                toIndex.getAll(userPhone)
            ]).then(([sent, received]) => {
                const allTransactions = [...sent, ...received];
                return allTransactions.filter(t => t.status === 'pending');
            });
        });
    }

    // TRUST SCORE METHODS

    // Save or update trust score
    async saveTrustScore(phone, scoreData) {
        return this.executeTransaction('trustScores', 'readwrite', (store) => {
            return store.put({
                phone: phone,
                ...scoreData,
                lastUpdated: new Date().toISOString()
            });
        });
    }

    // Get trust score for a user
    async getTrustScore(phone) {
        return this.executeTransaction('trustScores', 'readonly', (store) => {
            return store.get(phone);
        });
    }

    // PAYMENT METHODS

    // Record payment
    async recordPayment(paymentData) {
        return this.executeTransaction('payments', 'readwrite', (store) => {
            return store.add({
                ...paymentData,
                date: new Date().toISOString(),
                status: paymentData.status || 'completed'
            });
        });
    }

    // Get payment history for a user
    async getPaymentHistory(userPhone) {
        return this.executeTransaction('payments', 'readonly', (store) => {
            const index = store.index('userPhone');
            return index.getAll(userPhone);
        });
    }

    // REFERRAL METHODS

    // Record referral
    async recordReferral(referralData) {
        return this.executeTransaction('referrals', 'readwrite', (store) => {
            const id = `${referralData.referrerCode}_${referralData.referredPhone}`;
            return store.put({
                id: id,
                ...referralData,
                date: new Date().toISOString()
            });
        });
    }

    // Get referrals by referrer code
    async getReferralsByCode(referrerCode) {
        return this.executeTransaction('referrals', 'readonly', (store) => {
            const index = store.index('referrerCode');
            return index.getAll(referrerCode);
        });
    }

    // COMMISSION METHODS

    // Record commission
    async recordCommission(commissionData) {
        return this.executeTransaction('commissions', 'readwrite', (store) => {
            return store.add({
                ...commissionData,
                createdDate: new Date().toISOString()
            });
        });
    }

    // Get commissions for a user
    async getUserCommissions(userPhone) {
        return this.executeTransaction('commissions', 'readonly', (store) => {
            const index = store.index('recipientPhone');
            return index.getAll(userPhone);
        });
    }

    // Update commission status
    async updateCommissionStatus(commissionId, newStatus) {
        return this.executeTransaction('commissions', 'readwrite', async (store) => {
            const commission = await store.get(commissionId);
            if (!commission) throw new Error('Commission not found');
            
            const updatedCommission = {
                ...commission,
                status: newStatus,
                statusUpdated: new Date().toISOString()
            };

            if (newStatus === 'paid') {
                updatedCommission.paidDate = new Date().toISOString();
            }

            return store.put(updatedCommission);
        });
    }

    // SETTINGS METHODS

    // Save user settings
    async saveSettings(phone, settings) {
        return this.executeTransaction('settings', 'readwrite', (store) => {
            return store.put({
                phone: phone,
                ...settings,
                lastUpdated: new Date().toISOString()
            });
        });
    }

    // Get user settings
    async getSettings(phone) {
        return this.executeTransaction('settings', 'readonly', (store) => {
            return store.get(phone);
        });
    }

    // UTILITY METHODS

    // Get database statistics
    async getDatabaseStats() {
        const storeNames = Array.from(this.db.objectStoreNames);
        const stats = {};

        for (const storeName of storeNames) {
            stats[storeName] = await this.executeTransaction(storeName, 'readonly', (store) => {
                return store.count();
            });
        }

        return stats;
    }

    // Clear all data (for testing/reset)
    async clearAllData() {
        const storeNames = Array.from(this.db.objectStoreNames);
        
        for (const storeName of storeNames) {
            await this.executeTransaction(storeName, 'readwrite', (store) => {
                return store.clear();
            });
        }

        console.log('🧹 All database data cleared');
    }

    // Export all data for backup
    async exportAllData() {
        const storeNames = Array.from(this.db.objectStoreNames);
        const exportData = {
            exportDate: new Date().toISOString(),
            version: this.version,
            data: {}
        };

        for (const storeName of storeNames) {
            exportData.data[storeName] = await this.executeTransaction(storeName, 'readonly', (store) => {
                return store.getAll();
            });
        }

        return exportData;
    }

    // Import data from backup
    async importData(importData) {
        if (!importData || !importData.data) {
            throw new Error('Invalid import data format');
        }

        for (const [storeName, records] of Object.entries(importData.data)) {
            if (this.db.objectStoreNames.contains(storeName)) {
                for (const record of records) {
                    await this.executeTransaction(storeName, 'readwrite', (store) => {
                        return store.put(record);
                    });
                }
            }
        }

        console.log('✅ Data import completed');
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close();
            console.log('🔒 Database connection closed');
        }
    }

    // Health check
    async healthCheck() {
        try {
            const stats = await this.getDatabaseStats();
            return {
                status: 'healthy',
                message: 'Database is working correctly',
                stats: stats
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                stats: null
            };
        }
    }
}

// Create global database manager instance
window.databaseManager = new DatabaseManager();

// Export for module use (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;

}
