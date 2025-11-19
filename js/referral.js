// referral.js - Referral and Commission Management for Transparent Transactions
// This file handles referral tracking, commission calculations, and payout management

class ReferralManager {
    constructor() {
        this.commissionRates = {
            level1: 1.60,  // ₹1.60
            level2: 0.80,  // ₹0.80
            level3: 0.40,  // ₹0.40
            level4: 0.20   // ₹0.20
        };
        this.payoutThreshold = 10.00; // ₹10 minimum for payout
        this.referralCodeLength = 6;
        this.init();
    }

    init() {
        console.log('🤝 Referral Manager initialized');
        this.loadReferralData();
        this.setupEventListeners();
    }

    // Load referral data from localStorage
    loadReferralData() {
        try {
            this.userReferralCode = localStorage.getItem('personalReferralCode');
            this.referralChain = JSON.parse(localStorage.getItem('referralChain') || '{}');
            this.pendingCommissions = JSON.parse(localStorage.getItem('pendingCommissions') || '[]');
            this.paidCommissions = JSON.parse(localStorage.getItem('paidCommissions') || '[]');
            
            console.log('📊 Referral data loaded');
        } catch (error) {
            console.error('❌ Error loading referral data:', error);
            this.initializeDefaultData();
        }
    }

    // Initialize default data structure
    initializeDefaultData() {
        this.referralChain = {};
        this.pendingCommissions = [];
        this.paidCommissions = [];
        this.saveReferralData();
    }

    // Save referral data to localStorage
    saveReferralData() {
        try {
            localStorage.setItem('referralChain', JSON.stringify(this.referralChain));
            localStorage.setItem('pendingCommissions', JSON.stringify(this.pendingCommissions));
            localStorage.setItem('paidCommissions', JSON.stringify(this.paidCommissions));
        } catch (error) {
            console.error('❌ Error saving referral data:', error);
        }
    }

    // Setup event listeners for referral-related events
    setupEventListeners() {
        // Listen for payment events
        document.addEventListener('paymentProcessed', (event) => {
            this.handlePaymentEvent(event.detail);
        });

        // Listen for user registration events
        document.addEventListener('userRegistered', (event) => {
            this.handleNewUserRegistration(event.detail);
        });
    }

    // Generate a unique referral code
    generateReferralCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        
        for (let i = 0; i < this.referralCodeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // Check if code already exists
        if (this.isReferralCodeUnique(code)) {
            return code;
        } else {
            // Recursively generate new code if duplicate
            return this.generateReferralCode();
        }
    }

    // Check if referral code is unique
    isReferralCodeUnique(code) {
        // In a real app, this would check against a database
        // For now, we'll assume all generated codes are unique
        return true;
    }

    // Set user's referral code
    setUserReferralCode(code) {
        this.userReferralCode = code;
        localStorage.setItem('personalReferralCode', code);
        console.log('✅ User referral code set:', code);
    }

    // Get user's referral code
    getUserReferralCode() {
        return this.userReferralCode;
    }

