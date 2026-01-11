-- Addresses (User Address Book)
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('sender', 'receiver')),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    postal_code VARCHAR(20),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insurance Policies
CREATE TABLE insurance_policies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    coverage_percentage DECIMAL(5,2) DEFAULT 0, -- e.g., 100.00 for full coverage
    fee_currency VARCHAR(3) DEFAULT 'NGN',
    fee_type VARCHAR(20) CHECK (fee_type IN ('percentage', 'flat')), -- percentage of value or flat fee
    fee_amount DECIMAL(10,2) NOT NULL, -- The percentage value (e.g. 1.5) or flat amount
    min_fee DECIMAL(10,2) DEFAULT 0, -- Minimum fee if percentage is too low
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Shipments
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Nullable for guest users if we support them, or strictly auth
    status VARCHAR(20) CHECK (status IN ('pending', 'paid', 'pickup', 'in_transit', 'delivered', 'cancelled')) DEFAULT 'pending',
    service_type VARCHAR(10) CHECK (service_type IN ('import', 'export')),
    shipment_option_id INTEGER REFERENCES shipment_options(id),
    insurance_policy_id INTEGER REFERENCES insurance_policies(id),
    insurance_fee DECIMAL(12,2) DEFAULT 0,
    shipping_fee DECIMAL(12,2) DEFAULT 0,
    total_price DECIMAL(12,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'NGN',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Shipment Addresses (Snapshot)
CREATE TABLE shipment_addresses (
    id SERIAL PRIMARY KEY,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('sender', 'receiver')),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    postal_code VARCHAR(20)
);

-- Shipment Packages
CREATE TABLE shipment_packages (
    id SERIAL PRIMARY KEY,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    category VARCHAR(100),
    description TEXT,
    weight DECIMAL(10,2) NOT NULL, -- kg
    length DECIMAL(10,2), -- cm
    width DECIMAL(10,2), -- cm
    height DECIMAL(10,2), -- cm
    value DECIMAL(12,2), -- Value for insurance
    quantity INTEGER DEFAULT 1
);

-- Indexes
CREATE INDEX idx_addresses_user ON addresses(user_id);
CREATE INDEX idx_shipments_user ON shipments(user_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
