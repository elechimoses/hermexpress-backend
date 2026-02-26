import { query } from '../src/db/index.js';

async function checkDb() {
    try {
        const countries = await query(`
            SELECT c.id, c.name, r.name as region_name, c.is_active 
            FROM countries c 
            LEFT JOIN regions r ON c.region_id = r.id
            WHERE LOWER(c.name) IN ('united states', 'nigeria', 'ghana')
        `);
        console.log('Countries Found:', countries.rows);

        const rates = await query(`
            SELECT r.name as region_name, rr.service_type, rr.weight_kg, rr.amount, o.name as option_name
            FROM shipment_option_region_rates rr
            JOIN regions r ON rr.region_id = r.id
            JOIN shipment_options o ON rr.shipment_option_id = o.id
            ORDER BY r.name, rr.service_type, rr.weight_kg
        `);
        console.log('Rates Found:', rates.rows);
    } catch (err) {
        console.error(err);
    }
}

checkDb().then(() => process.exit());
