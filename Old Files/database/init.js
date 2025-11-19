// database/init.js
const pool = require('./db');

async function initializeDatabase() {
  try {
    console.log('🔄 Setting up database tables...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        trust_score DECIMAL(3,2) DEFAULT 1.00,
        referral_code VARCHAR(20) UNIQUE,
        referred_by INTEGER,
        referral_chain TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table ready');

    // Create transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER,
        to_user_id INTEGER,
        from_username VARCHAR(50) NOT NULL,
        to_username VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        initiated_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Transactions table ready');

    // Add demo users
    await addDemoUsers();
    
    console.log('✅ Database setup complete');
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
  }
}

async function addDemoUsers() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(result.rows[0].count);
    
    if (userCount === 0) {
      console.log('📦 Adding demo users...');
      
      // Insert Arjun (Pioneer)
      await pool.query(
        `INSERT INTO users (username, email, trust_score, referral_code, referral_chain) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['arjun', 'arjun@trustledger.com', 1.0, 'ARJ5000', '["arjun"]']
      );

      // Insert Bharat (referred by Arjun)
      await pool.query(
        `INSERT INTO users (username, email, trust_score, referral_code, referral_chain) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['bharat', 'bharat@trustledger.com', 1.0, 'BHA7000', '["arjun", "bharat"]']
      );

      // Insert Chetan (referred by Bharat)
      await pool.query(
        `INSERT INTO users (username, email, trust_score, referral_code, referral_chain) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['chetan', 'chetan@trustledger.com', 1.0, 'CHE3000', '["arjun", "bharat", "chetan"]']
      );

      console.log('✅ Demo users added');
    } else {
      console.log('📊 Users already exist, skipping demo data');
    }
  } catch (error) {
    console.log('⚠️ Demo users already exist or error:', error.message);
  }
}

module.exports = { initializeDatabase };