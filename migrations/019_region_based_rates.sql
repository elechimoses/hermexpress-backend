-- Add updated_at to shipment_options if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipment_options' AND column_name='updated_at') THEN
        ALTER TABLE shipment_options ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Create regions table
CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add region_id to countries
ALTER TABLE countries ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id);

-- Create shipment_option_region_rates table
CREATE TABLE IF NOT EXISTS shipment_option_region_rates (
    id SERIAL PRIMARY KEY,
    shipment_option_id INTEGER REFERENCES shipment_options(id) ON DELETE CASCADE,
    region_id INTEGER REFERENCES regions(id) ON DELETE CASCADE,
    weight_kg DECIMAL(10, 2) NOT NULL, -- e.g., 0.5, 1.0, 5.0
    amount DECIMAL(10, 2) NOT NULL,    -- e.g., 2500, 3000
    service_type VARCHAR(20) NOT NULL,  -- 'import', 'export'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shipment_option_id, region_id, weight_kg, service_type)
);

-- Ensure unique constraints for ON CONFLICT logic in management
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipment_options_name_key') THEN
        ALTER TABLE shipment_options ADD CONSTRAINT shipment_options_name_key UNIQUE (name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'countries_code_key') THEN
        ALTER TABLE countries ADD CONSTRAINT countries_code_key UNIQUE (code);
    END IF;
END $$;
