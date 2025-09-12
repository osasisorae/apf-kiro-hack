require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function createTradesTable() {
  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL,
        user_account_id INTEGER,
        order_id INTEGER,
        trade_id VARCHAR(50),
        instrument VARCHAR(20) NOT NULL,
        units INTEGER NOT NULL,
        order_type VARCHAR(20) NOT NULL,
        entry_price NUMERIC,
        stop_loss NUMERIC,
        take_profit NUMERIC,
        status VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Helpful indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades(account_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);`;

    console.log('Trades table created (or already exists).');
    process.exit(0);
  } catch (error) {
    console.error('Error creating trades table:', error);
    process.exit(1);
  }
}

createTradesTable();

