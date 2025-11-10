// database.js - COMPLETE WITH REFERRAL SYSTEM SUPPORT
if (typeof DatabaseManager === 'undefined') {
    class DatabaseManager {
        constructor() {
            this.db = null;
            this.dbName = 'TransparentTransactionsDB';
            this.dbVersion = 5; // Increased version for schema updates
            this.isInitialized = false;
            
            console.log('🔍 DEBUG: DatabaseManager constructor called');
            this.init();
        }

        async init() {
            console.log('🔍 DEBUG: DatabaseManager.init() started');
            if (this.isInitialized) return;

            try {
                console.log('🔍 DEBUG: Opening database...');
                this.db = await this.openDatabase();
                console.log('🔍 DEBUG: Database opened successfully');
                await this.createStores();
                this.isInitialized = true;
                console.log('✅ Database initialized successfully');
                
                this.initializeAuthManager();
                
            } catch (error) {
                console.error('❌ Database initialization failed:', error);
                throw error;
            }
        }

        openDatabase() {
            return new Promise((resolve, reject) => {
                console.log('🔍 DEBUG: indexedDB.open called');
                const request = indexedDB.open(this.dbName, this.dbVersion);
                
                request.onerror = () => {
                    console.error('🔍 DEBUG: indexedDB.open ERROR:', request.error);
                    reject(request.error);
                };
                
                request.onsuccess = () => {
                    console.log('🔍 DEBUG: indexedDB.open SUCCESS');
                    resolve(request.result);
                };
                
                request.onupgradeneeded = (event) => {
                    console.log('🔍 DEBUG: indexedDB.onupgradeneeded');
                    const db = event.target.result;
                    this.createStoresInUpgrade(db);
                };
            });
        }

        createStoresInUpgrade(db) {
            console.log('🔍 DEBUG: createStoresInUpgrade');
            
            const requiredStores = ['users', 'settings', 'transactions', 'referrals'];
            
            requiredStores.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    console.log('🔍 DEBUG: Creating store:', storeName);
                    if (storeName === 'users') {
                        db.createObjectStore('users', { keyPath: 'phone' });
                    } else if (storeName === 'settings') {
                        db.createObjectStore('settings', { keyPath: 'key' });
                    } else if (storeName === 'transactions') {
                        db.createObjectStore('transactions', { 
                            keyPath: 'id', 
                            autoIncrement: true 
                        });
                    } else if (storeName === 'referrals') {
                        db.createObjectStore('referrals', { 
                            keyPath: 'id', 
                            autoIncrement: true 
                        });
                    }
                }
            });
        }

        async createStores() {
            console.log('🔍 DEBUG: Verifying stores exist...');
            const storeNames = ['users', 'settings', 'transactions', 'referrals'];
            for (const storeName of storeNames) {
                try {
                    await this.executeTransaction(storeName, 'readonly', (store) => store.count());
                    console.log('🔍 DEBUG: Store verified:', storeName);
                } catch (error) {
                    console.error('🔍 DEBUG: Store verification failed:', storeName, error);
                    throw error;
                }
            }
        }

        initializeAuthManager() {
            console.log('🔍 DEBUG: initializeAuthManager called');
            if (typeof AuthManager !== 'undefined') {
                window.authManager = new AuthManager();
                console.log('✅ Auth Manager created');
            } else {
                console.error('❌ AuthManager class not found');
            }
        }

        // === USER MANAGEMENT ===
        async getUser(phone) {
            return this.executeTransaction('users', 'readonly', (store) => store.get(phone));
        }

        async saveUser(userData) {
            return this.executeTransaction('users', 'readwrite', (store) => store.put(userData));
        }

        // === REFERRAL SYSTEM METHODS ===
        async getAllUsers() {
            return this.executeTransaction('users', 'readonly', (store) => {
                return store.getAll();
            });
        }

        async getUserByReferralCode(referralCode) {
            const allUsers = await this.getAllUsers();
            return allUsers.find(user => user.myReferralCode === referralCode);
        }

        async saveReferral(referralData) {
            return this.executeTransaction('referrals', 'readwrite', (store) => {
                return store.put(referralData);
            });
        }

        async getReferralsByUser(phone) {
            return this.executeTransaction('referrals', 'readonly', (store) => {
                return store.getAll().then(referrals => {
                    return referrals.filter(ref => ref.referrerPhone === phone);
                });
            });
        }

        async getReferralChain(phone) {
            return this.executeTransaction('referrals', 'readonly', (store) => {
                return store.getAll().then(referrals => {
                    return referrals.filter(ref => 
                        ref.referrerPhone === phone || 
                        ref.referredPhone === phone
                    );
                });
            });
        }

        async updateUserReferrals(phone, newReferrals) {
            const user = await this.getUser(phone);
            if (user) {
                user.referrals = newReferrals;
                await this.saveUser(user);
                return true;
            }
            return false;
        }

        // === COMMISSION TRACKING ===
        async recordCommission(commissionData) {
            const commissionRecord = {
                ...commissionData,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };
            
            return this.executeTransaction('transactions', 'readwrite', (store) => {
                return store.put(commissionRecord);
            });
        }

        async getCommissionsByUser(phone) {
            return this.executeTransaction('transactions', 'readonly', (store) => {
                return store.getAll().then(transactions => {
                    return transactions.filter(tx => 
                        tx.type === 'commission' && 
                        (tx.referrerPhone === phone || tx.referredPhone === phone)
                    );
                });
            });
        }

        // === NETWORK ANALYSIS ===
        async getUserNetworkStats(phone) {
            const referrals = await this.getReferralsByUser(phone);
            const allUsers = await this.getAllUsers();
            
            let directReferrals = 0;
            let level2Referrals = 0;
            let level3Referrals = 0;
            let level4Referrals = 0;

            // Count direct referrals
            directReferrals = referrals.length;

            // Count level 2 referrals (referrals of referrals)
            for (const ref of referrals) {
                const userRefs = await this.getReferralsByUser(ref.referredPhone);
                level2Referrals += userRefs.length;

                // Count level 3 referrals
                for (const l2Ref of userRefs) {
                    const l3Refs = await this.getReferralsByUser(l2Ref.referredPhone);
                    level3Referrals += l3Refs.length;

                    // Count level 4 referrals
                    for (const l3Ref of l3Refs) {
                        const l4Refs = await this.getReferralsByUser(l3Ref.referredPhone);
                        level4Referrals += l4Refs.length;
                    }
                }
            }

            return {
                directReferrals,
                level2Referrals,
                level3Referrals,
                level4Referrals,
                totalNetwork: directReferrals + level2Referrals + level3Referrals + level4Referrals
            };
        }

        // === SETTINGS MANAGEMENT ===
        async getSetting(key) {
            return this.executeTransaction('settings', 'readonly', (store) => store.get(key));
        }

        async saveSetting(key, value) {
            const setting = { key, value };
            return this.executeTransaction('settings', 'readwrite', (store) => store.put(setting));
        }

        async deleteSetting(key) {
            return this.executeTransaction('settings', 'readwrite', (store) => store.delete(key));
        }

        // === CORE DATABASE OPERATIONS ===
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
                transaction.onerror = () => reject(transaction.error);
            });
        }

        // === DATABASE MAINTENANCE ===
        async clearAllData() {
            const stores = ['users', 'settings', 'transactions', 'referrals'];
            for (const storeName of stores) {
                await this.executeTransaction(storeName, 'readwrite', (store) => store.clear());
            }
            console.log('✅ All database data cleared');
        }

        async getDatabaseStats() {
            const stats = {};
            const stores = ['users', 'settings', 'transactions', 'referrals'];
            
            for (const storeName of stores) {
                stats[storeName] = await this.executeTransaction(storeName, 'readonly', (store) => store.count());
            }
            
            return stats;
        }
    }

    // ONLY create instance if window.databaseManager doesn't exist
    if (!window.databaseManager) {
        console.log('🔍 DEBUG: Creating window.databaseManager');
        window.databaseManager = new DatabaseManager();
    } else {
        console.log('🔍 DEBUG: window.databaseManager already exists');
    }
} else {
    console.log('🔍 DEBUG: DatabaseManager class already defined');
}
