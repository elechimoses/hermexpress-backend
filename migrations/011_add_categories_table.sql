CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categories (name, description) VALUES
('Electronics', 'Electronic gadgets and devices'),
('Fashion', 'Clothing, shoes, and accessories'),
('Home & Garden', 'Items for home and gardening'),
('Beauty & Health', 'Cosmetics and health products'),
('Sports & Outdoors', 'Sporting goods and outdoor equipment')
ON CONFLICT (name) DO NOTHING;
