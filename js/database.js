// database.js - Fixed for multiple loads
if (typeof DatabaseManager === 'undefined') {
    class DatabaseManager {
        constructor() {
            this.db = null;
            this.dbName = 'TransparentTransactionsDB';
            this.dbVersion = 4;
            this.isInitialized = false;
            
            console.log('🔍 DEBUG: DatabaseManager constructor called');
            // Initialize immediately
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
                
                // NOW create auth manager after DB is ready
                this.initializeAuthManager();
                
            } catch (error) {
                console.error('❌ Database initialization failed:', error);
                throw error;
            }
        }

        openDatabase() {
            return new Promise((resolve, reject) => {
                console.log('🔍 DEBUG: indexedDB.open called for:', this.dbName, 'version:', this.dbVersion);
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
                    console.log('🔍 DEBUG: indexedDB.onupgradeneeded - old version:', event.oldVersion, 'new version:', event.newVersion);
                    const db = event.target.result;
                    this.createStoresInUpgrade(db);
                };

                request.onblocked = () => {
                    console.error('🔍 DEBUG: indexedDB.open BLOCKED - database is blocked');
                };
            });
        }

        createStoresInUpgrade(db) {
            console.log('🔍 DEBUG: createStoresInUpgrade - existing stores:', Array.from(db.objectStoreNames));
            
            // Only create stores that don't exist
            const requiredStores = ['users', 'settings', 'transactions'];
            
            requiredStores.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    console.log('🔍 DEBUG: Creating store:', storeName);
                    if (storeName === 'users') {
                        const userStore = db.createObjectStore('users', { keyPath: 'phone' });
                        userStore.createIndex('phone', 'phone', { unique: true });
                    } else if (storeName === 'settings') {
                        const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
                        settingsStore.createIndex('key', 'key', { unique: true });
                    } else if (storeName === 'transactions') {
                        const txStore = db.createObjectStore('transactions', { 
                            keyPath: 'id', 
                            autoIncrement: true 
                        });
                        txStore.createIndex('phone', 'phone', { unique: false });
                        txStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }
                } else {
                    console.log('🔍 DEBUG: Store already exists:', storeName);
                }
            });
        }

        async createStores() {
            console.log('🔍 DEBUG: Verifying stores exist...');
            // Verify all stores exist and are accessible
            const storeNames = ['users', 'settings', 'transactions'];
            for (const storeName of storeNames) {
                try {
                    const count = await this.executeTransaction(storeName, 'readonly', (store) => {
                        return store.count();
                    });
                    console.log('🔍 DEBUG: Store verified:', storeName, 'count:', count);
                } catch (error) {
                    console.error('🔍 DEBUG: Store verification failed for:', storeName, error);
                    throw error;
                }
            }
        }

        initializeAuthManager() {
            console.log('🔍 DEBUG: initializeAuthManager called');
            // Load and initialize auth manager only after DB is ready
            if (typeof AuthManager !== 'undefined') {
                window.authManager = new AuthManager();
                console.log('✅ Auth Manager created after DB ready');
            } else {
                console.error('❌ AuthManager class not found');
            }
        }

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
} // End of if check

// Create database manager immediately - this starts the initialization chain
console.log('🔍 DEBUG: Creating window.databaseManager');
window.databaseManager = new DatabaseManager();
