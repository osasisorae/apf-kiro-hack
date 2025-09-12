require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

/**
 * A script to delete all rows in the 'orders' table, modeled after cleanup-db.js.
 */
(async () => {
  try {
    const sql = neon(process.env.DATABASE_URL);

    console.log("Deleting all rows from the 'orders' table...");
    await sql`DELETE FROM orders;`;

    console.log("Successfully removed all rows from 'orders'.");
    process.exit(0);
  } catch (error) {
    console.error("Error cleaning up orders table:", error);
    process.exit(1);
  }
})();
