#!/usr/bin/env node
/*
  Usage:
    node scripts/trading-history-test.js

  Reads:
    - OANDA_TOKEN from .env
    - OANDA_ENVIRONMENT (practice|live) from .env (default: practice)

  Notes:
    - Account ID is hardcoded in this file.
    - Adds detailed logging for each step and API call.
*/

require('dotenv').config()
const OandaClient = require('../lib/oanda-client')
const ACCOUNT_ID = '101-001-36280559-007'

function normalizeId(id) {
  if (id === null || id === undefined) return ''
  return String(id).replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
}

function isoDaysAgo(days = 365) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

async function getAllTransactions(client, accountId, { from = isoDaysAgo(365), to = undefined, pageSize = 1000, log = () => {} } = {}) {
  const qs = new URLSearchParams()
  if (from) qs.append('from', from)
  if (to) qs.append('to', to)
  if (pageSize) qs.append('pageSize', String(pageSize))

  let path = `/v3/accounts/${accountId}/transactions?${qs.toString()}`
  const all = []
  let page = 1

  while (true) {
    log(`GET ${path} (page ${page})`)
    const resp = await client.makeRequest(path, 'GET')
    if (!resp.success) {
      const errBody = typeof resp.data === 'object' ? JSON.stringify(resp.data) : String(resp.data)
      const err = new Error(`Transactions request failed: ${resp.statusCode} ${errBody}`)
      err.response = resp
      throw err
    }
    const txs = resp.data?.transactions || []
    log(`→ Received ${txs.length} transactions on page ${page}`)
    all.push(...txs)

    const linkHeader = resp.headers?.link || resp.headers?.Link
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
      if (match && match[1]) {
        try {
          const nextUrl = new URL(match[1])
          path = nextUrl.pathname + nextUrl.search
          page += 1
          log('↪ Following Link: next page URL resolved via absolute link header')
          continue
        } catch (_) {
          // Fallback if it's a relative link already
          path = match[1]
          page += 1
          log('↪ Following Link: next page URL appears relative')
          continue
        }
      }
    }
    log('✔ No next link; pagination complete')
    break
  }
  return all
}

async function getTransactionsByPages(client, accountId, { log = () => {} } = {}) {
  // OANDA V20 pattern: first call returns a list of page URLs
  const rootPath = `/v3/accounts/${accountId}/transactions`
  log(`GET ${rootPath} (root)`)
  const root = await client.makeRequest(rootPath, 'GET')
  if (!root.success) {
    const errBody = typeof root.data === 'object' ? JSON.stringify(root.data) : String(root.data)
    const err = new Error(`Transactions root failed: ${root.statusCode} ${errBody}`)
    err.response = root
    throw err
  }
  const pages = Array.isArray(root.data?.pages) ? root.data.pages : []
  log(`→ pages listed: ${pages.length}`)
  const all = []
  const pagePayloads = []
  let idx = 0
  for (const url of pages) {
    idx += 1
    let path
    try {
      const u = new URL(url)
      path = u.pathname + u.search
    } catch {
      path = url
    }
    log(`GET ${path} (page ${idx} of ${pages.length})`)
    const resp = await client.makeRequest(path, 'GET')
    if (!resp.success) {
      const errBody = typeof resp.data === 'object' ? JSON.stringify(resp.data) : String(resp.data)
      const err = new Error(`Transactions page failed: ${resp.statusCode} ${errBody}`)
      err.response = resp
      throw err
    }
    const txs = resp.data?.transactions || []
    pagePayloads.push(resp.data)
    all.push(...txs)
    log(`→ page ${idx} transactions: ${txs.length}`)
  }
  log(`✔ transactions via pages: ${all.length}`)
  return { transactions: all, root: root.data, pages: pagePayloads }
}

