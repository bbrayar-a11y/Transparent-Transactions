// test-pg.js
const { Client } = require('pg');
require('dotenv').config();

console.log('🔧 Testing PostgreSQL connection...');

const client = new Client({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ Step 1: Connection successful!');
    
    const result = await client.query('SELECT NOW() as time');
    console.log('✅ Step 2: Query successful! Server time:', result.rows[0].time);
    
    // Check if trustledger database exists
    const dbCheck = await client.query(`
      SELECT datname FROM pg_database WHERE datname = 'trustledger'
    `);
    
    if (dbCheck.rows.length > 0) {
      console.log('✅ Step 3: trustledger database exists!');
    } else {
      console.log('❌ Step 3: trustledger database does not exist');
      console.log('💡 Creating trustledger database...');
      await client.query('CREATE DATABASE trustledger');
      console.log('✅ trustledger database created!');
    }
    
    await client.end();
    console.log('🎉 All tests passed! PostgreSQL is ready.');
    
  } catch (error) {
    console.log('❌ Connection failed:');
    console.log('Error:', error.message);
    console.log('\n💡 Troubleshooting steps:');
    console.log('1. Check .env file has correct password');
    console.log('2. Try these common passwords: postgres, password, admin');
    console.log('3. Check if database "trustledger" exists in pgAdmin');
    console.log('4. Verify PostgreSQL is listening on port 5432');
  }
}

testConnection();