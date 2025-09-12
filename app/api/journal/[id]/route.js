import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { getSql } from '../../../../lib/db'

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Journal entry ID is required' },
        { status: 400 }
      )
    }

    const sql = getSql()

    // Get user ID from email
    const user = await sql`
      SELECT id FROM users WHERE email = ${session.user.email}
    `

    if (user.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userId = user[0].id

    // Get specific journal entry
    const entry = await sql`
      SELECT id, title, conversation_data, message_count, created_at
      FROM journal_entries 
      WHERE id = ${id} AND user_id = ${userId}
    `

    if (entry.length === 0) {
      return NextResponse.json(
        { error: 'Journal entry not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      entry: entry[0]
    })

  } catch (error) {
    console.error('Journal entry fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch journal entry' },
      { status: 500 }
    )
  }
}