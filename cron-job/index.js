require('dotenv').config();
const fetch = require('node-fetch');

const API_URL = process.env.API_URL;

if (!API_URL) {
  console.error('❌ Missing API_URL in .env file');
  process.exit(1);
}

async function callEndpoint() {
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Endpoint response:', data);
  } catch (err) {
    console.error('❌ Error calling endpoint:', err.message);
    process.exit(1);
  }
}

callEndpoint();
