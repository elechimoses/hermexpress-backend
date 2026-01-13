import fetch from 'node-fetch';
import http from 'http';

// Dynamic import to handle env var setting before app loads
process.env.NODE_ENV = 'test';
const { default: app } = await import('../app.js');
import { pool } from '../src/db/index.js';

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

const testRates = async () => {
    console.log('\n--- Testing Rates Calculation ---');

    const sender = {
        name: 'Sender Test', 
        country: 'Nigeria', // Using Name, not ID
        state: 'Lagos', city: 'Ikeja', address: '1 Sender St', postal_code: '100'
    };
    const receiver = {
        name: 'Receiver Test', 
        country: 'United States', // Using Name, not ID (fuzzy match assumption "United")
        state: 'NY', city: 'New York', address: '2 Receiver Ave', postal_code: '200'
    };
    const packages = [
        { category: 'Electronics', description: 'Laptop', weight: 2, length: 10, width: 10, height: 10, value: 200000, quantity: 1 }
    ];

    const res = await fetch(`${baseUrl}/api/shipments/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender, receiver, packages,
            serviceType: 'export'
        })
    });

    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error('Response Raw:', text.substring(0, 500));
        throw new Error('Failed to parse JSON');
    }

    if (!data.status) {
        console.error('Rates Error Payload:', JSON.stringify(data, null, 2));
        throw new Error('Rates calculation failed: ' + data.message);
    }

    console.log('Quotes Found:', data.payload.quotes.length);
    console.log('Insurance Options:', data.payload.insuranceOptions.length);
    console.log('Chargeable Weight:', data.payload.summary.chargeableWeight);
    
    // Validate results
    if (data.payload.quotes.length === 0) throw new Error('No quotes returned');
    const quote = data.payload.quotes[0];
    console.log(`Option: ${quote.name} - ${quote.formattedPrice}`);
    
    // Verify aggregation (2kg)
    if (data.payload.summary.chargeableWeight !== 2) {
        throw new Error(`Weight mismatch. Expected 2, got ${data.payload.summary.chargeableWeight}`);
    }
};

const run = async () => {
    try {
        await startServer();
        await testRates();
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
