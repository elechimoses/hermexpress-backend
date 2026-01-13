import { query, pool } from '../src/db/index.js';

const seedPayments = async () => {
    console.log('Seeding Payment Methods...');
    
    const providers = [
        {
            provider: 'korapay',
            name: 'Korapay',
            description: 'Pay seamlessly with Korapay',
            is_active: false,
            config: { publicKey: '' }
        },
        {
            provider: 'paystack',
            name: 'Paystack',
            description: 'Pay with Card, Bank Transfer via Paystack',
            is_active: false,
            config: { publicKey: '' }
        },
        {
            provider: 'flutterwave',
            name: 'Flutterwave',
            description: 'Secure payment via Flutterwave',
            is_active: false,
            config: { publicKey: '' }
        },
        {
            provider: 'bank_transfer',
            name: 'Bank Transfer',
            description: 'Direct transfer to our bank account',
            is_active: true, // Default active for testing
            config: {
                bankName: 'Access Bank',
                accountName: 'Hermes Express Logistics',
                accountNumber: '1234567890',
                routingNumber: '' // Optional
            }
        }
    ];

    try {
        for (const p of providers) {
            await query(
                `INSERT INTO payment_methods (provider, name, description, is_active, config)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (provider) DO NOTHING`,
                [p.provider, p.name, p.description, p.is_active, p.config]
            );
        }
        console.log('Payment Methods seeded successfully.');
    } catch (err) {
        console.error('Seeding Error:', err);
    } finally {
        pool.end();
    }
};

seedPayments();
