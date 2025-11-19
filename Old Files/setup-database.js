// setup-database.js
const { Client } = require('pg');

async function setupDatabase() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'trust123',
    port: 5432,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Create database
    await client.query('CREATE DATABASE trustledger');
    console.log('✅ trustledger database created');
    
    await client.end();
    console.log('🎉 Database created successfully!');
    console.log('💡 Now run: npm start');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ trustledger database already exists');
      console.log('💡 Now run: npm start');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

setupDatabase();