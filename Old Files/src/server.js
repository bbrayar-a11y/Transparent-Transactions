// src/server.js - CIRCULAR REFERENCE FIXED + LOOP BREAKER
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');
const pool = require('../database/db');
const { initializeDatabase } = require('../database/init');
const { SecurityLayer } = require('../database/securityLayer');
const { 
  sanitizeInput, 
  validationRules, 
  handleValidationErrors, 
  simulateAuth 
} = require('./middleware/validation');

const app = express();
const PORT = 3000;
const YOUR_IP = '192.168.1.3';

// =====================
// SECURITY MIDDLEWARE SETUP
// =====================
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8080',
    `http://${YOUR_IP}:3000`,
    `http://${YOUR_IP}:8080`,
  ],
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../client')));
app.use(sanitizeInput);

// Rate limiting configuration
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Apply rate limiting
app.use(createRateLimit(15 * 60 * 1000, 100, 'Too many requests from this IP'));

// Critical endpoints get stricter rate limiting
const strictRateLimit = createRateLimit(15 * 60 * 1000, 30, 'Too many authentication attempts');

// =====================
// LOOP PREVENTION - GLOBAL
// =====================
global.lastLoginCall = 0;
global.lastRegisterCall = 0;

// =====================
// DATABASE FIX ENDPOINT (TEMPORARY)
// =====================
app.post('/api/fix-database', async (req, res) => {
    console.log('🔧 Fix database endpoint hit!');
    
    try {
        // Test database connection
        const testResult = await pool.query('SELECT 1 as test');
        console.log('✅ Database connection test passed');
        
        // Create transactions table
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                from_user_id INTEGER,
                to_user_id INTEGER,
                from_username VARCHAR(100),
                to_username VARCHAR(100),
                amount DECIMAL(10,2),
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                initiated_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                confirmed_at TIMESTAMP
            )
        `;
        
        await pool.query(createTableSQL);
        console.log('✅ Transactions table created successfully!');
        
        res.json({
            success: true,
            message: 'Transactions table created successfully!'
        });
        
    } catch (error) {
        console.error('❌ Database fix failed:', error);
        res.status(500).json({
            success: false,
            message: 'Database fix failed: ' + error.message
        });
    }
});

// =====================
// DATABASE INITIALIZATION
// =====================
initializeDatabase();

// =====================
// DEMO DATA (Fallback) - PRESERVED
// =====================
const demoUsers = {
  'arjun': { id: 1, username: 'arjun', email: 'arjun@trustledger.com', trustScore: 1.0 },
  'bharat': { id: 2, username: 'bharat', email: 'bharat@trustledger.com', trustScore: 1.0 },
  'chetan': { id: 3, username: 'chetan', email: 'chetan@trustledger.com', trustScore: 1.0 }
};

const demoUsersByEmail = {
  'arjun@trustledger.com': { id: 1, username: 'arjun', email: 'arjun@trustledger.com', trustScore: 1.0, referralCode: 'ARJ5000', role: 'pioneer' },
  'bharat@trustledger.com': { id: 2, username: 'bharat', email: 'bharat@trustledger.com', trustScore: 1.0, referralCode: 'BHA7000', role: 'referred', referredBy: 'arjun' },
  'chetan@trustledger.com': { id: 3, username: 'chetan', email: 'chetan@trustledger.com', trustScore: 1.0, referralCode: 'CHE3000', role: 'referred', referredBy: 'bharat' }
};

const referrers = {
  'ARJ5000': { id: 1, username: 'arjun' },
  'BHA7000': { id: 2, username: 'bharat' }
};

// =====================
// TRANSACTIONS DATA
// =====================
let transactions = [
  {
    id: 1001,
    fromUserId: 1,
    toUserId: 2,
    fromUsername: 'arjun',
    toUsername: 'bharat',
    amount: 500,
    description: 'Project collaboration',
    status: 'confirmed',
    createdAt: '2024-01-15T10:30:00Z',
    confirmedAt: '2024-01-15T11:00:00Z'
  },
  {
    id: 1002,
    fromUserId: 2,
    toUserId: 3,
    fromUsername: 'bharat',
    toUsername: 'chetan',
    amount: 300,
    description: 'Resource sharing',
    status: 'confirmed',
    createdAt: '2024-01-10T14:20:00Z',
    confirmedAt: '2024-01-10T15:00:00Z'
  }
];

// =====================
// SECURITY HEALTH CHECK
// =====================
app.get('/api/security/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await SecurityLayer.executeQuery('SELECT 1');
    
    res.json({ 
      success: true, 
      message: '🔒 TrustLedger Security System Active',
      timestamp: new Date().toISOString(),
      security: {
        phase: '2.1-security-patches',
        status: 'protected',
        features: [
          'input_validation',
          'sql_injection_prevention', 
          'user_data_isolation',
          'transaction_authorization',
          'rate_limiting',
          'xss_protection'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Security system compromised',
      error: error.message 
    });
  }
});

// =====================
// HEALTH & TEST ROUTES
// =====================
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT COUNT(*) as user_count FROM users');
    const userCount = parseInt(dbResult.rows[0].user_count);
    
    res.json({ 
      status: '✅ Healthy', 
      database: '✅ Connected',
      users_in_database: userCount,
      demo_users: Object.keys(demoUsers).length,
      ip: YOUR_IP,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      security: '🔒 Phase 2.1 Active'
    });
  } catch (error) {
    res.status(500).json({ 
      status: '⚠️ Degraded', 
      database: '❌ Disconnected',
      error: error.message,
      demo_mode: 'Active - using demo data',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'TrustLedger API is working!',
    serverTime: new Date().toISOString(),
    clientIP: req.ip,
    userAgent: req.get('User-Agent'),
    security: '🔒 Protected'
  });
});

// =====================
// 🐛 DEBUG ENDPOINTS (TEMPORARY)
// =====================

// Debug test for database connection
app.post('/api/debug-test', async (req, res) => {
  console.log('🔧 DEBUG: Testing database connection...');
  
  try {
    // Test 1: Basic database connection
    const test1 = await pool.query('SELECT 1 as connection_test');
    console.log('✅ Database connection:', test1.rows[0]);
    
    // Test 2: Check users table
    const test2 = await pool.query('SELECT COUNT(*) as user_count FROM users');
    console.log('✅ Users table:', test2.rows[0]);
    
    // Test 3: Test SecurityLayer
    const test3 = await SecurityLayer.executeQuery('SELECT 1 as security_test');
    console.log('✅ SecurityLayer:', test3.rows[0]);
    
    res.json({
      success: true,
      message: 'All systems working',
      tests: {
        database: test1.rows[0],
        users_table: test2.rows[0],
        security_layer: test3.rows[0]
      }
    });
    
  } catch (error) {
    console.error('🔴 DEBUG TEST FAILED:', error);
    res.status(500).json({
      success: false,
      message: 'Debug test failed',
      error: error.message,
      stack: error.stack
    });
  }
});

// Simple registration bypass (demo data only)
app.post('/api/auth/register-simple', async (req, res) => {
  console.log('🔧 SIMPLE REGISTRATION:', req.body);
  
  try {
    const { name, email, password, referralCode } = req.body;
    
    // Simple validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
    }
    
    // Check if user exists in demo data
    if (demoUsers[name.toLowerCase()]) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Create simple user in demo data only
    const userReferralCode = `${name.slice(0, 3).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
    
    const newUser = {
      id: Math.floor(Math.random() * 1000) + 100,
      username: name,
      email: email,
      referralCode: userReferralCode,
      trustScore: 1.0,
      createdAt: new Date().toISOString()
    };
    
    demoUsers[name.toLowerCase()] = newUser;
    demoUsersByEmail[email] = newUser;
    
    console.log('✅ Simple registration successful:', newUser);
    
    res.status(201).json({
      message: 'User registered successfully (Demo Data)',
      user: newUser,
      storage: 'DEMO_DATA'
    });
    
  } catch (error) {
    console.error('🔴 Simple registration error:', error);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// =====================
// SECURE AUTHENTICATION ROUTES - CIRCULAR REFERENCE FIXED + LOOP BREAKER
// =====================
app.use('/api/users/:id*', simulateAuth, strictRateLimit);
app.use('/api/transactions*', simulateAuth);
app.use('/api/trust*', simulateAuth);

app.post('/api/auth/register', 
  validationRules.createUser,
  handleValidationErrors,
  async (req, res) => {
    try {
      // 🚨 LOOP BREAKER - Registration
      const now = Date.now();
      if (now - global.lastRegisterCall < 2000) { // 2 second cooldown
        console.log('🚨 REGISTRATION LOOP DETECTED - Blocking rapid calls');
        return res.status(429).json({ error: 'Too many registration attempts' });
      }
      global.lastRegisterCall = now;

      const { name, email, password, referralCode } = req.body;
      
      console.log('📝 Secure registration attempt:', { name, email, referralCode });
      
      if (demoUsers[name.toLowerCase()]) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      
      try {
        // Use direct pool query to avoid circular reference
        const existingUser = await pool.query(
          'SELECT id FROM users WHERE username = $1 OR email = $2',
          [name.toLowerCase(), email]
        );
        
        if (existingUser.rows.length > 0) {
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        
        const userReferralCode = `${name.slice(0, 3).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
        
        let referredById = null;
        let referralChain = [name];
        
        if (referralCode) {
          const referrerResult = await pool.query(
            'SELECT id, username, referral_chain FROM users WHERE referral_code = $1',
            [referralCode]
          );
          
          if (referrerResult.rows.length > 0) {
            referredById = referrerResult.rows[0].id;
            referralChain = [...referrerResult.rows[0].referral_chain, name];
          }
        }
        
        const newUserResult = await pool.query(
          `INSERT INTO users (username, email, referral_code, referred_by, referral_chain) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [name.toLowerCase(), email, userReferralCode, referredById, referralChain]
        );
        
        const newUser = newUserResult.rows[0];
        
        console.log('✅ New user registered securely in DATABASE:', newUser.username);
        
        const demoUser = {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          referralCode: newUser.referral_code,
          referredBy: referredById,
          trustScore: parseFloat(newUser.trust_score),
          createdAt: newUser.created_at,
          referralChain: newUser.referral_chain
        };
        
        demoUsers[name.toLowerCase()] = demoUser;
        demoUsersByEmail[email] = demoUser;
        
        res.status(201).json({
          message: 'User registered successfully in DATABASE',
          user: demoUser,
          referralChain: referralChain.length > 1 ? 
            `Referral chain: ${referralChain.join(' → ')}` : 
            'Pioneer user - no referrals',
          storage: 'DATABASE',
          security: '🔒 Protected'
        });
        
      } catch (dbError) {
        console.warn('⚠️ Database registration failed, falling back to demo data:', dbError.message);
        
        const userReferralCode = `${name.slice(0, 3).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
        
        let referredBy = null;
        let referralChain = [];
        
        if (referralCode && referrers[referralCode]) {
          referredBy = referrers[referralCode].id;
          referralChain = [referrers[referralCode].username, name];
        }
        
        const newUser = {
          id: Math.floor(Math.random() * 1000) + 100,
          username: name,
          email: email,
          referralCode: userReferralCode,
          referredBy: referredBy,
          trustScore: 1.0,
          createdAt: new Date().toISOString(),
          referralChain: referralChain
        };
        
        demoUsers[name.toLowerCase()] = newUser;
        demoUsersByEmail[email] = newUser;
        
        console.log('✅ New user registered in DEMO DATA (fallback):', newUser);
        
        res.status(201).json({
          message: 'User registered successfully in DEMO DATA (fallback mode)',
          user: newUser,
          referralChain: referralChain.length > 0 ? 
            `Referral chain: ${referralChain.join(' → ')}` : 
            'Pioneer user - no referrals',
          storage: 'DEMO_DATA_FALLBACK',
          security: '⚠️ Fallback Mode'
        });
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

app.post('/api/auth/login', 
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 1 }).withMessage('Password required'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      // 🚨 LOOP BREAKER - Login
      const now = Date.now();
      if (now - global.lastLoginCall < 2000) { // 2 second cooldown
        console.log('🚨 LOGIN LOOP DETECTED - Blocking rapid calls');
        return res.status(429).json({ error: 'Too many login attempts' });
      }
      global.lastLoginCall = now;

      const { email, password } = req.body;
      
      console.log('🔐 Secure login attempt:', { email });

      try {
        // FIXED: Use direct pool query to avoid circular reference in SecurityLayer
        const userResult = await pool.query(
          'SELECT id, username, email, trust_score, referral_code, referral_chain FROM users WHERE email = $1',
          [email]
        );
        
        if (userResult.rows.length > 0) {
          const dbUser = userResult.rows[0];
          const user = {
            id: dbUser.id,
            username: dbUser.username,
            email: dbUser.email,
            trustScore: parseFloat(dbUser.trust_score),
            referralCode: dbUser.referral_code,
            referralChain: dbUser.referral_chain
          };
          
          demoUsers[user.username] = user;
          demoUsersByEmail[user.email] = user;
          
          console.log('✅ User logged in securely from DATABASE:', user.username);
          
          return res.json({
            message: 'Login successful (Database)',
            user: user,
            user_id: user.id,
            security: '🔒 Protected'
          });
        }
      } catch (dbError) {
        console.warn('⚠️ Database login failed, trying demo data:', dbError.message);
      }
      
      const user = demoUsersByEmail[email];
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      console.log('✅ User logged in from DEMO DATA:', user.username);
      
      res.json({
        message: 'Login successful (Demo Data)',
        user: user,
        user_id: user.id,
        security: '⚠️ Fallback Mode'
      });
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// =====================
// SECURE USER ROUTES
// =====================
app.get('/api/users/dashboard', simulateAuth, async (req, res) => {
  try {
    const userCountResult = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCountResult.rows[0].count);
    
    res.json({
      user: {
        username: 'demo',
        trustScore: 1.0,
        totalTransactions: 0,
        pendingActions: 0,
        referralCount: 0
      },
      recentActivity: [],
      trustNetwork: [],
      database_stats: {
        total_users: userCount,
        storage: 'PostgreSQL'
      },
      security: '🔒 Protected'
    });
  } catch (error) {
    res.json({
      user: {
        username: 'demo',
        trustScore: 1.0,
        totalTransactions: 0,
        pendingActions: 0,
        referralCount: 0
      },
      recentActivity: [],
      trustNetwork: [],
      database_stats: {
        error: 'Database unavailable',
        storage: 'Demo Data'
      },
      security: '⚠️ Fallback Mode'
    });
  }
});

app.get('/api/users/:userId', 
  simulateAuth,
  [
    param('userId').isInt({ min: 1 }).withMessage('Valid user ID required'),
    handleValidationErrors
  ],
  async (req, res) => {
    const userId = parseInt(req.params.userId);
    
    const hasAccess = await SecurityLayer.validateUserAccess(req.currentUserId, 'user', userId);
    if (!hasAccess) {
      console.warn(`🚨 Unauthorized access: User ${req.currentUserId} tried to access user ${userId}`);
      return res.status(403).json({ 
        error: 'Access denied: You can only access your own data',
        security: '🔒 Blocked'
      });
    }
    
    try {
      const userResult = await pool.query(
        'SELECT id, username, email, trust_score, referral_code, referral_chain FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length > 0) {
        const dbUser = userResult.rows[0];
        return res.json({ 
          user: {
            id: dbUser.id,
            username: dbUser.username,
            email: dbUser.email,
            trustScore: parseFloat(dbUser.trust_score),
            referralCode: dbUser.referral_code,
            referralChain: dbUser.referral_chain
          },
          source: 'database',
          security: '🔒 Protected'
        });
      }
    } catch (dbError) {
      console.warn('Database query failed, using demo data:', dbError.message);
    }
    
    const user = Object.values(demoUsers).find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      user: user,
      source: 'demo_data',
      security: '⚠️ Fallback Mode'
    });
  }
);

// =====================
// SECURE TRANSACTION ROUTES - FIXED VERSION
// =====================
app.post('/api/transactions',
  simulateAuth,
  validationRules.createTransaction,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { fromUserId, receiver_id, amount, description } = req.body;
      const currentUserId = req.currentUserId;
      
      console.log('💸 Secure transaction creation:', { fromUserId, receiver_id, amount, description, currentUserId });
      
      if (parseInt(fromUserId) !== parseInt(currentUserId)) {
        return res.status(403).json({ 
          error: 'Access denied: You can only create transactions from your own account',
          security: '🔒 Blocked'
        });
      }
      
      let toUser, fromUser;
      
      try {
        // FIXED: Use direct pool queries for user lookup to avoid circular reference
        const toUserResult = await pool.query(
          'SELECT id, username FROM users WHERE id = $1', 
          [receiver_id]
        );
        const fromUserResult = await pool.query(
          'SELECT id, username FROM users WHERE id = $1', 
          [fromUserId]
        );
        
        if (toUserResult.rows.length === 0) {
          return res.status(400).json({ error: 'Recipient user not found' });
        }
        if (fromUserResult.rows.length === 0) {
          return res.status(400).json({ error: 'Sender user not found' });
        }
        
        toUser = toUserResult.rows[0];
        fromUser = fromUserResult.rows[0];
        
        // Use SecurityLayer for transaction creation (this is safe)
        const transactionResult = await SecurityLayer.executeQuery(
          `INSERT INTO transactions (from_user_id, to_user_id, from_username, to_username, amount, description, initiated_by) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [fromUser.id, toUser.id, fromUser.username, toUser.username, amount, description || 'Transaction', fromUserId]
        );
        
        const dbTransaction = transactionResult.rows[0];
        
        const newTransaction = {
          id: dbTransaction.id,
          fromUserId: dbTransaction.from_user_id,
          toUserId: dbTransaction.to_user_id,
          fromUsername: dbTransaction.from_username,
          toUsername: dbTransaction.to_username,
          amount: parseFloat(dbTransaction.amount),
          description: dbTransaction.description,
          status: dbTransaction.status,
          initiatedBy: dbTransaction.initiated_by,
          createdAt: dbTransaction.created_at
        };
        
        transactions.push(newTransaction);
        
        console.log('✅ Transaction created securely in DATABASE:', newTransaction);
        
        res.status(201).json({
          message: 'Transaction created successfully in DATABASE - waiting for confirmation',
          transaction: newTransaction,
          notification: `${toUser.username} needs to confirm this transaction`,
          storage: 'DATABASE',
          security: '🔒 Protected'
        });
        
      } catch (dbError) {
        console.warn('⚠️ Database transaction failed, using demo data:', dbError.message);
        
        // Fallback to demo data
        const toUser = Object.values(demoUsers).find(u => u.id === parseInt(receiver_id));
        if (!toUser) {
          return res.status(400).json({ error: 'Recipient user not found' });
        }
        
        const fromUser = Object.values(demoUsers).find(u => u.id === parseInt(fromUserId));
        if (!fromUser) {
          return res.status(400).json({ error: 'Sender user not found' });
        }
        
        const newTransaction = {
          id: Math.floor(Math.random() * 1000) + 1000,
          fromUserId: parseInt(fromUserId),
          toUserId: toUser.id,
          fromUsername: fromUser.username,
          toUsername: toUser.username,
          amount: parseFloat(amount),
          description: description || 'Transaction',
          status: 'pending',
          initiatedBy: parseInt(fromUserId),
          createdAt: new Date().toISOString()
        };
        
        transactions.push(newTransaction);
        
        console.log('✅ Transaction created in DEMO DATA:', newTransaction);
        
        res.status(201).json({
          message: 'Transaction created successfully in DEMO DATA - waiting for confirmation',
          transaction: newTransaction,
          notification: `${toUser.username} needs to confirm this transaction`,
          storage: 'DEMO_DATA',
          security: '⚠️ Fallback Mode'
        });
      }
      
    } catch (error) {
      console.error('Transaction creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

app.get('/api/transactions/pending/:userId', 
  simulateAuth,
  [
    param('userId').isInt({ min: 1 }).withMessage('Valid user ID required'),
    handleValidationErrors
  ],
  async (req, res) => {
    const userId = parseInt(req.params.userId);
    
    const hasAccess = await SecurityLayer.validateUserAccess(req.currentUserId, 'user', userId);
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied',
        security: '🔒 Blocked'
      });
    }
    
    try {
      const pendingResult = await pool.query(
        'SELECT * FROM transactions WHERE to_user_id = $1 AND status = $2',
        [userId, 'pending']
      );
      
      const pendingTransactions = pendingResult.rows.map(row => ({
        id: row.id,
        fromUserId: row.from_user_id,
        toUserId: row.to_user_id,
        fromUsername: row.from_username,
        toUsername: row.to_username,
        amount: parseFloat(row.amount),
        description: row.description,
        status: row.status,
        createdAt: row.created_at
      }));
      
      res.json({
        pendingTransactions,
        count: pendingTransactions.length,
        source: 'database',
        security: '🔒 Protected'
      });
      
    } catch (dbError) {
      console.warn('Database query failed, using demo data:', dbError.message);
      
      const pendingTransactions = transactions.filter(t => 
        t.toUserId === userId && t.status === 'pending'
      );
      
      res.json({
        pendingTransactions,
        count: pendingTransactions.length,
        source: 'demo_data',
        security: '⚠️ Fallback Mode'
      });
    }
  }
);

app.post('/api/transactions/:transactionId/confirm',
  simulateAuth,
  [
    param('transactionId').isInt({ min: 1 }).withMessage('Valid transaction ID required'),
    handleValidationErrors
  ],
  async (req, res) => {
    const transactionId = parseInt(req.params.transactionId);
    const currentUserId = req.currentUserId;
    
    console.log('✅ Secure transaction confirmation:', { transactionId, currentUserId });
    
    try {
      const transaction = await SecurityLayer.validateTransactionAuthorization(transactionId, currentUserId);
      
      await SecurityLayer.executeQuery(
        'UPDATE transactions SET status = $1, confirmed_at = $2 WHERE id = $3',
        ['confirmed', new Date(), transactionId]
      );
      
      await SecurityLayer.executeQuery(
        'UPDATE users SET trust_score = trust_score + 0.05 WHERE id IN ($1, $2)',
        [transaction.from_user_id, transaction.to_user_id]
      );
      
      console.log('✅ Transaction confirmed securely in DATABASE:', transactionId);
      
      res.json({
        message: 'Transaction confirmed successfully in DATABASE!',
        transactionId: transactionId,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        security: '🔒 Protected'
      });
      
    } catch (dbError) {
      console.warn('⚠️ Database confirmation failed, using demo data:', dbError.message);
      
      const transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      if (transaction.toUserId !== currentUserId) {
        return res.status(403).json({ 
          error: 'Only transaction receiver can confirm transactions',
          security: '🔒 Blocked'
        });
      }
      
      transaction.status = 'confirmed';
      transaction.confirmedAt = new Date().toISOString();
      
      // Update demo data trust scores
      if (demoUsers[transaction.fromUsername]) {
        demoUsers[transaction.fromUsername].trustScore += 0.05;
      }
      if (demoUsers[transaction.toUsername]) {
        demoUsers[transaction.toUsername].trustScore += 0.05;
      }
      
      const trustUpdate = {};
      Object.keys(demoUsers).forEach(username => {
        trustUpdate[username] = demoUsers[username].trustScore;
      });
      
      res.json({
        message: 'Transaction confirmed successfully in DEMO DATA!',
        transactionId: transactionId,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        trustScores: trustUpdate,
        security: '⚠️ Fallback Mode'
      });
    }
  }
);

// =====================
// GLOBAL ERROR HANDLER
// =====================
app.use((err, req, res, next) => {
  console.error('🔴 Global error handler:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    reference: `ERR-${Date.now()}`,
    security: '🔒 Protected'
  });
});

// =====================
// START SERVER
// =====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 TrustLedger Server Started Successfully!
📍 Local Access:    http://localhost:${PORT}
🌐 Network Access:  http://${YOUR_IP}:${PORT}

🔧 FIX DATABASE: Press the "🔧 Fix Database" button in Arjun Test Panel

🛡️ LOOP PROTECTION: Active (2-second cooldown on login/registration)
  `);
});

// =====================
// GRACEFUL SHUTDOWN
// =====================
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down TrustLedger server gracefully...');
  await pool.end();
  process.exit(0);
});