// database/securityLayer.js
const { Pool } = require('pg');
require('dotenv').config();

console.log('🔍 SECURITY_LAYER_DEBUG: Creating independent database connection...');

// Create INDEPENDENT database connection - no circular dependencies
const securityDb = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'trustledger',
  password: process.env.DB_PASSWORD || 'trust123',
  port: process.env.DB_PORT || 5432,
});

// Test the independent connection
securityDb.query('SELECT 1 as test')
  .then(() => console.log('✅ Security Layer DB connected successfully'))
  .catch(err => console.log('❌ Security Layer DB connection failed:', err.message));

class SecurityLayer {
  // Enhanced parameterized query execution with comprehensive validation
  static async executeQuery(query, params = []) {
 const debugStack = new Error().stack;
  const callerLine = debugStack.split('\n')[2] || 'Unknown';
  console.log('🚨 SECURITY_LAYER_CALLED:');
  console.log('   Query:', query.substring(0, 50) + '...');
  console.log('   Params:', params);
  console.log('   Caller:', callerLine.includes('at') ? callerLine : 'Unknown location');
  console.log('   ---');
    try {
      console.log(`🔒 Secure Query: ${query.substring(0, 100)}...`, params);

      // Validate query structure
      if (typeof query !== 'string' || query.trim() === '') {
        throw new Error('Invalid query structure');
      }

      // Block potentially dangerous operations in queries
      const dangerousPatterns = [
        /DROP\s+(TABLE|DATABASE)/i,
        /DELETE\s+FROM/i,
        /UPDATE\s+\w+\s+SET\s+\w+\s*=/i,
        /INSERT\s+INTO/i,
        /ALTER\s+TABLE/i,
        /CREATE\s+TABLE/i,
        /--/,
        /;/g
      ];

      const cleanQuery = query.replace(/;/g, '');
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(cleanQuery) && !query.includes('UPDATE transactions SET status')) {
          throw new Error('Potentially dangerous operation detected');
        }
      }

      // Sanitize parameters
      const safeParams = params.map(param => {
        if (typeof param === 'string') {
          return param
            .replace(/'/g, "''")
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .substring(0, 500); // Limit string length
        }
        return param;
      });

      // Use INDEPENDENT database connection
      const result = await securityDb.query(cleanQuery, safeParams);
      console.log(`✅ Query executed successfully, returned ${result.rows.length} rows`);
      return result;
      
    } catch (error) {
      console.error('🔴 Database Security Error:', error.message);
      
      // For critical system queries, allow fallback
      if (query.includes('SELECT') && query.includes('users') || query.includes('transactions')) {
        console.log('🔄 Critical query failed, using emergency fallback');
        throw error; // Re-throw for proper error handling upstream
      }
      
      throw new Error('Database operation failed for security reasons');
    }
  }

  // Enhanced user access validation
  static async validateUserAccess(userId, resourceType, resourceId) {
    try {
      console.log(`🔐 Validating access: User ${userId} to ${resourceType} ${resourceId}`);
      
      if (!userId || isNaN(parseInt(userId))) {
        throw new Error('Invalid user identification');
      }

      if (!resourceId || isNaN(parseInt(resourceId))) {
        throw new Error('Invalid resource identification');
      }

      const numericUserId = parseInt(userId);
      const numericResourceId = parseInt(resourceId);

      switch (resourceType) {
        case 'user':
          // Users can only access their own data
          return numericUserId === numericResourceId;
        
        case 'transaction':
          // Enhanced transaction access check
          const transactionCheck = await this.executeQuery(
            'SELECT sender_id, receiver_id, status FROM transactions WHERE id = $1',
            [resourceId]
          );
          
          if (transactionCheck.rows.length === 0) {
            throw new Error('Transaction not found');
          }
          
          const transaction = transactionCheck.rows[0];
          const isAuthorized = numericUserId === parseInt(transaction.sender_id) || 
                             numericUserId === parseInt(transaction.receiver_id);
          
          if (!isAuthorized) {
            console.warn(`🚨 Unauthorized transaction access attempt: User ${userId} tried to access transaction ${resourceId}`);
          }
          return isAuthorized;
        
        default:
          throw new Error('Invalid resource type');
      }
    } catch (error) {
      console.error('Access validation error:', error);
      return false;
    }
  }

  // Comprehensive transaction authorization
  static async validateTransactionAuthorization(transactionId, userId) {
    try {
      console.log(`🔐 Authorizing transaction: ${transactionId} for user ${userId}`);
      
      if (!transactionId || !userId) {
        throw new Error('Missing required parameters');
      }

      const result = await this.executeQuery(
        `SELECT id, sender_id, receiver_id, status, amount 
         FROM transactions 
         WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)`,
        [transactionId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Transaction not found or access denied');
      }

      const transaction = result.rows[0];
      
      // Only receiver can confirm transactions
      if (parseInt(userId) === parseInt(transaction.sender_id)) {
        throw new Error('Only transaction receiver can confirm transactions');
      }

      // Check if transaction is already completed
      if (transaction.status === 'completed') {
        throw new Error('Transaction already completed');
      }

      console.log(`✅ Transaction authorized:`, transaction);
      return transaction;
    } catch (error) {
      console.error('Transaction authorization error:', error);
      throw error;
    }
  }

  // Input sanitization for all user inputs
  static sanitizeInput(input) {
    if (typeof input === 'string') {
      return input
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/'/g, "''")
        .replace(/;/g, '')
        .substring(0, 1000); // Prevent massive input attacks
    }
    return input;
  }

  // Validate email format
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  // Validate amount (prevent negative or extremely large values)
  static validateAmount(amount) {
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount > 0 && numAmount <= 1000000; // Max 1 million
  }
}

module.exports = { SecurityLayer };