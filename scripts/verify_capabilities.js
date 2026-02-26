import 'dotenv/config';
import { calculateRates } from '../src/controllers/shipment.controller.js';
import { query } from '../src/db/index.js';

async function testCalculateRatesValidation() {
    console.log('--- Testing calculateRates Validation ---');

    // Setup: Ensure Nigeria has can_export_to = true and can_import_from = true (or check current state)
    // Actually, let's just test with whatever is in the DB and report it.

    const countryRes = await query("SELECT name, can_import_from, can_export_to FROM countries WHERE name IN ('Nigeria', 'United States')");
    console.log('DB State:', JSON.stringify(countryRes.rows, null, 2));

    const req = {
        body: {
            sender: { country: "United States", state: "", city: "" },
            receiver: { country: "Nigeria", state: "Lagos", city: "Ikeja" },
            packages: [{ category: "Electronics", weight: 1, value: 2000, quantity: 1 }],
            serviceType: "import"
        }
    };

    const res = {
        status: function (code) { this.statusCode = code; return this; },
        json: function (data) { this.data = data; return this; }
    };

    console.log('\n--- Test 1: Import from US to Nigeria (Expected fail if US can_import_from is false) ---');
    await calculateRates(req, res);
    console.log('Status:', res.statusCode || 200);
    console.log('Message:', res.data.message);

    console.log('\n--- Test 3: Import from a country with can_import_from = false (Expected fail) ---');
    // Temporarily set a country capability to false for testing
    await query("UPDATE countries SET can_import_from = FALSE WHERE name = 'United States'");
    await calculateRates(req, res);
    console.log('Status:', res.statusCode || 200);
    console.log('Message:', res.data.message);

    // Cleanup
    await query("UPDATE countries SET can_import_from = TRUE WHERE name = 'United States'");
}

testCalculateRatesValidation().then(() => process.exit());
