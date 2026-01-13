import { query } from '../src/db/index.js';

const seed = async () => {
    try {
        console.log('--- Seeding Quote Data ---');

        // 1. Countries
        console.log('Inserting Countries...');
        // Nigeria: Export Origin, Import Destination
        const ngRes = await query(`
            INSERT INTO countries (name, code, can_import_from, can_export_to) 
            VALUES ('Nigeria', 'NG', false, false) 
            ON CONFLICT (code) DO UPDATE SET can_export_to = false RETURNING id`);
        const ngId = ngRes.rows[0].id;

        // USA: Import Origin, Export Destination
        const usRes = await query(`
            INSERT INTO countries (name, code, can_import_from, can_export_to) 
            VALUES ('United States', 'US', true, true) 
            ON CONFLICT (code) DO UPDATE SET can_import_from = true, can_export_to = true RETURNING id`);
        const usId = usRes.rows[0].id;

        // UK: Import Origin, Export Destination
        const ukRes = await query(`
            INSERT INTO countries (name, code, can_import_from, can_export_to) 
            VALUES ('United Kingdom', 'GB', true, true) 
            ON CONFLICT (code) DO UPDATE SET can_import_from = true, can_export_to = true RETURNING id`);
        const ukId = ukRes.rows[0].id;
        
        // Canada: Export Destination Only
        const caRes = await query(`
            INSERT INTO countries (name, code, can_import_from, can_export_to) 
            VALUES ('Canada', 'CA', false, true) 
            ON CONFLICT (code) DO UPDATE SET can_export_to = true RETURNING id`);
        const caId = caRes.rows[0].id;


        // 2. Cities (Nigeria)
        console.log('Inserting Cities...');
        await query(`INSERT INTO cities (country_id, name, state) VALUES ($1, 'Lagos', 'Lagos')`, [ngId]);
        await query(`INSERT INTO cities (country_id, name, state) VALUES ($1, 'Abuja', 'FCT')`, [ngId]);
        await query(`INSERT INTO cities (country_id, name, state) VALUES ($1, 'Port Harcourt', 'Rivers')`, [ngId]);

        // 3. Shipment Options
        console.log('Inserting Options...');
        const budgetRes = await query(`
            INSERT INTO shipment_options (name, description, min_days, max_days) 
            VALUES ('Budget', 'Cost-effective shipping', 10, 15) RETURNING id`);
        const budgetId = budgetRes.rows[0].id;

        const expressRes = await query(`
            INSERT INTO shipment_options (name, description, min_days, max_days) 
            VALUES ('Express', 'Fastest delivery', 3, 5) RETURNING id`);
        const expressId = expressRes.rows[0].id;

        // 4. Rates
        console.log('Inserting Rates...');
        
        // Export: NG -> USA (Budget)
        // 0-5kg: Base 5000 + 1000/kg
        await query(`
            INSERT INTO shipping_rates (pickup_country_id, destination_country_id, shipment_option_id, service_type, min_weight, max_weight, base_fee, rate_per_kg)
            VALUES ($1, $2, $3, 'export', 0, 5, 5000, 1000)`, [ngId, usId, budgetId]);
            
        // Export: NG -> USA (Express)
        // 0-5kg: Base 10000 + 2000/kg
        await query(`
            INSERT INTO shipping_rates (pickup_country_id, destination_country_id, shipment_option_id, service_type, min_weight, max_weight, base_fee, rate_per_kg)
            VALUES ($1, $2, $3, 'export', 0, 5, 10000, 2000)`, [ngId, usId, expressId]);

        // Import: USA -> NG (Budget)
        // 0-10kg: Base 8000 + 1500/kg
         await query(`
            INSERT INTO shipping_rates (pickup_country_id, destination_country_id, shipment_option_id, service_type, min_weight, max_weight, base_fee, rate_per_kg)
            VALUES ($1, $2, $3, 'import', 0, 10, 8000, 1500)`, [usId, ngId, budgetId]);

        console.log('Seeding Completed Successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seed();
