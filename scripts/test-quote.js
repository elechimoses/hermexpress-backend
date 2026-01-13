import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000/api';

const runTest = async () => {
    // 1. Get Countries
    let res = await fetch(`${baseUrl}/locations/countries?type=export`);
    let countries = await res.json();
    const usa = countries.payload.find(c => c.code === 'US');
    
    // 3. Get Quote (Standard)
    res = await fetch(`${baseUrl}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            serviceType: 'export',
            destinationCountryId: usa.id,
            weight: 4,
            length: 10, width: 10, height: 10
        })
    });
    let quote = await res.json();
    console.log('STATUS:', res.status);
    console.log('RESPONSE (Standard):', JSON.stringify(quote, null, 2));

    // 4. Get Quote (Volumetric)
    console.log('\n--- Volumetric Test (No Weight provided) ---');
    // Using dimensions 20x20x20 = 1.6kg vol weight.
    res = await fetch(`${baseUrl}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            serviceType: 'export',
            destinationCountryId: usa.id,
            length: 20, width: 20, height: 20,
            isVolumetric: true
        })
    });
    quote = await res.json();
    console.log('STATUS:', res.status);
    console.log('RESPONSE (Volumetric):', JSON.stringify(quote, null, 2));
};

runTest();