    // Build referral link
    getReferralLink() {
        if (!this.userReferralCode) {
            console.error('❌ No referral code available');
            return null;
        }
        
        const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, 'index.html');
        return `${baseUrl}?ref=${this.userReferralCode}`;
    }

    // Process new user registration with referral
    processReferralRegistration(newUserPhone, enteredReferralCode) {
        return new Promise((resolve, reject) => {
            try {
                // Validate referral code
                if (!this.validateReferralCode(enteredReferralCode)) {
                    reject({
                        success: false,
                        message: 'Invalid referral code'
                    });
                    return;
                }

                // Build referral chain
                const referralData = {
                    referredUser: newUserPhone,
                    referrerCode: enteredReferralCode,
                    registrationDate: new Date().toISOString(),
                    level: 1
                };

                // Add to referral chain
                if (!this.referralChain[enteredReferralCode]) {
                    this.referralChain[enteredReferralCode] = [];
                }
                this.referralChain[enteredReferralCode].push(referralData);

                // Save updated data
                this.saveReferralData();

                console.log('✅ Referral registration processed:', newUserPhone, 'referred by', enteredReferralCode);
                
                resolve({
                    success: true,
                    message: 'Referral registered successfully',
                    data: referralData
                });

            } catch (error) {
                reject({
                    success: false,
                    message: 'Error processing referral',
                    error: error.message
                });
            }
        });
    }

    // Handle payment events and distribute commissions
    handlePaymentEvent(paymentDetail) {
        if (paymentDetail.amount !== 10) {
            console.log('⚠️  Non-₹10 payment, skipping commission calculation');
            return;
        }

        console.log('💰 Processing commissions for ₹10 payment');

        const userPhone = paymentDetail.userPhone;
        const paymentId = paymentDetail.paymentId;
        const timestamp = new Date().toISOString();

        // Find referral chain for this user
        const userChain = this.findUserReferralChain(userPhone);
        
        if (!userChain || userChain.length === 0) {
            console.log('ℹ️  No referral chain found for user:', userPhone);
            return;
        }

        // Distribute commissions across 4 levels
        this.distributeCommissions(userChain, paymentId, timestamp);
    }

    // Find user's referral chain
    findUserReferralChain(userPhone) {
        const chain = [];
        
        // Search through referral chain to find this user and their upline
        for (const [referrerCode, referrals] of Object.entries(this.referralChain)) {
            for (const referral of referrals) {
                if (referral.referredUser === userPhone) {
                    chain.push({
                        level: 1,
                        user: referrerCode,
                        referralDate: referral.registrationDate
                    });
                    
                    // Find upline for level 2-4
                    this.findUplineChain(referrerCode, chain, 2);
                    break;
                }
            }
        }
        
        return chain;
    }

    // Recursively find upline chain
    findUplineChain(userCode, chain, currentLevel) {
        if (currentLevel > 4) return;

        for (const [referrerCode, referrals] of Object.entries(this.referralChain)) {
            for (const referral of referrals) {
                if (referral.referredUser === userCode) {
                    chain.push({
                        level: currentLevel,
                        user: referrerCode,
                        referralDate: referral.registrationDate
                    });
                    
                    // Continue finding upline
                    this.findUplineChain(referrerCode, chain, currentLevel + 1);
                    break;
                }
            }
        }
    }

    // Distribute commissions across referral levels
    distributeCommissions(referralChain, paymentId, timestamp) {
        let totalCommissions = 0;

        referralChain.forEach(chainLink => {
            if (chainLink.level <= 4) {
                const commissionAmount = this.commissionRates[`level${chainLink.level}`];
                
                const commission = {
                    id: this.generateCommissionId(),
                    paymentId: paymentId,
                    recipient: chainLink.user,
                    amount: commissionAmount,
                    level: chainLink.level,
                    status: 'pending',
                    created: timestamp,
                    dueDate: this.calculateDueDate(timestamp)
                };

                this.pendingCommissions.push(commission);
                totalCommissions += commissionAmount;

                console.log(`💰 Level ${chainLink.level} commission: ₹${commissionAmount} for ${chainLink.user}`);
            }
        });

        // Save updated commissions
        this.saveReferralData();

        // Trigger commission event
        this.triggerCommissionEvent('commissionsDistributed', {
            paymentId: paymentId,
            totalCommissions: totalCommissions,
            commissions: referralChain.slice(0, 4)
        });

        console.log(`✅ Total commissions distributed: ₹${totalCommissions.toFixed(2)}`);
    }

    // Handle new user registration
    handleNewUserRegistration(userDetail) {
        console.log('👤 New user registration:', userDetail.phone);
        
        // If user came through referral, process it
        if (userDetail.referralCode && userDetail.referralCode !== 'admin123') {
            this.processReferralRegistration(userDetail.phone, userDetail.referralCode);
        }
    }

    // Validate referral code format
    validateReferralCode(code) {
        if (!code || typeof code !== 'string') return false;
        
        // Check length
        if (code.length !== this.referralCodeLength) return false;
        
        // Check if all uppercase letters
        if (!/^[A-Z]+$/.test(code)) return false;
        
        return true;
    }

    // Generate unique commission ID
    generateCommissionId() {
        return 'comm_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    // Calculate due date for commission (7 days from now)
    calculateDueDate(timestamp) {
        const dueDate = new Date(timestamp);
        dueDate.setDate(dueDate.getDate() + 7);
        return dueDate.toISOString();
    }

    // Get pending commissions for a user
    getUserPendingCommissions(userCode) {
        return this.pendingCommissions.filter(commission => 
            commission.recipient === userCode && commission.status === 'pending'
        );
    }

    // Get total pending amount for a user
    getUserPendingAmount(userCode) {
        const userCommissions = this.getUserPendingCommissions(userCode);
        return userCommissions.reduce((total, commission) => total + commission.amount, 0);
    }

    // Check if user has reached payout threshold
    hasReachedPayoutThreshold(userCode) {
        const pendingAmount = this.getUserPendingAmount(userCode);
        return pendingAmount >= this.payoutThreshold;
    }

    // Process commission payout
    processPayout(userCode) {
        return new Promise((resolve, reject) => {
            try {
                const userCommissions = this.getUserPendingCommissions(userCode);
                const totalAmount = this.getUserPendingAmount(userCode);

                if (totalAmount < this.payoutThreshold) {
                    reject({
                        success: false,
                        message: `Minimum payout is ₹${this.payoutThreshold}. Current balance: ₹${totalAmount.toFixed(2)}`
                    });
                    return;
                }

                // Mark commissions as paid
                const payoutId = 'payout_' + Date.now();
                const payoutTimestamp = new Date().toISOString();

                userCommissions.forEach(commission => {
                    commission.status = 'paid';
                    commission.paidAt = payoutTimestamp;
                    commission.payoutId = payoutId;
                    
                    // Move to paid commissions
                    this.paidCommissions.push(commission);
                });

                // Remove from pending
                this.pendingCommissions = this.pendingCommissions.filter(
                    commission => commission.status === 'pending'
                );

                // Save updated data
                this.saveReferralData();

                console.log(`✅ Payout processed: ₹${totalAmount.toFixed(2)} to ${userCode}`);

                // Trigger payout event
                this.triggerCommissionEvent('payoutProcessed', {
                    payoutId: payoutId,
                    recipient: userCode,
                    amount: totalAmount,
                    commissionCount: userCommissions.length
                });

                resolve({
                    success: true,
                    message: `Payout of ₹${totalAmount.toFixed(2)} processed successfully`,
                    payoutId: payoutId,
                    amount: totalAmount
                });

            } catch (error) {
                reject({
                    success: false,
                    message: 'Error processing payout',
                    error: error.message
                });
            }
        });
    }

    // Get referral statistics
    getReferralStats(userCode) {
        const directReferrals = this.referralChain[userCode] || [];
        const pendingAmount = this.getUserPendingAmount(userCode);
        const totalEarned = this.paidCommissions
            .filter(commission => commission.recipient === userCode)
            .reduce((total, commission) => total + commission.amount, 0);

        return {
            directReferrals: directReferrals.length,
            pendingAmount: pendingAmount,
            totalEarned: totalEarned,
            hasReachedThreshold: pendingAmount >= this.payoutThreshold,
            nextPayoutAmount: pendingAmount
        };
    }

    // Get full referral network
    getUserReferralNetwork(userCode) {
        const network = {
            level1: [],
            level2: [],
            level3: [],
            level4: []
        };

        // Direct referrals (Level 1)
        network.level1 = this.referralChain[userCode] || [];

        // Build level 2-4 network
        network.level1.forEach(referral => {
            const level2 = this.referralChain[referral.referredUser] || [];
            network.level2.push(...level2);

            level2.forEach(l2Referral => {
                const level3 = this.referralChain[l2Referral.referredUser] || [];
                network.level3.push(...level3);

                level3.forEach(l3Referral => {
                    const level4 = this.referralChain[l3Referral.referredUser] || [];
                    network.level4.push(...level4);
                });
            });
        });

        return network;
    }

    // Trigger commission events
    triggerCommissionEvent(eventType, detail) {
        const event = new CustomEvent(eventType, {
            detail: detail
        });
        document.dispatchEvent(event);
    }

    // Export referral data (for backup)
    exportReferralData() {
        return {
            referralChain: this.referralChain,
            pendingCommissions: this.pendingCommissions,
            paidCommissions: this.paidCommissions,
            userReferralCode: this.userReferralCode,
            exportDate: new Date().toISOString()
        };
    }

    // Import referral data (for restore)
    importReferralData(data) {
        try {
            if (data.referralChain) this.referralChain = data.referralChain;
            if (data.pendingCommissions) this.pendingCommissions = data.pendingCommissions;
            if (data.paidCommissions) this.paidCommissions = data.paidCommissions;
            if (data.userReferralCode) this.userReferralCode = data.userReferralCode;
            
            this.saveReferralData();
            console.log('✅ Referral data imported successfully');
            
            return { success: true, message: 'Data imported successfully' };
        } catch (error) {
            console.error('❌ Error importing referral data:', error);
            return { success: false, message: 'Error importing data' };
        }
    }
}

// Create global referral manager instance
window.referralManager = new ReferralManager();

// Export for module use (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReferralManager;
}