import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000';
let adminToken = '';

async function loginAdmin() {
    const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@hermexpress.com', password: 'admin123' })
    });
    const data = await res.json();
    if (!data.status) throw new Error('Admin login failed: ' + data.message);
    adminToken = data.payload.token;
    console.log('Admin logged in');
}

async function testCityQuote() {
    try {
        await loginAdmin();

        // 1. Create City (MyCity) in Nigeria
        // Get NG ID first
        const ngRes = await fetch(`${baseUrl}/api/locations/countries`);
        const ngData = await ngRes.json();
        // console.log('NG Data Payload:', JSON.stringify(ngData.payload));
        const nigeria = ngData.payload.find(c => c.code === 'NG');
        if(!nigeria) throw new Error('Nigeria not found in countries list');
        console.log('Nigeria ID:', nigeria.id);
        
        const cityRes = await fetch(`${baseUrl}/admin/cities`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ country_id: nigeria.id, name: 'MyTestCity', state: 'Lagos' })
        });
        const cityData = await cityRes.json();
        if (!cityData.status) {
            console.error('City Creation Failed:', cityData);
            throw new Error('City create failed');
        }
        const myCityId = cityData.payload.id;
        console.log('Created City:', cityData.payload.name, myCityId);

        // 2. Create Specific Rate for MyCity -> USA
        // Get USA ID
        const destRes = await fetch(`${baseUrl}/api/locations/countries?type=import`); // USA accounts for both usually but seeded as such
        // Actually checking logic: Import type returns "can_import_from", Export type returns "can_export_to"
        // For Quote Export: Dest must be in "can_export_to".
        // Let's assume USA is id 2 (seeded).
        const usaId = 2; // based on seed
        const optionId = 1; // Standard

        // Create Rate: High Price for MyTestCity
        await fetch(`${baseUrl}/admin/rates`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                pickup_country_id: nigeria.id,
                destination_country_id: usaId,
                pickup_city_id: myCityId, // Specific City
                shipment_option_id: optionId,
                service_type: 'export',
                min_weight: 0,
                max_weight: 100,
                base_fee: 50000,
                rate_per_kg: 2000
            })
        });
        console.log('Created Specific Rate for MyTestCity (Base: 50000)');

        // 3. Get Quote Matching Specific City
        const quoteRes = await fetch(`${baseUrl}/api/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serviceType: 'export',
                destinationCountryId: usaId,
                pickupCityId: myCityId,
                weight: 5
            })
        });
        const quoteData = await quoteRes.json();
        console.log('City Quote Result:', quoteData.payload.quotes[0].price); // Should reflect 50000 base

        // 4. Get Quote for Random City (Should fallback to General Rate if exists, or fail if not)
        // Ensure General Rate exists (Seeded data usually has one)
        const genQuoteRes = await fetch(`${baseUrl}/api/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serviceType: 'export',
                destinationCountryId: usaId,
                pickupCityId: null,
                weight: 5
            })
        });
        const genQuoteData = await genQuoteRes.json();
        if (genQuoteData.status) {
             console.log('General Quote Result:', genQuoteData.payload.quotes[0].price); 
             // Verify difference
             if (quoteData.payload.quotes[0].price !== genQuoteData.payload.quotes[0].price) {
                 console.log('SUCCESS: Specific rate is different from general rate.');
             } else {
                 console.log('WARNING: Rates are same, might have matched wrong or rates identical.');
             }
        } else {
            console.log('No general rate found (Normal if not seeded wide enough)');
        }

    } catch (err) {
        console.error('Test Failed:', err);
    }
}

testCityQuote();
