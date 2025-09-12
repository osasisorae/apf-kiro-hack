import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { getSql } from '../../../lib/db'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { title, conversationData, messageCount } = await request.json()

    if (!conversationData || !messageCount) {
      return NextResponse.json(
        { error: 'Conversation data and message count are required' },
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

    // Generate title if not provided
    const entryTitle = title || `Journal Entry - ${new Date().toLocaleDateString()}`

    // Save journal entry
    const result = await sql`
      INSERT INTO journal_entries (user_id, title, conversation_data, message_count)
      VALUES (${userId}, ${entryTitle}, ${JSON.stringify(conversationData)}, ${messageCount})
      RETURNING id, title, created_at
    `

    return NextResponse.json({
      success: true,
      entry: result[0]
    })

  } catch (error) {
    console.error('Journal save error:', error)
    return NextResponse.json(
      { error: 'Failed to save journal entry' },
      { status: 500 }
    )
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
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

    // Get journal entries for the user
    const entries = await sql`
      SELECT id, title, message_count, created_at
      FROM journal_entries 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      success: true,
      entries
    })

  } catch (error) {
    console.error('Journal fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch journal entries' },
      { status: 500 }
    )
  }
}