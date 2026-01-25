-- Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(12, 2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'NGN',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_wallet UNIQUE (user_id)
);

-- Wallet Transactions Table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')), -- credit (funding), debit (payment)
    amount DECIMAL(12, 2) NOT NULL,
    balance_before DECIMAL(12, 2) NOT NULL,
    balance_after DECIMAL(12, 2) NOT NULL,
    reference VARCHAR(100), -- External ref (Paystack/Korapay) or Internal Shipment Ref
    description TEXT,
    status VARCHAR(20) DEFAULT 'success', -- success, failed, pending
    meta_data JSONB, -- Store extra details like source, admin_id, shipment_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add 'wallet' to payment methods if not exists
INSERT INTO payment_methods (provider, name, description, is_active, config)
VALUES ('wallet', 'Wallet', 'Pay using your wallet balance', true, '{}')
ON CONFLICT (provider) DO NOTHING;
