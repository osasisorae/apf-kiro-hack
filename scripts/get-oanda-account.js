require('dotenv').config();
const OandaClient = require('../lib/oanda-client');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const m = a.match(/^--account=(.+)$/);
    if (m) out.account = m[1];
  }
  if (!out.account && process.env.OANDA_ACCOUNT_ID) {
    out.account = process.env.OANDA_ACCOUNT_ID;
  }
  return out;
}

async function main() {
  const { account } = parseArgs();
  const client = new OandaClient();

  console.log('=== OANDA Account Info ===');
  console.log(`Environment: ${process.env.OANDA_ENVIRONMENT || 'practice'}`);
  console.log(`Provided Account: ${account || '(none)'}`);

  // List accounts
  const list = await client.getAccounts();
  if (!list.success) {
    console.error('Failed to list accounts:', list.statusCode, list.data);
    process.exit(1);
  }

  const accounts = list.data.accounts || [];
  if (accounts.length === 0) {
    console.log('No accounts returned.');
    process.exit(0);
  }

  console.log(`Found ${accounts.length} account(s):`);
  accounts.forEach((a, i) => console.log(` ${i + 1}. ${a.id} (${a.tags?.join(', ') || 'no tags'})`));

  const target = account || accounts[0].id;
  console.log(`\nFetching summary for: ${target}`);
  const summary = await client.getAccountSummary(target);
  if (!summary.success) {
    console.error('Failed to get account summary:', summary.statusCode, summary.data);
    process.exit(1);
  }

  const acc = summary.data.account || {};
  console.log('Currency:', acc.currency);
  console.log('Balance:', acc.balance);
  console.log('NAV:', acc.NAV);
  console.log('Unrealized P/L:', acc.unrealizedPL);
  console.log('Margin Available:', acc.marginAvailable);
  console.log('Open Trade Count:', acc.openTradeCount);
}

main();

