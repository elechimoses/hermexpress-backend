import { query, pool } from '../src/db/index.js';
import bcrypt from 'bcrypt';
import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3001/api';

const setupTestData = async () => {
    console.log('Setting up test data...');
    const password = await bcrypt.hash('password123', 10);
    
    // 1. Create User
    const userRes = await query(`
        INSERT INTO users (first_name, last_name, email, password, role, account_type, is_verified, status)
        VALUES ('Test', 'User', 'testuser@example.com', $1, 'user', 'individual', true, 'active')
        ON CONFLICT (email) DO UPDATE SET is_verified = true RETURNING id, email
    `, [password]);
    const user = userRes.rows[0];

    // 2. Create Admin
    const adminRes = await query(`
        INSERT INTO users (first_name, last_name, email, password, role, account_type, is_verified, status)
        VALUES ('Test', 'Admin', 'testadmin@example.com', $1, 'admin', 'admin', true, 'active')
        ON CONFLICT (email) DO UPDATE SET role = 'admin' RETURNING id, email
    `, [password]);
    const admin = adminRes.rows[0];

    // 3. Create Shipments for User
    // We need a dummy shipment_option and insurance_policy if constraints exist, 
    // but the query in controller joins leftly or doesn't strictly depend on them for the basic select.
    // However, foreign keys might enforce existence.
    // Let's check constraints. shipments refs shipment_options(id).
    // so we need an option.
    
    let optionId;
    const optionRes = await query(`SELECT id FROM shipment_options LIMIT 1`);
    if (optionRes.rows.length === 0) {
        const newOpt = await query(`INSERT INTO shipment_options (name, min_days, max_days, is_active) VALUES ('Test Option', 1, 3, true) RETURNING id`);
        optionId = newOpt.rows[0].id;
    } else {
        optionId = optionRes.rows[0].id;
    }

    // Create 3 shipments (2 pending, 1 delivered)
    // Shipment 1: Pending
    const s1 = await query(`
        INSERT INTO shipments (tracking_number, user_id, status, total_price, shipment_option_id, service_type)
        VALUES ($1, $2, 'pending', 5000, $3, 'import') RETURNING id
    `, ['TRK001' + Date.now(), user.id, optionId]);
    
    await query(`
        INSERT INTO shipment_addresses (shipment_id, type, name, phone, country, state, city, address)
        VALUES ($1, 'receiver', 'Receiver One', '123', 'Nigeria', 'Lagos', 'Ikeja', 'Street 1')
    `, [s1.rows[0].id]);

    // Shipment 2: Pending
    const s2 = await query(`
        INSERT INTO shipments (tracking_number, user_id, status, total_price, shipment_option_id, service_type)
        VALUES ($1, $2, 'pending', 7000, $3, 'export') RETURNING id
    `, ['TRK002' + Date.now(), user.id, optionId]);
     await query(`
        INSERT INTO shipment_addresses (shipment_id, type, name, phone, country, state, city, address)
        VALUES ($1, 'receiver', 'Receiver Two', '123', 'Nigeria', 'Abuja', 'Maitama', 'Street 2')
    `, [s2.rows[0].id]);

    // Shipment 3: Delivered
    const s3 = await query(`
        INSERT INTO shipments (tracking_number, user_id, status, total_price, shipment_option_id, service_type)
        VALUES ($1, $2, 'delivered', 10000, $3, 'import') RETURNING id
    `, ['TRK003' + Date.now(), user.id, optionId]);
     await query(`
        INSERT INTO shipment_addresses (shipment_id, type, name, phone, country, state, city, address)
        VALUES ($1, 'receiver', 'Receiver Three', '123', 'Nigeria', 'Lagos', 'Lekki', 'Street 3')
    `, [s3.rows[0].id]);

    console.log('Test data created.');
    return { user, admin };
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
        if (!data.status) throw new Error(`Login failed for ${email}: ${data.message}`);
        return data.payload.token;
    } catch (e) {
        console.error(`Login error for ${email}. Status: ${res.status}`);
        console.error('Response body:', text);
        const fs = await import('fs');
        fs.writeFileSync('debug_login_response.json', text);
        throw e;
    }
};

const runTests = async () => {
    try {
        console.log('Starting setupTestData...');
        const { user, admin } = await setupTestData();
        console.log('setupTestData done.');
        
        // Login
        console.log('Logging in user...');
        const userToken = await login(user.email, 'password123');
        console.log('User logged in. Token length:', userToken?.length);
        
        console.log('Logging in admin...');
        const adminToken = await login(admin.email, 'password123');
        console.log('Admin logged in. Token length:', adminToken?.length);
        
        console.log('\n--- User Endpoints ---');
        
        // 1. User Recent
        console.log('Fetching User Recent...');
        const userRecentRes = await fetch(`${baseUrl}/shipments/user/recent`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const userRecentData = await userRecentRes.json();
        console.log('User Recent:', userRecentData.status ? 'OK' : 'FAIL', userRecentData.payload?.length + ' items');
        if (userRecentData.payload && userRecentData.payload.length > 0) {
            console.log('Sample:', userRecentData.payload[0]);
        }

        // 2. User Pending Count
        console.log('Fetching User Pending...');
        const userPendingRes = await fetch(`${baseUrl}/shipments/user/pending`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const userPendingData = await userPendingRes.json();
        console.log('User Pending Count:', userPendingData.status ? 'OK' : 'FAIL', userPendingData.payload);

        // 3. User Total Count
        console.log('Fetching User Total...');
        const userTotalRes = await fetch(`${baseUrl}/shipments/user/total`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const userTotalData = await userTotalRes.json();
        console.log('User Total Count:', userTotalData.status ? 'OK' : 'FAIL', userTotalData.payload);

        console.log('\n--- Admin Endpoints ---');

        // 4. Admin Recent
        console.log('Fetching Admin Recent...');
        const adminRecentRes = await fetch(`${baseUrl}/admin/shipments/recent`, { // Note: Check route path
             headers: { 'Authorization': `Bearer ${adminToken}` }
        });
         // Wait, verify admin route path.
         // admin.routes.js is mounted at /api/admin
         // route is router.get('/shipments/recent', ...)
         // So URL is /api/admin/shipments/recent
         // In script: `${baseUrl}/admin/shipments/recent` -> /api/admin/shipments/recent. Correct.
        
        const adminRecentData = await adminRecentRes.json(); 
        console.log('Admin Recent:', adminRecentData.status ? 'OK' : 'FAIL', adminRecentData.payload?.length + ' items');

        // 5. Admin Pending Count
        console.log('Fetching Admin Pending...');
        const adminPendingRes = await fetch(`${baseUrl}/admin/shipments/pending-count`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const adminPendingData = await adminPendingRes.json();
        console.log('Admin Pending Count:', adminPendingData.status ? 'OK' : 'FAIL', adminPendingData.payload);

        // 6. Admin Total Count
        console.log('Fetching Admin Total...');
        const adminTotalRes = await fetch(`${baseUrl}/admin/shipments/total-count`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const adminTotalData = await adminTotalRes.json();
        console.log('Admin Total Count:', adminTotalData.status ? 'OK' : 'FAIL', adminTotalData.payload);

    } catch (err) {
        console.error('Test failed:', err);
        console.error('Stack:', err.stack);
    } finally {
        await pool.end();
    }
};

runTests();
