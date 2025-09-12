require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

/**
 * Drops all unneeded tables, leaving only 'users' and 'waitlist'.
 */
(async () => {
  try {
    const sql = neon(process.env.DATABASE_URL);

    console.log("Dropping tables we no longer want...");
    await sql`DROP TABLE IF EXISTS journal_entries CASCADE;`;
    await sql`DROP TABLE IF EXISTS orders CASCADE;`;
    await sql`DROP TABLE IF EXISTS trades CASCADE;`;
    await sql`DROP TABLE IF EXISTS trading_accounts CASCADE;`;
    await sql`DROP TABLE IF EXISTS transactions CASCADE;`;

    console.log(
      "Successfully cleaned up the database. Only 'users' and 'waitlist' remain.",
    );
    process.exit(0);
  } catch (error) {
    console.error("Error cleaning up database:", error);
    process.exit(1);
  }
})();
