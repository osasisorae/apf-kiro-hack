require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

/**
 * Lists all rows in the 'orders' table, logging them to the console.
 */
(async () => {
  try {
    // Initialize Neon client
    const sql = neon(process.env.DATABASE_URL);

    // Fetch all orders
    const orders = await sql`SELECT * FROM orders;`;

    console.log("=== Orders Table Contents ===");
    if (!orders || orders.length === 0) {
      console.log("No orders found.");
    } else {
      orders.forEach((order, index) => {
        console.log(`Order #${index + 1}:`, order);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error("Error listing orders table:", error);
    process.exit(1);
  }
})();
