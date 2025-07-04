require('dotenv').config();
const fetch = require('node-fetch');

const API_URL = process.env.API_URL;
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '60000'); // default: 60 sec

if (!API_URL) {
  console.error('❌ Missing API_URL in .env file');
  process.exit(1);
}

if (isNaN(INTERVAL_MS) || INTERVAL_MS < 1000) {
  console.error('❌ Invalid INTERVAL_MS in .env file. Must be >= 1000');
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
  }
}

// Ejecutar cada X milisegundos según .env
setInterval(() => {
  callEndpoint();
}, INTERVAL_MS);
