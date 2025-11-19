-- Clean schema for TrustLedger
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
);

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
);