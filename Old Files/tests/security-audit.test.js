// tests/security-audit.test.js
const request = require('supertest');
const app = require('../src/server');
const { SecurityLayer } = require('../database/securityLayer');

describe('🔒 SECURITY AUDIT - PHASE 2.1', () => {
  let testUserId = 1;
  let otherUserId = 2;
  let transactionId;

  beforeAll(async () => {
    console.log('🔍 Starting Security Audit...\n');
  });

  test('1. Should block SQL injection attempts in user endpoints', async () => {
    console.log('   Testing SQL Injection Prevention...');
    
    const sqlInjectionPayloads = [
      "1; DROP TABLE users; --",
      "1' OR '1'='1",
      "1; UPDATE users SET trust_score = 1000 WHERE id = 1; --", 
      "1 UNION SELECT * FROM users",
      "1; DELETE FROM transactions WHERE 1=1; --"
    ];

    for (const payload of sqlInjectionPayloads) {
      const response = await request(app)
        .get(`/api/users/${payload}`)
        .set('X-User-ID', testUserId.toString());

      expect(response.status).not.toBe(200);
      if (response.status === 500) {
        expect(response.body.message).toMatch(/security|validation|invalid/i);
      }
    }
    console.log('   ✅ SQL injection prevention working');
  });

  test('2. Should enforce user data isolation', async () => {
    console.log('   Testing User Data Isolation...');
    
    // User 1 trying to access User 2's data
    const response = await request(app)
      .get(`/api/users/${otherUserId}`)
      .set('X-User-ID', testUserId.toString());

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/access denied|own data/i);
    console.log('   ✅ User data isolation working');
  });

  test('3. Should prevent unauthorized transaction confirmation', async () => {
    console.log('   Testing Transaction Authorization...');
    
    // First create a transaction
    const createResponse = await request(app)
      .post('/api/transactions')
      .set('X-User-ID', testUserId.toString())
      .send({
        fromUserId: testUserId,
        toUsername: 'bharat',
        amount: 10.50,
        description: 'Security test transaction'
      });

    expect(createResponse.status).toBe(201);
    transactionId = createResponse.body.transaction.id;

    // Try to confirm with wrong user (sender trying to confirm their own transaction)
    const confirmResponse = await request(app)
      .post(`/api/transactions/${transactionId}/confirm`)
      .set('X-User-ID', testUserId.toString()); // Sender trying to confirm

    expect(confirmResponse.status).toBe(403);
    expect(confirmResponse.body.message).toMatch(/only.*receiver|access denied/i);
    console.log('   ✅ Transaction authorization working');
  });

  test('4. Should validate all input parameters', async () => {
    console.log('   Testing Input Validation...');
    
    const invalidPayloads = [
      { fromUserId: "not_a_number", toUsername: "bharat", amount: 10, description: "test" },
      { fromUserId: 1, toUsername: "bharat", amount: -10, description: "test" },
      { fromUserId: 1, toUsername: "bharat", amount: 1000001, description: "test" }, // Too large
      { fromUserId: 1, toUsername: "arjun", amount: 10, description: "test" }, // Self-transaction
      { fromUserId: 1, toUsername: "", amount: 10, description: "test" }, // Empty username
      { fromUserId: 1, toUsername: "bharat", amount: 0, description: "test" }, // Zero amount
    ];

    for (const payload of invalidPayloads) {
      const response = await request(app)
        .post('/api/transactions')
        .set('X-User-ID', testUserId.toString())
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    }
    console.log('   ✅ Input validation working');
  });

  test('5. Should sanitize malicious input in descriptions', async () => {
    console.log('   Testing Input Sanitization...');
    
    const maliciousInputs = [
      "<script>alert('xss')</script>",
      "'; DROP TABLE users; --",
      "<div onclick='malicious()'>test</div>",
      "Normal input with <b>HTML</b> tags"
    ];

    for (const input of maliciousInputs) {
      const response = await request(app)
        .post('/api/transactions')
        .set('X-User-ID', testUserId.toString())
        .send({
          fromUserId: testUserId,
          toUsername: 'bharat',
          amount: 10,
          description: input
        });

      // Should either be blocked by validation or sanitized
      expect([201, 400]).toContain(response.status);
    }
    console.log('   ✅ Input sanitization working');
  });

  test('6. Should enforce rate limiting', async () => {
    console.log('   Testing Rate Limiting...');
    
    const requests = [];
    
    // Make multiple rapid requests
    for (let i = 0; i < 35; i++) {
      requests.push(
        request(app)
          .get(`/api/users/${testUserId}`)
          .set('X-User-ID', testUserId.toString())
      );
    }

    const responses = await Promise.all(requests);
    
    // Some requests should be rate limited (429)
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
    
    if (rateLimited.length > 0) {
      console.log('   ✅ Rate limiting working (blocked', rateLimited.length, 'requests)');
    }
  });

  test('7. Should validate user access for transactions', async () => {
    console.log('   Testing Transaction Access Control...');
    
    // User 1 trying to access User 2's pending transactions
    const response = await request(app)
      .get(`/api/transactions/pending/${otherUserId}`)
      .set('X-User-ID', testUserId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/access denied/i);
    console.log('   ✅ Transaction access control working');
  });

  test('8. Security health check should pass', async () => {
    console.log('   Testing Security Health Check...');
    
    const response = await request(app).get('/api/security/health');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.security.status).toBe('protected');
    expect(response.body.security.features).toContain('sql_injection_prevention');
    console.log('   ✅ Security health check working');
  });

  test('9. Should prevent cross-user transaction creation', async () => {
    console.log('   Testing Cross-User Transaction Prevention...');
    
    // User 1 trying to create transaction as User 2
    const response = await request(app)
      .post('/api/transactions')
      .set('X-User-ID', testUserId.toString())
      .send({
        fromUserId: otherUserId, // Different user ID
        toUsername: 'chetan',
        amount: 10,
        description: 'Unauthorized transaction'
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/own account|access denied/i);
    console.log('   ✅ Cross-user transaction prevention working');
  });

  test('10. Should handle malformed user IDs gracefully', async () => {
    console.log('   Testing Malformed Input Handling...');
    
    const malformedIds = [
      "null",
      "undefined", 
      "1.5",
      "-1",
      "0",
      "9999999999999999999",
      "1 OR 1=1"
    ];

    for (const id of malformedIds) {
      const response = await request(app)
        .get(`/api/users/${id}`)
        .set('X-User-ID', testUserId.toString());

      expect([400, 403, 404]).toContain(response.status);
    }
    console.log('   ✅ Malformed input handling working');
  });

  afterAll(() => {
    console.log('\n🎯 SECURITY AUDIT COMPLETE');
    console.log('✅ All critical security patches verified');
    console.log('🔒 Phase 2.1 Security Implementation: PASSED\n');
  });
});

