import axios from 'axios';
import { query } from '../src/db/index.js';
import app from '../app.js';
import http from 'http';

const TEST_PORT = 3001;
const API_URL = `http://localhost:${TEST_PORT}/api`;

async function testCategories() {
  console.log('--- Testing Categories Feature with Temporary Server ---');

  // Start Server
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  console.log(`Temporary server running on port ${TEST_PORT}`);

  // 1. Check DB directly
  try {
    const res = await query('SELECT * FROM categories');
    console.log(`DB Test: Found ${res.rows.length} categories.`);
    
    if (res.rows.length < 5) {
        console.error('DB Test Failed: Expected at least 5 categories.');
    } else {
        console.log('DB Test Passed.');
    }
  } catch (err) {
    console.error('DB Test Error:', err.message);
  }

  // 2. Check Public API
  try {
    console.log(`Fetching from ${API_URL}/categories`);
    const response = await axios.get(`${API_URL}/categories`);
    if (response.status === 200 && response.data.status === true) {
        console.log('API Test Passed: Fetched categories successfully.');
        console.log('API Data:', response.data.payload.map(c => c.name));
    } else {
        console.error('API Test Failed: Unexpected response format', response.data);
    }
  } catch (err) {
    if (err.response) {
      console.error(`API Test Failed: Status ${err.response.status} - ${JSON.stringify(err.response.data)}`);
    } else {
      console.error('API Test Failed: Network Error', err.message);
    }
  }
  
  // Cleanup
  console.log('Closing server...');
  server.close();
  // End DB pool if necessary (from db/index.js pool is export)
  // But pool is not exported with end/close method easily reachable if it's just 'pool' const.
  // Actually db/index.js exports pool.
  try {
    // import pool to close it
    // Wait, I imported { query }, let's import pool too
  } catch(e) {}
  
  process.exit(0);
}

testCategories();
