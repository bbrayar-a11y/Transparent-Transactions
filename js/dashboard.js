// js/dashboard.js - COMPLETE WITH STORAGE DETECTIVE INTEGRATION
class DashboardManager {
    constructor() {
        this.isInitialized = false;
        this.storageStrategy = 'standard';
        this.currentUser = null;
        this.dashboardData = {
            user: null,
            stats: null,
            activities: [],
            networkStats: null
        };
    }

    async init() {
        console.log('🏠 Dashboard Manager initializing...');
        
        try {
            // Wait for Storage Detective first
            await this.waitForStorageDetective();
            this.setStorageStrategy();
            
            // Wait for essential components
            await this.waitForComponents();
            
            // Validate user session
            await this.validateAndLoadSession();
            
            this.isInitialized = true;
            console.log('✅ Dashboard Manager initialized successfully');
            
        } catch (error) {
            console.error('💥 Dashboard initialization failed:', error);
            this.handleFatalError('Failed to load dashboard. Please try again.');
        }
    }

    // === STORAGE DETECTIVE INTEGRATION ===
    async waitForStorageDetective() {
        const maxWait = 15000; // 15 seconds max
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (window.storageCapabilities) {
                console.log('✅ Storage Detective ready for dashboard');
                return;
            }
            
            try {
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Storage Detective timeout')), 3000);
                    document.addEventListener('storageReady', () => {
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                });
                break;
            } catch (error) {
                console.log('⏳ Dashboard waiting for Storage Detective...');
                await new Promise(r => setTimeout(r, 500));
            }
        }
        
