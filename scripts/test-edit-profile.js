import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { query } from '../src/db/index.js';

const baseUrl = 'http://localhost:3000';

const testProfileUpdate = async () => {
    console.log('\n--- Testing Profile Update Flow ---');
    const email = `update_test_${Date.now()}@test.com`;
    const password = 'password123';
    
    // 1. Register & Login (Personal)
    await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'Test', lastName: 'User', email, phone: '08000000000', password, accountType: 'personal' })
    });
    // Verify
    await query("UPDATE users SET is_verified = TRUE WHERE email = $1", [email]);
    
    // Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const loginData = await loginRes.json();
    const token = loginData.payload.token;

    // 2. Complete Profile
    const form = new FormData();
    form.append('date_of_birth', '2000-01-01');
    form.append('address', 'Original Address');
    form.append('landmark', 'Old Landmark');
    form.append('country', 'Nigeria');
    form.append('state', 'Lagos');
    form.append('city', 'Ikeja');
    form.append('postal_code', '100001');
    // Using dummy file for complete (ID Card)
    fs.writeFileSync('dummy_id.jpg', 'ID CONTENT');
    form.append('id_card', fs.createReadStream('dummy_id.jpg'));

    await fetch(`${baseUrl}/auth/complete-profile`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, ...form.getHeaders() },
        body: form
    });
    
    // 3. Get Profile (Original)
    console.log('Fetching Original Profile...');
    let res = await fetch(`${baseUrl}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    let data = await res.json();
    console.log('Original Address:', data.payload.profile.address); // Should be "Original Address"

    // 4. Update Profile (New Address + Avatar)
    console.log('Updating Profile...');
    const updateForm = new FormData();
    updateForm.append('first_name', 'UpdatedName');
    updateForm.append('address', 'New Address 123'); // Changing address
    
    // Avatar upload
    fs.writeFileSync('dummy_avatar.jpg', 'AVATAR CONTENT');
    updateForm.append('avatar', fs.createReadStream('dummy_avatar.jpg'));

    res = await fetch(`${baseUrl}/auth/profile`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, ...updateForm.getHeaders() },
        body: updateForm
    });
    data = await res.json();
    console.log('Update Status:', data.status, data.message);

    // 5. Get Profile (Updated)
    console.log('Fetching Updated Profile...');
    res = await fetch(`${baseUrl}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    
    console.log('Updated First Name:', data.payload.user.first_name); // UpdatedName
    console.log('Updated Address:', data.payload.profile.address); // New Address 123
    console.log('Avatar URL:', data.payload.user.avatar_url); // Should be Cloudinary URL
    
    if (data.payload.profile.address !== 'New Address 123' || data.payload.user.first_name !== 'UpdatedName') {
        throw new Error('Profile update verification failed');
    }

    // Cleanup
    try { fs.unlinkSync('dummy_id.jpg'); } catch(e){}
    try { fs.unlinkSync('dummy_avatar.jpg'); } catch(e){}
};

const run = async () => {
    try {
        await testProfileUpdate();
        console.log('Test Passed');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
