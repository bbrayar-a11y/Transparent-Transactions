// app.js - Core Application Logic for Transparent Transactions
// Builds on database.js and auth.js foundation

class TransparentTransactionsApp {
    constructor() {
        this.currentUser = null;
        this.isOnline = navigator.onLine;
        this.isInitialized = false;
        this.userStats = null;
        this.dashboardData = null;
        
        // Don't auto-initialize - wait for components
        this.init();
    }

    async init() {
        if (this.isInitialized) {
            console.log('✅ App already initialized');
            return;
        }

        console.log('🚀 Transparent Transactions App Initializing...');
        
        try {
            // Wait for essential components to be ready
            await this.waitForComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Check authentication state
            await this.checkAuthentication();
            
            // Load initial data if authenticated
            if (this.currentUser) {
                await this.loadInitialData();
            }
            
            this.isInitialized = true;
            console.log('✅ Transparent Transactions App Ready');
            
            // Trigger app ready event
            this.triggerAppEvent('appReady', {
                user: this.currentUser,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('💥 App initialization failed:', error);
            this.showFatalError('Failed to initialize application. Please refresh the page.');
        }
    }

    async waitForComponents() {
        const maxWaitTime = 15000; // 15 seconds
        const startTime = Date.now();
        
        console.log('🔄 Waiting for essential components...');
        
        while (Date.now() - startTime < maxWaitTime) {
            // Check if both database and auth managers are ready
            const dbReady = window.databaseManager && window.databaseManager.isReady && window.databaseManager.isReady();
            const authReady = window.authManager && window.authManager.isInitialized;
            
            if (dbReady && authReady) {
                console.log('✅ All components ready');
                return;
            }
            
            // Log current status for debugging
            if (Date.now() - startTime > 5000) { // Only log after 5 seconds
                console.log(`⏳ Waiting for components... Database: ${dbReady}, Auth: ${authReady}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        throw new Error('Essential components not ready within timeout');
    }

    async checkAuthentication() {
        if (window.authManager && window.authManager.isAuthenticated()) {
            this.currentUser = window.authManager.getCurrentUser();
            console.log('🔐 User authenticated:', this.currentUser.phone);
        } else {
            console.log('🔐 No authenticated user found');
            this.currentUser = null;
        }
    }

    async loadInitialData() {
        if (!this.currentUser) return;
        
        console.log('📥 Loading initial app data...');
        
        try {
            // Load user profile from database
            const userProfile = await window.databaseManager.getUser(this.currentUser.phone);
            if (userProfile) {
                this.currentUser.profile = userProfile;
            }
            
            // Load user statistics
            await this.loadUserStats();
            
            console.log('✅ Initial app data loaded');
            
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
            this.showNotification('error', 'Data Load Error', 'Some data may not be available');
        }
    }

    async loadUserStats() {
        if (!this.currentUser) return;
        
        try {
            const userPhone = this.currentUser.phone;
            
            // Load various data in parallel
            const [transactions, contacts, commissions] = await Promise.all([
                window.databaseManager.getUserTransactions(userPhone),
                window.databaseManager.getContacts(userPhone),
                window.databaseManager.getUserCommissions(userPhone)
            ]);
            
            // Calculate statistics
            const pendingTransactions = transactions.filter(t => t.status === 'pending');
            const earnedCommissions = commissions.filter(c => c.status === 'paid');
            const pendingCommissions = commissions.filter(c => c.status === 'pending');
            
            this.userStats = {
                // Basic counts
                contacts: contacts.length,
                transactions: transactions.length,
                pendingTransactions: pendingTransactions.length,
                
                // Financial data
                balance: this.currentUser.profile?.balance || 0,
                totalEarnings: earnedCommissions.reduce((sum, c) => sum + (c.amount || 0), 0),
                pendingEarnings: pendingCommissions.reduce((sum, c) => sum + (c.amount || 0), 0),
                
                // Trust and reputation
                trustScore: this.currentUser.profile?.trustScore || 100,
                trustLevel: this.calculateTrustLevel(this.currentUser.profile?.trustScore || 100),
                
                // Activity metrics
                successfulTransactions: transactions.filter(t => t.status === 'completed').length
            };
            
        } catch (error) {
            console.error('❌ Error loading user stats:', error);
            // Set default stats
            this.userStats = {
                contacts: 0,
                transactions: 0,
                pendingTransactions: 0,
                balance: 0,
                totalEarnings: 0,
                pendingEarnings: 0,
                trustScore: 100,
                trustLevel: 'Beginner',
                successfulTransactions: 0
            };
        }
    }

    // EVENT SYSTEM

    setupEventListeners() {
        console.log('🔧 Setting up app event listeners...');
        
        // Online/offline detection
        window.addEventListener('online', () => {
            this.handleOnlineStatusChange(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleOnlineStatusChange(false);
        });
        
        // Auth state changes
        document.addEventListener('authStateChange', (event) => {
            this.handleAuthStateChange(event.detail);
        });
        
        // Global click handler for navigation
        document.addEventListener('click', (event) => {
            this.handleGlobalClick(event);
        });
        
        // Page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Before unload - save state
        window.addEventListener('beforeunload', () => {
            this.saveApplicationState();
        });
        
        console.log('✅ App event listeners setup complete');
    }

    handleOnlineStatusChange(online) {
        this.isOnline = online;
        
        this.showNotification({
            type: online ? 'success' : 'warning',
            title: online ? 'Back Online' : 'Offline Mode',
            message: online ? 'Connection restored' : 'Working offline - changes will sync when online',
            duration: 3000
        });
        
        this.updateApplicationUI();
    }

    handleAuthStateChange(authDetail) {
        console.log('🔄 Auth state changed:', authDetail.action);
        
        switch (authDetail.action) {
            case 'login':
                this.currentUser = authDetail.user;
                this.loadInitialData().then(() => {
                    this.updateApplicationUI();
                });
                break;
                
            case 'logout':
                this.currentUser = null;
                this.userStats = null;
                this.dashboardData = null;
                this.updateApplicationUI();
                break;
        }
    }

    handleVisibilityChange() {
        if (!document.hidden && this.currentUser) {
            // Page became visible, update user activity
            if (window.authManager) {
                window.authManager.updateUserActivity();
            }
        }
    }

    handleGlobalClick(event) {
        // Navigation links
        const navLink = event.target.closest('[data-nav]');
        if (navLink) {
            event.preventDefault();
            const page = navLink.getAttribute('data-nav');
            this.navigateTo(page);
        }
        
        // Back buttons
        if (event.target.matches('[data-back]') || event.target.closest('[data-back]')) {
            event.preventDefault();
            this.navigateBack();
        }
        
        // Refresh buttons
        if (event.target.matches('[data-refresh]') || event.target.closest('[data-refresh]')) {
            event.preventDefault();
            this.refreshAllData();
        }
    }

    // ... (rest of your existing methods remain the same - navigation, data management, etc.)

    calculateTrustLevel(score) {
        if (score >= 90) return 'Excellent';
        if (score >= 80) return 'Very Good';
        if (score >= 70) return 'Good';
        if (score >= 60) return 'Fair';
        return 'Beginner';
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    }

    showNotification(notification) {
        // Create notification container if it doesn't exist
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        // Create notification element
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification notification-${notification.type}`;
        notificationEl.innerHTML = `
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
        `;
        
        // Add to container
        container.appendChild(notificationEl);
        
        // Remove after duration
        setTimeout(() => {
            if (notificationEl.parentNode) {
                notificationEl.parentNode.removeChild(notificationEl);
            }
        }, notification.duration || 5000);
    }

    showError(message) {
        this.showNotification({
            type: 'error',
            title: 'Error',
            message: message,
            duration: 5000
        });
    }

    showFatalError(message) {
        const errorHtml = `
            <div class="fatal-error">
                <div class="error-content">
                    <h2>💥 Application Error</h2>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.location.reload()">
                        Reload Application
                    </button>
                </div>
            </div>
        `;
        
        document.body.innerHTML = errorHtml;
    }

    // ... (rest of your existing methods)

    getAppStatus() {
        return {
            user: this.currentUser,
            online: this.isOnline,
            stats: this.userStats,
            components: {
                database: !!window.databaseManager,
                auth: !!window.authManager
            }
        };
    }

    async logout() {
        if (window.authManager) {
            await window.authManager.logout();
        } else {
            this.redirectToLogin();
        }
    }

    redirectToLogin() {
        window.location.href = 'login.html';
    }
}

// Initialize application when DOM is loaded AND components are ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🏠 App: DOM loaded, waiting for components...');
    
    // Wait a bit for other scripts to load
    setTimeout(async () => {
        try {
            // Create global app instance
            window.app = new TransparentTransactionsApp();
            
            // Make app available globally
            window.TransparentTransactionsApp = TransparentTransactionsApp;
            
        } catch (error) {
            console.error('💥 App creation failed:', error);
            // Show error to user
            document.body.innerHTML = `
                <div class="fatal-error">
                    <div class="error-content">
                        <h2>💥 Application Error</h2>
                        <p>Failed to create application instance</p>
                        <button class="btn btn-primary" onclick="window.location.reload()">
                            Reload Application
                        </button>
                    </div>
                </div>
            `;
        }
    }, 1000);
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransparentTransactionsApp;
}
