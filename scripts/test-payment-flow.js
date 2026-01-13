import fetch from 'node-fetch';
import http from 'http';
import { query, pool } from '../src/db/index.js';

// Dynamic import to handle env var setting before app loads
process.env.NODE_ENV = 'test';
const { default: app } = await import('../app.js');

let server;
let baseUrl;

const startServer = () => {
    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            console.log(`Test Server running on ${baseUrl}`);
            resolve();
        });
    });
};

const closeServer = () => {
    return new Promise((resolve) => {
        server.close(resolve);
        pool.end(); 
    });
};

const testPaymentFlow = async () => {
    console.log('\n--- Testing Payment & Notifications ---');

    // 1. Get Payment Methods (Public)
    console.log('\n1. Fetching Public Payment Methods...');
    const methodsRes = await fetch(`${baseUrl}/api/payment-methods`);
    const methodsData = await methodsRes.json();
    if (!methodsData.status) throw new Error('Failed to fetch methods');
    
    console.log('Active Methods:', methodsData.payload.map(m => m.name).join(', '));
    const bankMethod = methodsData.payload.find(m => m.provider === 'bank_transfer');
    if (!bankMethod) throw new Error('Bank Transfer method not active');

    // 2. Admin: Update Bank Details (Toggle Active/Config)
    console.log('\n2. Admin: Updating Bank Config...');
    // Login as Admin first (reuse existing admin or create temp)
    // For speed, let's just create a quick token if we can, or just mock the DB update.
    // Actually, let's use the DB directly to simulate Admin action to avoid auth complexity in this script,
    // OR use the route if we have a valid admin token. 
    // Let's use route to verify controller logic.
    
    // Create Admin Token
    const adminEmail = `admin_pay_${Date.now()}@test.com`;
    await query(`INSERT INTO users (first_name, last_name, email, password, role, is_verified, country_dial_code, phone, account_type) 
                 VALUES ('Admin', 'Pay', $1, 'hashed', 'admin', true, '+234', '000', 'personal') RETURNING id`, [adminEmail]);
    // We need a real token, so let's just use the login flow or generate one. 
    // Generating manual token is faster.
    const { default: jwt } = await import('jsonwebtoken');
    const adminUser = (await query('SELECT * FROM users WHERE email = $1', [adminEmail])).rows[0];
    const adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: 'admin' }, process.env.JWT_SECRET || 'dev_secret');

    const updateRes = await fetch(`${baseUrl}/api/admin/payment-methods/${bankMethod.id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            config: { ...bankMethod.config, accountName: 'Updated Hermes Corp' }
        })
    });
    const updateData = await updateRes.json();
    if (!updateData.status) throw new Error('Admin update failed: ' + updateData.message);
    console.log('Updated Account Name:', updateData.payload.config.accountName);

    // 3. Book Shipment with Payment Method
    console.log('\n3. Booking with Payment Method...');
    
    // Setup data
    const sender = { name: 'Pay Sender', email: 'sender@pay.com', country: 'Nigeria', state: 'Lagos', city: 'Ikeja', address: '1 Pay St', postal_code: '100', phone: '123' };
    const receiver = { name: 'Pay Receiver', email: 'receiver@pay.com', country: 'United States', state: 'NY', city: 'NY', address: '2 Pay Ave', postal_code: '200', phone: '456' };
    const packages = [{ weight: 2, value: 5000, length: 1, width: 1, height: 1 }];
    
    // Get valid IDs
    const countriesRes = await query('SELECT * FROM countries WHERE is_active = TRUE limit 2');
    const optionsRes = await query('SELECT * FROM shipment_options WHERE is_active = TRUE limit 1');
    const pickupCountryId = countriesRes.rows[0].id;
    const destCountryId = countriesRes.rows[1].id;
    const serviceOptionId = optionsRes.rows[0].id;

    const bookRes = await fetch(`${baseUrl}/api/shipments/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender, receiver, packages,
            serviceType: 'export',
            pickupCountryId, destinationCountryId: destCountryId,
            serviceOptionId,
            paymentMethodId: bankMethod.id // <--- NEW FIELD
        })
    });

    const bookText = await bookRes.text();
    let bookData;
    try {
        bookData = JSON.parse(bookText);
    } catch (e) {
        throw new Error('Booking Parse Error: ' + bookText);
    }

    if (!bookData.status) throw new Error('Booking Failed: ' + bookData.message);

    console.log('Booking Successful:', bookData.payload.trackingNumber);
    console.log('Payment Snapshot Name:', bookData.payload.paymentMethod.name);
    console.log('Payment Snapshot Acct:', bookData.payload.paymentMethod.config.accountName);

    if (bookData.payload.paymentMethod.config.accountName !== 'Updated Hermes Corp') {
        throw new Error('Snapshot did not use updated config!');
    }

    // 4. Initialize Payment (Test Bank Transfer Logic)
    console.log('\n4. Initializing Payment Transaction...');
    const initRes = await fetch(`${baseUrl}/api/payment-methods/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shipmentId: bookData.payload.shipmentId
        })
    });
    
    const initData = await initRes.json();
    if (!initData.status) throw new Error('Init Payment Failed: ' + initData.message);
    
    console.log('Payment Provider:', initData.payload.provider);
    if (initData.payload.provider !== 'bank_transfer') throw new Error('Wrong provider returned');
    
    console.log('(Check console logs for Email Sending output)');
};

const run = async () => {
    try {
        await startServer();
        await testPaymentFlow();
        console.log('\nTest Passed');
        await closeServer();
        process.exit(0);
    } catch (err) {
        console.error(err);
        if (server) await closeServer();
        process.exit(1);
    }
};

run();
