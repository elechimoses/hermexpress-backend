import { query, pool } from '../src/db/index.js';

const checkSchema = async () => {
    try {
        const res = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'shipments'
        `);
        console.log('Columns in shipments:', JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
};

checkSchema();
