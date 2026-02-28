import 'dotenv/config';
import { query } from '../src/db/index.js';
import fetch from 'node-fetch';

const CITIES_URL = 'https://raw.githubusercontent.com/russ666/all-countries-and-cities-json/master/countries.json';
const ISO_URL = 'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json';

// Aliases for country names that differ between datasets
const aliases = {
    'united states': 'US',
    'south korea': 'KR',
    'north korea': 'KP',
    'russia': 'RU',
    'iran': 'IR',
    'vietnam': 'VN',
    'tanzania': 'TZ',
    'congo': 'CG',
    'syria': 'SY',
    'bolivia': 'BO',
    'moldova': 'MD',
    'laos': 'LA',
    'taiwan': 'TW',
    'turkey': 'TR',
    'netherlands': 'NL',
    'united kingdom': 'GB',
    'czech republic': 'CZ',
    'palestine': 'PS',
    'cape verde': 'CV',
    "cote d'ivoire": 'CI',
    'ivory coast': 'CI',
    'timor-leste': 'TL',
    'east timor': 'TL',
    'brunei': 'BN',
    'myanmar (burma)': 'MM',
    'burma': 'MM',
    'micronesia': 'FM',
    'swaziland': 'SZ',
    'saint kitts and nevis': 'KN',
    'saint lucia': 'LC',
    'saint vincent and the grenadines': 'VC',
    'trinidad & tobago': 'TT',
    'reunion': 'RE',
    'curacao': 'CW',
};

async function seed() {
    console.log('Fetching data from GitHub...');
    const [citiesRes, isoRes] = await Promise.all([fetch(CITIES_URL), fetch(ISO_URL)]);
    const citiesData = await citiesRes.json();
    const isoData = await isoRes.json();

    // Build ISO code lookup
    const isoMap = {};
    for (const entry of isoData) {
        isoMap[entry.name.toLowerCase()] = entry['alpha-2'];
    }

    const countriesList = Object.keys(citiesData);
    console.log(`Loaded ${countriesList.length} countries. Building batch inserts...`);

    const countriesToInsert = [];
    const skipped = [];

    for (const countryName of countriesList) {
        const lowerName = countryName.toLowerCase();
        const code = isoMap[lowerName] || aliases[lowerName];
        if (!code) {
            skipped.push(countryName);
            continue;
        }
        const cities = (citiesData[countryName] || []).slice(0, 10);
        countriesToInsert.push({ name: countryName, code, cities });
    }

    if (skipped.length > 0) {
        console.log(`⚠️  ${skipped.length} countries skipped (no ISO code): ${skipped.join(', ')}`);
    }

    console.log(`Inserting/updating ${countriesToInsert.length} countries...`);

    // Batch insert all countries at once using a single query
    // Build VALUES clause: ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10), ...
    const countryValues = [];
    const countryParams = [];
    let pIdx = 1;

    for (const c of countriesToInsert) {
        countryValues.push(`($${pIdx++}, $${pIdx++}, TRUE, TRUE, TRUE)`);
        countryParams.push(c.name, c.code);
    }

    const upsertSQL = `
        INSERT INTO countries (name, code, is_active, can_import_from, can_export_to)
        VALUES ${countryValues.join(',\n')}
        ON CONFLICT (code) DO UPDATE 
            SET name = EXCLUDED.name,
                is_active = TRUE,
                can_import_from = TRUE,
                can_export_to = TRUE
        RETURNING id, code
    `;

    const countryResult = await query(upsertSQL, countryParams);
    console.log(`✅ Upserted ${countryResult.rows.length} countries.`);

    // Build a code -> id map
    const codeToId = {};
    for (const row of countryResult.rows) {
        codeToId[row.code] = row.id;
    }

    // Batch insert cities - build one large query
    const cityValues = [];
    const cityParams = [];
    let cIdx = 1;

    for (const c of countriesToInsert) {
        const countryId = codeToId[c.code];
        if (!countryId) continue;
        for (const cityName of c.cities) {
            cityValues.push(`($${cIdx++}, $${cIdx++}, '', TRUE)`);
            cityParams.push(countryId, cityName);
        }
    }

    if (cityValues.length > 0) {
        // Split into batches of 500 rows to avoid query limits
        const BATCH_SIZE = 500;
        let cityInserted = 0;

        for (let i = 0; i < cityValues.length; i += BATCH_SIZE) {
            const batchValues = cityValues.slice(i, i + BATCH_SIZE);
            const batchParams = cityParams.slice(i * 2, (i + BATCH_SIZE) * 2);

            // Re-index params for this batch
            const reindexed = [];
            const reindexedParams = [];
            let bi = 1;
            for (let j = 0; j < batchValues.length; j++) {
                reindexed.push(`($${bi++}, $${bi++}, '', TRUE)`);
                reindexedParams.push(cityParams[(i + j) * 2], cityParams[(i + j) * 2 + 1]);
            }

            const citySQL = `
                INSERT INTO cities (country_id, name, state, is_active)
                VALUES ${reindexed.join(',\n')}
                ON CONFLICT DO NOTHING
            `;
            const r = await query(citySQL, reindexedParams);
            cityInserted += r.rowCount;
            process.stdout.write(`\r   Cities inserted: ${cityInserted}`);
        }

        console.log(`\n✅ Inserted ${cityInserted} cities.`);
    }

    const countryCount = await query('SELECT COUNT(*) FROM countries');
    const cityCount = await query('SELECT COUNT(*) FROM cities');
    console.log(`\n📊 Final DB counts:`);
    console.log(`   Countries: ${countryCount.rows[0].count}`);
    console.log(`   Cities: ${cityCount.rows[0].count}`);
}

seed().catch(console.error).finally(() => process.exit());
