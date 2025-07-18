require('dotenv').config();
const fetch = require('node-fetch');

const API_URL = process.env.API_URL;

const MAX_INTERVAL_MS = 2_147_483_647n; // int32 max en BigInt
const MIN_INTERVAL_MS = 1000n;

let intervalRaw = process.env.INTERVAL_MS || '60000';
let INTERVAL_MS; // ✅ declaración necesaria

if (!API_URL) {
  console.error('❌ Missing API_URL in .env file');
  process.exit(1);
}

let intervalBigInt;
try {
  intervalBigInt = BigInt(intervalRaw);
} catch (err) {
  console.error('❌ INTERVAL_MS must be a valid integer string');
  process.exit(1);
}

if (intervalBigInt < MIN_INTERVAL_MS) {
  console.error(`❌ Invalid INTERVAL_MS in .env file. Must be >= ${MIN_INTERVAL_MS}`);
  process.exit(1);
}

if (intervalBigInt > MAX_INTERVAL_MS) {
  console.warn(
    `⚠️ INTERVAL_MS too large (${intervalBigInt} ms). Capping to ${MAX_INTERVAL_MS} ms`,
  );
  INTERVAL_MS = Number(MAX_INTERVAL_MS);
} else {
  INTERVAL_MS = Number(intervalBigInt);
}

async function callEndpoint() {
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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
