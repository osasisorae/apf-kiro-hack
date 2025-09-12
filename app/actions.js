"use server";

import { neon } from "@neondatabase/serverless";

export async function getWaitlistData() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Get all waitlist entries with detailed info
    const waitlistEntries = await sql`
      SELECT 
        id, 
        email, 
        timestamp, 
        source, 
        ip, 
        user_agent,
        ROW_NUMBER() OVER (ORDER BY timestamp ASC) as position
      FROM waitlist 
      ORDER BY timestamp DESC
    `;

    // Get total count
    const totalCount = await sql`SELECT COUNT(*) as count FROM waitlist`;
    
    // Get today's signups
    const todaySignups = await sql`
      SELECT COUNT(*) as count 
      FROM waitlist 
      WHERE DATE(timestamp) = CURRENT_DATE
    `;
    
    // Get this week's signups
    const weekSignups = await sql`
      SELECT COUNT(*) as count 
      FROM waitlist 
      WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
    `;

    // Get signups by source
    const sourceStats = await sql`
      SELECT source, COUNT(*) as count 
      FROM waitlist 
      GROUP BY source 
      ORDER BY count DESC
    `;

    return {
      success: true,
      data: {
        entries: waitlistEntries,
        stats: {
          total: parseInt(totalCount[0]?.count) || 0,
          today: parseInt(todaySignups[0]?.count) || 0,
          thisWeek: parseInt(weekSignups[0]?.count) || 0,
          sources: sourceStats
        }
      }
    };
  } catch (error) {
    console.error('Database error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function exportWaitlistCSV() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    const entries = await sql`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY timestamp ASC) as position,
        email, 
        timestamp, 
        source, 
        ip, 
        user_agent
      FROM waitlist 
      ORDER BY timestamp ASC
    `;

    // Convert to CSV format
    const headers = ['Position', 'Email', 'Date Joined', 'Source', 'IP Address', 'User Agent'];
    const csvData = [
      headers.join(','),
      ...entries.map(entry => [
        entry.position,
        entry.email,
        new Date(entry.timestamp).toISOString(),
        entry.source,
        entry.ip,
        `"${entry.user_agent}"`
      ].join(','))
    ].join('\n');

    return {
      success: true,
      data: csvData,
      filename: `aurum-waitlist-${new Date().toISOString().split('T')[0]}.csv`
    };
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getUserAccounts(userEmail) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Get user ID first
    const user = await sql`
      SELECT id FROM users WHERE email = ${userEmail}
    `;
    
    if (user.length === 0) {
      return { success: false, error: 'User not found' };
    }
    
    const userId = user[0].id;
    
    // Get all accounts for the user
    const accounts = await sql`
      SELECT 
        id,
        account_type,
        account_size,
        status,
        challenge_phase,
        start_date,
        end_date,
        profit_target,
        max_drawdown,
        current_balance,
        max_balance,
        total_trades,
        winning_trades,
        losing_trades,
        profit_loss,
        created_at
      FROM trading_accounts 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    // Separate active and inactive accounts
    const activeAccounts = accounts.filter(acc => acc.status === 'active');
    const inactiveAccounts = accounts.filter(acc => acc.status !== 'active');
    
    // Calculate stats
    const totalProfit = accounts.reduce((sum, acc) => sum + parseFloat(acc.profit_loss || 0), 0);
    const totalTrades = accounts.reduce((sum, acc) => sum + (acc.total_trades || 0), 0);
    const totalWinning = accounts.reduce((sum, acc) => sum + (acc.winning_trades || 0), 0);
    const winRate = totalTrades > 0 ? (totalWinning / totalTrades * 100).toFixed(1) : 0;

    return {
      success: true,
      data: {
        activeAccounts,
        inactiveAccounts,
        stats: {
          totalAccounts: accounts.length,
          activeCount: activeAccounts.length,
          inactiveCount: inactiveAccounts.length,
          totalProfit,
          totalTrades,
          winRate
        }
      }
    };
  } catch (error) {
    console.error('Get accounts error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}