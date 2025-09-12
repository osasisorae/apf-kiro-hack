import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { neon } from '@neondatabase/serverless'
export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL)

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await sql`
      SELECT ta.id, ta.user_id, ta.account_type, ta.account_size, ta.plan_tier, ta.status, ta.start_date,
             ta.oanda_account_id, u.email as user_email
      FROM trading_accounts ta
      LEFT JOIN users u ON u.id = ta.user_id
      WHERE ta.status = 'provisioning'
      ORDER BY ta.start_date DESC
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { account_id, oanda_account_id } = body || {}
    if (!account_id || !oanda_account_id) {
      return NextResponse.json({ error: 'account_id and oanda_account_id are required' }, { status: 400 })
    }

    // Ensure columns exist for new fields
    await sql`ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;`
    await sql`ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS approved_by INTEGER;`

    const upd = await sql`
      UPDATE trading_accounts
      SET oanda_account_id = ${oanda_account_id}, status = 'active', provisioned_at = NOW(), approved_by = ${Number(session.user.id) || null}
      WHERE id = ${Number(account_id)}
      RETURNING id, oanda_account_id, status
    `
    if (!upd || upd.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: upd[0] })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
