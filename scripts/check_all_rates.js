import { query } from '../src/db/index.js';

async function checkAllRates() {
    try {
        const rates = await query(`
            SELECT DISTINCT service_type FROM shipment_option_region_rates
        `);
        console.log('Available service types:', rates.rows);

        const summaries = await query(`
            SELECT r.name as region_name, rr.service_type, COUNT(*) as rate_count
            FROM shipment_option_region_rates rr
            JOIN regions r ON rr.region_id = r.id
            GROUP BY r.name, rr.service_type
        `);
        console.log('Rates Summary:', summaries.rows);
    } catch (err) {
        console.error(err);
    }
}

checkAllRates().then(() => process.exit());
