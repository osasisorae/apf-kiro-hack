import { NextResponse } from 'next/server'
import OandaClient from '../../../../lib/oanda-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeId(id) {
  if (id === null || id === undefined) return ''
  return String(id).replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
}

function isoDaysAgo(days = 30) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const oandaIdRaw = searchParams.get('oanda_account_id')
    const oanda_account_id = normalizeId(oandaIdRaw)
    const from = searchParams.get('from') || isoDaysAgo(30)
    const to = searchParams.get('to') || new Date().toISOString()

    if (!oanda_account_id) {
      return NextResponse.json({ error: 'oanda_account_id is required' }, { status: 400 })
    }

    const client = new OandaClient()

    // Fetch account summary for header context
    const summaryResp = await client.getAccountSummary(oanda_account_id).catch(() => null)
    const accountSummary = summaryResp?.success ? summaryResp.data?.account : null

    // Open trades straight from OANDA
    const openResp = await client.getOpenTrades(oanda_account_id)
    const openTrades = openResp?.success ? (openResp.data?.trades || []) : []

    // Fetch recent transactions and reconstruct closed trades
    const txResp = await client.getTransactions(oanda_account_id, { from, to, types: ['ORDER_FILL', 'TRADE_CLOSE'] }).catch(() => null)
    const transactions = txResp?.success ? (txResp.data?.transactions || []) : []

    const fillsByTrade = new Map() // tradeID -> { instrument, units, price, time }
    const closedTrades = []

    for (const tx of transactions) {
      const type = tx.type
      if (type === 'ORDER_FILL' || type === 'OrderFillTransaction') {
        const tradeId = tx.tradeOpened?.tradeID || tx.tradeID || tx.tradesClosed?.[0]?.tradeID
        if (tradeId && !fillsByTrade.has(tradeId)) {
          fillsByTrade.set(tradeId, {
            tradeID: tradeId,
            instrument: tx.instrument,
            units: Number(tx.units || tx.tradeOpened?.units || 0),
            entryPrice: tx.price ? Number(tx.price) : null,
            entryTime: tx.time || null,
          })
        }
      } else if (type === 'TRADE_CLOSE' || type === 'TradeCloseTransaction') {
        const tradeId = tx.tradeID || tx.tradesClosed?.[0]?.tradeID
        const fill = tradeId ? fillsByTrade.get(tradeId) : null
        const pl = tx.pl !== undefined ? Number(tx.pl) : (tx.tradesClosed?.[0]?.realizedPL ? Number(tx.tradesClosed[0].realizedPL) : null)
        const closePrice = tx.price ? Number(tx.price) : null
        const closeTime = tx.time || null
        const financing = tx.financing !== undefined ? Number(tx.financing) : null
        const commission = tx.commission !== undefined ? Number(tx.commission) : null
        const instrument = tx.instrument || fill?.instrument || null
        const units = fill?.units || null

        closedTrades.push({
          tradeID: tradeId || null,
          instrument,
          units,
          entryPrice: fill?.entryPrice || null,
          entryTime: fill?.entryTime || null,
          closePrice,
          closeTime,
          realizedPL: pl,
          financing,
          commission,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        accountSummary,
        openTrades,
        closedTrades,
        window: { from, to },
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch OANDA trades', details: e.message }, { status: 500 })
  }
}

