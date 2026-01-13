import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000';

const testSecurity = async () => {
    console.log('\n--- Testing 404 Handler ---');
    const ghostRes = await fetch(`${baseUrl}/api/ghost_route`);
    const ghostData = await ghostRes.json();
    console.log(`GET /api/ghost_route Status: ${ghostRes.status}`);
    console.log('Response:', ghostData);
    
    if (ghostRes.status !== 404 || ghostData.message !== 'Route not found') {
        throw new Error('404 Handler failed');
    }

    console.log('\n--- Testing Rate Limit (Mock) ---');
    // Note: To test this properly, we'd need to spam 101 requests. 
    // For this quick check, we just confirm the headers exist on a normal request.
    const limitRes = await fetch(`${baseUrl}/`); // Root route might not be limited if applied to /api only?
    // Let's check /api/user/profile (needs auth, but rate limit hits first hopefully?)
    // Or just check /api endpoint (404 but rate limited first)
    
    const apiRes = await fetch(`${baseUrl}/api/test`);
    const remaining = apiRes.headers.get('RateLimit-Remaining');
    console.log('RateLimit-Remaining:', remaining);
    
    if (!remaining) {
        throw new Error('Rate Limit headers missing');
    }
    
    console.log('Rate Limit headers present.');
};

const run = async () => {
    try {
        await testSecurity();
        console.log('All tests passed.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
