-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed China Rate Description
INSERT INTO settings (key, value, description) 
VALUES ('china_rate_description', 'Rate starts from 30 naira per kg.', 'Description of shipping rates from China')
ON CONFLICT (key) DO NOTHING;
