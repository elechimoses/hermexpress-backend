CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL UNIQUE, -- 'korapay', 'paystack', 'bank_transfer'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    config JSONB DEFAULT '{}', -- Stores bank details, public keys, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add payment_method snapshot to shipments table
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS payment_method JSONB; 
-- Storage format: { "provider": "bank_transfer", "name": "Bank Transfer", "details": { ... } }
