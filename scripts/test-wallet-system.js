import { query, pool } from '../src/db/index.js';
import bcrypt from 'bcrypt';
import fetch from 'node-fetch';
import fs from 'fs';

const baseUrl = 'http://localhost:3001/api';

const setupTestData = async () => {
    console.log('Setting up test data...');
    const password = await bcrypt.hash('password123', 10);
    
    // 1. Create User
    const userRes = await query(`
        INSERT INTO users (first_name, last_name, email, password, role, account_type, is_verified, status)
        VALUES ('Wallet', 'User', 'walletuser@example.com', $1, 'user', 'individual', true, 'active')
        ON CONFLICT (email) DO UPDATE SET is_verified = true RETURNING id, email
    `, [password]);
    const user = userRes.rows[0];

    // 2. Create Admin
    const adminRes = await query(`
        INSERT INTO users (first_name, last_name, email, password, role, account_type, is_verified, status)
        VALUES ('Wallet', 'Admin', 'walletadmin@example.com', $1, 'admin', 'admin', true, 'active')
        ON CONFLICT (email) DO UPDATE SET role = 'admin' RETURNING id, email
    `, [password]);
    const admin = adminRes.rows[0];

    // 3. Ensure 'wallet' payment method exists
    await query(`
        INSERT INTO payment_methods (provider, name, description, is_active, config)
        VALUES ('wallet', 'Wallet', 'Pay with Wallet', true, '{}')
        ON CONFLICT (provider) DO UPDATE SET is_active = true
    `);
    
    // Get wallet method ID
    const pmRes = await query(`SELECT id FROM payment_methods WHERE provider = 'wallet'`);
    const walletPmId = pmRes.rows[0].id;

    // Ensure dummy shipment option
    let optionId;
    const optionRes = await query(`SELECT id FROM shipment_options LIMIT 1`);
    if (optionRes.rows.length === 0) {
        const newOpt = await query(`INSERT INTO shipment_options (name, min_days, max_days, is_active) VALUES ('Test Option', 1, 3, true) RETURNING id`);
        optionId = newOpt.rows[0].id;
    } else {
        optionId = optionRes.rows[0].id;
    }

    // Ensure dummy shipping rate for calculation
    // Actually we are not calculating rates, just booking. 
    // But bookShipment does checks. We will construct a minimal valid payload.

    return { user, admin, walletPmId, optionId };
};

const login = async (email, password) => {
    const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const text = await res.text();
    try {
        const data = JSON.parse(text);
        if (!data.status) throw new Error(`Login failed: ${data.message}`);
        return data.payload.token;
    } catch (e) {
        console.error('Login Error Body:', text);
        throw e;
    }
};

const runTests = async () => {
    try {
        const { user, admin, walletPmId, optionId } = await setupTestData();
        
        const userToken = await login(user.email, 'password123');
        const adminToken = await login(admin.email, 'password123');
        
        console.log('--- 1. Check Initial Balance ---');
        const balRes = await fetch(`${baseUrl}/wallet`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const balData = await balRes.json();
        console.log('Balance:', balData.payload?.balance);

        console.log('\n--- 2. Admin Credit Wallet (Fund) ---');
        const fundRes = await fetch(`${baseUrl}/admin/wallets/update`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: user.id,
                action: 'credit',
                amount: 50000,
                description: 'Test Funding'
            })
        });
        const fundData = await fundRes.json();
        console.log('Fund Status:', fundData.status ? 'OK' : 'FAIL', fundData.message);
        console.log('New Balance:', fundData.payload?.newBalance);

        console.log('\n--- 3. Book Shipment using Wallet ---');
        const bookingPayload = {
            sender: { name: 'Sender', email: 'sender@test.com', phone: '123', country: 'Nigeria', address: 'Lagos' },
            receiver: { name: 'Receiver', email: 'receiver@test.com', phone: '123', country: 'Nigeria', address: 'Abuja' },
            packages: [{ weight: 5, value: 1000, quantity: 1, category: 'General' }],
            serviceOptionId: optionId,
            serviceType: 'import',
            paymentMethodId: walletPmId,
            pickupCountryId: 1, // Assumptions
            destinationCountryId: 1
        };

        // Note: bookShipment calculates price internally.
        // We need to ensure calculation works or mock it?
        // Actually, our previous test didn't rely on calculation because we inserted directly.
        // But here we want to call the API endpoint for booking to trigger wallet logic.
        // bookShipment endpoint: POST /api/shipments/book
        
        // Wait, bookShipment relies on `shipping_rates`.
        // We need to verify that we have a valid rate or inject one.
        // Let's insert a valid rate for optionId, country 1 -> country 1.
        await query(`INSERT INTO countries (name, code, is_active) VALUES ('Nigeria', 'NG', true) ON CONFLICT DO NOTHING`);
        const countryRes = await query(`SELECT id FROM countries WHERE code='NG'`);
        const countryId = countryRes.rows[0].id;
        bookingPayload.pickupCountryId = countryId;
        bookingPayload.destinationCountryId = countryId;

        await query(`
            INSERT INTO shipping_rates (shipment_option_id, pickup_country_id, destination_country_id, service_type, min_weight, max_weight, base_fee, rate_per_kg)
            VALUES ($1, $2, $2, 'import', 0, 1000, 1000, 100)
            ON CONFLICT DO NOTHING
        `, [optionId, countryId]);

        const bookRes = await fetch(`${baseUrl}/shipments/book`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookingPayload)
        });
        const bookData = await bookRes.json();
        
        if (!bookData.status) {
            console.error('Booking Failed:', bookData.message);
            // Print body if failed
            // console.log(JSON.stringify(bookData, null, 2));
        } else {
            console.log('Booking Success:', bookData.message);
            console.log('Tracking:', bookData.payload.trackingNumber);
            console.log('Status:', bookData.payload.status);
            console.log('Payment:', bookData.payload.paymentMethod?.provider);
        }

        console.log('\n--- 4. Verify Final Balance ---');
        const finalBalRes = await fetch(`${baseUrl}/wallet`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const finalBalData = await finalBalRes.json();
        console.log('Final Balance:', finalBalData.payload?.balance);
        
        console.log('\n--- 5. Verify Transaction History ---');
        const txRes = await fetch(`${baseUrl}/wallet/transactions`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const txData = await txRes.json();
        console.log('Transactions:', txData.payload?.transactions?.length);
        if (txData.payload?.transactions?.length > 0) {
            console.log('Latest Tx:', txData.payload.transactions[0].type, txData.payload.transactions[0].amount);
        }

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        await pool.end();
    }
};

runTests();
