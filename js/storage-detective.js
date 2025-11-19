// js/storage-detective.js - Hybrid Storage Detection System
class StorageDetective {
    constructor() {
        this.testResults = {};
        this.healthScore = 0;
        this.recommendedStrategy = '';
        this.isInitialized = false;
    }

    // === MAIN PUBLIC METHOD ===
    async runAllTests() {
        console.log('🕵️ Storage Detective starting comprehensive tests...');
        
        try {
            // Run all detection tests
            await this.testLocalStorage();
            await this.testSessionStorage();
            await this.testIndexedDB();
            this.detectBrowserEnvironment();
            
            // Calculate overall health and recommendations
            this.calculateHealthScore();
            this.generateRecommendations();
            
            this.isInitialized = true;
            
            console.log('✅ Storage Detective completed:', this.getSummary());
            return this.getFullReport();
            
        } catch (error) {
            console.error('❌ Storage Detective failed:', error);
            return this.getErrorReport(error);
        }
    }

    // === LOCALSTORAGE DETECTION ===
    async testLocalStorage() {
        const testKey = 'storage_test_local';
        const testValue = 'local_storage_works_' + Date.now();
        
        try {
            // Test 1: Basic write/read
            localStorage.setItem(testKey, testValue);
            const retrieved = localStorage.getItem(testKey);
            
            // Test 2: Delete operation
            localStorage.removeItem(testKey);
            const afterDelete = localStorage.getItem(testKey);
            
            // Test 3: Persistence across navigation (simulated)
            const persistenceTest = 'persistence_test';
            localStorage.setItem(persistenceTest, 'should_persist');
            
            this.testResults.localStorage = {
                status: retrieved === testValue ? 'available' : 'unreliable',
                persistent: true,
                canWrite: true,
                canRead: true,
                canDelete: afterDelete === null,
                details: {
                    quota: this.estimateLocalStorageQuota(),
                    used: this.getLocalStorageUsage()
                }
            };
            
        } catch (error) {
            this.testResults.localStorage = {
                status: 'unavailable',
                persistent: false,
                canWrite: false,
                canRead: false,
                canDelete: false,
                error: error.message
            };
        }
    }

    // === SESSIONSTORAGE DETECTION ===
    async testSessionStorage() {
        const testKey = 'storage_test_session';
        const testValue = 'session_storage_works_' + Date.now();
        
        try {
            // Test basic operations
            sessionStorage.setItem(testKey, testValue);
            const retrieved = sessionStorage.getItem(testKey);
            sessionStorage.removeItem(testKey);
            const afterDelete = sessionStorage.getItem(testKey);
            
            this.testResults.sessionStorage = {
                status: retrieved === testValue ? 'available' : 'unreliable',
                persistent: false, // Session-bound by design
                canWrite: true,
                canRead: true,
                canDelete: afterDelete === null,
                scope: 'session'
            };
            
        } catch (error) {
            this.testResults.sessionStorage = {
                status: 'unavailable',
                persistent: false,
                canWrite: false,
                canRead: false,
                canDelete: false,
                error: error.message
            };
        }
    }

    // === INDEXEDDB DETECTION ===
    async testIndexedDB() {
        const testDBName = 'StorageTestDB';
        const testStoreName = 'testStore';
        
        try {
            // Test database creation and operations
            const db = await this.createTestDatabase(testDBName, testStoreName);
            const canCRUD = await this.testIndexedDBCRUD(db, testStoreName);
            
            // Cleanup
            db.close();
            await this.deleteDatabase(testDBName);
            
            this.testResults.indexedDB = {
                status: canCRUD ? 'available' : 'limited',
                persistent: true,
                canCreate: true,
                canRead: canCRUD,
                canUpdate: canCRUD,
                canDelete: canCRUD,
                operations: canCRUD ? ['create', 'read', 'update', 'delete'] : ['create']
            };
            
        } catch (error) {
            this.testResults.indexedDB = {
                status: 'unavailable',
                persistent: false,
                canCreate: false,
                canRead: false,
                canUpdate: false,
                canDelete: false,
                error: error.message,
                operations: []
            };
        }
    }

