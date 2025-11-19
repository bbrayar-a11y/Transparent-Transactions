// database/db.js
const { Pool } = require('pg');
require('dotenv').config();

console.log('🔧 Starting PostgreSQL connection...');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'trustledger',
  password: process.env.DB_PASSWORD || 'trust123',
  port: process.env.DB_PORT || 5432,
});

// Test connection
pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ PostgreSQL connected successfully');
  })
  .catch((error) => {
    console.log('❌ PostgreSQL connection failed:', error.message);
  });

module.exports = pool;