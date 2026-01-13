import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000';

async function testQuotes() {
    try {
        console.log('--- Fetching Countries ---');
        const cRes = await fetch(`${baseUrl}/api/locations/countries`);
        const cData = await cRes.json();
        const countries = cData.payload;
        
        const nigeria = countries.find(c => c.code === 'NG');
        const usa = countries.find(c => c.code === 'US');
        const uk = countries.find(c => c.code === 'GB');

        if (!nigeria || !usa) throw new Error('Seeding issue: Needed countries not found');

        console.log('--- Test 1: Valid Export (NG -> USA) ---');
        // Expect Success
        let res = await fetch(`${baseUrl}/api/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serviceType: 'export',
                pickupCountryId: nigeria.id,  // Should match "From" logic
                destinationCountryId: usa.id, // Should have can_export_to=true
                weight: 5
            })
        });
        let data = await res.json();
        console.log('Export Status:', data.status, data.message);
        if (data.status) console.log('Price:', data.payload.quotes[0]?.formattedPrice);

        console.log('\n--- Test 2: Invalid Export (USA -> NG) ---');
        // Expect Failure usually, unless USA has can_export_to=true (which means we export TO USA, but here verify logic)
        // Logic: Dest Country must be can_export_to. Nigeria usually defined as "can_import_from" not "can_export_to"?
        // Wait, if we are exporting TO Nigeria from USA, that's an import.
        // If we say serviceType='export', and dest=NG. Logic checks: Does NG have can_export_to=true?
        // Likely NG row has can_export_to=false (we don't export to ourselves).
        res = await fetch(`${baseUrl}/api/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serviceType: 'export',
                pickupCountryId: usa.id, 
                destinationCountryId: nigeria.id, 
                weight: 5
            })
        });
        data = await res.json();
        console.log('Invalid Export Status (Expected 400):', data.status, data.message);

        console.log('\n--- Test 3: Valid Import (USA -> NG) ---');
        // Logic: Pickup (USA) must have can_import_from=true.
        res = await fetch(`${baseUrl}/api/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serviceType: 'import',
                pickupCountryId: usa.id,
                destinationCountryId: nigeria.id,
                weight: 5
            })
        });
        data = await res.json();
        console.log('Import Status:', data.status, data.message);
        if (data.status) console.log('Price:', data.payload.quotes[0]?.formattedPrice);

    } catch (err) {
        console.error('Test Error:', err);
    }
}

testQuotes();
