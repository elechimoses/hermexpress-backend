import { query, pool } from '../src/db/index.js';

const debugInsert = async () => {
    try {
        // 1. Get Wallet ID
        const wRes = await query('SELECT id FROM wallets LIMIT 1');
        if (wRes.rows.length === 0) {
            console.log('No wallet found, creating one...');
            // Create user first if needed? Assuming existence from previous test.
            const uRes = await query(`INSERT INTO users (first_name, last_name, email, password, account_type) VALUES ('D', 'U', 'debug@test.com', 'pass', 'individual') RETURNING id`);
            await query(`INSERT INTO wallets (user_id) VALUES ($1)`, [uRes.rows[0].id]);
        }
        const walletId = (await query('SELECT id FROM wallets LIMIT 1')).rows[0].id;

        console.log('Wallet ID:', walletId);

        // 2. Try minimal insert
        console.log('Inserting minimal...');
        await query(`INSERT INTO wallet_transactions (wallet_id, type, amount, balance_before, balance_after) VALUES ($1, 'credit', 100, 0, 100)`, [walletId]);
        console.log('Minimal success.');

        // 3. Try full insert
        console.log('Inserting full...');
        await query(`
            INSERT INTO wallet_transactions 
            (wallet_id, type, amount, balance_before, balance_after, reference, description, status, meta_data)
            VALUES ($1, 'credit', 100, 0, 100, 'REF', 'Desc', 'success', $2)
        `, [walletId, JSON.stringify({ foo: 'bar' })]);
        console.log('Full success.');

    } catch (err) {
        console.error('Insert Failed:', err);
    } finally {
        await pool.end();
    }
};

debugInsert();
