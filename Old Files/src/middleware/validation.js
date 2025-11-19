// src/middleware/validation.js - FIXED VERSION
const { body, param, query, validationResult } = require('express-validator');
const { SecurityLayer } = require('../../database/securityLayer');

// Comprehensive input sanitization
const sanitizeInput = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = SecurityLayer.sanitizeInput(req.body[key]);
      }
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = SecurityLayer.sanitizeInput(req.query[key]);
      }
    });
  }

  // Sanitize URL parameters
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = SecurityLayer.sanitizeInput(req.params[key]);
      }
    });
  }

  next();
};

// Enhanced validation rules
const validationRules = {
  userId: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Valid user ID required')
      .custom((value, { req }) => {
        // Ensure user can only access their own data
        if (req.currentUserId && parseInt(value) !== parseInt(req.currentUserId)) {
          throw new Error('Access denied');
        }
        return true;
      })
  ],

  transactionId: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Valid transaction ID required')
  ],

  createUser: [
    body('name')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be 2-50 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Name can only contain letters and spaces'),
    
    body('email')
      .isEmail()
      .withMessage('Valid email required')
      .custom((value) => {
        if (!SecurityLayer.validateEmail(value)) {
          throw new Error('Invalid email format');
        }
        return true;
      })
      .normalizeEmail(),
    
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
  ],

  createTransaction: [
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Valid amount required (minimum 0.01)')
      .custom((value) => {
        if (!SecurityLayer.validateAmount(value)) {
          throw new Error('Invalid amount');
        }
        return true;
      }),
    
    body('description')
      .isLength({ min: 1, max: 200 })
      .withMessage('Description required (1-200 characters)')
      .escape(),
    
    body('receiver_id')
      .isInt({ min: 1 })
      .withMessage('Valid receiver ID required')
      .custom((value, { req }) => {
        if (req.currentUserId && parseInt(value) === parseInt(req.currentUserId)) {
          throw new Error('Cannot create transaction to yourself');
        }
        return true;
      })
  ],

  confirmTransaction: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Valid transaction ID required')
  ]
};

// Enhanced validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));

    console.warn('🔴 Validation failed:', {
      url: req.originalUrl,
      errors: errorMessages,
      user: req.currentUserId
    });

    return res.status(400).json({
      success: false,
      message: 'Request validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

// Authentication simulation middleware (temporary for Phase 2.1)
const simulateAuth = (req, res, next) => {
  // Get user ID from query param, body, or header
  const userId = req.query.user_id || req.body.user_id || req.headers['x-user-id'];
  
  if (!userId || isNaN(parseInt(userId))) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide valid user context.'
    });
  }

  // Set current user ID for access control
  req.currentUserId = parseInt(userId);
  next();
};

module.exports = {
  sanitizeInput,
  validationRules,
  handleValidationErrors,
  simulateAuth
};