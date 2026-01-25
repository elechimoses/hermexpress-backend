import { query, pool } from '../src/db/index.js';

const resetTable = async () => {
    try {
        console.log('Dropping wallet_transactions...');
        await query('DROP TABLE IF EXISTS wallet_transactions');
        
        console.log('Recreating wallet_transactions...');
        await query(`
            CREATE TABLE wallet_transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
                type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
                amount DECIMAL(12, 2) NOT NULL,
                balance_before DECIMAL(12, 2) NOT NULL,
                balance_after DECIMAL(12, 2) NOT NULL,
                reference VARCHAR(100),
                description TEXT,
                status VARCHAR(20) DEFAULT 'success',
                meta_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
