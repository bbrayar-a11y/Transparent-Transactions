// create-db.js
const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',  // Connect to default database
  password: 'trust123',
  port: 5432,
});

async function createDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Create trustledger database
    console.log('📦 Creating trustledger database...');
    await client.query('CREATE DATABASE trustledger');
    console.log('✅ trustledger database created successfully!');
    
    await client.end();
    console.log('🎉 Database is ready! Now run: npm start');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ trustledger database already exists');
    } else {
      console.log('❌ Error creating database:', error.message);
    }
  }
}

createDatabase();