import { NextResponse } from 'next/server'
import { getSql, initDb } from '../../../../lib/db'

export async function GET(request) {
  try {
    // Simple authentication check
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')
    
    if (password !== 'aurum2025') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Initialize database
    await initDb()
    const sql = getSql()

    // Get all waitlist entries
    const waitlistData = await sql`
      SELECT id, email, timestamp, source, ip, user_agent 
      FROM waitlist 
      ORDER BY timestamp DESC
    `

    // Get total count
    const totalCount = await sql`SELECT COUNT(*) as count FROM waitlist`

    return NextResponse.json({
      success: true,
      totalSignups: parseInt(totalCount[0]?.count) || 0,
      emails: waitlistData.map((item, index) => ({
        position: index + 1,
        id: item.id,
        email: item.email,
        timestamp: item.timestamp,
        source: item.source,
        ip: item.ip,
        userAgent: item.user_agent
      }))
    })

  } catch (error) {
    console.error('Admin error:', error)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}