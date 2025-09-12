import { NextResponse } from 'next/server'
import OandaClient from '../../../../lib/oanda-client'
import { getSql } from '../../../../lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeId(id) {
  if (id === null || id === undefined) return ''
  return String(id).replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
}

export async function GET() {
  try {
    const oanda = new OandaClient()
    const response = await oanda.getAccounts()
    
    if (response.success) {
      // Annotate with whether each OANDA account is already attached in our DB
      const accounts = response.data?.accounts || []
      let annotated = accounts.map(a => ({ ...a, attached: false }))
      let attachedIds = []
      try {
        const sql = getSql()
        const rows = await sql`SELECT DISTINCT oanda_account_id FROM trading_accounts WHERE oanda_account_id IS NOT NULL`
        const attachedSet = new Set(rows.map(r => normalizeId(r.oanda_account_id)))
        attachedIds = Array.from(attachedSet)
        // Enrich each account with summary details (alias, currency, balance)
        const summaries = await Promise.all(
          accounts.map(async (a) => {
            try {
              const sum = await oanda.getAccountSummary(a.id)
              const acc = sum?.data?.account || {}
              return [a.id, {
                alias: acc.alias || null,
                currency: acc.currency || null,
                balance: acc.balance ? Number(acc.balance) : null,
                marginAvailable: acc.marginAvailable ? Number(acc.marginAvailable) : null,
                lastTransactionID: sum?.data?.lastTransactionID || null,
              }]
            } catch {
              return [a.id, {}]
            }
          })
        )
        const detailMap = Object.fromEntries(summaries)
        annotated = accounts.map(a => ({
          id: a.id,
          ...detailMap[a.id],
          attached: attachedSet.has(normalizeId(a.id)),
        }))
      } catch (e) {
        // If DB not reachable, still return annotated shape with attached = false
        console.warn('OANDA accounts annotation failed (DB):', e?.message || e)
        // Best-effort details even without DB, for admin visibility
        try {
          const summaries = await Promise.all(
            accounts.map(async (a) => {
              try {
                const sum = await oanda.getAccountSummary(a.id)
                const acc = sum?.data?.account || {}
                return [a.id, {
                  alias: acc.alias || null,
                  currency: acc.currency || null,
                  balance: acc.balance ? Number(acc.balance) : null,
                  marginAvailable: acc.marginAvailable ? Number(acc.marginAvailable) : null,
                  lastTransactionID: sum?.data?.lastTransactionID || null,
                }]
              } catch {
                return [a.id, {}]
              }
            })
          )
          const detailMap = Object.fromEntries(summaries)
          annotated = accounts.map(a => ({ id: a.id, ...detailMap[a.id], attached: false }))
        } catch {}
      }

      return NextResponse.json({ accounts: annotated, attachedIds })
    } else {
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: response.statusCode || 500 }
      )
    }
  } catch (error) {
    console.error('OANDA accounts error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to OANDA' },
      { status: 500 }
    )
  }
}
