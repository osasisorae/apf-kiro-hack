require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

(async () => {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL not set');
      process.exit(1);
    }
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    console.log('Users table created (or already exists).');
    process.exit(0);
  } catch (e) {
    console.error('Error creating users table:', e.message || e);
    process.exit(1);
  }
})();