        if (!window.storageCapabilities) {
            console.warn('⚠️ Storage Detective not available, using fallback strategy');
            window.storageCapabilities = {
                strategy: 'standard',
                score: 50
            };
        }
    }

    setStorageStrategy() {
        this.storageStrategy = window.storageCapabilities?.strategy || 'standard';
        console.log('💾 Dashboard storage strategy:', this.storageStrategy);
    }

    // === STORAGE-AWARE SESSION MANAGEMENT ===
    getStorage() {
        switch (this.storageStrategy) {
            case 'full-persistence':
            case 'standard':
                try {
                    return localStorage;
                } catch (e) {
                    return sessionStorage;
                }
            case 'session-only':
                return sessionStorage;
            case 'temporary':
            case 'emergency':
                return sessionStorage;
            default:
                return localStorage;
        }
    }

    getCurrentUserFromStorage() {
        try {
            const storage = this.getStorage();
            const currentUser = storage.getItem('currentUser');
            return currentUser ? JSON.parse(currentUser) : null;
        } catch (error) {
            console.error('❌ Storage read failed:', error);
            return null;
        }
    }

    // === COMPONENT WAITING ===
    async waitForComponents() {
        const maxWaitTime = 15000; // 15 seconds
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            if (window.databaseManager && window.databaseManager.isInitialized && 
                window.authManager && window.authManager.isInitialized) {
                console.log('✅ All components ready for dashboard');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Components not ready within timeout');
    }

    // === SESSION VALIDATION ===
    async validateAndLoadSession() {
        try {
            // Check if user is authenticated using storage-aware method
            if (!window.authManager.isAuthenticated()) {
                throw new Error('No active session');
            }

            // Get user from storage
            this.currentUser = this.getCurrentUserFromStorage();
            if (!this.currentUser) {
                throw new Error('No user session found');
            }

            console.log('✅ Session validated:', this.currentUser.phone);
            
            // Load dashboard data
            await this.loadDashboardData();
            
            // Show main app
            this.showAppInterface();
            
            // Update debug info
            this.updateDebugInfo();
            
        } catch (error) {
            console.error('❌ Session validation failed:', error);
            this.handleSessionError(error.message);
        }
    }

    // === DASHBOARD DATA LOADING ===
    async loadDashboardData() {
        try {
            this.showLoadingMessage('Loading your data...');
            
            // Load user stats
            await this.loadUserStats();
            
            // Load referral network stats
            await this.loadReferralNetworkStats();
            
            // Load recent activity
            await this.loadRecentActivity();
            
            // Update UI
            this.updateDashboardUI();
            
            // Hide loading
            this.hideLoadingScreen();
            
        } catch (error) {
            console.error('❌ Data loading failed:', error);
            this.showNotification('warning', 'Data Loading', 'Some data may not be current');
        }
    }

    async loadUserStats() {
        try {
            const userPhone = this.currentUser.phone;
            
            // Get user profile for latest data
            const userProfile = await window.databaseManager.getUser(userPhone);
            if (userProfile) {
                this.currentUser.profile = userProfile;
            }
            
            // Calculate basic stats
            const transactions = await window.databaseManager.getUserTransactions(userPhone);
            const contacts = await window.databaseManager.getContacts(userPhone);
            const commissions = await window.databaseManager.getUserCommissions(userPhone);
            
            this.dashboardData.stats = {
                balance: userProfile?.balance || 0,
                trustScore: userProfile?.trustScore || 100,
                transactionsCount: transactions?.length || 0,
                contactsCount: contacts?.length || 0,
                totalEarnings: commissions?.filter(c => c.status === 'paid')
                                       .reduce((sum, c) => sum + (c.amount || 0), 0) || 0
            };
            
        } catch (error) {
            console.error('❌ Stats loading error:', error);
            // Set default stats
            this.dashboardData.stats = {
                balance: 0,
                trustScore: 100,
                transactionsCount: 0,
                contactsCount: 0,
                totalEarnings: 0
            };
        }
    }

    async loadReferralNetworkStats() {
        try {
            const userPhone = this.currentUser.phone;
            
            // Get network stats from database
            if (window.databaseManager.getUserNetworkStats) {
                this.dashboardData.networkStats = await window.databaseManager.getUserNetworkStats(userPhone);
            } else {
                // Fallback if method not available
                this.dashboardData.networkStats = {
                    directReferrals: 0,
                    level2Referrals: 0,
                    level3Referrals: 0,
                    level4Referrals: 0,
                    totalNetwork: 0
                };
            }
            
        } catch (error) {
            console.error('❌ Network stats loading error:', error);
            this.dashboardData.networkStats = {
                directReferrals: 0,
                level2Referrals: 0,
                level3Referrals: 0,
                level4Referrals: 0,
                totalNetwork: 0
            };
        }
    }

    async loadRecentActivity() {
        try {
            const userPhone = this.currentUser.phone;
            const transactions = await window.databaseManager.getUserTransactions(userPhone);
            
            // Get last 5 transactions, sorted by date
            this.dashboardData.activities = (transactions || [])
                .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
                .slice(0, 5)
                .map(tx => ({
                    type: 'transaction',
                    id: tx.id,
                    amount: tx.amount,
                    description: tx.description,
                    date: tx.createdDate,
                    status: tx.status,
                    isIncoming: tx.toPhone === userPhone
                }));
                
        } catch (error) {
            console.error('❌ Activity loading error:', error);
            this.dashboardData.activities = [];
        }
    }

    // === UI UPDATES ===
    updateDashboardUI() {
        if (!this.currentUser || !this.dashboardData.stats) return;
        
        // User info
        this.updateElement('userName', this.currentUser.profile?.fullName || 'User');
        this.updateElement('userPhone', this.formatPhone(this.currentUser.phone));
        this.updateElement('welcomeName', this.currentUser.profile?.fullName || 'there');
        this.updateElement('memberSince', new Date(this.currentUser.profile?.createdAt || Date.now()).toLocaleDateString());
        
        // Stats
        this.updateElement('balanceAmount', this.formatCurrency(this.dashboardData.stats.balance));
        this.updateElement('trustScore', `${this.dashboardData.stats.trustScore}%`);
        this.updateElement('transactionsCount', this.dashboardData.stats.transactionsCount.toString());
        this.updateElement('contactsCount', this.dashboardData.stats.contactsCount.toString());
        
        // Referral Network
        this.updateReferralNetworkUI();
        
        // Recent activity
        this.updateActivityList();
        
        // Online indicator
        this.updateOnlineStatus();
    }

    updateReferralNetworkUI() {
        // Personal referral link
        const referralCode = this.currentUser.profile?.myReferralCode || this.generateReferralCode();
        const baseUrl = window.location.origin + window.location.pathname;
        const referralLink = `${baseUrl.replace('dashboard.html', '')}login.html?ref=${referralCode}`;
        
        this.updateElement('personalReferralLink', referralLink);
        
        // Network statistics
        if (this.dashboardData.networkStats) {
            this.updateElement('directReferrals', this.dashboardData.networkStats.directReferrals);
            this.updateElement('level2Referrals', this.dashboardData.networkStats.level2Referrals);
            this.updateElement('level3Referrals', this.dashboardData.networkStats.level3Referrals);
            this.updateElement('totalNetwork', this.dashboardData.networkStats.totalNetwork);
        }
    }

    updateActivityList() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        if (this.dashboardData.activities.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <p>No recent activity</p>
                    <small>Your transactions will appear here</small>
                </div>
            `;
            return;
        }
        
        activityList.innerHTML = this.dashboardData.activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    ${activity.isIncoming ? '📥' : '📤'}
                </div>
                <div class="activity-details">
                    <div class="activity-title">
                        ${activity.isIncoming ? 'Received' : 'Sent'} Money
                    </div>
                    <div class="activity-description">
                        ${activity.description || 'Transaction'}
                    </div>
                    <div class="activity-date">
                        ${new Date(activity.date).toLocaleDateString()}
                    </div>
                </div>
                <div class="activity-amount ${activity.isIncoming ? 'positive' : 'negative'}">
                    ${activity.isIncoming ? '+' : '-'}${this.formatCurrency(activity.amount)}
                </div>
            </div>
        `).join('');
    }

    // === UI CONTROLS ===
    showAppInterface() {
        const loadingScreen = document.getElementById('loadingScreen');
        const appContainer = document.getElementById('appContainer');
        
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        
        this.showNotification('success', 'Welcome Back', 
            `Good to see you, ${this.currentUser.profile?.fullName || 'there'}!`);
    }

    showLoadingMessage(message) {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            const messageElement = loadingScreen.querySelector('p');
            if (messageElement) messageElement.textContent = message;
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }

    // === ERROR HANDLING ===
    handleSessionError(errorMessage) {
        this.hideLoadingScreen();
        
        const errorHtml = `
            <div class="error-screen">
                <div class="error-content">
                    <h2>🔐 Session Error</h2>
                    <p>${errorMessage}</p>
                    <div class="error-actions">
                        <button class="btn btn-primary" onclick="window.location.href='login.html'">
                            Go to Login
                        </button>
                        <button class="btn btn-secondary" onclick="window.location.reload()">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.innerHTML = errorHtml;
    }

    handleFatalError(message) {
        this.hideLoadingScreen();
        
        const errorHtml = `
            <div class="error-screen">
                <div class="error-content">
                    <h2>💥 Application Error</h2>
                    <p>${message}</p>
                    <div class="error-actions">
                        <button class="btn btn-primary" onclick="window.location.reload()">
                            Reload Application
                        </button>
                        <button class="btn btn-secondary" onclick="window.location.href='login.html'">
                            Go to Login
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.innerHTML = errorHtml;
    }

    // === DEBUG FUNCTIONS ===
    updateDebugInfo() {
        if (!this.currentUser) return;
        
        this.updateElement('debugSessionStatus', 'Valid', 'status-valid');
        this.updateElement('debugUserPhone', this.currentUser.phone);
        this.updateElement('debugLoginTime', new Date(this.currentUser.loginTime).toLocaleString());
        this.updateElement('debugDbStatus', window.databaseManager.isInitialized ? 'Connected' : 'Disconnected', 
                          window.databaseManager.isInitialized ? 'status-valid' : 'status-error');
        this.updateElement('debugReferralCode', this.currentUser.profile?.myReferralCode || 'Not set');
        this.updateElement('debugReferredBy', this.currentUser.profile?.referredBy || 'Direct signup');
        this.updateElement('debugStorageStrategy', this.storageStrategy);
    }

    // === UTILITY FUNCTIONS ===
    updateElement(id, content, className = '') {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
            if (className) element.className = className;
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    }

    formatPhone(phone) {
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }

    generateReferralCode() {
        const phone = this.currentUser.phone;
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const randomPart = Array(4).fill().map(() => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        return phone.slice(-4) + randomPart;
    }

    updateOnlineStatus() {
        const indicator = document.getElementById('onlineIndicator');
        if (indicator) {
            if (navigator.onLine) {
                indicator.className = 'online-indicator online';
                indicator.querySelector('.indicator-text').textContent = 'Online';
            } else {
                indicator.className = 'online-indicator offline';
                indicator.querySelector('.indicator-text').textContent = 'Offline';
            }
        }
    }

    showNotification(type, title, message) {
        // Use existing notification system or fallback
        if (window.app && window.app.showNotification) {
            window.app.showNotification({ type, title, message });
            return;
        }
        
        // Fallback notification
        console.log(`📢 ${title}: ${message}`);
    }
}

// === DASHBOARD AUTO-INITIALIZATION ===
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🏠 Dashboard initializing...');
    
    // Create and initialize dashboard manager
    window.dashboardManager = new DashboardManager();
    await window.dashboardManager.init();
});

// Global functions for HTML onclick handlers
window.handleLogout = async function() {
    try {
        window.dashboardManager.showLoadingMessage('Logging out...');
        await window.authManager.logout();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'index.html';
    }
};

// Event listeners
window.addEventListener('online', () => window.dashboardManager?.updateOnlineStatus());
window.addEventListener('offline', () => window.dashboardManager?.updateOnlineStatus());
