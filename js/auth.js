// auth.js - Remove immediate window.authManager creation
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.isDatabaseReady = false;
        this.otpExpiryTime = 2 * 60 * 1000;
        this.maxOtpAttempts = 3;
        
        // Initialize when class is created
        this.init();
    }

    async init() {
        console.log('🟡 Auth Manager INIT started');
        if (this.isInitialized) {
            console.log('✅ Auth Manager already initialized');
            return;
        }

        try {
            await this.waitForDatabase(25, 1000);
            await this.loadCurrentUser();
            this.setupEventListeners();
            this.isInitialized = true;
            console.log('✅ Auth Manager initialized successfully');
        } catch (error) {
            console.error('❌ Auth Manager initialization failed:', error);
            this.isInitialized = true;
        }
    }

    async waitForDatabase(maxRetries = 25, retryDelay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (window.databaseManager && await this.checkDatabaseReady()) {
                this.isDatabaseReady = true;
                console.log('✅ Database connection established');
                return;
            }
            
            console.log(`⏳ Waiting for database... (attempt ${attempt}/${maxRetries})`);
            
            if (attempt === maxRetries) {
                console.warn('⚠️ Database not available after maximum retries');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    async checkDatabaseReady() {
        try {
            if (!window.databaseManager) {
                console.log('🟡 databaseManager not found');
                return false;
            }
            
            // Try a simple database operation to verify readiness
            await window.databaseManager.executeTransaction('settings', 'readonly', (store) => {
                return store.count();
            });
            
            return true;
        } catch (error) {
            console.log('🟡 Database check failed:', error);
            return false;
        }
    }

    // ... keep ALL existing methods EXACTLY as they were (sendOTP, verifyOTP, login, etc.)
    // NO CHANGES to the actual authentication logic
    
    async sendOTP(phoneNumber) {
        // ... keep existing sendOTP method exactly as before
    }

    async verifyOTP(phoneNumber, enteredOTP, userData = null) {
        // ... keep existing verifyOTP method exactly as before
    }

    async login(phoneNumber, userProfile = null) {
        // ... keep existing login method exactly as before
    }

    // ... all other methods remain exactly the same
}

// REMOVED: window.authManager = new AuthManager();
// AuthManager will be created by database.js after DB is ready

// Export for module use - keep this
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
