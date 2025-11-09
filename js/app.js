// app.js - Core Application Logic for Transparent Transactions
// Builds on database.js and auth.js foundation

class TransparentTransactionsApp {
    constructor() {
        this.currentUser = null;
        this.isOnline = navigator.onLine;
        this.isInitialized = false;
        this.userStats = null;
        this.dashboardData = null;
        
        // Initialize when class is created
        this.init();
    }

    async init() {
        if (this.isInitialized) {
            console.log('✅ App already initialized');
            return;
        }

        console.log('🚀 Transparent Transactions App Initializing...');
        
        try {
            // Wait for essential components
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
        const maxWaitTime = 10000; // 10 seconds
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            if (window.databaseManager && window.databaseManager.isReady() && 
                window.authManager && window.authManager.isInitialized) {
                console.log('✅ All components ready');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
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

    // NAVIGATION SYSTEM

    navigateTo(page, data = {}) {
        console.log('🧭 Navigating to:', page);
        
        // Update current page
        this.currentPage = page;
        
        // Hide all pages
        this.hideAllPages();
        
        // Show target page
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) {
            targetPage.style.display = 'block';
            targetPage.classList.add('active');
            
            // Load page-specific data
            this.loadPageData(page, data);
            
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
    }

    navigateBack() {
        const previousPage = this.getPreviousPage();
        if (previousPage) {
            this.navigateTo(previousPage);
        } else {
            this.navigateTo('dashboard');
        }
    }

    hideAllPages() {
        const pages = document.querySelectorAll('[data-page]');
        pages.forEach(page => {
            page.style.display = 'none';
            page.classList.remove('active');
        });
    }

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

    updatePageTitle() {
        const titles = {
            'dashboard': 'Dashboard',
            'transactions': 'Transactions',
            'contacts': 'My Contacts',
            'profile': 'My Profile',
            'settings': 'Settings'
        };
        
        const title = titles[this.currentPage] || 'Transparent Transactions';
        document.title = `${title} - Transparent Transactions`;
    }

    // DATA MANAGEMENT

    async loadPageData(page, data = {}) {
        console.log(`📊 Loading data for: ${page}`);
        
        try {
            switch (page) {
                case 'dashboard':
                    await this.loadDashboardData();
                    break;
                case 'transactions':
                    await this.loadTransactionsData();
                    break;
                case 'contacts':
                    await this.loadContactsData();
                    break;
                case 'profile':
                    await this.loadProfileData();
                    break;
                case 'settings':
                    await this.loadSettingsData();
                    break;
            }
            
            this.triggerAppEvent('pageDataLoaded', {
                page: page,
                data: data
            });
            
        } catch (error) {
            console.error(`❌ Error loading ${page} data:`, error);
            this.showError(`Failed to load ${page} data`);
        }
    }

    async loadDashboardData() {
        if (!this.currentUser) return;
        
        console.log('📈 Loading dashboard data...');
        
        try {
            const userPhone = this.currentUser.phone;
            
            // Load recent transactions
            const transactions = await window.databaseManager.getUserTransactions(userPhone);
            const recentTransactions = transactions
                .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
                .slice(0, 5);
            
            // Load quick stats
            const quickStats = await this.calculateQuickStats();
            
            this.dashboardData = {
                recentTransactions: recentTransactions,
                quickStats: quickStats,
                lastUpdated: new Date().toISOString()
            };
            
            // Update dashboard UI if we're on dashboard
            if (this.currentPage === 'dashboard') {
                this.updateDashboardUI();
            }
            
            console.log('✅ Dashboard data loaded');
            
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
            throw error;
        }
    }

    async calculateQuickStats() {
        if (!this.currentUser) return {};
        
        try {
            const transactions = await window.databaseManager.getUserTransactions(this.currentUser.phone);
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            
            const todayTransactions = transactions.filter(t => 
                new Date(t.createdDate) >= todayStart
            );
            
            const weeklyTransactions = transactions.filter(t => {
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                return new Date(t.createdDate) >= weekAgo;
            });
            
            return {
                todayCount: todayTransactions.length,
                todayAmount: todayTransactions.reduce((sum, t) => {
                    if (t.toPhone === this.currentUser.phone) return sum + (t.amount || 0);
                    if (t.fromPhone === this.currentUser.phone) return sum - (t.amount || 0);
                    return sum;
                }, 0),
                weeklyCount: weeklyTransactions.length
            };
            
        } catch (error) {
            console.error('❌ Error calculating quick stats:', error);
            return {
                todayCount: 0,
                todayAmount: 0,
                weeklyCount: 0
            };
        }
    }

    async loadTransactionsData() {
        console.log('💳 Loading transactions data...');
        // Implementation for transactions page
        // This would load transaction history with filtering options
    }

    async loadContactsData() {
        console.log('👥 Loading contacts data...');
        // Implementation for contacts page
        // This would load user's contact list
    }

    async loadProfileData() {
        console.log('👤 Loading profile data...');
        // Implementation for profile page
        // This would load user profile and settings
    }

    async loadSettingsData() {
        console.log('⚙️ Loading settings data...');
        // Implementation for settings page
    }

    // USER MANAGEMENT

    async updateUserProfile(updates) {
        if (!this.currentUser) {
            throw new Error('User must be authenticated to update profile');
        }

        try {
            // Get current profile
            const currentProfile = await window.databaseManager.getUser(this.currentUser.phone);
            const updatedProfile = {
                ...currentProfile,
                ...updates,
                lastUpdated: new Date().toISOString()
            };

            // Save to database
            await window.databaseManager.saveUser(updatedProfile);
            
            // Update current user session
            this.currentUser.profile = updatedProfile;
            if (window.authManager) {
                window.authManager.currentUser.profile = updatedProfile;
                localStorage.setItem('currentUser', JSON.stringify(window.authManager.currentUser));
            }

            this.showNotification({
                type: 'success',
                title: 'Profile Updated',
                message: 'Your profile has been updated successfully',
                duration: 3000
            });

            // Refresh UI
            this.updateUserContent();
            
        } catch (error) {
            console.error('❌ Error updating profile:', error);
            this.showError('Failed to update profile');
            throw error;
        }
    }

    // TRANSACTION MANAGEMENT

    async createTransaction(transactionData) {
        if (!this.currentUser) {
            throw new Error('User must be authenticated to create transactions');
        }

        try {
            const transaction = {
                fromPhone: this.currentUser.phone,
                toPhone: transactionData.toPhone,
                amount: transactionData.amount,
                description: transactionData.description || '',
                type: transactionData.type || 'transfer',
                status: 'pending',
                createdDate: new Date().toISOString()
            };

            const result = await window.databaseManager.createTransaction(transaction);
            
            this.showNotification({
                type: 'success',
                title: 'Transaction Created',
                message: `Transaction of ${this.formatCurrency(transactionData.amount)} initiated`,
                duration: 3000
            });

            // Refresh data
            await this.refreshDashboardData();

            return result;
            
        } catch (error) {
            console.error('❌ Error creating transaction:', error);
            this.showError('Failed to create transaction');
            throw error;
        }
    }

    async getTransactionHistory(filters = {}) {
        if (!this.currentUser) return [];
        
        try {
            const transactions = await window.databaseManager.getUserTransactions(this.currentUser.phone);
            
            // Apply filters
            let filteredTransactions = transactions;
            
            if (filters.status) {
                filteredTransactions = filteredTransactions.filter(t => t.status === filters.status);
            }
            
            if (filters.type) {
                filteredTransactions = filteredTransactions.filter(t => t.type === filters.type);
            }
            
            if (filters.dateRange) {
                const startDate = new Date(filters.dateRange.start);
                const endDate = new Date(filters.dateRange.end);
                filteredTransactions = filteredTransactions.filter(t => {
                    const transactionDate = new Date(t.createdDate);
                    return transactionDate >= startDate && transactionDate <= endDate;
                });
            }
            
            return filteredTransactions.sort((a, b) => 
                new Date(b.createdDate) - new Date(a.createdDate)
            );
            
        } catch (error) {
            console.error('❌ Error getting transaction history:', error);
            return [];
        }
    }

    // REFERRAL SYSTEM

    generateReferralCode() {
        if (!this.currentUser) return null;
        
        const phone = this.currentUser.phone;
        const code = `TT${phone.slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
        return code;
    }

    async getReferralStatistics() {
        if (!this.currentUser) return null;
        
        try {
            const referralCode = this.currentUser.profile?.referralCode || this.generateReferralCode();
            // This would query referrals from database
            // For now, return mock data
            
            return {
                referralCode: referralCode,
                totalReferrals: 0,
                activeReferrals: 0,
                totalEarned: 0,
                pendingAmount: 0
            };
            
        } catch (error) {
            console.error('❌ Error getting referral statistics:', error);
            return null;
        }
    }

    // UI UPDATES

    updateApplicationUI() {
        // Update auth-dependent UI
        this.updateAuthUI();
        
        // Update user-specific content
        this.updateUserContent();
        
        // Update online/offline indicator
        this.updateOnlineStatusUI();
    }

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

    updateUserContent() {
        if (this.currentUser && this.currentUser.profile) {
            // Update user name displays
            const nameElements = document.querySelectorAll('[data-user-name]');
            nameElements.forEach(element => {
                element.textContent = this.currentUser.profile.fullName || this.currentUser.phone;
            });
            
            // Update user phone displays
            const phoneElements = document.querySelectorAll('[data-user-phone]');
            phoneElements.forEach(element => {
                element.textContent = this.currentUser.phone;
            });
            
            // Update user trust level
            const trustElements = document.querySelectorAll('[data-user-trust]');
            trustElements.forEach(element => {
                element.textContent = this.userStats?.trustLevel || 'Beginner';
            });
        }
    }

    updateOnlineStatusUI() {
        const indicator = document.getElementById('online-status');
        if (indicator) {
            indicator.className = this.isOnline ? 'online' : 'offline';
            indicator.title = this.isOnline ? 'Online' : 'Offline';
        }
    }

    updateDashboardUI() {
        if (!this.dashboardData || !this.userStats) return;
        
        // This would update various dashboard components
        // Stats cards, recent transactions, charts, etc.
        console.log('📊 Updating dashboard UI with latest data');
    }

    // NOTIFICATION SYSTEM

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

    // DATA REFRESH

    async refreshDashboardData() {
        await this.loadUserStats();
        await this.loadDashboardData();
        this.updateApplicationUI();
    }

    async refreshAllData() {
        console.log('🔄 Refreshing all application data...');
        
        await this.loadUserStats();
        await this.loadDashboardData();
        this.updateApplicationUI();
        
        this.showNotification({
            type: 'success',
            title: 'Data Refreshed',
            message: 'All application data has been updated',
            duration: 2000
        });
    }

    // UTILITY METHODS

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

    maskPhone(phone) {
        if (!phone) return 'Unknown';
        return phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');
    }

    // STATE MANAGEMENT

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

    getPreviousPage() {
        const pages = ['dashboard', 'transactions', 'contacts', 'profile', 'settings'];
        const currentIndex = pages.indexOf(this.currentPage);
        return currentIndex > 0 ? pages[currentIndex - 1] : null;
    }

    // EVENT SYSTEM

    triggerAppEvent(eventName, detail) {
        const event = new CustomEvent(eventName, {
            detail: detail
        });
        document.dispatchEvent(event);
    }

    // PUBLIC API

    getAppStatus() {
        return {
            user: this.currentUser,
            page: this.currentPage,
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
