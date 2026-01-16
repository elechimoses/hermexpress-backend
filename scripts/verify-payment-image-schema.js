import { query } from '../src/db/index.js';

async function verifySchema() {
    console.log('--- Verifying Payment Method Image Schema ---');
    try {
        // Check column existence
        const res = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='payment_methods' AND column_name='image_url'
        `);
        
        if (res.rows.length > 0) {
            console.log('SUCCESS: image_url column exists in payment_methods table.');
        } else {
            console.error('FAILURE: image_url column missing.');
        }

        // Check if API would return it (simulation)
        // We can't really simulate the API response without running the server and making a request, 
        // but we can check if the SELECT query in the controller would work.
        const selectRes = await query('SELECT id, provider, name, description, config, image_url FROM payment_methods LIMIT 1');
        console.log('SUCCESS: SELECT query with image_url executed without error.');
        
    } catch (err) {
        console.error('Verification Error:', err.message);
    }
    process.exit(0);
}

verifySchema();
