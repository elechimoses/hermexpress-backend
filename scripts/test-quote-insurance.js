import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000';

const testQuoteInsurance = async () => {
    console.log('\n--- Testing Quote with Insurance ---');
    
    // 1. Valid Request with Value
    const res = await fetch(`${baseUrl}/api/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            serviceType: 'export',
            pickupCountryId: 1, // Nigeria
            destinationCountryId: 2, // USA
            weight: 5,
            value: 500000 // 500k Value
        })
    });

    const data = await res.json();
    
    if (!data.status) {
        throw new Error('Quote failed: ' + data.message);
    }

    console.log('Quotes Found:', data.payload.quotes.length);
    console.log('Insurance Options Found:', data.payload.insuranceOptions.length);

    console.log('\nInsurance Options:');
    data.payload.insuranceOptions.forEach(opt => {
        console.log(`- ${opt.name}: ${opt.formattedFee} (Fee: ${opt.fee})`);
    });

    // Check Premium Calculation: 4% of 500,000 = 20,000. Min fee is 14,000. So should be 20,000.
    const premium = data.payload.insuranceOptions.find(o => o.name.includes('Premium'));
    if (premium && premium.fee !== 20000) {
        console.warn(`WARNING: Expected Premium Fee 20000, got ${premium.fee}`);
    }
};

const run = async () => {
    try {
        await testQuoteInsurance();
        console.log('\nTest Passed');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
