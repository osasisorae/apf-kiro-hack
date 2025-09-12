require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function createJournalEntriesTable() {
  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT,
        conversation_data JSONB NOT NULL,
        message_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Helpful indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_journal_user_id ON journal_entries(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_journal_created_at ON journal_entries(created_at DESC);`;

    console.log('Journal entries table created (or already exists).');
    process.exit(0);
  } catch (error) {
    console.error('Error creating journal_entries table:', error);
    process.exit(1);
  }
}

createJournalEntriesTable();

