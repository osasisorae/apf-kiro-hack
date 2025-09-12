require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

/**
 * A script to connect to the Neon DB using CommonJS (require) syntax
 * and list all rows in the 'trading_accounts' table.
 */
(async () => {
  try {
    const sql = neon(process.env.DATABASE_URL);

    console.log("=== Checking trading_accounts table ===");

    // Fetch rows
    const rows = await sql`SELECT * FROM trading_accounts;`;

    if (!rows || rows.length === 0) {
      console.log("No trading_accounts found.");
    } else {
      console.log(`Found ${rows.length} trading_accounts record(s):`);
      rows.forEach((r, i) => {
        console.log(`Record #${i + 1}:`, r);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error("Error checking trading_accounts table:", error);
    process.exit(1);
  }
})();
