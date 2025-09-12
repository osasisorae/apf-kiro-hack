import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required" },
        { status: 400 },
      );
    }

    // Get user ID first
    const user = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (user.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = user[0].id;

    // Ensure trading_accounts table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'trading_accounts'
      );
    `;

    if (!tableExists?.[0]?.exists) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Retrieve trading accounts for the user
    const accounts = await sql`
      SELECT
        id,
        user_id,
        account_type,
        account_size,
        plan_tier,
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
        oanda_account_id,
        created_at
      FROM trading_accounts
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error("Get accounts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
