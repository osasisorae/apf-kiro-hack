require('dotenv').config();
const OandaClient = require('../lib/oanda-client');

(async () => {
  try {
    if (!process.env.OANDA_TOKEN) {
      console.error('OANDA_TOKEN not set');
      process.exit(1);
    }

    const oanda = new OandaClient();

    console.log('=== OANDA Accounts Raw Dump ===');
    console.log(`Environment: ${process.env.OANDA_ENVIRONMENT || 'practice'}`);

    // 1) Dump GET /v3/accounts response as-is
    const list = await oanda.getAccounts();
    console.log('\n--- GET /v3/accounts ---');
    console.log('status:', list.statusCode);
    console.log(JSON.stringify(list.data, null, 2));

    const accounts = (list.data && list.data.accounts) ? list.data.accounts : [];
    if (accounts.length === 0) {
      console.log('\nNo accounts found to fetch details for.');
      process.exit(0);
    }

    // 2) For each account: dump GET /v3/accounts/{id}
    console.log('\n--- GET /v3/accounts/{accountID} (full details) ---');
    for (const a of accounts) {
      try {
        const full = await oanda.getAccount(a.id);
        console.log(`\naccountID: ${a.id}`);
        console.log('status:', full.statusCode);
        console.log(JSON.stringify(full.data, null, 2));
      } catch (e) {
        console.log(`\naccountID: ${a.id}`);
        console.log('error:', e.message || e);
      }
    }

    // 3) For each account: dump GET /v3/accounts/{id}/summary
    console.log('\n--- GET /v3/accounts/{accountID}/summary ---');
    for (const a of accounts) {
      try {
        const sum = await oanda.getAccountSummary(a.id);
        console.log(`\naccountID: ${a.id}`);
        console.log('status:', sum.statusCode);
        console.log(JSON.stringify(sum.data, null, 2));
      } catch (e) {
        console.log(`\naccountID: ${a.id}`);
        console.log('error:', e.message || e);
      }
    }

    console.log('\nDone.');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
})();
