import { query } from '../src/db/index.js';

const seedHistory = async () => {
  try {
    console.log('Creating migrations table...');
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const executedFiles = [
      'init.sql',
      '002_enhance_auth_schema.sql',
      '003_add_verification_expiry.sql',
      '004_quote_system_schema.sql',
      '005_add_city_rates.sql'
    ];

    for (const file of executedFiles) {
       console.log(`Seeding history for: ${file}`);
       await query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file]);
    }

    console.log('Migration history seeded.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed history:', err);
    process.exit(1);
  }
};

seedHistory();
