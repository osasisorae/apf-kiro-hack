import { NextResponse } from 'next/server'
import { getSql, initDb } from '../../../lib/db'

export async function POST(request) {
  try {
    console.log('Waitlist API called')
    
    // Initialize database
    await initDb()
    const sql = getSql()

    const { email } = await request.json()

    // Validate email
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    const cleanEmail = email.toLowerCase().trim()

    // Check if email already exists
    const existingUser = await sql`
      SELECT id FROM waitlist WHERE email = ${cleanEmail} LIMIT 1
    `

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown'

    // Insert new user
    const newUser = await sql`
      INSERT INTO waitlist (email, source, ip, user_agent)
      VALUES (${cleanEmail}, 'landing_page', ${ip}, ${request.headers.get('user-agent') || 'unknown'})
      RETURNING id, email, timestamp
    `

    // Get total count for position
    const totalCount = await sql`SELECT COUNT(*) as count FROM waitlist`
    const position = parseInt(totalCount[0]?.count) || 1

    console.log('New waitlist signup:', {
      email: cleanEmail,
      position: position,
      ip: ip
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the waitlist!',
      position: position,
      id: newUser[0]?.id
    })

  } catch (error) {
    console.error('Waitlist error:', error)
    
    if (error.message && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}