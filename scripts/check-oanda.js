require('dotenv').config();

const OandaClient = require('../lib/oanda-client');

async function main() {
  console.log('=== OANDA Connectivity Check ===');
  console.log(`Environment: ${process.env.OANDA_ENVIRONMENT || 'practice'}`);
  console.log(`Account ID: ${process.env.OANDA_ACCOUNT_ID || '(not set)'}`);
  console.log(`Token set: ${process.env.OANDA_TOKEN ? 'yes' : 'no'}`);
  console.log('---------------------------------------------');

  const client = new OandaClient();

  // Step 1: Basic connectivity + account discovery
  const conn = await client.testConnection();
  if (!conn.success) {
    console.error('❌ Failed to connect to OANDA:', conn.error || conn);
    process.exit(1);
  }

  // Step 2: Pricing for major FX pairs
  const majors = [
    'EUR_USD',
    'GBP_USD',
    'USD_JPY',
    'USD_CHF',
    'AUD_USD',
    'USD_CAD',
  ];

  try {
    console.log('\n📊 Fetching pricing for majors:', majors.join(', '));
    const resp = await client.getPricing(majors);
    if (!resp.success) {
      console.error('❌ Pricing request failed:', resp.statusCode, resp.data);
      process.exit(1);
    }

    const prices = resp.data?.prices || [];
    if (prices.length === 0) {
      console.warn('⚠️ No prices returned');
      process.exit(2);
    }

    console.log(`✅ Received ${prices.length} instruments`);
    for (const p of prices) {
      const bid = parseFloat(p.bids?.[0]?.price || NaN);
      const ask = parseFloat(p.asks?.[0]?.price || NaN);
      const instrument = p.instrument;
      const factor = instrument.includes('JPY') ? 100 : 10000;
      const spreadPips = isFinite(bid) && isFinite(ask) ? ((ask - bid) * factor).toFixed(1) : 'N/A';
      console.log(`💱 ${instrument}: bid=${bid || 'N/A'} ask=${ask || 'N/A'} spread=${spreadPips} pips`);
    }

    console.log('\n🎯 OANDA pricing check completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('💥 Error fetching pricing:', err.message);
    process.exit(1);
  }
}

main();