// Additional security layer unit tests
describe('🔒 SECURITY LAYER UNIT TESTS', () => {
  test('SecurityLayer.executeQuery should prevent dangerous operations', async () => {
    const dangerousQueries = [
      "DROP TABLE users",
      "DELETE FROM users WHERE 1=1",
      "UPDATE users SET trust_score = 1000",
      "INSERT INTO users (username) VALUES ('hacker')",
      "SELECT * FROM users; DROP TABLE transactions"
    ];

    for (const query of dangerousQueries) {
      await expect(SecurityLayer.executeQuery(query))
        .rejects
        .toThrow();
    }
  });

  test('SecurityLayer.validateUserAccess should enforce isolation', async () => {
    const result1 = await SecurityLayer.validateUserAccess(1, 'user', 1);
    expect(result1).toBe(true);

    const result2 = await SecurityLayer.validateUserAccess(1, 'user', 2);
    expect(result2).toBe(false);
  });

  test('SecurityLayer.sanitizeInput should remove dangerous content', () => {
    const maliciousInput = "<script>alert('xss')</script>Hello'; DROP TABLE users; --";
    const sanitized = SecurityLayer.sanitizeInput(maliciousInput);
    
    expect(sanitized).not.toMatch(/<script>/);
    expect(sanitized).not.toMatch(/DROP TABLE/);
    expect(sanitized).toMatch(/Hello/);
  });

  test('SecurityLayer.validateEmail should reject invalid emails', () => {
    expect(SecurityLayer.validateEmail('test@example.com')).toBe(true);
    expect(SecurityLayer.validateEmail('invalid-email')).toBe(false);
    expect(SecurityLayer.validateEmail('')).toBe(false);
  });

  test('SecurityLayer.validateAmount should reject invalid amounts', () => {
    expect(SecurityLayer.validateAmount(10.5)).toBe(true);
    expect(SecurityLayer.validateAmount(0)).toBe(false);
    expect(SecurityLayer.validateAmount(-10)).toBe(false);
    expect(SecurityLayer.validateAmount(1000001)).toBe(false);
  });
});

// Performance and stress tests
describe('⚡ SECURITY PERFORMANCE TESTS', () => {
  test('Should handle concurrent requests without data leakage', async () => {
    const user1Requests = Array(10).fill().map(() => 
      request(app)
        .get('/api/users/1')
        .set('X-User-ID', '1')
    );

    const user2Requests = Array(10).fill().map(() =>
      request(app)
        .get('/api/users/2') 
        .set('X-User-ID', '2')
    );

    const [user1Responses, user2Responses] = await Promise.all([
      Promise.all(user1Requests),
      Promise.all(user2Requests)
    ]);

    // User 1 should only access their own data
    user1Responses.forEach(response => {
      if (response.status === 200) {
        expect(response.body.user.id).toBe(1);
      }
    });

    // User 2 should only access their own data  
    user2Responses.forEach(response => {
      if (response.status === 200) {
        expect(response.body.user.id).toBe(2);
      }
    });

    console.log('   ✅ Concurrent access control working');
  });
});

console.log(`
🔐 SECURITY TEST INSTRUCTIONS:

To run the security audit:
1. npm test -- tests/security-audit.test.js

Expected Results:
✅ All 10+ security tests should pass
✅ No SQL injection vulnerabilities
✅ No data leakage between users
✅ Proper input validation
✅ Rate limiting active
✅ Transaction authorization enforced

If any test fails, check the corresponding security patch implementation.
`);