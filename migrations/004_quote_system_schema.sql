-- Countries table
CREATE TABLE IF NOT EXISTS countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(5) UNIQUE NOT NULL, -- e.g., 'NG', 'US', 'GB'
    can_import_from BOOLEAN DEFAULT FALSE,
    can_export_to BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Nigerian Cities table
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    country_id INTEGER REFERENCES countries(id), -- Should link to Nigeria
    name VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shipment Options (e.g., Budget, Express, Sea Freight)
CREATE TABLE IF NOT EXISTS shipment_options (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    min_days INTEGER,
    max_days INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shipping Rates
CREATE TABLE IF NOT EXISTS shipping_rates (
    id SERIAL PRIMARY KEY,
    pickup_country_id INTEGER REFERENCES countries(id),
    destination_country_id INTEGER REFERENCES countries(id),
    shipment_option_id INTEGER REFERENCES shipment_options(id),
    service_type VARCHAR(20) NOT NULL, -- 'import', 'export'
    min_weight DECIMAL(10, 2) NOT NULL,
    max_weight DECIMAL(10, 2) NOT NULL,
    base_fee DECIMAL(10, 2) DEFAULT 0,
    rate_per_kg DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
