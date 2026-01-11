-- Add city specific columns to shipping_rates
ALTER TABLE shipping_rates
ADD COLUMN pickup_city_id INTEGER REFERENCES cities(id),
ADD COLUMN destination_city_id INTEGER REFERENCES cities(id);

-- Create an index for faster lookups on city combinations
CREATE INDEX idx_shipping_rates_pickup_city ON shipping_rates(pickup_city_id);
CREATE INDEX idx_shipping_rates_destination_city ON shipping_rates(destination_city_id);
