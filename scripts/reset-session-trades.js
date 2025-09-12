require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const m = a.match(/^--(account|a)=(\d+)$/);
    if (m) out.account = parseInt(m[2], 10);
  }
  if (!out.account && process.env.ACCOUNT_ID) {
    out.account = parseInt(process.env.ACCOUNT_ID, 10);
  }
  return out;
}

function getSessionWindow(date = new Date()) {
  // UTC sessions matching app/api/trading/order logic
  const sessions = [
    { name: 'New York', startHour: 12, endHour: 21 },
    { name: 'London', startHour: 7, endHour: 16 },
    { name: 'Tokyo', startHour: 23, endHour: 8 },
    { name: 'Sydney', startHour: 22, endHour: 7 },
  ];
  const utcHour = date.getUTCHours();
  for (const s of sessions) {
    const { startHour, endHour } = s;
    if (startHour < endHour) {
      if (utcHour >= startHour && utcHour < endHour) {
        const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), startHour, 0, 0));
        const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), endHour, 0, 0));
        return { name: s.name, start, end };
      }
    } else {
      if (utcHour >= startHour || utcHour < endHour) {
        const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), startHour, 0, 0));
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        end.setUTCHours(endHour, 0, 0, 0);
        return { name: s.name, start, end };
      }
    }
  }
  // Fallback 1-hour window
  return { name: 'Unknown', start: new Date(date.getTime() - 60*60*1000), end: new Date(date.getTime() + 60*60*1000) };
}

async function main() {
  const { account } = parseArgs();
  if (!account) {
    console.error('Usage: node scripts/reset-session-trades.js --account=ACCOUNT_ID\n  or set env ACCOUNT_ID=...');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const win = getSessionWindow(new Date());
  console.log(`Resetting trades for account ${account} in session ${win.name}`);
  console.log(`Window: ${win.start.toISOString()} -> ${win.end.toISOString()}`);

  try {
    const result = await sql`
      DELETE FROM trades
      WHERE account_id = ${account}
      AND timestamp >= ${win.start.toISOString()}
      AND timestamp < ${win.end.toISOString()}
      RETURNING id;
    `;
    console.log(`Deleted ${result.length} trade(s) in current session window.`);
    process.exit(0);
  } catch (e) {
    console.error('Error resetting session trades:', e.message || e);
    process.exit(1);
  }
}

main();

