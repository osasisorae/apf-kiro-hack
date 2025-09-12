require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

/**
 * Adds missing columns used by the app to existing tables.
 * - trading_accounts: updated_at (TIMESTAMPTZ), oanda_account_id (TEXT)
 * - trades: pnl (NUMERIC) — used by refresh endpoint for summary stats
 *
 * The script is idempotent and uses IF NOT EXISTS guards.
 */
(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('🔎 Checking for trading_accounts table...');
    const taExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'trading_accounts'
      ) as exists;
    `;
    if (!taExists?.[0]?.exists) {
      console.warn("⚠️ trading_accounts table doesn't exist. Nothing to alter.");
    } else {
      console.log('✅ trading_accounts table exists. Applying safe alterations...');

      // Add updated_at column if missing
      await sql`ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
      console.log('➕ ensured trading_accounts.updated_at column');

      // Backfill updated_at if NULL
      await sql`UPDATE trading_accounts SET updated_at = NOW() WHERE updated_at IS NULL;`;
      console.log('🧹 backfilled NULL updated_at values to NOW()');

      // Add oanda_account_id if missing
      await sql`ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS oanda_account_id TEXT;`;
      console.log('➕ ensured trading_accounts.oanda_account_id column');

      // Add plan_tier (standard|pro) if missing
      await sql`ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS plan_tier TEXT;`;
      console.log('➕ ensured trading_accounts.plan_tier column');

      // Add provisioning metadata columns
      await sql`ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;`;
      await sql`ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS approved_by INTEGER;`;
      console.log('➕ ensured trading_accounts.provisioned_at, approved_by columns');
    }

    console.log('🔎 Checking for trades table...');
    const tradesExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'trades'
      ) as exists;
    `;
    if (!tradesExists?.[0]?.exists) {
      console.warn("⚠️ trades table doesn't exist. Skipping trades alterations.");
    } else {
      // Ensure pnl column exists, used by update-account refresh summaries
      await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS pnl NUMERIC;`;
      console.log('➕ ensured trades.pnl column');
    }

    console.log('✅ Schema update complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Schema update failed:', err.message || err);
    process.exit(1);
  }
})();
