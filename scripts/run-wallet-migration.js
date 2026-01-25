import { query, pool } from '../src/db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
    try {
        const sqlPath = path.join(__dirname, '../migrations/013_wallet_system.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Running migration: 013_wallet_system.sql');
        await query(sql);
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
};

runMigration();
