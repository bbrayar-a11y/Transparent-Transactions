// database.js - Fixed for multiple loads
if (typeof DatabaseManager === 'undefined') {
    class DatabaseManager {
        constructor() {
            this.db = null;
            this.dbName = 'TransparentTransactionsDB';
            this.dbVersion = 4;
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
            
            const requiredStores = ['users', 'settings', 'transactions'];
            
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
                    }
                }
            });
        }

        async createStores() {
            console.log('🔍 DEBUG: Verifying stores exist...');
            const storeNames = ['users', 'settings', 'transactions'];
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

        async getUser(phone) {
            return this.executeTransaction('users', 'readonly', (store) => store.get(phone));
        }

        async saveUser(userData) {
            return this.executeTransaction('users', 'readwrite', (store) => store.put(userData));
        }

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