    // === BROWSER ENVIRONMENT DETECTION ===
    detectBrowserEnvironment() {
        const userAgent = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';
        let mode = 'normal';
        let platform = 'desktop';
        
        // Browser detection
        if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
            browser = 'Chrome';
            version = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown';
        } else if (userAgent.includes('Firefox')) {
            browser = 'Firefox';
            version = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown';
        } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
            browser = 'Safari';
            version = userAgent.match(/Version\/([0-9.]+)/)?.[1] || 'Unknown';
        } else if (userAgent.includes('Edg')) {
            browser = 'Edge';
            version = userAgent.match(/Edg\/([0-9.]+)/)?.[1] || 'Unknown';
        }
        
        // Platform detection
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
            platform = 'mobile';
        }
        
        // Private mode detection
        try {
            if (!window.localStorage || !window.sessionStorage) {
                mode = 'private';
            } else if (this.isChromeIncognito()) {
                mode = 'incognito';
            }
        } catch (e) {
            mode = 'private';
        }
        
        this.testResults.browser = {
            name: browser,
            version: version,
            mode: mode,
            platform: platform,
            userAgent: userAgent
        };
    }

    // === HEALTH SCORE CALCULATION ===
    calculateHealthScore() {
        let score = 0;
        
        // localStorage contributes 30 points
        if (this.testResults.localStorage?.status === 'available') {
            score += 30;
        } else if (this.testResults.localStorage?.status === 'unreliable') {
            score += 15;
        }
        
        // sessionStorage contributes 25 points
        if (this.testResults.sessionStorage?.status === 'available') {
            score += 25;
        } else if (this.testResults.sessionStorage?.status === 'unreliable') {
            score += 12;
        }
        
        // IndexedDB contributes 45 points
        if (this.testResults.indexedDB?.status === 'available') {
            score += 45;
        } else if (this.testResults.indexedDB?.status === 'limited') {
            score += 20;
        }
        
        // Private mode penalty
        if (this.testResults.browser?.mode === 'private' || 
            this.testResults.browser?.mode === 'incognito') {
            score = Math.max(0, score - 20);
        }
        
        this.healthScore = Math.min(100, Math.max(0, score));
    }

    // === STRATEGY RECOMMENDATIONS ===
    generateRecommendations() {
        const score = this.healthScore;
        
        if (score >= 80) {
            this.recommendedStrategy = 'full-persistence';
        } else if (score >= 60) {
            this.recommendedStrategy = 'standard';
        } else if (score >= 40) {
            this.recommendedStrategy = 'session-only';
        } else {
            this.recommendedStrategy = 'temporary';
        }
    }

    // === HELPER METHODS ===
    async createTestDatabase(dbName, storeName) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id' });
                }
            };
        });
    }

    async testIndexedDBCRUD(db, storeName) {
        return new Promise((resolve) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Test data
            const testData = { id: 'test', value: 'indexeddb_works' };
            
            // Create
            store.put(testData);
            
            // Read
            const getRequest = store.get('test');
            getRequest.onsuccess = () => {
                if (getRequest.result?.value === 'indexeddb_works') {
                    // Delete
                    store.delete('test');
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            
            getRequest.onerror = () => resolve(false);
        });
    }

    async deleteDatabase(dbName) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    isChromeIncognito() {
        // Chrome Incognito detection
        try {
            const fs = window.RequestFileSystem || window.webkitRequestFileSystem;
            if (!fs) return false;
            
            return new Promise(resolve => {
                fs(window.TEMPORARY, 100, () => resolve(false), () => resolve(true));
            });
        } catch (e) {
            return false;
        }
    }

    estimateLocalStorageQuota() {
        try {
            // Simple estimation
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage[key].length + key.length;
                }
            }
            return total;
        } catch (e) {
            return 0;
        }
    }

    getLocalStorageUsage() {
        try {
            return JSON.stringify(localStorage).length;
        } catch (e) {
            return 0;
        }
    }

    // === REPORT METHODS ===
    getFullReport() {
        return {
            score: this.healthScore,
            strategy: this.recommendedStrategy,
            capabilities: this.testResults,
            timestamp: new Date().toISOString(),
            userFriendlySummary: this.getUserFriendlySummary()
        };
    }

    getSummary() {
        return {
            score: this.healthScore,
            strategy: this.recommendedStrategy,
            browser: this.testResults.browser,
            storage: {
                localStorage: this.testResults.localStorage?.status,
                sessionStorage: this.testResults.sessionStorage?.status,
                indexedDB: this.testResults.indexedDB?.status
            }
        };
    }

    getUserFriendlySummary() {
        const strategyNames = {
            'full-persistence': 'Full Data Persistence',
            'standard': 'Standard Storage',
            'session-only': 'Session-Only Storage', 
            'temporary': 'Temporary Storage'
        };
        
        const modeDescriptions = {
            'normal': 'Normal browsing mode',
            'private': 'Private browsing mode',
            'incognito': 'Chrome Incognito mode'
        };
        
        return {
            storageLevel: strategyNames[this.recommendedStrategy] || 'Unknown',
            browserMode: modeDescriptions[this.testResults.browser?.mode] || 'Unknown',
            dataPersistence: this.getPersistenceDescription(),
            recommendations: this.getUserRecommendations()
        };
    }

    getPersistenceDescription() {
        switch (this.recommendedStrategy) {
            case 'full-persistence':
                return 'Your data will be saved permanently';
            case 'standard':
                return 'Your data will be saved until you clear browser data';
            case 'session-only':
                return 'Your data will be saved until you close the browser';
            case 'temporary':
                return 'Your data will be lost when you close this tab';
            default:
                return 'Data persistence unknown';
        }
    }

    getUserRecommendations() {
        if (this.testResults.browser?.mode === 'incognito') {
            return [
                'You are in Incognito mode',
                'Export important data before closing the browser',
                'For full features, use normal browsing mode'
            ];
        }
        
        if (this.healthScore < 60) {
            return [
                'Consider using a different browser for better experience',
                'Export your referral data regularly',
                'Ensure cookies are enabled'
            ];
        }
        
        return ['All storage systems working properly'];
    }

    getErrorReport(error) {
        return {
            score: 0,
            strategy: 'emergency',
            capabilities: {},
            timestamp: new Date().toISOString(),
            error: error.message,
            userFriendlySummary: {
                storageLevel: 'Emergency Mode',
                browserMode: 'Unknown',
                dataPersistence: 'No data will be saved',
                recommendations: ['Please refresh the page', 'Try a different browser']
            }
        };
    }
}

// === AUTO-INITIALIZE AND EXPORT ===
window.StorageDetective = StorageDetective;

// Create global instance and run tests
(async function() {
    window.storageDetective = new StorageDetective();
    window.storageCapabilities = await window.storageDetective.runAllTests();
    
    // Emit ready event
    document.dispatchEvent(new CustomEvent('storageReady', {
        detail: window.storageCapabilities
    }));
    
    console.log('🚀 Storage Detective initialized:', window.storageCapabilities);
})();
