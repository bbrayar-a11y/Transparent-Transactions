// test-db.js
const { Pool } = require('pg');
require('dotenv').config();

console.log('Testing PostgreSQL connection...');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres', // Try default database first
  password: 'password', // Use your actual password
  port: 5432,
});

pool.query('SELECT NOW()')
  .then(result => {
    console.log('✅ PostgreSQL connected successfully:', result.rows[0]);
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ PostgreSQL connection failed:', error.message);
    console.log('💡 Make sure PostgreSQL is installed and running');
    process.exit(1);
  });