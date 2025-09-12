import { NextResponse } from 'next/server'
import OandaClient from '../../../../lib/oanda-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeId(id) {
  if (id === null || id === undefined) return ''
  return String(id).replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
}

function isoDaysAgo(days = 365) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

async function getTransactionsByPages(client, accountId) {
  const rootPath = `/v3/accounts/${accountId}/transactions`
  const root = await client.makeRequest(rootPath, 'GET')
  if (!root.success) {
    const errBody = typeof root.data === 'object' ? JSON.stringify(root.data) : String(root.data)
    throw new Error(`Transactions root failed: ${root.statusCode} ${errBody}`)
  }
  const pages = Array.isArray(root.data?.pages) ? root.data.pages : []
  const all = []
  const pagePayloads = []
  for (const url of pages) {
    let path
    try {
      const u = new URL(url)
      path = u.pathname + u.search
    } catch {
      path = url
    }
    const resp = await client.makeRequest(path, 'GET')
    if (!resp.success) {
      const errBody = typeof resp.data === 'object' ? JSON.stringify(resp.data) : String(resp.data)
      throw new Error(`Transactions page failed: ${resp.statusCode} ${errBody}`)
    }
    const txs = resp.data?.transactions || []
    pagePayloads.push(resp.data)
    all.push(...txs)
  }
  return { transactions: all, root: root.data, pages: pagePayloads }
}

async function getAllTransactions(client, accountId, { from = isoDaysAgo(365), to = undefined, pageSize = 1000 } = {}) {
  const qs = new URLSearchParams()
  if (from) qs.append('from', from)
  if (to) qs.append('to', to)
  if (pageSize) qs.append('pageSize', String(pageSize))
  const path = `/v3/accounts/${accountId}/transactions?${qs.toString()}`
  const resp = await client.makeRequest(path, 'GET')
  if (!resp.success) {
    const errBody = typeof resp.data === 'object' ? JSON.stringify(resp.data) : String(resp.data)
    throw new Error(`Transactions window failed: ${resp.statusCode} ${errBody}`)
  }
  return resp.data?.transactions || []
}

