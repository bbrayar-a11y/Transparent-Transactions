// quick-password-test.js
const { Client } = require('pg');

const passwords = ['trust123', '', 'postgres', 'password', 'admin', '123456'];

async function testPassword(pwd) {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: pwd,
    port: 5432,
  });

  try {
    await client.connect();
    console.log(`🎉 SUCCESS! Password is: "${pwd}"`);
    await client.end();
    return true;
  } catch (error) {
    console.log(`❌ Failed: "${pwd}"`);
    return false;
  }
}

async function findPassword() {
  console.log('🔑 Testing common PostgreSQL passwords...\n');
  
  for (const pwd of passwords) {
    const success = await testPassword(pwd);
    if (success) {
      console.log(`\n💡 Update your .env file with: DB_PASSWORD=${pwd}`);
      return;
    }
  }
  
  console.log('\n❌ None worked. Please check what password you used during installation.');
}

findPassword();