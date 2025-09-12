"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function AccountHistory({
  accountsLoading,
  accountsData,
  activeAccounts,
  provisioningAccounts,
  inactiveAccounts,
  tradesLoading,
  tradesData,
  selectedAccountForTrades,
  setSelectedAccountForTrades,
  loadTradesData,
  setActiveSection,
  setTradingStep,
  setSelectedAccount,
  setSelectedPair,
}) {
  const [oandaByAccountId, setOandaByAccountId] = useState({})

  useEffect(() => {
    const fetchSummaries = async () => {
      if (!activeAccounts || activeAccounts.length === 0) return
      const toFetch = activeAccounts.filter(a => a.oanda_account_id && !oandaByAccountId[a.id])
      if (toFetch.length === 0) return
      try {
        const results = await Promise.allSettled(toFetch.map(async (acc) => {
          const res = await fetch(`/api/oanda/history?oanda_account_id=${encodeURIComponent(String(acc.oanda_account_id))}`)
          const data = await res.json()
          if (!res.ok || !data.success) throw new Error(data.error || 'Failed')
          return { id: acc.id, summary: data.data?.accountSummary || null, history: Array.isArray(data.data?.history) ? data.data.history : [] }
        }))
        const copy = { ...oandaByAccountId }
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            copy[r.value.id] = { summary: r.value.summary, history: r.value.history }
          }
        }
        setOandaByAccountId(copy)
      } catch (_) {
        // ignore; fall back to DB values
      }
    }
    fetchSummaries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccounts])

  return (
    <div className="section-content">
      <div className="section-header">
        <h1>Account History</h1>
        <p>View and manage your active and inactive trading accounts</p>
      </div>

      {accountsLoading ? (
        <div className="accounts-loading">
          <div className="loading-spinner"></div>
          <p>Loading your orders...</p>
        </div>
      ) : accountsData ? (
        <>
          {/* Provisioning Accounts */}
          {provisioningAccounts && provisioningAccounts.length > 0 && (
            <div className="orders-section">
              <div className="accounts-section-header">
                <h2 className="accounts-section-title">Purchased Accounts</h2>
              </div>
              <div className="accounts-table">
                <div className="accounts-table-header">
                  <div className="table-col col-account">Account</div>
                  <div className="table-col col-plan">Plan</div>
                  <div className="table-col col-balance">Balance</div>
                  <div className="table-col col-status">Status</div>
                </div>
                {provisioningAccounts.map((account) => (
                  <div key={account.id} className="accounts-table-row provisioning">
                    <div className="table-col col-account">
                      <div className="account-info">
                        <div className="account-main">
                          <span className={`account-type-badge ${account.account_type}`}>
                            {account.account_type === "challenge" ? "Challenge" : account.account_type === "funded" ? "Funded" : "Demo"}
                          </span>
                          <span className="account-size">${parseFloat(account.account_size).toLocaleString()}</span>
                        </div>
                        <div className="account-meta">
                          <span className="account-date">Purchased {new Date(account.start_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="table-col col-plan">
                      <div className="account-meta">
                        <span className={`status-badge ${account.plan_tier || 'standard'}`}>{(account.plan_tier || 'standard').charAt(0).toUpperCase() + (account.plan_tier || 'standard').slice(1)}</span>
                      </div>
                    </div>
                    <div className="table-col col-balance">
                      <div className="balance-info">
                        <div className="current-balance">${parseFloat(account.current_balance || account.account_size).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="table-col col-status">
                      <div className="status-badge provisioning">Provisioning</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Accounts */}
          {activeAccounts && activeAccounts.length > 0 && (
            <div className="orders-section">
              <div className="accounts-section-header">
                <h2 className="accounts-section-title">Active Accounts</h2>
              </div>
              <div className="accounts-table">
                <div className="accounts-table-header">
                  <div className="table-col col-account">Account</div>
                  <div className="table-col col-balance">Balance</div>
                  <div className="table-col col-pnl">P&L</div>
                  <div className="table-col col-progress">Progress</div>
                  <div className="table-col col-trades">Trades</div>
                  <div className="table-col col-risk">Risk</div>
                  <div className="table-col col-actions">Actions</div>
                </div>

                {activeAccounts.map((account) => {
                  const o = oandaByAccountId[account.id] || {}
                  const oSummary = o.summary || null
                  const oHistory = Array.isArray(o.history) ? o.history : []
                  const accountSize = parseFloat(account.account_size || 0)
                  const fallbackBalance = parseFloat(account.current_balance || accountSize)
                  const currentBalance = oSummary?.balance !== undefined ? parseFloat(oSummary.balance) : fallbackBalance
                  const actualProfitLoss = currentBalance - accountSize
                  const profitTarget = parseFloat(account.profit_target || (accountSize * 0.1))
                  const progressPercent = profitTarget > 0 ? Math.min(100, Math.max(0, (actualProfitLoss / profitTarget) * 100)) : 0
                  const maxBalance = parseFloat(account.max_balance || currentBalance)
                  const currentDrawdown = Math.max(0, maxBalance - currentBalance)
                  const maxDrawdown = parseFloat(account.max_drawdown || (accountSize * 0.1))
                  // Drawdown percent should be relative to account size (e.g., $30 on $10,000 = 0.3%)
                  const drawdownPercentOfSize = accountSize > 0 ? (currentDrawdown / accountSize) * 100 : 0
                  const ddClass = currentDrawdown > 0 ? 'critical' : 'safe'
                  // Trades and win rate based on OANDA history if available
                  const totalTrades = oHistory.length > 0 ? oHistory.length : parseInt(account.total_trades || 0)
                  const winningTrades = oHistory.length > 0 ? oHistory.filter(t => t.status === 'closed' && Number(t.totals?.realizedPL) > 0).length : parseInt(account.winning_trades || 0)
                  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0'

                  return (
                    <div key={account.id} className="accounts-table-row">
                      <div className="table-col col-account">
                        <div className="account-info">
                          <div className="account-main">
                            <span className={`account-type-badge ${account.account_type}`}>
                              {account.account_type === "challenge" ? "Challenge" : account.account_type === "funded" ? "Funded" : "Demo"}
                            </span>
                            <span className="account-size">${parseFloat(account.account_size).toLocaleString()}</span>
                          </div>
                          <div className="account-meta">
                            {account.challenge_phase && <span className="account-phase">{account.challenge_phase}</span>}
                            <span className="account-date">Started {new Date(account.start_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="table-col col-balance">
                          <div className="balance-info">
                            <div className="current-balance">${Number(currentBalance).toLocaleString()}</div>
                            <div className="max-balance">Peak: ${Number(maxBalance).toLocaleString()}</div>
                          </div>
                        </div>

                      <div className="table-col col-pnl">
                        <div className={`pnl-value ${actualProfitLoss >= 0 ? "positive" : "negative"}`}>
                          {(actualProfitLoss >= 0 ? "+" : "") + actualProfitLoss.toFixed(2)}
                        </div>
                        <div className="pnl-percent">{(((currentBalance - accountSize) / (accountSize || 1)) * 100).toFixed(2)}%</div>
                      </div>

                      <div className="table-col col-progress">
                        {profitTarget > 0 ? (
                          <div className="progress-container">
                            <div className="progress-bar-mini">
                              <div className="progress-fill-mini" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                            <div className="progress-text">{progressPercent.toFixed(1)}% of ${Number(profitTarget).toFixed(0)}</div>
                          </div>
                        ) : (
                          <div className="no-target">No Target</div>
                        )}
                      </div>

                      <div className="table-col col-trades">
                        <div className="trades-info">
                          <div className="trades-count">{account.total_trades} trades</div>
                          <div className="win-rate">{winRate}% win rate</div>
                        </div>
                      </div>

                      <div className="table-col col-risk">
                        <div className="risk-info">
                          <div className={`drawdown-indicator ${ddClass}`}>
                            <div className="risk-circle"></div>
                            <span>{drawdownPercentOfSize.toFixed(1)}%</span>
                          </div>
                          <div className="risk-text">-{`$${Number(currentDrawdown.toFixed(0)).toLocaleString()}`} / {`$${Number(maxDrawdown.toFixed(0)).toLocaleString()}`} (10%)</div>
                        </div>
                      </div>

                      <div className="table-col col-actions">
                        <div className="action-buttons">
                          <button
                            className="action-btn primary"
                            onClick={() => {
                              setSelectedAccount && setSelectedAccount(account);
                              setTradingStep && setTradingStep("account-selection");
                              setActiveSection && setActiveSection("take-trade");
                              setSelectedPair && setSelectedPair(null);
                            }}
                          >
                            Trade
                          </button>
                          <Link href={`/dashboard/account/${account.id}`} className="action-btn secondary">Details</Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inactive/Account History */}
          <div className="orders-section">
            <div className="accounts-section-header">
              <h2 className="accounts-section-title">Account History</h2>
              <div className="accounts-section-actions">
                <button className="accounts-filter-btn">All Status</button>
              </div>
            </div>

            <div className="accounts-table">
              <div className="accounts-table-header">
                <div className="table-col col-account">Account</div>
                <div className="table-col col-balance">Final Balance</div>
                <div className="table-col col-pnl">P&L</div>
                <div className="table-col col-performance">Performance</div>
                <div className="table-col col-duration">Duration</div>
                <div className="table-col col-status">Status</div>
                <div className="table-col col-actions">Actions</div>
              </div>

              {inactiveAccounts.map((account) => {
                const totalTrades = parseInt(account.total_trades || 0);
                const winningTrades = parseInt(account.winning_trades || 0);
                const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : "0.0";
                const duration = account.end_date
                  ? Math.ceil((new Date(account.end_date) - new Date(account.start_date)) / (1000 * 60 * 60 * 24))
                  : Math.ceil((new Date() - new Date(account.start_date)) / (1000 * 60 * 60 * 24));

                return (
                  <div key={account.id} className={`accounts-table-row ${account.status}`}>
                    <div className="table-col col-account">
                      <div className="account-info">
                        <div className="account-main">
                          <span className={`account-type-badge ${account.account_type}`}>
                            {account.account_type === "challenge" ? "Challenge" : account.account_type === "funded" ? "Funded" : "Demo"}
                          </span>
                          <span className="account-size">${parseFloat(account.account_size).toLocaleString()}</span>
                        </div>
                        <div className="account-meta">
                          {account.challenge_phase && <span className="account-phase">{account.challenge_phase}</span>}
                          <span className="account-date">
                            {new Date(account.start_date).toLocaleDateString()} - {account.end_date ? new Date(account.end_date).toLocaleDateString() : "Ongoing"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="table-col col-balance">
                      <div className="balance-info">
                        <div className="current-balance">${parseFloat(account.current_balance).toLocaleString()}</div>
                        <div className="max-balance">Peak: ${parseFloat(account.max_balance).toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="table-col col-pnl">
                      <div className={`pnl-value ${parseFloat(account.current_balance || 0) - parseFloat(account.account_size || 0) >= 0 ? "positive" : "negative"}`}>
                        {(() => {
                          const currentBalance = parseFloat(account.current_balance || 0);
                          const accountSize = parseFloat(account.account_size || 0);
                          const realProfitLoss = currentBalance - accountSize;
                          return (realProfitLoss >= 0 ? "+" : "") + realProfitLoss.toFixed(2);
                        })()}
                      </div>
                      <div className="pnl-percent">
                        {(() => {
                          const accountSize = parseFloat(account.account_size || 1);
                          const currentBalance = parseFloat(account.current_balance || accountSize);
                          const percentage = ((currentBalance - accountSize) / accountSize) * 100;
                          const capped = Math.max(-100, Math.min(1000, percentage));
                          return capped.toFixed(2);
                        })()}
                        %
                      </div>
                    </div>

                    <div className="table-col col-performance">
                      <div className="performance-info">
                        <div className="trades-count">{account.total_trades} trades</div>
                        <div className="win-rate">{winRate}% win rate</div>
                        {account.profit_target > 0 && (
                          <div className="target-info">Target: ${parseFloat(account.profit_target).toFixed(0)}</div>
                        )}
                      </div>
                    </div>

                    <div className="table-col col-duration">
                      <div className="duration-info">
                        <div className="duration-days">{duration} days</div>
                        <div className="duration-dates">
                          {new Date(account.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {account.end_date ? new Date(account.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Now"}
                        </div>
                      </div>
                    </div>

                    <div className="table-col col-status">
                      <div className={`status-badge ${account.status}`}>
                        {account.status === "passed" ? "Passed" : account.status === "failed" ? "Failed" : account.status === "inactive" ? "Inactive" : account.status}
                      </div>
                    </div>

                    <div className="table-col col-actions">
                      <div className="action-buttons">
                        <Link href={`/dashboard/account/${account.id}`} className="action-btn secondary">Details</Link>
                        {account.status === "passed" && <button className="action-btn success">Claim</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-account trade history moved to Account Details page */}
        </>
      ) : (
        <div className="accounts-error-state">
          <p>Failed to load account data. Please try refreshing the page.</p>
        </div>
      )}
    </div>
  );
}
