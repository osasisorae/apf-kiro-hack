require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

/**
 * A script to delete all rows in the 'trading_accounts' table,
 * following the style of cleanup-db.js.
 */
(async () => {
  try {
    const sql = neon(process.env.DATABASE_URL);

    console.log("Deleting all rows from 'trading_accounts' table...");
    await sql`DELETE FROM trading_accounts;`;

    console.log("Successfully removed all rows from 'trading_accounts'.");
    process.exit(0);
  } catch (error) {
    console.error("Error cleaning up trading_accounts table:", error);
    process.exit(1);
  }
})();
