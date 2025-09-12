require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

async function createOrdersTable() {
  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255),
        amount NUMERIC,
        currency VARCHAR(10),
        reference VARCHAR(255) UNIQUE,
        plan VARCHAR(50),
        account_size NUMERIC,
        status VARCHAR(20) DEFAULT 'pending',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    console.log("Orders table created (or already exists).");
    process.exit(0);
  } catch (error) {
    console.error("Error creating orders table:", error);
    process.exit(1);
  }
}

createOrdersTable();
