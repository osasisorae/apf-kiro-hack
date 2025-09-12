import { neon } from '@neondatabase/serverless'

let sql = null

// Database connection with connection pooling for serverless
export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  
  // Reuse connection if it exists
  if (!sql) {
    sql = neon(process.env.DATABASE_URL)
  }
  
  return sql
}

// Initialize database (create table if it doesn't exist)
export async function initDb() {
  const sqlClient = getSql()
  
  try {
    // Create table if it doesn't exist
    await sqlClient`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        timestamp TIMESTAMP DEFAULT NOW(),
        source VARCHAR(50) DEFAULT 'landing_page',
        ip VARCHAR(45),
        user_agent TEXT
      );
    `
    console.log('Database initialized successfully')
    return true
  } catch (error) {
    console.error('Database initialization error:', error)
    throw error
  }
}