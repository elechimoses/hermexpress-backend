import { query } from '../src/db/index.js';

const seedInsurance = async () => {
    try {
        console.log('Seeding Insurance Policies...');

        // 1. Basic Insurance
        await query(`
            INSERT INTO insurance_policies (name, description, fee_type, fee_amount, min_fee)
            VALUES ($1, $2, $3, $4, $5)
        `, ['Basic Insurance', 'Covers damages of up to ₦10,000', 'flat', 0, 0]);

        // 2. Premium Insurance
        await query(`
            INSERT INTO insurance_policies (name, description, fee_type, fee_amount, min_fee)
            VALUES ($1, $2, $3, $4, $5)
        `, ['Premium Insurance', '4% of the package value. Covers damages up to ₦300,000', 'percentage', 4.00, 14000]);

        console.log('Insurance Policies Seeded');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedInsurance();
