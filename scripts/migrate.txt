import fs from 'fs';
import path from 'path';
import { query } from '../src/db/index.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigrations = async () => {
  try {
    // 1. Create migrations table if not exists
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).sort(); // Sort to ensure order

    // 2. Get executed migrations
    const { rows: executedRows } = await query('SELECT name FROM migrations');
    const executedNames = new Set(executedRows.map(row => row.name));

    for (const file of files) {
      if (file.endsWith('.sql')) {
        if (executedNames.has(file)) {
            // console.log(`Skipping already executed: ${file}`);
            continue;
        }

        console.log(`Running migration: ${file}`);
        const sqlPath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await query('BEGIN'); // Transaction
        try {
            await query(sql);
            await query('INSERT INTO migrations (name) VALUES ($1)', [file]);
            await query('COMMIT');
            console.log(`Completed migration: ${file}`);
        } catch (execErr) {
            await query('ROLLBACK');
            throw execErr;
        }
      }
    }

    console.log('All migrations processed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

runMigrations();
