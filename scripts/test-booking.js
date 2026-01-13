import fetch from 'node-fetch';
import { query, pool } from '../src/db/index.js';
import http from 'http';

// Dynamic import to handle env var setting before app loads
process.env.NODE_ENV = 'test';
const { default: app } = await import('../app.js');

let server;
let baseUrl;

const startServer = () => {
    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, () => { // Random free port
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
        pool.end(); // Close DB pool too
    });
};

const testBooking = async () => {
    console.log('\n--- Testing Booking Flow ---');
    
    // 0. Setup: Fetch Valid IDs
    console.log('Fetching valid IDs...');
    const countriesRes = await query('SELECT * FROM countries WHERE is_active = TRUE');
    const optionsRes = await query('SELECT * FROM shipment_options WHERE is_active = TRUE');
    const insuranceRes = await query('SELECT * FROM insurance_policies WHERE is_active = TRUE');

    const pickupCountry = countriesRes.rows.find(c => c.name.includes('Nigeria')) || countriesRes.rows[0];
    const destCountry = countriesRes.rows.find(c => c.name.includes('Unit')) || countriesRes.rows[1];
    const option = optionsRes.rows[0];
    const insurance = insuranceRes.rows.find(i => i.name.includes('Premium')) || insuranceRes.rows[0];

    if (!pickupCountry || !destCountry || !option || !insurance) throw new Error('Missing seed data');

    console.log(`Using: ${pickupCountry.name} -> ${destCountry.name} | ${option.name} | ${insurance.name}`);

    const pickupCountryId = pickupCountry.id;
    const destinationCountryId = destCountry.id;
    const serviceOptionId = option.id;
    const insurancePolicyId = insurance.id;

    const sender = {
        name: 'Sender Test', email: 'sender@test.com', phone: '111', 
        country: 'Nigeria', state: 'Lagos', city: 'Ikeja', address: '1 Sender St', postal_code: '100'
    };
    const receiver = {
        name: 'Receiver Test', email: 'receiver@test.com', phone: '222', 
        country: 'USA', state: 'NY', city: 'New York', address: '2 Receiver Ave', postal_code: '200'
    };
    const packages = [
        { category: 'Electronics', description: 'Laptop', weight: 2, length: 10, width: 10, height: 10, value: 200000, quantity: 1 }
    ];

    // 1. Guest Booking
    console.log('\n1. Guest Booking...');
    const guestRes = await fetch(`${baseUrl}/api/shipments/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender, receiver, packages,
            serviceType: 'export',
            pickupCountryId, 
            destinationCountryId,
            serviceOptionId, 
            insurancePolicyId 
        })
    });
    
    const text = await guestRes.text();
    let guestData;
    try {
        guestData = JSON.parse(text);
    } catch (e) {
        console.error('Guest Response Raw:', text.substring(0, 500));
        throw new Error('Failed to parse Guest JSON');
    }
    
    console.log('Guest Status:', guestRes.status);
    if (!guestData.status) {
        console.error('Guest Booking Error Payload:', JSON.stringify(guestData, null, 2));
        throw new Error('Guest booking failed: ' + guestData.message);
    }
    console.log('Guest Tracking:', guestData.payload.trackingNumber);
    console.log('Guest Price:', guestData.payload.totalPrice);


    // 2. Auth Booking + Address Save
    console.log('\n2. Auth Booking...');
    // Register/Login
    const email = `booker_${Date.now()}@test.com`;
    console.log('Registering:', email);
    // Use /auth/register based on app.js check
    const regRes = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'B', lastName: 'K', email, phone: '5551234567', password: 'password123', accountType: 'personal', countryCode: '+234' })
    });
    const regText = await regRes.text();
    let regData;
    try {
        regData = JSON.parse(regText);
    } catch (e) {
        console.error('Reg Response Raw:', regText.substring(0, 500));
        throw new Error('Registration JSON parse failed');
    }

    if (!regData.status) {
        console.error('Registration Failed:', JSON.stringify(regData, null, 2));
        throw new Error('Registration failed');
    }
    
    await query("UPDATE users SET is_verified = TRUE WHERE email = $1", [email]);
    
    // Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' })
    });
    const loginData = await loginRes.json();
    if (!loginData.status || !loginData.payload.token) {
        console.error('Login Failed:', JSON.stringify(loginData, null, 2));
        throw new Error('Login failed');
    }
    const token = loginData.payload.token;
    console.log('Login Token:', token.substring(0, 20) + '...');

    // Book
    const authRes = await fetch(`${baseUrl}/api/shipments/book`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            sender: { ...sender, name: 'Auth Sender' }, 
            receiver, packages,
            serviceType: 'export',
            pickupCountryId, 
            destinationCountryId,
            serviceOptionId,
            saveSenderAddress: true
        })
    });
    const authText = await authRes.text();
    let authData;
    try {
        authData = JSON.parse(authText);
    } catch (e) {
        console.error('Auth Response Raw:', authText.substring(0, 500));
        throw new Error('Auth JSON parse failed');
    }

    console.log('Auth Status:', authRes.status);
    if (!authData.status) {
        console.error('Auth Booking Error Payload:', JSON.stringify(authData, null, 2));
        throw new Error('Auth booking failed: ' + authData.message);
    }
    
    // Verify Address Saved
    console.log('Verifying Saved Address...');
    const addrRes = await fetch(`${baseUrl}/api/user/addresses`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const addrData = await addrRes.json();
    // console.log('Fetched Addresses:', JSON.stringify(addrData, null, 2));

    const saved = addrData.payload.find(a => a.name === 'Auth Sender');
    
    if (!saved) throw new Error('Address was not saved to book');
    console.log('Address saved successfully:', saved.name);
};

const run = async () => {
    try {
        await startServer();
        await testBooking();
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
