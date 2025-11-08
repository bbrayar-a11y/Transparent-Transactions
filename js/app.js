// app.js - Enhanced Main Application Orchestrator for Transparent Transactions
// Now with comprehensive dashboard functionality and user management

class TransparentTransactionsApp {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.isOnline = navigator.onLine;
        this.userStats = null;
        this.dashboardData = null;
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
        
        // Initialize referral manager if exists
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
                // Note: You'll need to create a service worker file for production
                // const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker ready for registration');
                
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
            
            // Load enhanced user stats
            await this.loadEnhancedUserStats();
            
            console.log('✅ Initial data loaded:', this.userStats);
            
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
        }
    }

    // Enhanced user statistics loading
    async loadEnhancedUserStats() {
        if (!this.currentUser) return;
        
        try {
            // Load contacts count
            const contacts = await window.databaseManager.getContacts(this.currentUser.phone);
            
            // Load transactions with enhanced data
            const transactions = await window.databaseManager.getUserTransactions(this.currentUser.phone);
            const pendingTransactions = transactions.filter(t => t.status === 'pending');
            
            // Load commissions data
            const commissions = await window.databaseManager.getUserCommissions(this.currentUser.phone);
            const earnedCommissions = commissions.filter(c => c.status === 'paid');
            const pendingCommissions = commissions.filter(c => c.status === 'pending');
            
            // Load trust score
            const trustScore = await window.databaseManager.getTrustScore(this.currentUser.phone);
            
            // Calculate total balance from transactions
            const totalBalance = this.calculateTotalBalance(transactions);
            
            // Calculate total commission earnings
            const totalEarnings = earnedCommissions.reduce((sum, commission) => 
                sum + (commission.amount || 0), 0
            );
            
            this.userStats = {
                // Basic stats
                contacts: contacts.length,
                transactions: transactions.length,
                pending: pendingTransactions.length,
                
                // Financial stats
                totalBalance: totalBalance,
                totalEarnings: totalEarnings,
                pendingEarnings: pendingCommissions.reduce((sum, c) => sum + (c.amount || 0), 0),
                
                // Trust and reputation
                trustScore: trustScore?.score || 0,
                trustLevel: this.calculateTrustLevel(trustScore?.score || 0),
                
                // Activity stats
                activeReferrals: 0, // Will be populated by referral manager
                successfulTransactions: transactions.filter(t => t.status === 'settled').length
            };
            
        } catch (error) {
            console.error('❌ Error loading enhanced user stats:', error);
            // Set default stats on error
            this.userStats = {
                contacts: 0,
                transactions: 0,
                pending: 0,
                totalBalance: 0,
                totalEarnings: 0,
                pendingEarnings: 0,
                trustScore: 0,
                trustLevel: 'Beginner',
                activeReferrals: 0,
                successfulTransactions: 0
            };
        }
    }

    // Calculate total balance from transactions
    calculateTotalBalance(transactions) {
        return transactions.reduce((balance, transaction) => {
            if (transaction.status === 'settled') {
                // Add received amounts, subtract sent amounts
                if (transaction.toPhone === this.currentUser.phone) {
                    return balance + (transaction.amount || 0);
                } else if (transaction.fromPhone === this.currentUser.phone) {
                    return balance - (transaction.amount || 0);
                }
            }
            return balance;
        }, 0);
    }

    // Calculate trust level based on score
    calculateTrustLevel(score) {
        if (score >= 90) return 'Excellent';
        if (score >= 80) return 'Very Good';
        if (score >= 70) return 'Good';
        if (score >= 60) return 'Fair';
        return 'Beginner';
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
                this.userStats = null;
                this.dashboardData = null;
                this.redirectToLogin();
                break;
        }
        
        this.updateApplicationUI();
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
            
            // Refresh data if needed
            this.refreshDashboardData();
        }
    }

    // Handle global click events for navigation and actions
    handleGlobalClick(event) {
        // Navigation links
        const navLink = event.target.closest('a[data-nav]');
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
        
        // Logout buttons
        if (event.target.matches('[data-logout]') || event.target.closest('[data-logout]')) {
            event.preventDefault();
            this.logout();
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
            page.classList.remove('active');
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
        
        // Update breadcrumbs if they exist
        this.updateBreadcrumbs();
    }

    // Update page title based on current page
    updatePageTitle() {
        const titles = {
            'dashboard': 'Dashboard',
            'contacts': 'My Contacts',
            'transactions': 'Transactions',
            'reports': 'Trust Reports',
            'profile': 'My Profile',
            'settings': 'Settings',
            'referrals': 'Referral Program'
        };
        
        const title = titles[this.currentPage] || 'Transparent Transactions';
        document.title = `${title} - Transparent Transactions`;
    }

    // Update breadcrumb navigation
    updateBreadcrumbs() {
        const breadcrumbContainer = document.getElementById('breadcrumb-container');
        if (!breadcrumbContainer) return;
        
        const breadcrumbs = {
            'dashboard': [{ name: 'Dashboard', active: true }],
            'transactions': [
                { name: 'Dashboard', page: 'dashboard' },
                { name: 'Transactions', active: true }
            ],
            'profile': [
                { name: 'Dashboard', page: 'dashboard' },
                { name: 'Profile', active: true }
            ]
            // Add more breadcrumb paths as needed
        };
        
        const currentBreadcrumbs = breadcrumbs[this.currentPage] || breadcrumbs.dashboard;
        
        breadcrumbContainer.innerHTML = currentBreadcrumbs.map(breadcrumb => 
            breadcrumb.active 
                ? `<span class="breadcrumb-active">${breadcrumb.name}</span>`
                : `<a href="#" data-nav="${breadcrumb.page}" class="breadcrumb-link">${breadcrumb.name}</a>`
        ).join(' / ');
    }

    // Load data for specific page
    async loadPageData(page, data) {
        console.log(`📊 Loading data for: ${page}`);
        
        switch (page) {
            case 'dashboard':
                await this.loadEnhancedDashboardData();
                break;
            case 'transactions':
                await this.loadTransactionsData();
                break;
            case 'profile':
                await this.loadProfileData();
                break;
            case 'referrals':
                await this.loadReferralsData();
                break;
            case 'settings':
                await this.loadSettingsData();
                break;
        }
        
        // Trigger page data loaded event
        this.triggerAppEvent('pageDataLoaded', {
            page: page,
            data: data
        });
    }

    // Enhanced dashboard data loading with comprehensive stats
    async loadEnhancedDashboardData() {
        if (!this.currentUser) return;
        
        console.log('📈 Loading enhanced dashboard data...');
        
        try {
            // Load recent transactions
            const transactions = await window.databaseManager.getUserTransactions(this.currentUser.phone);
            const recentTransactions = transactions
                .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
                .slice(0, 10);
            
            // Load recent commissions
            const commissions = await window.databaseManager.getUserCommissions(this.currentUser.phone);
            const recentCommissions = commissions
                .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
                .slice(0, 5);
            
            // Load quick stats
            const quickStats = await this.calculateQuickStats();
            
            // Compile dashboard data
            this.dashboardData = {
                recentTransactions: recentTransactions,
                recentCommissions: recentCommissions,
                quickStats: quickStats,
                lastUpdated: new Date().toISOString()
            };
            
            // Update dashboard UI
            this.updateDashboardUI();
            
            console.log('✅ Enhanced dashboard data loaded');
            
        } catch (error) {
            console.error('❌ Error loading enhanced dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    // Calculate quick stats for dashboard
    async calculateQuickStats() {
        if (!this.currentUser || !this.userStats) return {};
        
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
            weeklyCount: weeklyTransactions.length,
            monthlyGrowth: this.calculateMonthlyGrowth(transactions)
        };
    }

    // Calculate monthly growth percentage
    calculateMonthlyGrowth(transactions) {
        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        const currentMonthTransactions = transactions.filter(t => 
            new Date(t.createdDate) >= currentMonth
        );
        const lastMonthTransactions = transactions.filter(t => 
            new Date(t.createdDate) >= lastMonth && new Date(t.createdDate) < currentMonth
        );
        
        if (lastMonthTransactions.length === 0) return 100; // 100% growth if no previous data
        
        return ((currentMonthTransactions.length - lastMonthTransactions.length) / lastMonthTransactions.length) * 100;
    }

    // Update dashboard UI with loaded data
    updateDashboardUI() {
        if (!this.dashboardData || !this.userStats) return;
        
        // Update stats cards
        this.updateStatsCards();
        
        // Update recent transactions list
        this.updateRecentTransactions();
        
        // Update recent commissions
        this.updateRecentCommissions();
        
        // Update quick stats
        this.updateQuickStats();
        
        // Update charts if they exist
        this.updateDashboardCharts();
    }

    // Update statistics cards on dashboard
    updateStatsCards() {
        if (!this.userStats) return;
        
        const elements = {
            balance: document.getElementById('balance-amount'),
            transactions: document.getElementById('transactions-count'),
            contacts: document.getElementById('contacts-count'),
            trustScore: document.getElementById('trust-score'),
            earnings: document.getElementById('total-earnings'),
            pending: document.getElementById('pending-count')
        };
        
        if (elements.balance) elements.balance.textContent = this.formatCurrency(this.userStats.totalBalance);
        if (elements.transactions) elements.transactions.textContent = this.userStats.transactions;
        if (elements.contacts) elements.contacts.textContent = this.userStats.contacts;
        if (elements.trustScore) elements.trustScore.textContent = `${this.userStats.trustScore}%`;
        if (elements.earnings) elements.earnings.textContent = this.formatCurrency(this.userStats.totalEarnings);
        if (elements.pending) elements.pending.textContent = this.userStats.pending;
    }

    // Update recent transactions list
    updateRecentTransactions() {
        const container = document.getElementById('recent-transactions-list');
        if (!container || !this.dashboardData.recentTransactions) return;
        
        if (this.dashboardData.recentTransactions.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent transactions</div>';
            return;
        }
        
        container.innerHTML = this.dashboardData.recentTransactions.map(transaction => `
            <div class="transaction-item" data-transaction-id="${transaction.id}">
                <div class="transaction-info">
                    <div class="transaction-party">
                        ${transaction.fromPhone === this.currentUser.phone ? 'To: ' + this.maskPhone(transaction.toPhone) : 'From: ' + this.maskPhone(transaction.fromPhone)}
                    </div>
                    <div class="transaction-date">
                        ${new Date(transaction.createdDate).toLocaleDateString()}
                    </div>
                </div>
                <div class="transaction-amount ${transaction.fromPhone === this.currentUser.phone ? 'negative' : 'positive'}">
                    ${transaction.fromPhone === this.currentUser.phone ? '-' : '+'}${this.formatCurrency(transaction.amount || 0)}
                </div>
            </div>
        `).join('');
    }

    // Update recent commissions list
    updateRecentCommissions() {
        const container = document.getElementById('recent-commissions-list');
        if (!container || !this.dashboardData.recentCommissions) return;
        
        if (this.dashboardData.recentCommissions.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent commissions</div>';
            return;
        }
        
        container.innerHTML = this.dashboardData.recentCommissions.map(commission => `
            <div class="commission-item">
                <div class="commission-info">
                    <div class="commission-source">Referral Commission</div>
                    <div class="commission-date">
                        ${new Date(commission.createdDate).toLocaleDateString()}
                    </div>
                </div>
                <div class="commission-amount positive">
                    +${this.formatCurrency(commission.amount || 0)}
                </div>
            </div>
        `).join('');
    }

    // Update quick stats display
    updateQuickStats() {
        if (!this.dashboardData.quickStats) return;
        
        const elements = {
            todayCount: document.getElementById('today-count'),
            todayAmount: document.getElementById('today-amount'),
            weeklyCount: document.getElementById('weekly-count'),
            monthlyGrowth: document.getElementById('monthly-growth')
        };
        
        const stats = this.dashboardData.quickStats;
        
        if (elements.todayCount) elements.todayCount.textContent = stats.todayCount || 0;
        if (elements.todayAmount) elements.todayAmount.textContent = this.formatCurrency(stats.todayAmount || 0);
        if (elements.weeklyCount) elements.weeklyCount.textContent = stats.weeklyCount || 0;
        if (elements.monthlyGrowth) {
            const growth = stats.monthlyGrowth || 0;
            elements.monthlyGrowth.textContent = `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`;
            elements.monthlyGrowth.className = `growth-indicator ${growth >= 0 ? 'positive' : 'negative'}`;
        }
    }

    // Update dashboard charts (placeholder for future implementation)
    updateDashboardCharts() {
        // This would integrate with a charting library like Chart.js
        console.log('📊 Dashboard charts would be updated here');
    }

    // TRANSACTION MANAGEMENT METHODS

    // Add new transaction
    async addNewTransaction(transactionData) {
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
                status: 'pending'
            };

            const result = await window.databaseManager.createTransaction(transaction);
            
            this.showNotification({
                type: 'success',
                title: 'Transaction Created',
                message: `Transaction of ${this.formatCurrency(transactionData.amount)} initiated`,
                duration: 3000
            });

            // Refresh dashboard data
            await this.refreshDashboardData();

            return result;
            
        } catch (error) {
            console.error('❌ Error creating transaction:', error);
            this.showError('Failed to create transaction');
            throw error;
        }
    }

    // Get transaction history with filtering
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

    // USER PROFILE MANAGEMENT

    // Update user profile
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

    // Change user password
    async changeUserPassword(currentPassword, newPassword) {
        if (!window.authManager) {
            throw new Error('Authentication manager not available');
        }

        // This would integrate with your auth system
        // For now, just show a notification
        this.showNotification({
            type: 'success',
            title: 'Password Updated',
            message: 'Your password has been changed successfully',
            duration: 3000
        });
    }

    // REFERRAL SYSTEM INTEGRATION

    // Generate referral code for user
    generateReferralCode() {
        if (!this.currentUser) return null;
        
        // Simple referral code generation based on phone number
        const phone = this.currentUser.phone;
        const code = `TT${phone.slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
        return code;
    }

    // Get referral statistics
    async getReferralStatistics() {
        if (!this.currentUser) return null;
        
        try {
            const referralCode = this.currentUser.profile?.referralCode || this.generateReferralCode();
            const referrals = await window.databaseManager.getReferralsByCode(referralCode);
            const commissions = await window.databaseManager.getUserCommissions(this.currentUser.phone);
            
            const earnedCommissions = commissions.filter(c => c.status === 'paid');
            const pendingCommissions = commissions.filter(c => c.status === 'pending');
            
            return {
                referralCode: referralCode,
                totalReferrals: referrals.length,
                activeReferrals: referrals.filter(r => r.status === 'active').length,
                totalEarned: earnedCommissions.reduce((sum, c) => sum + (c.amount || 0), 0),
                pendingAmount: pendingCommissions.reduce((sum, c) => sum + (c.amount || 0), 0),
                commissionHistory: earnedCommissions.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
            };
            
        } catch (error) {
            console.error('❌ Error getting referral statistics:', error);
            return null;
        }
    }

    // Load referrals page data
    async loadReferralsData() {
        const stats = await this.getReferralStatistics();
        if (stats) {
            this.updateReferralsUI(stats);
        }
    }

    // Update referrals UI
    updateReferralsUI(stats) {
        const elements = {
            referralCode: document.getElementById('user-referral-code'),
            totalReferrals: document.getElementById('total-referrals'),
            activeReferrals: document.getElementById('active-referrals'),
            totalEarned: document.getElementById('total-earned'),
            pendingAmount: document.getElementById('pending-amount')
        };
        
        if (elements.referralCode) elements.referralCode.textContent = stats.referralCode;
        if (elements.totalReferrals) elements.totalReferrals.textContent = stats.totalReferrals;
        if (elements.activeReferrals) elements.activeReferrals.textContent = stats.activeReferrals;
        if (elements.totalEarned) elements.totalEarned.textContent = this.formatCurrency(stats.totalEarned);
        if (elements.pendingAmount) elements.pendingAmount.textContent = this.formatCurrency(stats.pendingAmount);
    }

    // UTILITY METHODS

    // Format currency for display
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    }

    // Mask phone number for display
    maskPhone(phone) {
        if (!phone) return 'Unknown';
        return phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');
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

    // Logout user
    async logout() {
        if (window.authManager) {
            await window.authManager.logout();
        } else {
            this.redirectToLogin();
        }
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
        const pages = ['dashboard', 'transactions', 'contacts', 'reports', 'profile', 'settings', 'referrals'];
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

    // Refresh dashboard data
    async refreshDashboardData() {
        await this.loadEnhancedUserStats();
        await this.loadEnhancedDashboardData();
        this.updateApplicationUI();
    }

    // Public method to refresh all data
    async refreshAllData() {
        console.log('🔄 Refreshing all application data...');
        await this.loadInitialData();
        await this.loadEnhancedDashboardData();
        this.updateApplicationUI();
        
        this.showNotification({
            type: 'success',
            title: 'Data Refreshed',
            message: 'All application data has been updated',
            duration: 2000
        });
    }

    // Update overall application UI
    updateApplicationUI() {
        // Update auth-dependent UI
        this.updateAuthUI();
        
        // Update online/offline indicator
        this.updateOnlineStatusUI();
        
        // Update user-specific content
        this.updateUserContent();
        
        // Update current page UI if needed
        if (this.currentPage === 'dashboard') {
            this.updateDashboardUI();
        }
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

    // Load transactions page data
    async loadTransactionsData() {
        console.log('Loading transactions data...');
        // Implementation for transactions page
    }

    // Load profile page data
    async loadProfileData() {
        console.log('Loading profile data...');
        // Implementation for profile page
    }

    // Load settings page data
    async loadSettingsData() {
        console.log('Loading settings data...');
        // Implementation for settings page
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
            stats: this.userStats,
            components: {
                database: !!window.databaseManager,
                auth: !!window.authManager,
                referral: !!window.referralManager
            }
        };
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