function buildTradeHistory({ transactions, openTrades }) {
  console.log('▶ Building structured trade history from transactions + open trades')
  // Sort transactions by time ascending for consistent grouping
  const sorted = [...transactions].sort((a, b) => new Date(a.time) - new Date(b.time))
  console.log(`• Transactions sorted: ${sorted.length}`)

  const trades = new Map() // tradeID -> aggregate

  function getOrInit(tradeID) {
    if (!trades.has(tradeID)) trades.set(tradeID, { tradeID, instrument: null, side: null, openedAt: null, openPrice: null, openUnits: null, remainingUnits: 0, closes: [], totalRealizedPL: 0 })
    return trades.get(tradeID)
  }

  for (const tx of sorted) {
    const type = tx.type
    if (type === 'ORDER_FILL' || type === 'OrderFillTransaction') {
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
        // If multiple fills opened the same trade (rare), accumulate
        const added = Math.abs(units)
        agg.openUnits = (agg.openUnits || 0) + added
        agg.remainingUnits += added
        // Keep earliest open time, average entry price (size-weighted)
        if (agg.openPrice != null && entryPrice != null) {
          const prevQty = (agg.openUnits || 0) - added
          const newQty = agg.openUnits || 0
          agg.openPrice = newQty > 0 ? ((agg.openPrice * prevQty) + (entryPrice * added)) / newQty : entryPrice
        } else if (agg.openPrice == null) {
          agg.openPrice = entryPrice
        }
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

  // Enrich open trades (unrealized)
  const openById = new Map()
  for (const t of openTrades || []) {
    if (t.id !== undefined && t.id !== null) {
      openById.set(String(t.id), t)
    }
  }
  console.log(`• Open trades mapped: ${openById.size}`)

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

  // Order newest first by closedAt/openedAt
  result.sort((a, b) => new Date(b.closedAt || b.openedAt) - new Date(a.closedAt || a.openedAt))
  console.log(`✔ Trade history built: ${result.length} trades (open: ${result.filter(t => t.status==='open').length}, closed: ${result.filter(t => t.status==='closed').length})`)
  return result
}

async function main() {
  const oandaAccountId = normalizeId(ACCOUNT_ID)
  const token = process.env.OANDA_TOKEN
  const environment = process.env.OANDA_ENVIRONMENT || 'practice'
  const from = isoDaysAgo(365)
  const to = undefined

  if (!token) {
    console.error('Missing OANDA_TOKEN in .env. Please set OANDA_TOKEN=...')
    process.exit(1)
  }

  const client = new OandaClient({ token, environment })
  console.log('\n=== OANDA Trading History Test ===')
  console.log(`Account: ${oandaAccountId}`)
  console.log(`Environment: ${client.environment}`)
  const masked = token.length > 12 ? `${token.slice(0,6)}...${token.slice(-4)}` : '[masked]'
  console.log(`Token: ${masked}`)
  console.log(`Window: from=${from}${to ? ` to=${to}` : ''}`)

  // Fetch account summary
  console.log('\nSTEP 1: Fetch account summary')
  const summaryResp = await client.getAccountSummary(oandaAccountId).catch(e => ({ success: false, error: e.message }))
  if (!summaryResp?.success) {
    console.error('✖ Failed to fetch account summary:', summaryResp?.error || JSON.stringify(summaryResp?.data))
  } else {
    console.log(`✔ Account summary OK (status ${summaryResp.statusCode})`)
  }
  const summary = summaryResp?.data?.account || null

  // Fetch open trades
  console.log('\nSTEP 2: Fetch open trades')
  const openResp = await client.getOpenTrades(oandaAccountId).catch(e => ({ success: false, error: e.message }))
  const openTrades = openResp?.success ? (openResp.data?.trades || []) : []
  if (!openResp?.success) {
    console.error('✖ Failed to fetch open trades:', openResp?.error || JSON.stringify(openResp?.data))
  } else {
    console.log(`✔ Open trades OK (status ${openResp.statusCode}) count=${openTrades.length}`)
  }

  // Additional raw dumps for trades endpoint
  console.log('\nSTEP 2b: Fetch trades (state=ALL and CLOSED) for raw dump')
  const allTradesResp = await client.makeRequest(`/v3/accounts/${oandaAccountId}/trades?state=ALL`, 'GET').catch(e => ({ success: false, error: e.message }))
  const closedTradesResp = await client.makeRequest(`/v3/accounts/${oandaAccountId}/trades?state=CLOSED`, 'GET').catch(e => ({ success: false, error: e.message }))
  const allTradesRaw = allTradesResp?.success ? (allTradesResp.data?.trades || []) : []
  const closedTradesRaw = closedTradesResp?.success ? (closedTradesResp.data?.trades || []) : []
  console.log(`✔ Trades (ALL) count=${allTradesRaw.length}; Trades (CLOSED) count=${closedTradesRaw.length}`)

  // Fetch ALL fill/close transactions via paging
  console.log('\nSTEP 3: Fetch transactions (try pages approach, fallback to from/to window)')
  let txAgg = { transactions: [], root: null, pages: [] }
  try {
    txAgg = await getTransactionsByPages(client, oandaAccountId, { log: (m) => console.log('  ·', m) })
  } catch (e) {
    console.warn('! Pages approach failed, falling back to time-window:', e.message)
    const transactions = await getAllTransactions(client, oandaAccountId, { from, to, log: (m) => console.log('  ·', m) })
    txAgg = { transactions, root: null, pages: [] }
  }
  const transactions = txAgg.transactions
  console.log(`✔ Transactions fetched: ${transactions.length}`)

  // Build structured trade history
  console.log('\nSTEP 4: Build structured trade history')
  const history = buildTradeHistory({ transactions, openTrades })

  const output = {
    account: summary ? {
      id: summary.id,
      alias: summary.alias,
      currency: summary.currency,
      balance: Number(summary.balance),
      NAV: summary.NAV !== undefined ? Number(summary.NAV) : undefined,
      openTradeCount: summary.openTradeCount,
    } : { id: oandaAccountId },
    counts: {
      transactions: transactions.length,
      openTrades: openTrades.length,
      tradesInHistory: history.length,
      openInHistory: history.filter(t => t.status === 'open').length,
      closedInHistory: history.filter(t => t.status === 'closed').length,
    },
    trades: history,
  }

  console.log('\nSTEP 5: Output structured result')
  console.log('• Summary:', { account: output.account, counts: output.counts })
  console.log('\nRAW DUMPS: openTrades, trades(ALL), trades(CLOSED), transactions')
  console.log('· openTrades (raw):', JSON.stringify(openResp?.data || {}, null, 2))
  console.log('· trades ALL (raw):', JSON.stringify(allTradesResp?.data || {}, null, 2))
  console.log('· trades CLOSED (raw):', JSON.stringify(closedTradesResp?.data || {}, null, 2))
  console.log('· transactions root/pages (raw):', JSON.stringify({ root: txAgg.root, pagesCount: txAgg.pages.length }, null, 2))
  console.log('· transactions (first 5):', JSON.stringify(transactions.slice(0, 5), null, 2))
  console.log('\n=== Structured Output (JSON) ===')
  console.log(JSON.stringify(output, null, 2))
}

main().catch(err => {
  console.error('Unexpected error:', err?.message || err)
  process.exit(1)
})
