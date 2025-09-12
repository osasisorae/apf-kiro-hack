require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

(async () => {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL not set');
      process.exit(1);
    }
    const sql = neon(process.env.DATABASE_URL);

    console.log('🔎 Ensuring plan_tier column exists...');
    await sql`ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS plan_tier TEXT;`;

    console.log('🔄 Fetching accounts missing plan_tier...');
    const accounts = await sql`
      SELECT ta.id, ta.user_id, ta.account_size
      FROM trading_accounts ta
      WHERE ta.plan_tier IS NULL OR ta.plan_tier = ''
    `;

    if (!accounts || accounts.length === 0) {
      console.log('✅ Nothing to backfill; all rows have plan_tier.');
      process.exit(0);
    }

    let updated = 0;
    for (const acc of accounts) {
      try {
        const users = await sql`SELECT email FROM users WHERE id = ${acc.user_id} LIMIT 1`;
        const email = users?.[0]?.email || null;
        if (!email) continue;

        const orders = await sql`
          SELECT plan
          FROM orders
          WHERE user_email = ${email}
            AND account_size = ${acc.account_size}
            AND status = 'success'
          ORDER BY created_at DESC
          LIMIT 1
        `;
        let tier = 'standard';
        if (orders && orders.length > 0) {
          const p = String(orders[0].plan || '').toLowerCase();
          tier = p === 'pro' ? 'pro' : 'standard';
        }

        await sql`UPDATE trading_accounts SET plan_tier = ${tier} WHERE id = ${acc.id}`;
        updated++;
      } catch (e) {
        console.warn(`⚠️ Could not backfill account ${acc.id}:`, e.message || e);
      }
    }

    console.log(`✅ Backfill complete. Updated ${updated} row(s).`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Backfill failed:', e.message || e);
    process.exit(1);
  }
})();

