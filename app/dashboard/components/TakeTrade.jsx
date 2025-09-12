"use client";

import React, { useState } from "react";

export default function TakeTrade({
  tradingStep,
  setTradingStep,
  selectedAccount,
  setSelectedAccount,
  selectedPair,
  setSelectedPair,
  accountsLoading,
  activeAccounts,
  livePrices,
  pricesLoading,
  isWeekend,
  setActiveSection,
}) {
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [orderReason, setOrderReason] = useState("");
  const [pendingSide, setPendingSide] = useState(null); // 'BUY' | 'SELL'
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");

  const instrumentToOanda = (pair) => pair.replace("/", "_");

  const openReasonModal = (side) => {
    setPendingSide(side);
    setOrderReason("");
    setPlaceError("");
    setShowReasonModal(true);
  };

  const handlePlaceOrder = async () => {
    if (!selectedAccount || !selectedPair || !pendingSide) return;
    if (!orderReason.trim()) return; // enforce journaling reason
    try {
      setPlacing(true);
      setPlaceError("");
      const res = await fetch("/api/trading/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: selectedAccount.id,
          instrument: instrumentToOanda(selectedPair),
          side: pendingSide,
          reason: orderReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Surface detailed reason if available
        const reason = data?.oanda?.orderCancelTransaction?.reason || data?.error || "Order failed";
        throw new Error(reason);
      }

      setShowReasonModal(false);
      // Reset selection to initial step
      setTradingStep("account-selection");
      // Navigate to Account History to view trade
      if (typeof setActiveSection === 'function') {
        setActiveSection('account-history');
      }
    } catch (e) {
      setPlaceError(e.message || "Failed to place trade");
    } finally {
      setPlacing(false);
    }
  };
  return (
    <div className="section-content">
      <div className="section-header">
        <h1>Take a Trade</h1>
        <p>Execute trades with our AI-guided, step-by-step trading platform</p>
      </div>

      <div className="trading-flow">
        <div className="trading-progress">
          <div
            className={`progress-step ${
              tradingStep === "account-selection"
                ? "active"
                : tradingStep !== "account-selection"
                  ? "completed"
                  : ""
            }`}
          >
            <div className="step-number">1</div>
            <div className="step-label">Select Account</div>
          </div>
          <div className="progress-line"></div>
          <div
            className={`progress-step ${
              tradingStep === "pair-selection"
                ? "active"
                : selectedPair
                  ? "completed"
                  : ""
            }`}
          >
            <div className="step-number">2</div>
            <div className="step-label">Choose Pair</div>
          </div>
          <div className="progress-line"></div>
          <div
            className={`progress-step ${
              tradingStep === "direction-selection" ? "active" : ""
            }`}
          >
            <div className="step-number">3</div>
            <div className="step-label">Buy/Sell</div>
          </div>
        </div>

        {tradingStep === "account-selection" && (
          <div className="trading-step account-selection-step">
            <div className="step-header">
              <h2>Step 1: Select Your Trading Account</h2>
              <p>Choose which account you'd like to trade with</p>
            </div>

            {accountsLoading ? (
              <div className="accounts-loading">
                <div className="loading-spinner"></div>
                <p>Loading your accounts...</p>
              </div>
            ) : activeAccounts.length > 0 ? (
              <div className="active-accounts-grid">
                {activeAccounts.map((account) => {
                  const totalTrades = parseInt(account.total_trades || 0);
                  const winningTrades = parseInt(account.winning_trades || 0);
                  const winRate =
                    totalTrades > 0
                      ? ((winningTrades / totalTrades) * 100).toFixed(1)
                      : "0.0";

                  return (
                    <div
                      key={account.id}
                      className={`account-trading-card ${
                        selectedAccount?.id === account.id ? "selected" : ""
                      }`}
                      onClick={() => setSelectedAccount(account)}
                    >
                      <div className="account-header">
                      <div className={`account-type-badge ${account.account_type}`}>
                        {account.account_type
                          .charAt(0)
                          .toUpperCase() + account.account_type.slice(1)}
                      </div>
                        <div className="account-status-badge active">Active</div>
                      </div>

                      <div className="account-main-info">
                        <div className="account-balance">
                          <span className="balance-label">Balance</span>
                          <span className="balance-amount">
                            ${parseFloat(account.current_balance).toFixed(2)}
                          </span>
                        </div>
                        <div className="account-profit">
                          <span className="profit-label">P&L</span>
                          <span
                            className={`profit-amount ${(() => {
                              const currentBalance = parseFloat(
                                account.current_balance || 0,
                              );
                              const accountSize = parseFloat(
                                account.account_size || 0,
                              );
                              return currentBalance - accountSize >= 0
                                ? "positive"
                                : "negative";
                            })()}`}
                          >
                            {(() => {
                              const currentBalance = parseFloat(
                                account.current_balance || 0,
                              );
                              const accountSize = parseFloat(
                                account.account_size || 0,
                              );
                              const realProfitLoss = currentBalance - accountSize;
                              return (
                                (realProfitLoss >= 0 ? "+" : "") +
                                realProfitLoss.toFixed(2)
                              );
                            })()}
                          </span>
                        </div>
                      </div>

                      <div className="account-stats">
                        <div className="stat-item">
                          <div className="stat-label">Win Rate</div>
                          <div className="stat-value">{winRate}%</div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-label">Trades</div>
                          <div className="stat-value">
                            {account.total_trades || 0}
                          </div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-label">Max Loss</div>
                          <div className="stat-value">
                            ${parseFloat(account.max_drawdown || 0).toFixed(0)}
                          </div>
                        </div>
                      </div>

                      <div className="select-account-overlay">
                        {selectedAccount?.id === account.id
                          ? "Selected"
                          : "Select"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-accounts">
                <p>No active accounts available.</p>
              </div>
            )}

            <div className="step-actions">
              <button
                className="btn-next"
                onClick={() => selectedAccount && setTradingStep("pair-selection")}
                disabled={!selectedAccount}
              >
                Next: Choose Pair
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {tradingStep === "pair-selection" && selectedAccount && (
          <div className="trading-step pair-selection-step">
            <div className="step-header">
              <h2>Step 2: Select Your Pair</h2>
              <p>Choose the currency pair to trade</p>
            </div>

            <div className="currency-pairs-grid">
              {[
                { name: "EUR/USD", icon: "🇪🇺/🇺🇸", defaultPrice: "1.0850", defaultChange: "+0.0010" },
                { name: "GBP/USD", icon: "🇬🇧/🇺🇸", defaultPrice: "1.2650", defaultChange: "-0.0008" },
                { name: "USD/JPY", icon: "🇺🇸/🇯🇵", defaultPrice: "150.250", defaultChange: "+0.0300" },
                { name: "USD/CHF", icon: "🇺🇸/🇨🇭", defaultPrice: "0.9025", defaultChange: "-0.0005" },
                { name: "AUD/USD", icon: "🇦🇺/🇺🇸", defaultPrice: "0.6550", defaultChange: "+0.0006" },
                { name: "USD/CAD", icon: "🇺🇸/🇨🇦", defaultPrice: "1.3450", defaultChange: "-0.0007" },
              ].map((pair) => {
                // livePrices are keyed by pairs with slashes (e.g., "EUR/USD")
                const key = pair.name;
                const livePrice = livePrices[key];
                const displayPrice = !isWeekend && livePrice && livePrice.bid && livePrice.ask
                  ? (((parseFloat(livePrice.bid) + parseFloat(livePrice.ask)) / 2).toFixed(
                      pair.name.includes("JPY") ? 3 : 5,
                    ))
                  : null;
                const displayChange = isWeekend
                  ? pair.defaultChange
                  : livePrice?.change || (displayPrice ? "+0.0000" : null);

                return (
                  <div
                    key={pair.name}
                    className={`pair-card ${selectedPair === pair.name ? "selected" : ""} ${isWeekend ? "weekend-disabled" : ""}`}
                    onClick={() => !isWeekend && setSelectedPair(pair.name)}
                  >
                    <div className="pair-icon">{pair.icon}</div>
                    <div className="pair-name">{pair.name}</div>
                    <div className="pair-price">
                      {pricesLoading && !isWeekend ? (
                        <span className="price-loading">Loading...</span>
                      ) : displayPrice ? (
                        displayPrice
                      ) : !isWeekend ? (
                        <span className="price-unavailable">Price unavailable</span>
                      ) : (
                        pair.defaultPrice
                      )}
                    </div>
                    <div
                      className={`pair-change ${displayChange?.startsWith("+") ? "positive" : "negative"}`}
                    >
                      {displayChange || (displayPrice ? "+0.0000" : "—")}
                    </div>
                    {isWeekend && (
                      <div className="weekend-overlay">
                        <span>Closed</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="step-actions">
              <button
                className="btn-back"
                onClick={() => {
                  setTradingStep("account-selection");
                  setSelectedPair(null);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" />
                </svg>
                Back to Account Selection
              </button>

              {selectedPair && (
                <button
                  className="btn-next"
                  onClick={() => setTradingStep("direction-selection")}
                >
                  Trade {selectedPair}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {tradingStep === "direction-selection" && selectedAccount && selectedPair && (
          <div className="trading-step direction-selection-step">
            <div className="step-header">
              <h2>Step 3: Choose Trade Direction</h2>
              <p>Select whether you want to buy or sell {selectedPair}</p>
            </div>

            <div className="trade-summary">
              <div className="summary-card">
                <div className="summary-item">
                  <span className="summary-label">Account:</span>
                  <span className="summary-value">
                    {(() => {
                      const typeText = String(selectedAccount.account_type || selectedAccount.plan || 'account');
                      return typeText.charAt(0).toUpperCase() + typeText.slice(1);
                    })()}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Balance:</span>
                  <span className="summary-value">
                    ${parseFloat(selectedAccount.current_balance).toFixed(2)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Pair:</span>
                  <span className="summary-value">{selectedPair}</span>
                </div>
              </div>
            </div>

            {(() => {
              const lp = livePrices[selectedPair];
              const hasLive = lp && lp.bid && lp.ask;
              const mid = hasLive
                ? ((parseFloat(lp.bid) + parseFloat(lp.ask)) / 2).toFixed(
                    selectedPair.includes('JPY') ? 3 : 5,
                  )
                : null;
              return (
                <div className="trade-direction-buttons">
                  <button className="trade-direction-btn buy-btn" onClick={() => openReasonModal('BUY')}>
                    <div className="direction-header">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 19V5" stroke="currentColor" strokeWidth="2" />
                        <path d="M5 12L12 5L19 12" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <span className="direction-label">Buy</span>
                    </div>
                    <div className="direction-price">{mid || (pricesLoading ? 'Loading...' : '—')}</div>
                    <div className="direction-description">Go long {selectedPair}</div>
                  </button>
                  <button className="trade-direction-btn sell-btn" onClick={() => openReasonModal('SELL')}>
                    <div className="direction-header">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14" stroke="currentColor" strokeWidth="2" />
                        <path d="M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <span className="direction-label">Sell</span>
                    </div>
                    <div className="direction-price">{mid || (pricesLoading ? 'Loading...' : '—')}</div>
                    <div className="direction-description">Go short {selectedPair}</div>
                  </button>
                </div>
              );
            })()}
            {showReasonModal && (
              <div className="modal-overlay" role="dialog" aria-modal="true">
                <div className="trade-reason-modal">
                  <div className="modal-header">
                    <h3>Journal Your Reason</h3>
                    <button className="modal-close" onClick={() => !placing && setShowReasonModal(false)} aria-label="Close">×</button>
                  </div>
                  <div className="modal-body">
                    <div className="reason-context">
                      <div><strong>Account:</strong> {selectedAccount?.account_type}</div>
                      <div><strong>Pair:</strong> {selectedPair}</div>
                      <div><strong>Side:</strong> {pendingSide}</div>
                    </div>
                    <p className="reason-guidance">Briefly describe why you're entering this trade. SL/TP will be auto‑set by your plan rules.</p>
                    <textarea
                      className="reason-textarea"
                      placeholder="Example: Breakout above resistance aligning with London session momentum. Risking 7 pips per rules."
                      value={orderReason}
                      onChange={(e) => setOrderReason(e.target.value)}
                      rows={5}
                      disabled={placing}
                    />
                    {placeError && (
                      <div className="modal-error">
                        {placeError === 'OPPOSING_POSITIONS_NOT_ALLOWED' || placeError === 'FIFO_VIOLATION_SAFEGUARD_VIOLATION'
                          ? 'Your account disallows opposing positions (or FIFO safeguard triggered). Close existing positions for this pair, then retry.'
                          : placeError}
                      </div>
                    )}
                  </div>
                  <div className="modal-actions">
                    <button className="btn-back" onClick={() => setShowReasonModal(false)} disabled={placing}>Cancel</button>
                    <button className="btn-next" onClick={handlePlaceOrder} disabled={placing || !orderReason.trim()}>
                      {placing ? 'Placing…' : `Confirm ${pendingSide}`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="step-actions">
              <button
                className="btn-back"
                onClick={() => setTradingStep("pair-selection")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" />
                </svg>
                Back to Pair Selection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
