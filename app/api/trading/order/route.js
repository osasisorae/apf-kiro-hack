import { NextResponse } from "next/server";
import OandaClient from "../../../../lib/oanda-client";
import { computeUnits } from "../../../../lib/trade-sizing";
import { getSql } from "../../../../lib/db";

// Minimal POST handler to place a market order and persist basic records
export async function POST(request) {
  try {
    const body = await request.json();

    // Basic validation
    const {
      account_id,
      instrument,
      side,
      units,
      stop_loss,
      take_profit,
      reason,
    } = body;
    if (!account_id || !instrument || !side) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Build OANDA order payload (simple market order)
    const orderPayload = {
      order: {
        units:
          side.toUpperCase() === "BUY"
            ? String(Math.abs(units || 1000))
            : String(-Math.abs(units || 1000)),
        instrument: instrument.replace("/", "_"),
        timeInForce: "FOK",
        type: "MARKET",
        positionFill: "REDUCE_FIRST",
      },
    };

    if (stop_loss) {
      orderPayload.order["stopLossOnFill"] = { price: String(stop_loss) };
    }

    if (take_profit) {
      orderPayload.order["takeProfitOnFill"] = { price: String(take_profit) };
    }

    const oanda = new OandaClient();

    // Enforce: one trade per session per account
    const now = new Date();

    function getSessionWindow(date = new Date()) {
      // Session definitions (UTC) - using the spring/summer set from forextradintip.txt
      const sessions = [
        { name: "New York", startHour: 12, endHour: 21 }, // 12:00 - 21:00 UTC
        { name: "London", startHour: 7, endHour: 16 }, // 07:00 - 16:00 UTC
        { name: "Tokyo", startHour: 23, endHour: 8 }, // 23:00 - 08:00 UTC (wrap)
        { name: "Sydney", startHour: 22, endHour: 7 }, // 22:00 - 07:00 UTC (wrap)
      ];

      const utcHour = date.getUTCHours();

      for (const s of sessions) {
        const { startHour, endHour } = s;
        if (startHour < endHour) {
          // same-day window
          if (utcHour >= startHour && utcHour < endHour) {
            // compute precise start/end Date objects in UTC
            const start = new Date(
              Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                startHour,
                0,
                0,
              ),
            );
            const end = new Date(
              Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                endHour,
                0,
                0,
              ),
            );
            return { name: s.name, start, end };
          }
        } else {
          // wrapping window (start > end) e.g., 22:00 - 07:00
          if (utcHour >= startHour || utcHour < endHour) {
            // start is today at startHour, end is tomorrow at endHour
            const start = new Date(
              Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                startHour,
                0,
                0,
              ),
            );
            const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
            end.setUTCHours(endHour, 0, 0, 0);
            return { name: s.name, start, end };
          }
        }
      }

      // Fallback: return a small window around now
      return {
        name: "Unknown",
        start: new Date(now.getTime() - 60 * 60 * 1000),
        end: new Date(now.getTime() + 60 * 60 * 1000),
      };
    }

    const sessionWindow = getSessionWindow(now);

    const sql = getSql();

    // Enforce one-trade-per-session in production unless explicitly disabled
    const enforceSessionLimit =
      (process.env.NODE_ENV === 'production') && (process.env.ALLOW_MULTIPLE_TRADES !== 'true');

    if (enforceSessionLimit) {
      const existing = await sql`
        SELECT id, timestamp, status
        FROM trades
        WHERE account_id = ${String(account_id)}
        AND timestamp >= ${sessionWindow.start.toISOString()}
        AND timestamp < ${sessionWindow.end.toISOString()}
        LIMIT 1
      `;

      if (existing && existing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Only one trade is allowed per ${sessionWindow.name} session. You already placed a trade at ${new Date(existing[0].timestamp).toLocaleString()}. Please monitor the trade in Spirit Journal and the TradingView chart and wait for the session to end before placing another trade.`,
            guidance:
              "Go to Spirit Journal to review and journal this trade. You may not place another trade until the session window closes.",
          },
          { status: 403 },
        );
      }
    } else {
      console.log('⚙️ Session limit bypassed (non-production or ALLOW_MULTIPLE_TRADES=true).');
    }

    // Server-side sizing: load account info
    const accountRows = await sql`
      SELECT id, user_id, account_type, account_size, current_balance, status, oanda_account_id
      FROM trading_accounts
      WHERE id = ${Number(account_id)}
      LIMIT 1
    `;

    if (!accountRows || accountRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Trading account not found" },
        { status: 404 },
      );
    }

    const account = accountRows[0];

    // Enforce provisioning approval and binding to OANDA account
    if (String(account.status) !== 'active' || !account.oanda_account_id) {
      return NextResponse.json(
        { success: false, error: 'Account not active or not provisioned. Please wait for admin approval.' },
        { status: 403 },
      );
    }

    // Determine pips risk (fixed 7 pips per rules)
    const pipsRisk = 7;

    // Fetch current price for instrument
    const instrumentParam = orderPayload.order.instrument;
    console.log(
      "⏱ sessionWindow:",
      sessionWindow.name,
      sessionWindow.start.toISOString(),
      "->",
      sessionWindow.end.toISOString(),
    );
    console.log(
      "📡 Fetching market price from OANDA for instrument:",
      instrumentParam,
    );
    const pricingResp = await oanda.getPricing(instrumentParam, account.oanda_account_id).catch((err) => {
      console.error("⚠️ OANDA pricing fetch error:", err && err.message);
      return null;
    });

    // Robust price extraction: prefer closeoutBid/closeoutAsk mid, then bids/asks
    let price = null;
    if (pricingResp?.data?.prices && Array.isArray(pricingResp.data.prices)) {
      const priceObj = pricingResp.data.prices.find(p => p.instrument === instrumentParam) || pricingResp.data.prices[0];
      if (priceObj) {
        const closeoutBid = priceObj.closeoutBid ? Number(priceObj.closeoutBid) : null;
        const closeoutAsk = priceObj.closeoutAsk ? Number(priceObj.closeoutAsk) : null;
        const bid = priceObj.bids?.[0]?.price ? Number(priceObj.bids[0].price) : null;
        const ask = priceObj.asks?.[0]?.price ? Number(priceObj.asks[0].price) : null;

        if (!isNaN(closeoutBid) && !isNaN(closeoutAsk)) {
          price = (closeoutBid + closeoutAsk) / 2;
        } else if (!isNaN(bid) && !isNaN(ask)) {
          price = (bid + ask) / 2;
        } else if (!isNaN(bid)) {
          price = bid;
        } else if (!isNaN(ask)) {
          price = ask;
        }

        console.log("📈 Pricing details:", {
          instrument: priceObj.instrument,
          tradeable: priceObj.tradeable,
          status: priceObj.status,
          closeoutBid,
          closeoutAsk,
          bid,
          ask,
          resolvedPrice: price,
        });
      }
    }

    console.log("📈 Pricing resolved:", Boolean(price), "price:", price);

    // Do NOT accept a client-supplied fallback price. Require live market price.
    if (!price) {
      const raw = pricingResp?.data || {};
      const status = raw?.prices?.[0]?.status || raw?.errorMessage || 'unavailable';
      return NextResponse.json(
        {
          success: false,
          error: `Live market price unavailable from OANDA for ${instrumentParam} (status: ${status}). Ensure the instrument is tradeable on the attached account and market is open.`,
          oanda: raw,
        },
        { status: 503 },
      );
    }

    // Compute units using account_size (prefer current_balance if available)
    const acctSize = Number(
      account.account_size || account.current_balance || 0,
    );
    const sizing = computeUnits({
      accountSize: acctSize,
      riskPercent: 0.0025,
      pipsRisk,
      instrument: instrumentParam,
      price,
    });

    // Overwrite units in orderPayload with computed units
    orderPayload.order.units = String(
      side.toUpperCase() === "BUY"
        ? Math.abs(sizing.units)
        : -Math.abs(sizing.units),
    );

    // Attach sizing info to metadata
    const sizingMeta = {
      computedUnits: sizing.units,
      lots: sizing.lots,
      pipSize: sizing.pipSize,
      pipValuePerUnit: sizing.pipValuePerUnitInAccountCurrency,
      riskDollars: sizing.riskDollars,
      pipsRisk,
      priceUsed: price,
    };

    // Compute SL/TP server-side according to account type rules
    // Rules: STANDARD => SL=7 pips, TP=21 pips; PRO => SL=7 pips, TP=42 pips
    function pipSizeForInstrument(instr) {
      if (!instr) return 0.0001;
      return instr.includes("JPY") ? 0.01 : 0.0001;
    }

    function computeSLTPLevels({
      instrument: instr,
      direction,
      midPrice,
      accountType,
    }) {
      const pipSize = pipSizeForInstrument(instr);
      const rules =
        String(accountType || "").toLowerCase() === "pro"
          ? { sl: 7, tp: 42 }
          : { sl: 7, tp: 21 };

      let slLevel, tpLevel;
      if (String(direction).toUpperCase() === "BUY") {
        slLevel = midPrice - rules.sl * pipSize;
        tpLevel = midPrice + rules.tp * pipSize;
      } else {
        slLevel = midPrice + rules.sl * pipSize;
        tpLevel = midPrice - rules.tp * pipSize;
      }

      const decimals = instr.includes("JPY") ? 3 : 5;
      return {
        stopLoss: Number(slLevel.toFixed(decimals)),
        takeProfit: Number(tpLevel.toFixed(decimals)),
        slPips: rules.sl,
        tpPips: rules.tp,
      };
    }

    // If client did not supply stop_loss/take_profit, compute them. Otherwise prefer client values.
    const accountType =
      account.account_type || account.accountType || "standard";
    const computed = computeSLTPLevels({
      instrument: instrumentParam,
      direction: side,
      midPrice: price,
      accountType,
    });
    const finalStopLoss = stop_loss || computed.stopLoss;
    const finalTakeProfit = take_profit || computed.takeProfit;

    // Add computed SL/TP to sizing metadata for observability
    sizingMeta.stopLoss = finalStopLoss;
    sizingMeta.takeProfit = finalTakeProfit;

    // Ensure order payload includes the SL/TP we will persist
    if (finalStopLoss)
      orderPayload.order["stopLossOnFill"] = { price: String(finalStopLoss) };
    if (finalTakeProfit)
      orderPayload.order["takeProfitOnFill"] = {
        price: String(finalTakeProfit),
      };

    console.log("🔧 Order payload to send to OANDA:", {
      instrument: orderPayload.order.instrument,
      units: orderPayload.order.units,
      type: orderPayload.order.type,
    });

    // Determine external OANDA account id to use for the API call.
    // trading_accounts may not store the external OANDA account id; fall back to client env via OandaClient.
    const externalAccountId = String(account.oanda_account_id || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    console.log(
      "🔑 Using external OANDA account id for API call:",
      externalAccountId,
    );
    if (!externalAccountId) {
      return NextResponse.json(
        { success: false, error: 'This trading account is missing its linked OANDA account ID. Please contact support.' },
        { status: 400 },
      );
    }

    // Place the order with OANDA (account id must be the OANDA account ID)
    // Fetch account summary to inspect margin/balance before placing order
    try {
      const acctSummary = await oanda
        .getAccountSummary(externalAccountId)
        .catch((e) => null);
      console.log(
        "📋 OANDA account summary fetched:",
        acctSummary?.data?.account?.marginAvailable || acctSummary?.data,
      );
    } catch (e) {
      console.warn("⚠️ Could not fetch OANDA account summary:", e && e.message);
    }

    const oandaResp = await oanda.placeOrder(orderPayload, externalAccountId);
    console.log(
      "📤 OANDA response status code:",
      oandaResp?.statusCode,
      "success:",
      oandaResp?.success,
    );
    if (oandaResp && oandaResp.data)
      console.log("📦 OANDA response body keys:", Object.keys(oandaResp.data));
    if (oandaResp && oandaResp.data && Object.keys(oandaResp.data).length > 0)
      console.log(
        "📦 OANDA response body (sample):",
        JSON.stringify(oandaResp.data).slice(0, 1000),
      );

    // Persist minimal order/trade info

    // Insert into orders table
    // Persist order with metadata including sizing and reason
    const orderInsert = await sql`
      INSERT INTO orders (user_email, amount, currency, reference, plan, account_size, status, metadata, created_at)
      VALUES (
        ${body.user_email || null},
        ${null},
        ${null},
        ${oandaResp.data?.orderCreateTransaction?.id || null},
        ${account.account_type || null},
        ${acctSize || null},
    ${oandaResp.success ? "placed" : "failed"},
    ${JSON.stringify({ oanda: oandaResp.data || {}, sizing: sizingMeta, reason: reason || null })},
        NOW()
      )
      RETURNING id
    `;

    const orderId = orderInsert[0]?.id || null;

    // Only insert a trade if OANDA returned a fill (market orders are typically followed by an orderFillTransaction)
    const wasFilled = Boolean(
      oandaResp?.success && oandaResp?.data?.orderFillTransaction,
    );
    const entryPrice = wasFilled
      ? Number(oandaResp.data.orderFillTransaction.price)
      : null;

    if (!wasFilled) {
      console.error(
        "❌ Order was not filled by OANDA or returned an error. Persisted order as failed.",
      );
      // Return the OANDA error details to the client for debugging
      return NextResponse.json(
        {
          success: false,
          error: "OANDA rejected or did not fill the order",
          oanda: oandaResp.data,
        },
        { status: oandaResp.statusCode || 400 },
      );
    }

    // Insert into trades table (basic) only when filled
    await sql`
      INSERT INTO trades (account_id, user_account_id, order_id, trade_id, instrument, units, order_type, entry_price, stop_loss, take_profit, status, side, timestamp, created_at)
      VALUES (
        ${String(account_id)},
        ${body.user_account_id || null},
        ${orderId},
        ${oandaResp.data.orderFillTransaction.tradeOpened?.tradeID || null},
        ${instrument},
        ${orderPayload.order.units},
        ${oandaResp.data.orderCreateTransaction?.type || "MARKET"},
        ${entryPrice},
        ${finalStopLoss || null},
        ${finalTakeProfit || null},
        ${"open"},
        ${side.toUpperCase()},
        ${new Date().toISOString()},
        NOW()
      )
    `;

    // Account stats will be updated via the update-account endpoint below

    // Create a journal entry for the reason (best-effort; don't fail trade if this fails)
    if (reason) {
      try {
        console.log("📝 Creating journal entry for user:", account.user_id);
        await sql`
          INSERT INTO journal_entries (user_id, title, conversation_data, message_count, created_at)
          VALUES (
            ${account.user_id || null},
            ${`Trade: ${instrument} ${side.toUpperCase()} - ${account.account_type || ""}`},
            ${JSON.stringify([{ id: Date.now(), role: "user", content: reason, timestamp: new Date().toISOString() }])},
            ${1},
            NOW()
          )
        `;
      } catch (e) {
        console.warn("⚠️ Journal entry insert failed:", e && e.message);
      }
    }

    // Update account statistics after successful trade placement
    try {
      console.log("📊 Updating account statistics for trade placement...");
      const updateResponse = await fetch(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/trading/update-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: account_id,
            action: "trade_opened",
          }),
        },
      );

      const updateResult = await updateResponse.json();
      if (updateResult.success) {
        console.log("✅ Account statistics updated successfully");
      } else {
        console.warn(
          "⚠️ Failed to update account statistics:",
          updateResult.error,
        );
      }
    } catch (error) {
      console.warn("⚠️ Error updating account statistics:", error.message);
      // Don't fail the trade placement if stats update fails
    }

    return NextResponse.json({ success: true, oanda: oandaResp.data, orderId });
  } catch (error) {
    console.error("Trade placement error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal error" },
      { status: 500 },
    );
  }
}
