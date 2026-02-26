import { query } from '../src/db/index.js';

async function checkDb() {
    try {
        const countries = await query(`
            SELECT c.id, c.name, r.name as region_name, c.region_id, c.is_active 
            FROM countries c 
            LEFT JOIN regions r ON c.region_id = r.id
            WHERE LOWER(c.name) IN ('united states', 'nigeria', 'ghana')
        `);
        console.log('--- Countries ---');
        console.log(JSON.stringify(countries.rows, null, 2));

        const regions = await query('SELECT * FROM regions');
        console.log('--- Regions ---');
        console.log(JSON.stringify(regions.rows, null, 2));

        const ratesCount = await query('SELECT COUNT(*) FROM shipment_option_region_rates');
        console.log('Total Rates count:', ratesCount.rows[0].count);

        const importRates = await query(`
            SELECT r.name as region_name, rr.weight_kg, rr.amount, o.name as option_name
            FROM shipment_option_region_rates rr
            JOIN regions r ON rr.region_id = r.id
            JOIN shipment_options o ON rr.shipment_option_id = o.id
            WHERE rr.service_type = 'import'
        `);
        console.log('--- Import Rates ---');
        console.log(JSON.stringify(importRates.rows, null, 2));
    } catch (err) {
        console.error(err);
    }
}

checkDb().then(() => process.exit());
