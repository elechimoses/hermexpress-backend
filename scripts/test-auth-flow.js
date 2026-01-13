import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000/auth';
const email = 'login_test@example.com';
const password = 'password123';

const runTest = async () => {
    // 1. Register User
    console.log('\n--- 1. Registering User ---');
    let res = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            firstName: 'Login', lastName: 'Test', email, phone: '1234567890', password, accountType: 'personal'
        })
    });
    let data = await res.json();
    console.log('Register:', res.status, data.message);

    if (res.status === 201) {
        // Manually verify user (simulating OTP check) to proceed with login test
        // NOTE: In a real integration test we would use the DB, but here we assume the previous OTP test works.
        // We will just try to login, which should fail if unverified.
    }

    // 2. Try Login (Unverified)
    console.log('\n--- 2. Login (Unverified) ---');
    res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    data = await res.json();
    console.log('Login (Unverified):', res.status, data.message); // Should be 403

     // 3. Request Password Reset
     console.log('\n--- 3. Forgot Password ---');
     res = await fetch(`${baseUrl}/forgot-password`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ email })
     });
     data = await res.json();
     console.log('Forgot Password:', res.status, data.message);
};

runTest();
