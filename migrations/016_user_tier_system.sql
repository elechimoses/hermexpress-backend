-- Create user_tiers table
CREATE TABLE IF NOT EXISTS user_tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    level INTEGER NOT NULL UNIQUE,
    min_shipments INTEGER NOT NULL DEFAULT 0,
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add tier_id to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS tier_id INTEGER REFERENCES user_tiers(id) ON DELETE SET NULL;

-- Seed default Tiers
INSERT INTO user_tiers (name, level, min_shipments, discount_percentage) VALUES 
('Tier 1', 1, 0, 0),
('Tier 2', 2, 10, 5.00),
('Tier 3', 3, 50, 10.00)
ON CONFLICT (name) DO NOTHING;

-- Set default tier for existing users
-- Note: This assumes 'Tier 1' was just inserted and we want its ID
UPDATE users SET tier_id = (SELECT id FROM user_tiers WHERE level = 1) WHERE tier_id IS NULL;
