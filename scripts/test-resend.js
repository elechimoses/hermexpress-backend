import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000/auth';
const email = `resend_test_${Date.now()}@example.com`;
const password = 'password123';

const runTest = async () => {
    // 1. Register User
    console.log('\n--- 1. Registering User ---');
    let res = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            firstName: 'Resend', lastName: 'Test', email, phone: '1234567890', password, accountType: 'personal'
        })
    });
    let data = await res.json();
    console.log('Register:', res.status, data.message);

    if (res.status === 201) {
        // 2. Try Resend Immediately (Should Fail - Rate Limit)
        console.log('\n--- 2. Resend Immediately (Expect 429) ---');
        res = await fetch(`${baseUrl}/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        data = await res.json();
        console.log('Resend #1:', res.status, data.message);

        // 3. For testing, we can wait or just rely on the fact that rate limit worked.
        // To verify success, we would need to manually update DB last_otp_sent_at or wait 1 min.
        // We will assume if 429 is returned, the logic is active.
    }
};

runTest();
