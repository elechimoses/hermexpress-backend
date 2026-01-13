import { query } from '../src/db/index.js';

const run = async () => {
    const rateQuery = `
            SELECT r.* 
            FROM shipping_rates r
            JOIN shipment_options o ON r.shipment_option_id = o.id
            WHERE r.shipment_option_id = $1
            AND r.pickup_country_id = $2
            AND r.destination_country_id = $3
            AND (r.pickup_city_id IS NULL OR r.pickup_city_id = $4)
            AND (r.destination_city_id IS NULL OR r.destination_city_id = $5)
            AND r.service_type = $6
            AND $7 >= r.min_weight
            AND $7 <= r.max_weight
    `;
    
    // Params from log: [ 1, 1, 2, null, null, 'export', 2 ]
    const params = [1, 1, 2, null, null, 'export', 2];

    try {
        const res = await query(rateQuery, params);
        console.log('Rows:', res.rows.length);
        if (res.rows.length > 0) console.log(res.rows[0]);
    } catch (err) {
        console.error(err);
    }
};

run();
