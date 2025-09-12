import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import OandaClient from '../../../../lib/oanda-client'

const sql = neon(process.env.DATABASE_URL)

export async function POST(request) {
  try {
    const body = await request.json()
    const { account_id, trade_result, action } = body

    if (!account_id) {
      return NextResponse.json(
        { error: 'account_id is required' },
        { status: 400 }
      )
    }

    // Get current account data
    const accountResult = await sql`
      SELECT
        id,
        user_id,
        account_type,
        account_size,
        current_balance,
        max_balance,
        total_trades,
        winning_trades,
        losing_trades,
        profit_loss,
        oanda_account_id
      FROM trading_accounts
      WHERE id = ${account_id}
      LIMIT 1
    `

    if (accountResult.length === 0) {
      return NextResponse.json(
        { error: 'Trading account not found' },
        { status: 404 }
      )
    }

    const account = accountResult[0]

    // Get current balance from OANDA if possible
    let currentOandaBalance = null
    try {
      const oanda = new OandaClient()
      const externalAccountId = String(account.oanda_account_id || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()

      if (externalAccountId) {
        const accountSummary = await oanda.getAccountSummary(externalAccountId)
        if (accountSummary?.success && accountSummary.data?.account) {
          currentOandaBalance = parseFloat(accountSummary.data.account.balance)
        }
      }
    } catch (error) {
      console.warn('Could not fetch OANDA balance:', error.message)
    }

    // Apply scoped, atomic updates to avoid clobbering concurrent changes
    if (action === 'trade_opened') {
      if (currentOandaBalance !== null) {
        await sql`
          UPDATE trading_accounts
          SET
            total_trades = COALESCE(total_trades, 0) + 1,
            current_balance = ${currentOandaBalance},
            max_balance = GREATEST(COALESCE(max_balance, ${currentOandaBalance}), ${currentOandaBalance}),
            profit_loss = ${currentOandaBalance} - account_size,
            updated_at = NOW()
          WHERE id = ${account_id}
        `
      } else {
        await sql`
          UPDATE trading_accounts
          SET
            total_trades = COALESCE(total_trades, 0) + 1,
            updated_at = NOW()
          WHERE id = ${account_id}
        `
      }
    } else if (action === 'trade_closed' && trade_result) {
      const tradePnl = parseFloat(trade_result.pnl || 0)
      const winInc = tradePnl > 0 ? 1 : 0
      const loseInc = tradePnl < 0 ? 1 : 0

      if (currentOandaBalance !== null) {
        await sql`
          UPDATE trading_accounts
          SET
            profit_loss = COALESCE(profit_loss, 0) + ${tradePnl},
            current_balance = ${currentOandaBalance},
            winning_trades = COALESCE(winning_trades, 0) + ${winInc},
            losing_trades = COALESCE(losing_trades, 0) + ${loseInc},
            max_balance = GREATEST(COALESCE(max_balance, ${currentOandaBalance}), ${currentOandaBalance}),
            updated_at = NOW()
          WHERE id = ${account_id}
        `
      } else {
        await sql`
          UPDATE trading_accounts
          SET
            profit_loss = COALESCE(profit_loss, 0) + ${tradePnl},
            current_balance = COALESCE(current_balance, 0) + ${tradePnl},
            winning_trades = COALESCE(winning_trades, 0) + ${winInc},
            losing_trades = COALESCE(losing_trades, 0) + ${loseInc},
            max_balance = GREATEST(COALESCE(max_balance, 0), COALESCE(current_balance, 0) + ${tradePnl}),
            updated_at = NOW()
          WHERE id = ${account_id}
        `
      }
    } else if (action === 'sync_balance') {
      // Only sync balance-related fields, never touch trade counters to avoid races
      if (currentOandaBalance !== null) {
        await sql`
          UPDATE trading_accounts
          SET
            current_balance = ${currentOandaBalance},
            max_balance = GREATEST(COALESCE(max_balance, ${currentOandaBalance}), ${currentOandaBalance}),
            profit_loss = ${currentOandaBalance} - account_size,
            updated_at = NOW()
          WHERE id = ${account_id}
        `
      }
    }

    // Return latest stats snapshot
    const latest = await sql`
      SELECT account_size, current_balance, max_balance, total_trades, winning_trades, losing_trades, profit_loss
      FROM trading_accounts WHERE id = ${account_id} LIMIT 1
    `

    const s = latest && latest[0] ? latest[0] : account
    const winRate = (Number(s.total_trades || 0) > 0)
      ? ((Number(s.winning_trades || 0) / Number(s.total_trades || 0)) * 100).toFixed(1)
      : 0
    const profitPercent = Number(s.account_size || 0) > 0
      ? ((Number(s.profit_loss || 0) / Number(s.account_size || 1)) * 100).toFixed(2)
      : 0

    console.log(`✅ Updated account ${account_id} statistics:`, {
      balance: s.current_balance,
      pnl: s.profit_loss,
      totalTrades: s.total_trades,
      winRate: `${winRate}%`,
      action
    })

    return NextResponse.json({
      success: true,
      data: {
        account_id,
        updated_stats: {
          current_balance: s.current_balance,
          max_balance: s.max_balance,
          total_trades: s.total_trades,
          winning_trades: s.winning_trades,
          losing_trades: s.losing_trades,
          profit_loss: s.profit_loss,
          win_rate: winRate,
          profit_percent: profitPercent
        },
        oanda_balance_used: currentOandaBalance !== null,
        action_performed: action
      }
    })

  } catch (error) {
    console.error('Update account statistics error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// GET method to refresh account statistics from current trade data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')
    const email = searchParams.get('email')

    if (!accountId && !email) {
      return NextResponse.json(
        { error: 'Either account_id or email parameter required' },
        { status: 400 }
      )
    }

    // Get accounts to refresh
    let accounts = []
    if (accountId) {
      const result = await sql`
        SELECT id FROM trading_accounts WHERE id = ${accountId}
      `
      accounts = result
    } else if (email) {
      const userResult = await sql`
        SELECT id FROM users WHERE email = ${email}
      `
      if (userResult.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      const userId = userResult[0].id

      const result = await sql`
        SELECT id FROM trading_accounts WHERE user_id = ${userId} AND status = 'active'
      `
      accounts = result
    }

    // Refresh each account
    const refreshResults = []
    for (const account of accounts) {
      try {
        // Recalculate statistics from trades table
        const tradesResult = await sql`
          SELECT
            COUNT(*) as total_trades,
            COUNT(CASE WHEN status = 'closed' AND pnl > 0 THEN 1 END) as winning_trades,
            COUNT(CASE WHEN status = 'closed' AND pnl < 0 THEN 1 END) as losing_trades,
            COALESCE(SUM(CASE WHEN status = 'closed' THEN pnl ELSE 0 END), 0) as realized_pnl
          FROM trades
          WHERE account_id = ${account.id}
        `

        if (tradesResult.length > 0) {
          const stats = tradesResult[0]

          // Sync balance with OANDA and update statistics
          const response = await fetch(`${request.url.origin}/api/trading/update-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_id: account.id,
              action: 'sync_balance'
            })
          })

          const syncResult = await response.json()
          refreshResults.push({
            account_id: account.id,
            refreshed: syncResult.success,
            stats: syncResult.data?.updated_stats
          })
        }
      } catch (error) {
        console.error(`Error refreshing account ${account.id}:`, error.message)
        refreshResults.push({
          account_id: account.id,
          refreshed: false,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      refreshed_accounts: refreshResults.length,
      results: refreshResults
    })

  } catch (error) {
    console.error('Refresh account statistics error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
