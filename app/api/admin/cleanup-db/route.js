import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

export async function POST(request) {
  try {
    const body = await request.json()

    // Simple security check - require a specific token
    if (body.confirm !== 'DELETE_ALL_TRADING_DATA') {
      return NextResponse.json(
        { error: 'Invalid confirmation token' },
        { status: 400 }
      )
    }

    console.log('🧹 Starting database cleanup...')

    // Delete in correct order to handle foreign key constraints

    // 1. Delete journal entries
    const journalResult = await sql`DELETE FROM journal_entries`
    console.log(`🗑️ Deleted ${journalResult.count || 0} journal entries`)

    // 2. Delete trades (references trading_accounts)
    const tradesResult = await sql`DELETE FROM trades`
    console.log(`🗑️ Deleted ${tradesResult.count || 0} trades`)

    // 3. Delete orders
    const ordersResult = await sql`DELETE FROM orders`
    console.log(`🗑️ Deleted ${ordersResult.count || 0} orders`)

    // 4. Delete trading accounts
    const accountsResult = await sql`DELETE FROM trading_accounts`
    console.log(`🗑️ Deleted ${accountsResult.count || 0} trading accounts`)

    // Optional: Reset auto-increment sequences if using them
    try {
      await sql`ALTER SEQUENCE trades_id_seq RESTART WITH 1`
      await sql`ALTER SEQUENCE orders_id_seq RESTART WITH 1`
      await sql`ALTER SEQUENCE trading_accounts_id_seq RESTART WITH 1`
      await sql`ALTER SEQUENCE journal_entries_id_seq RESTART WITH 1`
      console.log('🔄 Reset ID sequences')
    } catch (seqError) {
      console.log('⚠️ Could not reset sequences (might not exist):', seqError.message)
    }

    const summary = {
      journal_entries_deleted: journalResult.count || 0,
      trades_deleted: tradesResult.count || 0,
      orders_deleted: ordersResult.count || 0,
      trading_accounts_deleted: accountsResult.count || 0,
      timestamp: new Date().toISOString()
    }

    console.log('✅ Database cleanup completed:', summary)

    return NextResponse.json({
      success: true,
      message: 'Database cleanup completed successfully',
      summary
    })

  } catch (error) {
    console.error('💥 Database cleanup error:', error)
    return NextResponse.json(
      {
        error: 'Failed to cleanup database',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// GET method to check what would be deleted (dry run)
export async function GET(request) {
  try {
    console.log('🔍 Checking database contents...')

    // Count records in each table
    const journalCount = await sql`SELECT COUNT(*) as count FROM journal_entries`
    const tradesCount = await sql`SELECT COUNT(*) as count FROM trades`
    const ordersCount = await sql`SELECT COUNT(*) as count FROM orders`
    const accountsCount = await sql`SELECT COUNT(*) as count FROM trading_accounts`

    const summary = {
      journal_entries: parseInt(journalCount[0].count),
      trades: parseInt(tradesCount[0].count),
      orders: parseInt(ordersCount[0].count),
      trading_accounts: parseInt(accountsCount[0].count),
      total_records: parseInt(journalCount[0].count) +
                    parseInt(tradesCount[0].count) +
                    parseInt(ordersCount[0].count) +
                    parseInt(accountsCount[0].count)
    }

    console.log('📊 Database contents:', summary)

    return NextResponse.json({
      success: true,
      message: 'Database contents check completed',
      current_data: summary,
      cleanup_instructions: {
        method: 'POST',
        body: { confirm: 'DELETE_ALL_TRADING_DATA' },
        warning: 'This will permanently delete all trading data!'
      }
    })

  } catch (error) {
    console.error('💥 Database check error:', error)
    return NextResponse.json(
      {
        error: 'Failed to check database contents',
        details: error.message
      },
      { status: 500 }
    )
  }
}
