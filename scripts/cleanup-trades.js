require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { yes: false };
  for (const a of args) {
    let m;
    if (a === '--yes' || a === '-y') opts.yes = true;
    else if (a === '--all') opts.all = true;
    else if ((m = a.match(/^--email=(.+)$/))) opts.email = m[1];
    else if ((m = a.match(/^--account=(\d+)$/))) opts.account = parseInt(m[1], 10);
  }
  return opts;
}

async function main() {
  const { yes, all, email, account } = parseArgs();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  if (!yes) {
    console.log('Dry run. Use --yes to execute. Filters:');
    console.log({ all, email, account });
  }

  try {
    // Ensure trades table exists
    const exists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name='trades'
      ) as e;
    `;
    if (!exists?.[0]?.e) {
      console.log('No trades table found. Nothing to do.');
      process.exit(0);
    }

    let rows = [];
    if (all) {
      rows = await sql`SELECT id FROM trades LIMIT 1;`;
      console.log('Target: all trades');
      if (yes) {
        const del = await sql`DELETE FROM trades;`;
        console.log('Deleted all trades.');
      }
      process.exit(0);
    }

    if (account) {
      rows = await sql`SELECT id FROM trades WHERE account_id=${account} LIMIT 1;`;
      console.log(`Target: trades for account_id=${account}`);
      if (yes) {
        const del = await sql`DELETE FROM trades WHERE account_id=${account};`;
        console.log('Deleted trades for account', account);
      }
      process.exit(0);
    }

    if (email) {
      // get user id
      const user = await sql`SELECT id FROM users WHERE email=${email} LIMIT 1;`;
      if (!user || user.length === 0) {
        console.error('User not found for email:', email);
        process.exit(1);
      }
      const userId = user[0].id;
      // get accounts for user
      const accs = await sql`SELECT id FROM trading_accounts WHERE user_id=${userId};`;
      if (!accs || accs.length === 0) {
        console.log('No trading accounts for user.');
        process.exit(0);
      }
      const ids = accs.map(a => a.id);
      console.log(`Target: trades for user ${email} (accounts: ${ids.join(', ')})`);
      if (yes) {
        const del = await sql`DELETE FROM trades WHERE account_id = ANY(${ids});`;
        console.log('Deleted trades for user', email);
      }
      process.exit(0);
    }

    console.log('Specify a filter: --all or --email=<email> or --account=<id>. Add --yes to execute.');
    process.exit(0);
  } catch (e) {
    console.error('Cleanup error:', e.message || e);
    process.exit(1);
  }
}

main();

