import { query, pool } from '../src/db/index.js';

const resetTable = async () => {
    try {
        console.log('Dropping invoices...');
        await query('DROP TABLE IF EXISTS invoices');
        
        console.log('Recreating invoices...');
        await query(`
            CREATE TABLE invoices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                amount DECIMAL(12, 2) NOT NULL,
                reason TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
                due_date TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Reset complete.');
    } catch (err) {
        console.error('Reset failed:', err);
    } finally {
        await pool.end();
    }
};

resetTable();
