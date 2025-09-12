// Compare DB-saved OANDA account IDs against live OANDA accounts
// Usage: node scripts/check-oanda-attachment.js
// Requires: DATABASE_URL, OANDA_TOKEN, optional OANDA_ENVIRONMENT in .env

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const path = require('path');

// Reuse the app's OANDA client
const OandaClient = require(path.join(process.cwd(), 'lib', 'oanda-client.js'));

function normalizeId(id) {
  if (id === null || id === undefined) return '';
  let s = String(id);
  // Remove zero-width chars and trim whitespace
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  return s;
}

(async () => {
  const dbUrl = process.env.DATABASE_URL;
  const token = process.env.OANDA_TOKEN;

  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }
  if (!token) {
    console.error('❌ OANDA_TOKEN not set');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const oanda = new OandaClient();

  try {
    console.log('📡 Fetching OANDA accounts...');
    const resp = await oanda.getAccounts();
    if (!resp.success) {
      console.error('❌ OANDA getAccounts failed:', resp.statusCode, resp.data);
      process.exit(1);
    }
    const oandaAccounts = resp.data?.accounts || [];
    const oandaSet = new Set(oandaAccounts.map(a => normalizeId(a.id)));
    console.log(`✅ OANDA accounts fetched: ${oandaAccounts.length}`);

    console.log('🗄️  Fetching DB saved oanda_account_id...');
    const rows = await sql`
      SELECT id, user_id, status, oanda_account_id
      FROM trading_accounts
      WHERE oanda_account_id IS NOT NULL
      ORDER BY id DESC
    `;
    console.log(`✅ DB rows with oanda_account_id: ${rows.length}`);

    const report = rows.map(r => {
      const raw = r.oanda_account_id;
      const normalized = normalizeId(raw);
      const foundInOanda = normalized ? oandaSet.has(normalized) : false;
      return {
        trading_account_id: r.id,
        user_id: r.user_id,
        status: r.status,
        saved_oanda_id: raw,
        normalized_saved_oanda_id: normalized,
        found_in_oanda: foundInOanda,
      };
    });

    const notFound = report.filter(r => r.normalized_saved_oanda_id && !r.found_in_oanda);
    const attachedSetFromDb = new Set(report.filter(r => r.found_in_oanda).map(r => r.normalized_saved_oanda_id));
    const unattachedOanda = oandaAccounts
      .map(a => String(a.id))
      .filter(id => !attachedSetFromDb.has(normalizeId(id)));

    console.log('\n=== Summary ===');
    console.log(`Total OANDA accounts: ${oandaAccounts.length}`);
    console.log(`DB rows with saved oanda_account_id: ${rows.length}`);
    console.log(`DB rows matching an OANDA id: ${report.length - notFound.length}`);
    console.log(`DB rows NOT matching any OANDA id: ${notFound.length}`);
    console.log(`OANDA accounts with NO DB attachment: ${unattachedOanda.length}`);

    if (notFound.length > 0) {
      console.log('\n--- DB rows with saved IDs not found in OANDA (likely typos/whitespace/mismatch) ---');
      console.table(
        notFound.map(x => ({
          trading_account_id: x.trading_account_id,
          user_id: x.user_id,
          status: x.status,
          saved_oanda_id: x.saved_oanda_id,
          normalized_saved_oanda_id: x.normalized_saved_oanda_id,
        }))
      );
    }

    if (unattachedOanda.length > 0) {
      console.log('\n--- OANDA accounts not attached to any DB row ---');
      console.table(unattachedOanda.map(id => ({ oanda_account_id: id })));
    }

    console.log('\n--- Full comparison (first 50) ---');
    console.table(report.slice(0, 50));

    console.log('\n✅ Done.');
  } catch (err) {
    console.error('❌ Error:', err?.message || err);
    process.exit(1);
  }
})();

