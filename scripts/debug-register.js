import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000';

const run = async () => {
    const email = `debug_${Date.now()}@test.com`;
    console.log('Registering:', email);
    
    try {
        const regRes = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                firstName: 'Debug', 
                lastName: 'User', 
                email, 
                phone: '5551234567', 
                password: 'password123', 
                accountType: 'personal', 
                countryCode: '+234' 
            })
        });
        
        const text = await regRes.text();
        console.log('Status:', regRes.status);
        console.log('Body:', text);

    } catch (err) {
        console.error('Fetch Error:', err);
    }
};

run();
