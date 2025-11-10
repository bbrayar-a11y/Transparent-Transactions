// js/database.js
class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = 'TransparentTransactionsDB';
        this.dbVersion = 3;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        console.log('Initializing database...');
        try {
            this.db = await this.openDB();
            this.isInitialized = true;
            console.log('Database ready');
        } catch (err) {
            console.error('DB init failed:', err);
            this.showError('Database failed. Please reload.');
            throw err;
        }
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.dbVersion);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                ['users', 'settings', 'transactions', 'contacts'].forEach(name => {
                    if (!db.objectStoreNames.contains(name)) {
                        const store = name === 'users' || name === 'settings'
                            ? db.createObjectStore(name, { keyPath: name === 'users' ? 'phone' : 'key' })
                            : db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
                        if (name === 'users') store.createIndex('phone', 'phone', { unique: true });
                    }
                });
            };
        });
    }

    execute(mode, store, op) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([store], mode);
            const s = tx.objectStore(store);
            const r = op(s);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
            tx.onerror = () => reject(tx.error);
        });
    }

    async saveUser(u) { return this.execute('readwrite', 'users', s => s.put(u)); }
    async getUser(p) { return this.execute('readonly', 'users', s => s.get(p)); }

    async saveSetting(k, v) { return this.execute('readwrite', 'settings', s => s.put({ key: k, value: v })); }
    async getSetting(k) { return this.execute('readonly', 'settings', s => s.get(k)); }
    async deleteSetting(k) { return this.execute('readwrite', 'settings', s => s.delete(k)); }

    showError(msg) {
        const el = document.getElementById('db-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    }
}

window.databaseManager = new DatabaseManager();
window.databaseManager.init().catch(() => {});
