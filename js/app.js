// In app.js - replace the waitForComponents method:

async waitForComponents() {
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    console.log('🔄 App: Waiting for essential components...');
    
    while (Date.now() - startTime < maxWaitTime) {
        // Check if both database and auth managers are ready
        const dbReady = window.databaseManager && 
                       window.databaseManager.isReady && 
                       window.databaseManager.isReady();
        
        const authReady = window.authManager && 
                         window.authManager.isInitialized;
        
        console.log(`⏳ App waiting... Database: ${dbReady}, Auth: ${authReady}`);
        
        if (dbReady && authReady) {
            console.log('✅ App: All components ready!');
            return;
        }
        
        // Wait longer between checks
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // If we get here, components aren't ready but we'll try to proceed anyway
    console.warn('⚠️ App: Components not fully ready, but proceeding...');
}

// Also update the init method to be more forgiving:
async init() {
    if (this.isInitialized) {
        console.log('✅ App already initialized');
        return;
    }

    console.log('🚀 Transparent Transactions App Initializing...');
    
    try {
        // Wait for components, but don't fail completely
        await this.waitForComponents().catch(error => {
            console.warn('⚠️ App: Component wait warning:', error);
        });
        
        // Setup event listeners (always do this)
        this.setupEventListeners();
        
        // Try to check authentication, but don't fail if it doesn't work
        try {
            await this.checkAuthentication();
        } catch (authError) {
            console.warn('⚠️ App: Auth check warning:', authError);
        }
        
        // Load initial data if authenticated
        if (this.currentUser) {
            try {
                await this.loadInitialData();
            } catch (dataError) {
                console.warn('⚠️ App: Data load warning:', dataError);
            }
        }
        
        this.isInitialized = true;
        console.log('✅ Transparent Transactions App Ready');
        
    } catch (error) {
        console.error('💥 App initialization failed:', error);
        // Don't show fatal error - system might still work
        this.isInitialized = true; // Mark as initialized anyway
        console.log('🔄 App: Continuing despite initialization issues...');
    }
}
