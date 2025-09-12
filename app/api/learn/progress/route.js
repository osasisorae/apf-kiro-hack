import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { getSql } from '../../../../lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS learning_progress (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      completed_lessons JSONB DEFAULT '[]',
      current_module NUMERIC,
      current_lesson NUMERIC,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const sql = getSql()
    await ensureTable(sql)
    const rows = await sql`SELECT completed_lessons, current_module, current_lesson FROM learning_progress WHERE user_id = ${Number(session.user.id)} LIMIT 1`
    if (rows && rows.length > 0) {
      return NextResponse.json({ success: true, data: rows[0] })
    }
    return NextResponse.json({ success: true, data: { completed_lessons: [], current_module: null, current_lesson: null } })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const completed = Array.isArray(body.completed) ? body.completed : []
    const current_module = body.current_module ?? null
    const current_lesson = body.current_lesson ?? null

    const sql = getSql()
    await ensureTable(sql)

    await sql`
      INSERT INTO learning_progress (user_id, completed_lessons, current_module, current_lesson, updated_at)
      VALUES (${Number(session.user.id)}, ${JSON.stringify(completed)}::jsonb, ${current_module}, ${current_lesson}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        completed_lessons = EXCLUDED.completed_lessons,
        current_module = EXCLUDED.current_module,
        current_lesson = EXCLUDED.current_lesson,
        updated_at = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

