import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import OandaClient from "../../../../lib/oanda-client";

const sql = neon(process.env.DATABASE_URL);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const accountId = searchParams.get("account_id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

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

    // Check if trades table exists first
    const tablesExist = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'trades'
      );
    `;

    if (!tablesExist[0].exists) {
      // Return empty response if tables don't exist yet
      return NextResponse.json({
        success: true,
        data: {
          trades: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false,
          },
          summary: {
            total_trades: 0,
            open_trades: 0,
            closed_trades: 0,
            total_unrealized_pnl: 0,
          },
        },
        message: "Trade history tables not yet initialized",
      });
    }

    // Get trades with account information
    const trades = accountId
      ? await sql`
          SELECT
            t.id,
            t.account_id,
            t.trade_id as oanda_trade_id,
            t.instrument,
            t.units,
            t.order_type,
            t.entry_price,
            t.stop_loss,
            t.take_profit,
            t.status,
            t.side,
            t.timestamp,
            t.created_at,
            ta.account_type,
            ta.account_size,
            ta.oanda_account_id,
            o.metadata
          FROM trades t
          LEFT JOIN trading_accounts ta ON t.account_id = ta.id
          LEFT JOIN orders o ON t.order_id = o.id
          WHERE ta.user_id = ${userId} AND t.account_id = ${accountId}
          ORDER BY t.timestamp DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `
      : await sql`
          SELECT
            t.id,
            t.account_id,
            t.trade_id as oanda_trade_id,
            t.instrument,
            t.units,
            t.order_type,
            t.entry_price,
            t.stop_loss,
            t.take_profit,
            t.status,
            t.side,
            t.timestamp,
            t.created_at,
            ta.account_type,
            ta.account_size,
            ta.oanda_account_id,
            o.metadata
          FROM trades t
          LEFT JOIN trading_accounts ta ON t.account_id = ta.id
          LEFT JOIN orders o ON t.order_id = o.id
          WHERE ta.user_id = ${userId}
          ORDER BY t.timestamp DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

    // Get total count for pagination
    const countResult = accountId
      ? await sql`
          SELECT COUNT(*) as total
          FROM trades t
          LEFT JOIN trading_accounts ta ON t.account_id = ta.id
          WHERE ta.user_id = ${userId} AND t.account_id = ${accountId}
        `
      : await sql`
          SELECT COUNT(*) as total
          FROM trades t
          LEFT JOIN trading_accounts ta ON t.account_id = ta.id
          WHERE ta.user_id = ${userId}
        `;

    const totalTrades = parseInt(countResult[0].total);

    // Process trades to add current P&L for open positions
    const oanda = new OandaClient();
    const processedTrades = await Promise.all(
      trades.map(async (trade) => {
        let currentPnl = null;
        let currentPrice = null;
        let unrealizedPnl = null;

        // If trade is still open, get current P&L from OANDA
        if (trade.status === "open" && trade.oanda_trade_id) {
          try {
            // Get current price for the instrument
            const pricingResp = await oanda.getPricing(trade.instrument, String(trade.oanda_account_id || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim());
            if (pricingResp?.success && pricingResp.data?.prices?.[0]) {
              const priceData = pricingResp.data.prices[0];
              currentPrice =
                trade.side === "BUY"
                  ? parseFloat(
                      priceData.bids?.[0]?.price || priceData.closeoutBid,
                    )
                  : parseFloat(
                      priceData.asks?.[0]?.price || priceData.closeoutAsk,
                    );

              // Calculate unrealized P&L
              if (currentPrice && trade.entry_price) {
                const entryPrice = parseFloat(trade.entry_price);
                const units = parseInt(trade.units);

                let priceDiff;
                if (trade.side === "BUY") {
                  priceDiff = currentPrice - entryPrice;
                } else {
                  priceDiff = entryPrice - currentPrice;
                }

                // For JPY pairs, pip value is different
                const pipSize = trade.instrument.includes("JPY")
                  ? 0.01
                  : 0.0001;
                const pipValue = trade.instrument.includes("JPY")
                  ? (pipSize / currentPrice) * Math.abs(units)
                  : pipSize * Math.abs(units);

                unrealizedPnl = (priceDiff / pipSize) * pipValue;
              }
            }
          } catch (error) {
            console.error(
              `Error fetching current P&L for trade ${trade.id}:`,
              error.message,
            );
          }
        }

        // Parse metadata for additional info
        let tradeReason = null;
        let sizingInfo = null;
        try {
          const metadata = JSON.parse(trade.metadata || "{}");
          tradeReason = metadata.reason;
          sizingInfo = metadata.sizing;
        } catch (e) {
          // Ignore JSON parse errors
        }

        return {
          ...trade,
          current_price: currentPrice,
          unrealized_pnl: unrealizedPnl,
          trade_reason: tradeReason,
          sizing_info: sizingInfo,
          // Format display values
          entry_price_formatted: parseFloat(trade.entry_price || 0).toFixed(
            trade.instrument.includes("JPY") ? 3 : 5,
          ),
          stop_loss_formatted: trade.stop_loss
            ? parseFloat(trade.stop_loss).toFixed(
                trade.instrument.includes("JPY") ? 3 : 5,
              )
            : null,
          take_profit_formatted: trade.take_profit
            ? parseFloat(trade.take_profit).toFixed(
                trade.instrument.includes("JPY") ? 3 : 5,
              )
            : null,
          units_formatted: Math.abs(
            parseInt(trade.units || 0),
          ).toLocaleString(),
          timestamp_formatted: new Date(trade.timestamp).toLocaleString(),
        };
      }),
    );

    // Calculate summary statistics
    const openTrades = processedTrades.filter((t) => t.status === "open");
    const closedTrades = processedTrades.filter((t) => t.status === "closed");
    const totalUnrealizedPnl = openTrades.reduce(
      (sum, trade) => sum + (trade.unrealized_pnl || 0),
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        trades: processedTrades,
        pagination: {
          total: totalTrades,
          limit,
          offset,
          hasMore: offset + limit < totalTrades,
        },
        summary: {
          total_trades: totalTrades,
          open_trades: openTrades.length,
          closed_trades: closedTrades.length,
          total_unrealized_pnl: totalUnrealizedPnl,
        },
      },
    });
  } catch (error) {
    console.error("Get trades history error:", error);

    // Handle specific database errors gracefully
    if (error.code === "42P01") {
      // Table doesn't exist
      return NextResponse.json({
        success: true,
        data: {
          trades: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false,
          },
          summary: {
            total_trades: 0,
            open_trades: 0,
            closed_trades: 0,
            total_unrealized_pnl: 0,
          },
        },
        message: "Trade history not available yet",
      });
    }

    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
