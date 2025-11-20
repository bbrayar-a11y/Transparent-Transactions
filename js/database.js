let db;
const DB_NAME = APP_CONFIG.DB_NAME;
const DB_VERSION = APP_CONFIG.DB_VERSION;
const OBJECT_STORES = { users: 'users', contacts: 'contacts', transactions: 'transactions', reports: 'reports' };

async function initDB() {
console.log("initDB: Starting database initialization...");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => {
            console.error('initDB: Error opening DB:', event.target.error);
            reject('Database could not be opened');
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("initDB: Database opened successfully");
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            console.log("initDB: Upgrade needed from", event.oldVersion, "to", event.newVersion);
            db = event.target.result;
            // ... rest of the upgrade logic
            console.log("initDB: Upgrade complete");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('Database could not be opened');
        request.onsuccess = () => { db = request.result; resolve(db); };
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(OBJECT_STORES.users)) {
                const userStore = db.createObjectStore(OBJECT_STORES.users, { keyPath: 'phoneNumber' });
                userStore.createIndex('referralCode', 'referralCode', { unique: true });
            }
            if (!db.objectStoreNames.contains(OBJECT_STORES.contacts)) { db.createObjectStore(OBJECT_STORES.contacts, { keyPath: 'id', autoIncrement: true }); }
            if (!db.objectStoreNames.contains(OBJECT_STORES.transactions)) {
                const txStore = db.createObjectStore(OBJECT_STORES.transactions, { keyPath: 'id', autoIncrement: true });
                txStore.createIndex('transactionId', 'transactionId', { unique: true });
            }
            if (!db.objectStoreNames.contains(OBJECT_STORES.reports)) { db.createObjectStore(OBJECT_STORES.reports, { keyPath: 'id', autoIncrement: true }); }
        };
    });
}

function addData(storeName, data) {
    return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readwrite'); const store = tx.objectStore(storeName); const request = store.add(data); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

function getAllData(storeName) {
    return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readonly'); const store = tx.objectStore(storeName); const request = store.getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

function getDataByKey(storeName, key) {
    return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readonly'); const store = tx.objectStore(storeName); const request = store.get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

function getDataByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readonly'); const store = tx.objectStore(storeName); const index = store.index(indexName); const request = index.get(value); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

function updateData(storeName, key, updatedData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(updatedData, key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}