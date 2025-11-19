let db;
const DB_NAME = APP_CONFIG.DB_NAME;
const DB_VERSION = APP_CONFIG.DB_VERSION;
const OBJECT_STORES = { users: 'users', contacts: 'contacts', transactions: 'transactions', reports: 'reports' };

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => { console.error('Database error:', event.target.error); reject('Database could not be opened'); };
        request.onsuccess = (event) => { db = event.target.result; console.log('Database opened successfully'); resolve(db); };
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            console.log(`Database upgrade needed from ${event.oldVersion} to ${event.newVersion}`);
            if (!db.objectStoreNames.contains(OBJECT_STORES.users)) {
                const userStore = db.createObjectStore(OBJECT_STORES.users, { keyPath: 'phoneNumber' });
                userStore.createIndex('referralCode', 'referralCode', { unique: true });
            }
            if (!db.objectStoreNames.contains(OBJECT_STORES.contacts)) {
                const contactStore = db.createObjectStore(OBJECT_STORES.contacts, { keyPath: 'id', autoIncrement: true });
                contactStore.createIndex('phoneNumber', 'phoneNumber', { unique: false });
            }
            if (!db.objectStoreNames.contains(OBJECT_STORES.transactions)) {
                const transactionStore = db.createObjectStore(OBJECT_STORES.transactions, { keyPath: 'id', autoIncrement: true });
                transactionStore.createIndex('transactionId', 'transactionId', { unique: true });
                transactionStore.createIndex('withPhoneNumber', 'withPhoneNumber', { unique: false });
            }
            if (!db.objectStoreNames.contains(OBJECT_STORES.reports)) {
                db.createObjectStore(OBJECT_STORES.reports, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}
function addData(storeName, data) {
    return new Promise((resolve, reject) => { const transaction = db.transaction(storeName, 'readwrite'); const store = transaction.objectStore(storeName); const request = store.add(data); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function getAllData(storeName) {
    return new Promise((resolve, reject) => { const transaction = db.transaction(storeName, 'readonly'); const store = transaction.objectStore(storeName); const request = store.getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function getDataByKey(storeName, key) {
    return new Promise((resolve, reject) => { const transaction = db.transaction(storeName, 'readonly'); const store = transaction.objectStore(storeName); const request = store.get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
// New function to get data by an index
function getDataByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.get(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}