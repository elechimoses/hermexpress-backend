import fetch from 'node-fetch';
import { query } from '../src/db/index.js';

const baseUrl = 'http://localhost:3000';

const testDialCode = async () => {
    console.log('\n--- Testing Country Dial Code ---');
    const email = `dial_${Date.now()}@test.com`;
    const password = 'password123';
    
    // 1. Register with custom dial code
    console.log('Registering with +1 dial code...');
    const regRes = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            firstName: 'Dial', lastName: 'Test', email, phone: '5550199', 
            password, accountType: 'personal', countryCode: '+1' 
        })
    });
    const regData = await regRes.json();
    if (!regData.status) throw new Error('Register failed: ' + regData.message);
    
    // Verify Email (DB Hack)
    await query("UPDATE users SET is_verified = TRUE WHERE email = $1", [email]);

    // Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const loginData = await loginRes.json();
    const token = loginData.payload.token;
    
    // 2. Check Profile for dial code
    console.log('Checking Profile...');
    let res = await fetch(`${baseUrl}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    let data = await res.json();
    console.log('Registered Code:', data.payload.user.country_dial_code);
    
    if (data.payload.user.country_dial_code !== '+1') {
        throw new Error('Initial dial code incorrect');
    }

    // 3. Update dial code
    console.log('Updating dial code to +44...');
    res = await fetch(`${baseUrl}/api/user/profile`, {
        method: 'PUT',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ country_dial_code: '+44' })
    });
    data = await res.json();
    console.log('Update Status:', data.message);

    // 4. Verify Update
    res = await fetch(`${baseUrl}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    console.log('Updated Code:', data.payload.user.country_dial_code);

    if (data.payload.user.country_dial_code !== '+44') {
        throw new Error('Updated dial code incorrect');
    }
};

const run = async () => {
    try {
        await testDialCode();
        console.log('Test Passed');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
