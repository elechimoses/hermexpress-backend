import { query } from '../src/db/index.js';

const debug = async () => {
    const ngRes = await query("SELECT id FROM countries WHERE code = 'NG'");
    const usRes = await query("SELECT id FROM countries WHERE code = 'US'");
    
    const ngId = ngRes.rows[0]?.id;
    const usId = usRes.rows[0]?.id;

    console.log('Params:', [ngId, usId, 'export', 4]);

    const rateSql = `
        SELECT 
            r.base_fee, 
            r.rate_per_kg, 
            r.min_weight, 
            r.max_weight,
            o.name as option_name,
            o.description as option_desc,
            o.min_days,
            o.max_days
        FROM shipping_rates r
        JOIN shipment_options o ON r.shipment_option_id = o.id
        WHERE 
            r.pickup_country_id = $1
            AND r.destination_country_id = $2
            AND r.service_type = $3
            AND r.min_weight <= $4
            AND r.max_weight >= $4
            AND o.is_active = TRUE
    `;

    if (ngId && usId) {
        const rates = await query(rateSql, [ngId, usId, 'export', 4]);
        console.log('\nMatching Rates:', rates.rows);
    } else {
        console.log('IDs missing');
    }

    process.exit(0);
};

debug();