function buildTradeHistory({ transactions, openTrades }) {
  const sorted = [...(transactions || [])].sort((a, b) => new Date(a.time) - new Date(b.time))
  const trades = new Map()
  const getOrInit = (tradeID) => {
    if (!trades.has(tradeID)) trades.set(tradeID, { tradeID, instrument: null, side: null, openedAt: null, openPrice: null, openUnits: null, remainingUnits: 0, closes: [], totalRealizedPL: 0 })
    return trades.get(tradeID)
  }
  for (const tx of sorted) {
    const type = tx.type
    if (type === 'ORDER_FILL' || type === 'OrderFillTransaction' || type === 'MARKET_ORDER' || type === 'MARKET_ORDER_TRADE_OPEN') {
      const tradeId = tx.tradeOpened?.tradeID || tx.tradeID || tx.tradesClosed?.[0]?.tradeID
      if (!tradeId) continue
      const units = Number(tx.units ?? tx.tradeOpened?.units ?? 0)
      const entryPrice = tx.price ? Number(tx.price) : null
      const instrument = tx.instrument || null
      const entryTime = tx.time || null
      const agg = getOrInit(tradeId)
      if (agg.openedAt === null) {
        agg.instrument = instrument
        agg.openedAt = entryTime
        agg.openPrice = entryPrice
        agg.openUnits = Math.abs(units)
        agg.remainingUnits = Math.abs(units)
        agg.side = units >= 0 ? 'BUY' : 'SELL'
      } else {
        const added = Math.abs(units)
        const prevQty = agg.openUnits || 0
        const newQty = prevQty + added
        if (agg.openPrice != null && entryPrice != null && newQty > 0) {
          agg.openPrice = ((agg.openPrice * prevQty) + (entryPrice * added)) / newQty
        } else if (agg.openPrice == null) {
          agg.openPrice = entryPrice
        }
        agg.openUnits = newQty
        agg.remainingUnits += added
        if (!agg.instrument && instrument) agg.instrument = instrument
        if (!agg.side) agg.side = units >= 0 ? 'BUY' : 'SELL'
      }
    } else if (type === 'TRADE_CLOSE' || type === 'TradeCloseTransaction') {
      const tradeId = tx.tradeID || tx.tradesClosed?.[0]?.tradeID
      if (!tradeId) continue
      const unitsClosed = Math.abs(Number(tx.units ?? tx.tradesClosed?.[0]?.units ?? 0)) || null
      const closePrice = tx.price ? Number(tx.price) : null
      const closeTime = tx.time || null
      const realizedPL = tx.pl !== undefined ? Number(tx.pl) : (tx.tradesClosed?.[0]?.realizedPL !== undefined ? Number(tx.tradesClosed[0].realizedPL) : null)
      const instrument = tx.instrument || null
      const agg = getOrInit(tradeId)
      if (!agg.instrument && instrument) agg.instrument = instrument
      agg.closes.push({ units: unitsClosed, price: closePrice, time: closeTime, realizedPL })
      if (typeof realizedPL === 'number') agg.totalRealizedPL += realizedPL
      if (typeof unitsClosed === 'number' && !Number.isNaN(unitsClosed)) {
        agg.remainingUnits = Math.max(0, (agg.remainingUnits || 0) - unitsClosed)
      }
      if (agg.remainingUnits === 0) agg.closedAt = closeTime
    }
  }
  const openById = new Map()
  for (const t of openTrades || []) {
    if (t.id !== undefined && t.id !== null) openById.set(String(t.id), t)
  }
  const result = Array.from(trades.values()).map(t => {
    const isOpen = (t.remainingUnits || 0) > 0
    const openTrade = isOpen ? openById.get(String(t.tradeID)) : null
    const unrealizedPL = openTrade && openTrade.unrealizedPL !== undefined ? Number(openTrade.unrealizedPL) : null
    return {
      tradeID: t.tradeID,
      instrument: t.instrument,
      side: t.side,
      openedAt: t.openedAt,
      closedAt: t.closedAt || null,
      status: isOpen ? 'open' : 'closed',
      open: { price: t.openPrice, units: t.openUnits },
      remainingUnits: t.remainingUnits,
      closes: t.closes,
      totals: {
        realizedPL: Number.isFinite(t.totalRealizedPL) ? Number(t.totalRealizedPL.toFixed(2)) : null,
        unrealizedPL,
      },
      durationMs: t.openedAt && (t.closedAt || null) ? (new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()) : null,
    }
  })
  result.sort((a, b) => new Date(b.closedAt || b.openedAt) - new Date(a.closedAt || a.openedAt))
  return result
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const oandaIdRaw = searchParams.get('oanda_account_id')
    const oanda_account_id = normalizeId(oandaIdRaw)
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined
    if (!oanda_account_id) return NextResponse.json({ error: 'oanda_account_id is required' }, { status: 400 })

    const client = new OandaClient()

    const summaryResp = await client.getAccountSummary(oanda_account_id).catch(() => null)
    const accountSummary = summaryResp?.success ? summaryResp.data?.account : null

    const openResp = await client.getOpenTrades(oanda_account_id).catch(() => null)
    const openTrades = openResp?.success ? (openResp.data?.trades || []) : []

    // Also fetch trade summaries like the test script (ALL and CLOSED)
    const tradesAllResp = await client.makeRequest(`/v3/accounts/${oanda_account_id}/trades?state=ALL`, 'GET').catch(() => null)
    const tradesClosedResp = await client.makeRequest(`/v3/accounts/${oanda_account_id}/trades?state=CLOSED`, 'GET').catch(() => null)
    const tradesAll = tradesAllResp?.success ? (tradesAllResp.data?.trades || []) : []
    const tradesClosed = tradesClosedResp?.success ? (tradesClosedResp.data?.trades || []) : []

    let txAgg
    try {
      txAgg = await getTransactionsByPages(client, oanda_account_id)
    } catch (_) {
      const transactions = await getAllTransactions(client, oanda_account_id, { from, to })
      txAgg = { transactions, root: null, pages: [] }
    }

    // Prefer building from trade summaries to avoid misclassifying closures, then enrich with transactions if needed
    const historyFromSummaries = (() => {
      const rows = []
      for (const t of tradesClosed) {
        const id = String(t.id)
        const initialUnits = Number(t.initialUnits || t.units || 0)
        const side = initialUnits >= 0 ? 'BUY' : 'SELL'
        const openPrice = t.price !== undefined ? Number(t.price) : null
        const closePrice = t.averageClosePrice !== undefined ? Number(t.averageClosePrice) : null
        const realizedPL = t.realizedPL !== undefined ? Number(t.realizedPL) : null
        const openUnits = Math.abs(initialUnits) || null
        rows.push({
          tradeID: id,
          instrument: t.instrument || null,
          side,
          openedAt: t.openTime || null,
          closedAt: t.closeTime || null,
          status: 'closed',
          open: { price: openPrice, units: openUnits },
          remainingUnits: 0,
          closes: [{ units: openUnits, price: closePrice, time: t.closeTime || null, realizedPL }],
          totals: { realizedPL, unrealizedPL: null },
          durationMs: t.openTime && t.closeTime ? (new Date(t.closeTime).getTime() - new Date(t.openTime).getTime()) : null,
        })
      }
      for (const t of openTrades) {
        const id = String(t.id)
        const initialUnits = Number(t.initialUnits || 0)
        const currentUnits = Number(t.currentUnits || 0)
        const side = (currentUnits || initialUnits) >= 0 ? 'BUY' : 'SELL'
        const openPrice = t.price !== undefined ? Number(t.price) : null
        const unrealizedPL = t.unrealizedPL !== undefined ? Number(t.unrealizedPL) : null
        rows.push({
          tradeID: id,
          instrument: t.instrument || null,
          side,
          openedAt: t.openTime || null,
          closedAt: null,
          status: 'open',
          open: { price: openPrice, units: Math.abs(initialUnits || currentUnits || 0) || null },
          remainingUnits: Math.abs(currentUnits || 0),
          closes: [],
          totals: { realizedPL: 0, unrealizedPL },
          durationMs: null,
        })
      }
      // Order newest first
      rows.sort((a, b) => new Date(b.closedAt || b.openedAt) - new Date(a.closedAt || a.openedAt))
      return rows
    })()

    // If we still have no rows, try building from transactions as fallback
    const history = historyFromSummaries && historyFromSummaries.length > 0
      ? historyFromSummaries
      : buildTradeHistory({ transactions: txAgg.transactions, openTrades })

    return NextResponse.json({
      success: true,
      data: {
        accountSummary,
        raw: {
          transactions: txAgg.transactions,
          transactionsMeta: { root: txAgg.root, pages: txAgg.pages?.length || 0 },
          tradesAll,
          tradesClosed,
        },
        history,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to build OANDA history', details: e.message }, { status: 500 })
  }
}
