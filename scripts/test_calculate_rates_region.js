import { query } from '../src/db/index.js';

async function verifyQuoting() {
    console.log('--- Verifying Region-Based Quoting Logic ---');

    try {
        // 1. Setup Data
        // Region 1: Africa
        await query('INSERT INTO regions (id, name) VALUES (10, $1) ON CONFLICT (id) DO NOTHING', ['Quoting Test Region']);

        // Country: Testland (linked to Region 10)
        await query(`
            INSERT INTO countries (id, name, code, is_active, region_id) 
            VALUES (100, $1, $2, TRUE, 10) 
            ON CONFLICT (id) DO UPDATE SET region_id = 10`,
            ['Testland', 'TL']
        );

        // Option: Exp Quoting
        const optRes = await query(`
            INSERT INTO shipment_options (name, description, min_days, max_days, is_active)
            VALUES ($1, $2, 2, 4, TRUE)
            ON CONFLICT (name) DO UPDATE SET description = $2
            RETURNING id`,
            ['Exp Quoting', 'Test option for quoting']
        );
        const optionId = optRes.rows[0].id;

        // Rates for Region 10, Export
        await query('DELETE FROM shipment_option_region_rates WHERE shipment_option_id = $1 AND region_id = 10', [optionId]);
        await query(`
            INSERT INTO shipment_option_region_rates (shipment_option_id, region_id, weight_kg, amount, service_type)
            VALUES 
                ($1, 10, 0.5, 2500, 'export'),
                ($1, 10, 1.0, 3000, 'export'),
                ($1, 10, 2.0, 3200, 'export')`,
            [optionId]
        );

        console.log('✅ Setup complete.');

        // 2. Test Calculation (0.7kg -> should pick 1.0kg bracket -> 3000)
        const chargeableWeight = 0.7;
        const targetCountryId = 100; // Testland
        const serviceType = 'export';

        const rateQuery = `
            SELECT DISTINCT ON (rr.shipment_option_id)
                rr.id, rr.amount, rr.weight_kg,
                o.id as option_id, o.name AS option_name,
                r.name as region_name, r.id as region_id
            FROM shipment_option_region_rates rr
            JOIN shipment_options o ON rr.shipment_option_id = o.id
            JOIN countries c ON c.id = $1
            JOIN regions r ON c.region_id = r.id
            WHERE 
                rr.region_id = c.region_id
                AND rr.service_type = $2
                AND rr.weight_kg >= $3
                AND o.is_active = true
            ORDER BY rr.shipment_option_id, rr.weight_kg ASC
        `;

        const result = await query(rateQuery, [targetCountryId, serviceType, chargeableWeight]);

        if (result.rows.length > 0) {
            const quote = result.rows.find(q => q.option_id === optionId);
            if (quote && Number(quote.amount) === 3000) {
                console.log('✅ Quote calculation correct: 0.7kg matched 1.0kg bracket @ 3000');
                console.log('   Region Name:', quote.region_name);
            } else {
                console.log('❌ Quote calculation incorrect or option not found:', quote);
            }
        } else {
            console.log('❌ No quotes found.');
        }

    } catch (err) {
        console.error('❌ Verification Error:', err);
    }
}

verifyQuoting();
