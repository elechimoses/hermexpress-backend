-- Shipment Status History
CREATE TABLE shipment_status_history (
    id SERIAL PRIMARY KEY,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shipment_history_id ON shipment_status_history(shipment_id);
