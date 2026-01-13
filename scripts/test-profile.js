import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const baseUrl = 'http://localhost:3000';
// Helper to use DB directly for verification
import { query } from '../src/db/index.js';
// We need to close pool after test if we import query, but query uses a pool that might not close automatically.
// For script, process.exit is fine.

const testPersonalFlow = async () => {
    console.log('\n--- Testing Personal Profile Flow ---');
    const email = `personal_${Date.now()}@test.com`;
    const password = 'password123';
    
    // 1. Register
    const regRes = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            firstName: 'John', lastName: 'Doe', email, phone: '08012345678',
            password, accountType: 'personal' // 'personal' maps to 'individual'? Controller checks 'business' or not.
        })
    });
    const regData = await regRes.json();
    if (!regData.status) throw new Error('Register failed: ' + regData.message);
    console.log('Registered Personal User');

    // 2. Verify Email (DB Hack)
    await query("UPDATE users SET is_verified = TRUE WHERE email = $1", [email]);
    console.log('Verified Email (DB)');

    // 3. Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const loginData = await loginRes.json();
    if (!loginData.status) throw new Error('Login failed: ' + loginData.message);
    const token = loginData.payload.token;
    console.log('Logged In');

    // 4. Complete Profile
    const form = new FormData();
    form.append('date_of_birth', '1990-01-01');
    form.append('address', '123 Test St');
    form.append('landmark', 'Near Park');
    form.append('country', 'Nigeria');
    form.append('state', 'Lagos');
    form.append('city', 'Ikeja');
    form.append('postal_code', '100001');
    
    // Attach dummy file
    const DummyFile = 'dummy.jpg';
    fs.writeFileSync(DummyFile, 'dummy content');
    form.append('id_card', fs.createReadStream(DummyFile));

    const profileRes = await fetch(`${baseUrl}/auth/complete-profile`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`,
            ...form.getHeaders()
        },
        body: form
    });
    
    const profileData = await profileRes.json();
    console.log('Complete Profile Status:', profileData.status, profileData.message);

    if (!profileData.status) {
         console.error('Payload:', profileData);
         throw new Error('Profile completion failed');
    }

    // cleanup
    fs.unlinkSync(DummyFile);
};

const testBusinessFlow = async () => {
    console.log('\n--- Testing Business Profile Flow ---');
    const email = `biz_${Date.now()}@test.com`;
    const password = 'password123';
    
    // 1. Register
    const regRes = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            firstName: 'Jane', lastName: 'Doe', email, phone: '08098765432',
            password, accountType: 'business'
        })
    });
    const regData = await regRes.json();
    if (!regData.status) throw new Error('Register failed: ' + regData.message);
    console.log('Registered Business User');

    // 2. Verify Email (DB Hack)
    await query("UPDATE users SET is_verified = TRUE WHERE email = $1", [email]);
    console.log('Verified Email (DB)');

    // 3. Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const loginData = await loginRes.json();
    const token = loginData.payload.token;

    // 4. Complete Profile
    const form = new FormData();
    form.append('business_name', 'Tech Corp');
    form.append('business_type', 'LLC');
    form.append('registration_number', 'RC123456');
    form.append('tax_id', 'TIN987654');
    form.append('address', '456 Biz Road');
    form.append('landmark', 'Biz Tower');
    form.append('country', 'Nigeria');
    form.append('state', 'Abuja');
    form.append('city', 'Maitama');
    form.append('postal_code', '900001');

    const profileRes = await fetch(`${baseUrl}/auth/complete-profile`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`,
             ...form.getHeaders()
        },
        body: form // No file this time to test optional? Controller allows req.file to be undefined?
                   // Code: const idCardUrl = req.file ? ... : null; Yes.
    });
    
    const profileData = await profileRes.json();
    console.log('Complete Profile Status:', profileData.status, profileData.message);
     if (!profileData.status) {
         console.error('Payload:', profileData);
         throw new Error('Profile completion failed');
    }
};

const run = async () => {
    try {
        await testPersonalFlow();
        await testBusinessFlow();
        console.log('\nAll tests passed.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
