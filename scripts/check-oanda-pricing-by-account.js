// Fetch live pricing for a set of instruments using each OANDA account id
// Usage: node scripts/check-oanda-pricing-by-account.js
// Requires: OANDA_TOKEN (and optional OANDA_ENVIRONMENT) in .env

require('dotenv').config();
const path = require('path');
const OandaClient = require(path.join(process.cwd(), 'lib', 'oanda-client.js'));

function normalizeId(id) {
  if (id === null || id === undefined) return '';
  return String(id).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

(async () => {
  if (!process.env.OANDA_TOKEN) {
    console.error('❌ OANDA_TOKEN not set');
    process.exit(1);
  }

  const client = new OandaClient();

  try {
    console.log('=== OANDA Pricing By Account ===');
    console.log('Environment:', process.env.OANDA_ENVIRONMENT || 'practice');

    const list = await client.getAccounts();
    if (!list.success) {
      console.error('❌ Failed to list accounts:', list.statusCode, list.data);
      process.exit(1);
    }

    const accounts = (list.data?.accounts || []).map(a => normalizeId(a.id));
    console.log('Accounts:', accounts);

    const instruments = ['EUR_USD','GBP_USD','USD_CAD','USD_JPY','USD_CHF','AUD_USD'];
    const param = instruments.join(',');

    for (const id of accounts) {
      console.log(`\n--- Pricing for account ${id} ---`);
      try {
        const resp = await client.getPricing(param, id);
        console.log('status:', resp.statusCode, 'success:', resp.success);
        if (resp.success && resp.data?.prices) {
          const rows = resp.data.prices.map(p => {
            const bid = p.bids?.[0]?.price || p.closeoutBid || 'N/A';
            const ask = p.asks?.[0]?.price || p.closeoutAsk || 'N/A';
            return {
              instrument: p.instrument,
              tradeable: p.tradeable,
              status: p.status,
              bid,
              ask,
            };
          });
          console.table(rows);
        } else {
          console.log('Body:', JSON.stringify(resp.data, null, 2));
        }
      } catch (e) {
        console.error('Error:', e.message);
      }
    }

    console.log('\n✅ Done.');
  } catch (err) {
    console.error('❌ Error:', err?.message || err);
    process.exit(1);
  }
})();

