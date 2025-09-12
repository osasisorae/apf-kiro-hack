require('dotenv').config();
const OandaClient = require('../lib/oanda-client');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { confirm: false };
  for (const a of args) {
    if (a === '--yes' || a === '-y') out.confirm = true;
    const m = a.match(/^--account=(.+)$/);
    if (m) out.account = m[1];
  }
  if (!out.account && process.env.OANDA_ACCOUNT_ID) out.account = process.env.OANDA_ACCOUNT_ID;
  return out;
}

async function main() {
  const { account, confirm } = parseArgs();
  const client = new OandaClient();

  if (!account) {
    console.error('Usage: node scripts/close-all-trades.js --account=ACCOUNT_ID [-y]');
    process.exit(1);
  }

  console.log('=== Close All Open Trades ===');
  console.log('Account:', account);
  const open = await client.getOpenTrades(account);
  if (!open.success) {
    console.error('Failed to fetch open trades:', open.statusCode, open.data);
    process.exit(1);
  }

  const trades = open.data.trades || [];
  if (trades.length === 0) {
    console.log('No open trades.');
    process.exit(0);
  }

  console.log(`Found ${trades.length} open trade(s):`);
  trades.forEach(t => console.log(` - ${t.id} ${t.instrument} ${t.currentUnits} @ ${t.price}`));

  if (!confirm) {
    console.log('\nAdd --yes to confirm closing all open trades.');
    process.exit(0);
  }

  for (const t of trades) {
    try {
      console.log(`Closing trade ${t.id} (${t.instrument})...`);
      const resp = await client.closeTrade(t.id, 'ALL', account);
      console.log(' status:', resp.statusCode, 'success:', resp.success);
    } catch (e) {
      console.error(' Failed to close trade', t.id, e && e.message);
    }
  }

  console.log('Done.');
}

main();

