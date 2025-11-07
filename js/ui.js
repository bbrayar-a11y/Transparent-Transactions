// ui.js - User Interface Management and Screen Handling
class UIManager {
    constructor() {
        this.currentScreen = null;
        this.currentTab = 'dashboard';
        this.isInitialized = false;
        console.log('🎨 UI Manager created');
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            this.initEventListeners();
            this.isInitialized = true;
            console.log('✅ UI manager initialized');
        } catch (error) {
            console.error('❌ UI initialization failed:', error);
        }
    }

    // Initialize all UI event listeners
    initEventListeners() {
        console.log('🔌 Setting up UI event listeners...');
        
        // Navigation tabs
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-tab')) {
                this.switchTab(e.target.dataset.tab);
            }
        });

        // User menu toggle
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userMenu = document.getElementById('userMenu');
        
        if (userMenuBtn && userMenu) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('hidden');
            });

            document.addEventListener('click', () => {
                userMenu.classList.add('hidden');
            });
        }

        // Quick action buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'addTransactionBtn' || 
                e.target.id === 'firstTransactionBtn' ||
                e.target.id === 'firstTransactionBtn2') {
                this.showAddTransactionModal();
            }
            
            if (e.target.id === 'addContactBtn' || 
                e.target.id === 'firstContactBtn') {
                this.showAddContactModal();
            }
            
            if (e.target.id === 'creditTransferBtn') {
                this.showCreditTransferModal();
            }
            
            if (e.target.id === 'importContactsBtn') {
                this.importContactsFromPhone();
            }
            
            if (e.target.id === 'generateReportBtn') {
                this.generateReport();
            }
        });

        // Transaction filter
        const transactionFilter = document.getElementById('transactionFilter');
        if (transactionFilter) {
            transactionFilter.addEventListener('change', () => {
                this.loadTransactionsData();
            });
        }

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.id === 'modalsContainer') {
                this.closeAllModals();
            }
        });

        console.log('✅ All UI event listeners set up');
    }

    // Show login screen
    async showLoginScreen() {
        console.log('🔐 Showing login screen');
        this.hideAllScreens();
        document.getElementById('loginScreen').classList.add('active');
        this.currentScreen = 'login';
        this.resetLoginForm();
    }

    // Show main app screen
    async showAppScreen(user) {
        console.log('🏠 Showing app screen for user:', user.phone);
        this.hideAllScreens();
        document.getElementById('appScreen').classList.add('active');
        this.currentScreen = 'app';
        
        this.updateUserInfo(user);
        await this.loadDashboardData();
        this.switchTab('dashboard');
        
        console.log('✅ App screen loaded successfully');
    }

    // Hide all screens
    hideAllScreens() {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => screen.classList.remove('active'));
    }

    // Reset login form
    resetLoginForm() {
        const phoneInput = document.getElementById('phoneInput');
        const otpInput = document.getElementById('otpInput');
        const otpSection = document.getElementById('otpSection');
        const authStatus = document.getElementById('authStatus');
        const sendOtpBtn = document.getElementById('sendOtpBtn');

        if (phoneInput) phoneInput.value = '';
        if (otpInput) otpInput.value = '';
        if (otpSection) otpSection.classList.add('hidden');
        if (authStatus) authStatus.classList.add('hidden');
        if (sendOtpBtn) sendOtpBtn.disabled = false;
    }

    // Update user information in UI
    updateUserInfo(user) {
        const greeting = document.getElementById('userGreeting');
        if (greeting) {
            greeting.textContent = `Hello, ${user.name || 'User'}!`;
        }

        const welcomeText = document.getElementById('userWelcomeText');
        if (welcomeText) {
            welcomeText.textContent = `Welcome, ${user.name || 'User'}!`;
        }

        const phoneDisplay = document.getElementById('userPhoneDisplay');
        if (phoneDisplay) {
            phoneDisplay.textContent = user.phone;
        }

        console.log('✅ User info updated in UI');
    }

    // Switch between tabs
    switchTab(tabName) {
        console.log('📑 Switching to tab:', tabName);
        
        const tabButtons = document.querySelectorAll('.nav-tab');
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });

        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}Tab`);
        });

        this.currentTab = tabName;

        switch (tabName) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'contacts':
                this.loadContactsData();
                break;
            case 'transactions':
                this.loadTransactionsData();
                break;
            case 'reports':
                this.loadReportsData();
                break;
        }
    }

    // Load dashboard data
    async loadDashboardData() {
        if (!authManager.currentUser) return;

        try {
            console.log('📊 Loading dashboard data...');
            await this.updateBalanceOverview();
            await this.updateRecentActivity();
            await this.updateNotificationCount();
            console.log('✅ Dashboard data loaded');
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
        }
    }

    // Update balance overview
    async updateBalanceOverview() {
        if (!authManager.currentUser) return;

        try {
            const transactions = await transparentDB.getLedgerEntries(authManager.currentUser.phone);
            
            let totalReceivable = 0;
            let totalPayable = 0;

            transactions.forEach(tx => {
                if (tx.fromPhone === authManager.currentUser.phone) {
                    totalPayable += tx.amount;
                } else if (tx.toPhone === authManager.currentUser.phone) {
                    totalReceivable += tx.amount;
                }
            });

            const netBalance = totalReceivable - totalPayable;

            // Update UI
            const netBalanceElement = document.getElementById('netBalance');
            const receivableElement = document.getElementById('totalReceivable');
            const payableElement = document.getElementById('totalPayable');
            const trendElement = document.getElementById('balanceTrend');

            if (netBalanceElement) {
                netBalanceElement.textContent = `₹${netBalance}`;
                netBalanceElement.className = `balance-amount ${netBalance >= 0 ? 'positive' : 'negative'}`;
            }

            if (receivableElement) receivableElement.textContent = `₹${totalReceivable}`;
            if (payableElement) payableElement.textContent = `₹${totalPayable}`;

            if (trendElement) {
                if (transactions.length === 0) {
                    trendElement.textContent = 'No transactions yet';
                } else if (netBalance > 0) {
                    trendElement.textContent = 'You are owed money';
                } else if (netBalance < 0) {
                    trendElement.textContent = 'You owe money';
                } else {
                    trendElement.textContent = 'All settled up';
                }
            }

        } catch (error) {
            console.error('❌ Error updating balance overview:', error);
        }
    }

    // Update recent activity
    async updateRecentActivity() {
        if (!authManager.currentUser) return;

        try {
            const transactions = await transparentDB.getLedgerEntries(authManager.currentUser.phone);
            const activityList = document.getElementById('recentActivityList');

            if (!activityList) return;

            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            const recentTransactions = transactions.slice(0, 5);

            if (recentTransactions.length === 0) {
                activityList.innerHTML = `
                    <div class="empty-state">
                        <p>No transactions yet</p>
                        <button id="firstTransactionBtn" class="btn-outline small">
                            Create your first transaction
                        </button>
                    </div>
                `;
                return;
            }

            activityList.innerHTML = recentTransactions.map(tx => {
                const isSent = tx.fromPhone === authManager.currentUser.phone;
                const otherParty = isSent ? tx.toPhone : tx.fromPhone;
                const amount = isSent ? -tx.amount : tx.amount;
                const date = new Date(tx.date).toLocaleDateString();

                return `
                    <div class="activity-item ${isSent ? 'sent' : 'received'}">
                        <div class="activity-details">
                            <span class="activity-type">${isSent ? 'Sent to' : 'Received from'}</span>
                            <span class="activity-party">${otherParty}</span>
                            <span class="activity-date">${date}</span>
                        </div>
                        <div class="activity-amount ${amount >= 0 ? 'positive' : 'negative'}">
                            ${amount >= 0 ? '+' : ''}₹${Math.abs(amount)}
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('❌ Error updating recent activity:', error);
            activityList.innerHTML = '<div class="error-state">Error loading activity</div>';
        }
    }

    // Update notification count
    async updateNotificationCount() {
        if (!authManager.currentUser) return;

        try {
            const pendingTransactions = await transparentDB.getPendingTransactions(authManager.currentUser.phone);
            const notificationBadge = document.getElementById('notificationCount');

            const count = pendingTransactions.filter(tx => 
                tx.toPhone === authManager.currentUser.phone && tx.status === 'pending'
            ).length;

            if (notificationBadge) {
                if (count > 0) {
                    notificationBadge.textContent = count;
                    notificationBadge.classList.remove('hidden');
                } else {
                    notificationBadge.classList.add('hidden');
                }
            }

        } catch (error) {
            console.error('❌ Error updating notification count:', error);
        }
    }

    // Load contacts data
    async loadContactsData() {
        if (!authManager.currentUser) return;

        try {
            const contacts = await transparentDB.getContacts(authManager.currentUser.phone);
            const contactsList = document.getElementById('contactsList');

            if (!contactsList) return;

            if (contacts.length === 0) {
                contactsList.innerHTML = `
                    <div class="empty-state">
                        <p>No contacts yet</p>
                        <button id="firstContactBtn" class="btn-outline small">
                            Add your first contact
                        </button>
                    </div>
                `;
                return;
            }

            contactsList.innerHTML = contacts.map(contact => `
                <div class="contact-item">
                    <div class="contact-avatar">${contact.name ? contact.name.charAt(0).toUpperCase() : '👤'}</div>
                    <div class="contact-info">
                        <div class="contact-name">${contact.name || 'Unknown Contact'}</div>
                        <div class="contact-phone">${contact.contactPhone}</div>
                    </div>
                    <div class="contact-actions">
                        <button class="icon-btn small" title="View Details">👁️</button>
                        <button class="icon-btn small" title="New Transaction">💰</button>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('❌ Error loading contacts:', error);
            contactsList.innerHTML = '<div class="error-state">Error loading contacts</div>';
        }
    }

    // Load transactions data
    async loadTransactionsData() {
        if (!authManager.currentUser) return;

        try {
            const transactions = await transparentDB.getLedgerEntries(authManager.currentUser.phone);
            const transactionsList = document.getElementById('transactionsList');

            if (!transactionsList) return;

            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (transactions.length === 0) {
                transactionsList.innerHTML = `
                    <div class="empty-state">
                        <p>No transactions yet</p>
                        <button id="firstTransactionBtn2" class="btn-outline small">
                            Create your first transaction
                        </button>
                    </div>
                `;
                return;
            }

            transactionsList.innerHTML = transactions.map(tx => {
                const isSent = tx.fromPhone === authManager.currentUser.phone;
                const otherParty = isSent ? tx.toPhone : tx.fromPhone;
                const amount = isSent ? -tx.amount : tx.amount;
                const date = new Date(tx.date).toLocaleDateString();

                return `
                    <div class="transaction-item ${isSent ? 'sent' : 'received'}">
                        <div class="transaction-details">
                            <div class="transaction-party">${otherParty}</div>
                            <div class="transaction-meta">
                                <span class="transaction-date">${date}</span>
                                <span class="transaction-status approved">Approved</span>
                            </div>
                        </div>
                        <div class="transaction-amount ${amount >= 0 ? 'positive' : 'negative'}">
                            ${amount >= 0 ? '+' : ''}₹${Math.abs(amount)}
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('❌ Error loading transactions:', error);
            transactionsList.innerHTML = '<div class="error-state">Error loading transactions</div>';
        }
    }

    // Load reports data
    async loadReportsData() {
        const reportsContent = document.getElementById('reportsContent');
        if (!reportsContent) return;

        reportsContent.innerHTML = `
            <div class="empty-state">
                <p>No report data available</p>
                <p class="hint">Create some transactions to generate reports</p>
            </div>
        `;
    }

    // Show status message
    showStatus(message, type = 'info') {
        const existingStatus = document.querySelector('.status-message');
        if (existingStatus) existingStatus.remove();

        const statusElement = document.createElement('div');
        statusElement.className = `status-message status-${type}`;
        statusElement.textContent = message;
        document.body.appendChild(statusElement);

        setTimeout(() => {
            if (statusElement.parentNode) statusElement.remove();
        }, 3000);
    }

    // Show error message
    showError(message) {
        this.showStatus(message, 'error');
    }

    // Modal management
    showAddTransactionModal() {
        this.showModal(`
            <div class="modal">
                <div class="modal-header">
                    <h3>New Transaction</h3>
                    <button class="modal-close" onclick="uiManager.closeAllModals()">×</button>
                </div>
                <div class="modal-content">
                    <p>Transaction creation will be available in the next update.</p>
                </div>
                <div class="modal-actions">
                    <button class="btn-primary" onclick="uiManager.closeAllModals()">OK</button>
                </div>
            </div>
        `);
    }

    showAddContactModal() {
        this.showModal(`
            <div class="modal">
                <div class="modal-header">
                    <h3>Add Contact</h3>
                    <button class="modal-close" onclick="uiManager.closeAllModals()">×</button>
                </div>
                <div class="modal-content">
                    <p>Contact management will be available in the next update.</p>
                </div>
                <div class="modal-actions">
                    <button class="btn-primary" onclick="uiManager.closeAllModals()">OK</button>
                </div>
            </div>
        `);
    }

    showCreditTransferModal() {
        this.showModal(`
            <div class="modal">
                <div class="modal-header">
                    <h3>Transfer Credit</h3>
                    <button class="modal-close" onclick="uiManager.closeAllModals()">×</button>
                </div>
                <div class="modal-content">
                    <p>Credit transfer feature will be available soon.</p>
                </div>
                <div class="modal-actions">
                    <button class="btn-primary" onclick="uiManager.closeAllModals()">OK</button>
                </div>
            </div>
        `);
    }

    showModal(content) {
        const modalsContainer = document.getElementById('modalsContainer');
        modalsContainer.innerHTML = content;
        modalsContainer.classList.add('active');
    }

    closeAllModals() {
        const modalsContainer = document.getElementById('modalsContainer');
        modalsContainer.classList.remove('active');
        modalsContainer.innerHTML = '';
    }

    // Placeholder methods
    importContactsFromPhone() {
        this.showStatus('Contact import will be available soon', 'info');
    }

    generateReport() {
        this.showStatus('Report generation will be available soon', 'info');
    }
}

// Initialize UI manager
const uiManager = new UIManager();
window.uiManager = uiManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        uiManager.init();
    }, 500);
});
