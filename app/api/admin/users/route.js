import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'

const sql = neon(process.env.DATABASE_URL)

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, name, role = 'user', password, create_account, account_size, account_type = 'challenge' } = body || {}

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    // Normalize
    const normalizedEmail = String(email).trim().toLowerCase()

    // Ensure users table exists (create if missing)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `

    // Check if user exists
    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1`
    if (existing.length > 0) {
      // Update password/role for existing user on approval
      if (!password) {
        return NextResponse.json({ success: false, error: 'Password is required to approve existing user' }, { status: 400 })
      }
      const hashExisting = await bcrypt.hash(password, 10)
      await sql`UPDATE users SET password=${hashExisting}, role=${role || 'user'} WHERE id=${existing[0].id}`
      return NextResponse.json({ success: true, user_id: existing[0].id, created: false, updated: true })
    }

    // Generate or hash password
    const plain = password || Math.random().toString(36).slice(-10)
    const hash = await bcrypt.hash(plain, 10)

    // Insert user
    const ins = await sql`
      INSERT INTO users (email, password, role, name)
      VALUES (${normalizedEmail}, ${hash}, ${role}, ${name || normalizedEmail})
      RETURNING id
    `

    const userId = ins[0].id
    let createdAccountId = null

    // Optionally create a default trading account (not used in current admin flow)
    if (create_account && account_size) {
      const sizeNum = Number(account_size)
      const profitTarget = Math.round(sizeNum * 0.1)
      const maxLoss = Math.round(sizeNum * 0.1)
      const accIns = await sql`
        INSERT INTO trading_accounts (
          user_id, account_type, account_size, status, challenge_phase,
          current_balance, max_balance, start_date, profit_target, max_drawdown
        ) VALUES (
          ${userId}, ${account_type}, ${sizeNum}, 'active', 'phase1',
          ${sizeNum}, ${sizeNum}, NOW(), ${profitTarget}, ${maxLoss}
        ) RETURNING id
      `
      createdAccountId = accIns[0].id
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      created: true,
      generated_password: password ? null : plain,
      account_id: createdAccountId
    })
  } catch (err) {
    console.error('Admin create user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
