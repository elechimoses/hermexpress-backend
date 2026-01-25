import { query, pool } from '../src/db/index.js';
import bcrypt from 'bcrypt';
import fetch from 'node-fetch';

import app from '../app.js';
import { createServer } from 'http';

const PORT = 3002;
const baseUrl = `http://localhost:${PORT}/api`;
let server;

const startServer = () => {
    return new Promise((resolve) => {
        server = app.listen(PORT, () => {
            console.log(`Test server running on ${PORT}`);
            resolve();
        });
    });
};

const setupData = async () => {
    console.log('DB:', process.env.DB_NAME || 'Using DATABASE_URL');
    try {
        const typeRes = await query("SELECT data_type FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'id'");
        console.log('Shipment ID Type:', typeRes.rows[0]?.data_type);
    } catch(e) { console.log('Check type failed:', e.message); }
    
    try { 
        await query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                amount DECIMAL(12, 2) NOT NULL,
                reason TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
                due_date TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Invoices table ensured.');
    } catch(e) { console.error('Failed to ensure invoices table:', e.message); }
    console.log('Setting up test data...');
    const password = await bcrypt.hash('password123', 10);
    
    // User
    const userRes = await query(`
        INSERT INTO users (first_name, last_name, email, password, role, is_verified, status, account_type)
        VALUES ('Invoice', 'User', 'invoiceuser@example.com', $1, 'user', true, 'active', 'individual')
        ON CONFLICT (email) DO UPDATE SET is_verified = true RETURNING id, email
    `, [password]);
    const user = userRes.rows[0];

    // Admin
    const adminRes = await query(`
        INSERT INTO users (first_name, last_name, email, password, role, is_verified, status, account_type)
        VALUES ('Invoice', 'Admin', 'invoiceadmin@example.com', $1, 'admin', true, 'active', 'admin')
        ON CONFLICT (email) DO UPDATE SET role = 'admin' RETURNING id, email
    `, [password]);
    const admin = adminRes.rows[0];

    // Create Shipment
    const track = `INV-${Date.now()}`;
    const shipRes = await query(`
        INSERT INTO shipments (tracking_number, user_id, status, service_type, shipment_option_id, total_price, currency, payment_method)
        VALUES ($1, $2, 'delivered', 'import', 1, 5000, 'NGN', '{}')
        RETURNING id, tracking_number
    `, [track, user.id]);
    const shipment = shipRes.rows[0];

    return { user, admin, shipment };
};

const login = async (email) => {
    const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password: 'password123' }),
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!data.status) throw new Error(data.message);
    return data.payload.token;
};

const runTest = async () => {
    try {
        await startServer();
        const { user, admin, shipment } = await setupData();
        const userToken = await login(user.email);
        const adminToken = await login(admin.email);

        console.log('\n--- 1. Admin Creates Invoice ---');
        const invRes = await fetch(`${baseUrl}/invoices/create`, {
            method: 'POST',
            body: JSON.stringify({
                shipmentId: shipment.id,
                amount: 2500,
                reason: 'Underweight payment adjustment'
            }),
            headers: { 
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json' 
            }
        });
        const invData = await invRes.json();
        console.log('Status:', invData.status ? 'Success' : 'Failed', invData.message);
        if (invData.status) {
            console.log('Invoice ID:', invData.payload.invoiceId);
        } else {
             console.log('Create Invoice Failed:', JSON.stringify(invData, null, 2));
        }

        console.log('\n--- 2. User Views Invoices ---');
        const getRes = await fetch(`${baseUrl}/invoices`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const getData = await getRes.json();
        console.log('Get Invoices Response:', JSON.stringify(getData, null, 2));
        
        if (getData.status && getData.payload?.length > 0) {
            console.log('First Invoice Reason:', getData.payload[0].reason);
        }

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        await pool.end();
        if (server) server.close();
    }
};

runTest();
