// app.js - Main Application Orchestrator for Transparent Transactions
// This file coordinates all components and manages the application lifecycle

class TransparentTransactionsApp {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.isOnline = navigator.onLine;
        this.init();
    }

    // Initialize the application
    async init() {
        console.log('🚀 Transparent Transactions App Initializing...');
        
        try {
            // Initialize core components in sequence
            await this.initializeCoreComponents();
            
            // Setup application event listeners
            this.setupEventListeners();
            
            // Check authentication state
            await this.checkAuthentication();
            
            // Load initial data
            await this.loadInitialData();
            
            // Update UI based on current state
            this.updateApplicationUI();
            
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

    // Initialize all core components
    async initializeCoreComponents() {
        console.log('🔄 Initializing core components...');
        
        // Wait for database to be ready
        if (window.databaseManager) {
            await window.databaseManager.init();
        } else {
            throw new Error('Database manager not found');
        }
        
        // Initialize auth manager
        if (window.authManager) {
            await window.authManager.init();
        }
        
        // Initialize referral manager
        if (window.referralManager) {
            await window.referralManager.init();
        }
        
        // Register service worker for PWA functionality
        await this.registerServiceWorker();
        
        console.log('✅ All core components initialized');
    }

    // Register service worker for offline functionality
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.workbox.register();
                console.log('✅ Service Worker registered');
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 New service worker found');
                });
                
            } catch (error) {
                console.warn('⚠️ Service Worker registration failed:', error);
            }
        }
    }

    // Setup global event listeners
    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
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
        
        // Payment events
        document.addEventListener('paymentProcessed', (event) => {
            this.handlePaymentEvent(event.detail);
        });
        
        // Commission events
        document.addEventListener('commissionsDistributed', (event) => {
            this.handleCommissionEvent(event.detail);
        });
        
        // Navigation events
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
        
        console.log('✅ Event listeners setup complete');
    }

    // Check user authentication status
    async checkAuthentication() {
        if (window.authManager && window.authManager.isAuthenticated()) {
            this.currentUser = window.authManager.getCurrentUser();
            console.log('🔐 User authenticated:', this.currentUser.phone);
        } else {
            console.log('🔐 No authenticated user found');
            this.redirectToLogin();
        }
    }

    // Load initial application data
    async loadInitialData() {
        if (!this.currentUser) return;
        
        console.log('📥 Loading initial data...');
        
        try {
            // Load user profile
            const userProfile = await window.databaseManager.getUser(this.currentUser.phone);
            if (userProfile) {
                this.currentUser.profile = userProfile;
            }
            
            // Load user contacts count
            const contacts = await window.databaseManager.getContacts(this.currentUser.phone);
            this.userStats = {
                contacts: contacts.length,
                transactions: 0,
                pending: 0
            };
            
            // Load transactions count
            const transactions = await window.databaseManager.getUserTransactions(this.currentUser.phone);
            this.userStats.transactions = transactions.length;
            this.userStats.pending = transactions.filter(t => t.status === 'pending').length;
            
            // Load trust score
            const trustScore = await window.databaseManager.getTrustScore(this.currentUser.phone);
            this.currentUser.trustScore = trustScore;
            
            console.log('✅ Initial data loaded:', this.userStats);
            
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
        }
    }

    // Handle authentication state changes
    handleAuthStateChange(authDetail) {
        console.log('🔄 Auth state changed:', authDetail.action);
        
        switch (authDetail.action) {
            case 'login':
                this.currentUser = authDetail.user;
                this.loadInitialData().then(() => {
                    this.navigateTo('dashboard');
                });
                break;
                
            case 'logout':
                this.currentUser = null;
                this.redirectToLogin();
                break;
        }
        
        this.updateApplicationUI();
    }

    // Handle payment events
    handlePaymentEvent(paymentDetail) {
        console.log('💰 Payment processed:', paymentDetail);
        
        // Show payment success notification
        this.showNotification({
            type: 'success',
            title: 'Payment Successful',
            message: `₹${paymentDetail.amount} payment processed`,
            duration: 3000
        });
        
        // Update referral commissions
        if (window.referralManager && paymentDetail.amount === 10) {
            window.referralManager.handlePaymentEvent(paymentDetail);
        }
        
        // Refresh dashboard data
        this.loadInitialData();
    }

    // Handle commission events
    handleCommissionEvent(commissionDetail) {
        console.log('💰 Commission distributed:', commissionDetail);
        
        this.showNotification({
            type: 'info',
            title: 'Commission Earned',
            message: `₹${commissionDetail.totalCommissions.toFixed(2)} distributed across ${commissionDetail.commissions.length} levels`,
            duration: 4000
        });
    }

    // Handle online/offline status changes
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

    // Handle page visibility changes
    handleVisibilityChange() {
        if (!document.hidden && this.currentUser) {
            // Page became visible, update user activity
            if (window.authManager) {
                window.authManager.updateUserActivity();
            }
        }
    }

    // Handle global click events for navigation
    handleGlobalClick(event) {
        const link = event.target.closest('a[data-nav]');
        if (link) {
            event.preventDefault();
            const page = link.getAttribute('data-nav');
            this.navigateTo(page);
        }
        
        // Handle back button clicks
        if (event.target.matches('[data-back]') || event.target.closest('[data-back]')) {
            event.preventDefault();
            this.navigateBack();
        }
    }

    // Navigate to specific page
    navigateTo(page, data = {}) {
        console.log('🧭 Navigating to:', page);
        
        // Save current page state
        this.savePageState(this.currentPage);
        
        // Update current page
        this.currentPage = page;
        
        // Hide all pages
        this.hideAllPages();
        
        // Show target page
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) {
            targetPage.style.display = 'block';
            this.triggerAppEvent('pageChanged', {
                from: this.currentPage,
                to: page,
                data: data
            });
        } else {
            console.error('❌ Page not found:', page);
            this.showError('Page not found');
        }
        
        // Update navigation UI
        this.updateNavigationUI();
        
        // Load page-specific data
        this.loadPageData(page, data);
    }

    // Navigate back to previous page
    navigateBack() {
        const previousPage = this.getPreviousPage();
        if (previousPage) {
            this.navigateTo(previousPage);
        } else {
            this.navigateTo('dashboard');
        }
    }

    // Hide all application pages
    hideAllPages() {
        const pages = document.querySelectorAll('[data-page]');
        pages.forEach(page => {
            page.style.display = 'none';
        });
    }

    // Update navigation UI (active states, etc.)
    updateNavigationUI() {
        // Update active nav links
        const navLinks = document.querySelectorAll('[data-nav]');
        navLinks.forEach(link => {
            if (link.getAttribute('data-nav') === this.currentPage) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        
        // Update page title
        this.updatePageTitle();
    }

    // Update page title based on current page
    updatePageTitle() {
        const titles = {
            'dashboard': 'Dashboard',
            'contacts': 'My Contacts',
            'transactions': 'Transactions',
            'reports': 'Trust Reports',
            'profile': 'My Profile'
        };
        
        const title = titles[this.currentPage] || 'Transparent Transactions';
        document.title = `${title} - Transparent Transactions`;
    }

    // Load data for specific page
    async loadPageData(page, data) {
        switch (page) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'contacts':
                await this.loadContactsData();
                break;
            case 'transactions':
                await this.loadTransactionsData();
                break;
            case 'reports':
                await this.loadReportsData();
                break;
            case 'profile':
                await this.loadProfileData();
                break;
        }
    }

    // Load dashboard data
    async loadDashboardData() {
        if (!this.currentUser) return;
        
        try {
            // Update stats cards
            this.updateStatsCards();
            
            // Load referral stats
            if (window.referralManager && this.currentUser.profile) {
                const referralStats = window.referralManager.getReferralStats(
                    this.currentUser.profile.referralCode
                );
                this.updateReferralStats(referralStats);
            }
            
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
        }
    }

    // Load contacts data
    async loadContactsData() {
        // Implementation for contacts page
        console.log('Loading contacts data...');
    }

    // Load transactions data
    async loadTransactionsData() {
        // Implementation for transactions page
        console.log('Loading transactions data...');
    }

    // Load reports data
    async loadReportsData() {
        // Implementation for reports page
        console.log('Loading reports data...');
    }

    // Load profile data
    async loadProfileData() {
        // Implementation for profile page
        console.log('Loading profile data...');
    }

    // Update statistics cards on dashboard
    updateStatsCards() {
        if (!this.userStats) return;
        
        const elements = {
            contacts: document.getElementById('contacts-count'),
            transactions: document.getElementById('transactions-count'),
            pending: document.getElementById('pending-count')
        };
        
        if (elements.contacts) elements.contacts.textContent = this.userStats.contacts;
        if (elements.transactions) elements.transactions.textContent = this.userStats.transactions;
        if (elements.pending) elements.pending.textContent = this.userStats.pending;
    }

    // Update referral statistics
    updateReferralStats(stats) {
        const elements = {
            referrals: document.getElementById('referrals-count'),
            pending: document.getElementById('commission-pending'),
            earned: document.getElementById('commission-earned')
        };
        
        if (elements.referrals) elements.referrals.textContent = stats.directReferrals;
        if (elements.pending) elements.pending.textContent = `₹${stats.pendingAmount.toFixed(2)}`;
        if (elements.earned) elements.earned.textContent = `₹${stats.totalEarned.toFixed(2)}`;
    }

    // Update overall application UI
    updateApplicationUI() {
        // Update auth-dependent UI
        this.updateAuthUI();
        
        // Update online/offline indicator
        this.updateOnlineStatusUI();
        
        // Update user-specific content
        this.updateUserContent();
    }

    // Update authentication-dependent UI
    updateAuthUI() {
        const authElements = document.querySelectorAll('[data-auth-state]');
        
        authElements.forEach(element => {
            const requiredState = element.getAttribute('data-auth-state');
            const isVisible = this.currentUser ? 
                (requiredState === 'authenticated') : 
                (requiredState === 'unauthenticated');
            
            element.style.display = isVisible ? '' : 'none';
        });
    }

    // Update online/offline status indicator
    updateOnlineStatusUI() {
        const indicator = document.getElementById('online-status');
        if (indicator) {
            indicator.className = this.isOnline ? 'online' : 'offline';
            indicator.title = this.isOnline ? 'Online' : 'Offline';
        }
    }

    // Update user-specific content
    updateUserContent() {
        if (this.currentUser && this.currentUser.profile) {
            // Update user name displays
            const nameElements = document.querySelectorAll('[data-user-name]');
            nameElements.forEach(element => {
                element.textContent = this.currentUser.profile.fullName;
            });
            
            // Update user phone displays
            const phoneElements = document.querySelectorAll('[data-user-phone]');
            phoneElements.forEach(element => {
                element.textContent = this.currentUser.phone;
            });
        }
    }

    // Show notification to user
    showNotification(notification) {
        // Create notification element
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification notification-${notification.type}`;
        notificationEl.innerHTML = `
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
        `;
        
        // Add to notification container
        const container = document.getElementById('notification-container') || 
                         this.createNotificationContainer();
        container.appendChild(notificationEl);
        
        // Remove after duration
        setTimeout(() => {
            if (notificationEl.parentNode) {
                notificationEl.parentNode.removeChild(notificationEl);
            }
        }, notification.duration || 5000);
    }

    // Create notification container if it doesn't exist
    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
        return container;
    }

    // Show error message
    showError(message) {
        this.showNotification({
            type: 'error',
            title: 'Error',
            message: message,
            duration: 5000
        });
    }

    // Show fatal error (blocks application)
    showFatalError(message) {
        const errorHtml = `
            <div class="fatal-error">
                <h2>Application Error</h2>
                <p>${message}</p>
                <button onclick="window.location.reload()">Reload Application</button>
            </div>
        `;
        
        document.body.innerHTML = errorHtml;
    }

    // Redirect to login page
    redirectToLogin() {
        window.location.href = 'login.html';
    }

    // Save current page state
    savePageState(page) {
        const state = {
            page: page,
            timestamp: new Date().toISOString()
        };
        
        sessionStorage.setItem(`pageState_${page}`, JSON.stringify(state));
    }

    // Get previous page from history
    getPreviousPage() {
        // Simple implementation - could be enhanced with proper routing history
        const pages = ['dashboard', 'contacts', 'transactions', 'reports', 'profile'];
        const currentIndex = pages.indexOf(this.currentPage);
        return currentIndex > 0 ? pages[currentIndex - 1] : null;
    }

    // Save application state
    saveApplicationState() {
        const state = {
            currentPage: this.currentPage,
            user: this.currentUser ? {
                phone: this.currentUser.phone,
                isAuthenticated: this.currentUser.isAuthenticated
            } : null,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('appState', JSON.stringify(state));
    }

    // Restore application state
    async restoreApplicationState() {
        try {
            const state = JSON.parse(localStorage.getItem('appState'));
            if (state && state.user && state.user.isAuthenticated) {
                this.currentPage = state.currentPage || 'dashboard';
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Could not restore app state:', error);
        }
        return false;
    }

    // Trigger application events
    triggerAppEvent(eventName, detail) {
        const event = new CustomEvent(eventName, {
            detail: detail
        });
        document.dispatchEvent(event);
    }

    // Public method to get app status
    getAppStatus() {
        return {
            user: this.currentUser,
            page: this.currentPage,
            online: this.isOnline,
            components: {
                database: !!window.databaseManager,
                auth: !!window.authManager,
                referral: !!window.referralManager
            }
        };
    }

    // Public method to refresh all data
    async refreshAllData() {
        console.log('🔄 Refreshing all application data...');
        await this.loadInitialData();
        this.updateApplicationUI();
        this.showNotification({
            type: 'success',
            title: 'Data Refreshed',
            message: 'All application data has been updated',
            duration: 2000
        });
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Create global app instance
    window.app = new TransparentTransactionsApp();
    
    // Make app available globally
    window.TransparentTransactionsApp = TransparentTransactionsApp;
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransparentTransactionsApp;
}