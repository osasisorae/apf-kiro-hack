"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AccountDetailsPage({ params }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const accountId = useMemo(() => Number(params?.id), [params]);

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | open | closed

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.push('/login'); return; }

    const load = async () => {
      try {
        setLoading(true); setError("");
        const res = await fetch(`/api/accounts?email=${encodeURIComponent(session.user.email)}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load account');
        const found = (data.data || []).find(a => Number(a.id) === Number(accountId));
        setAccount(found || null);
        if (!found || !found.oanda_account_id) {
          setError('This account has no linked OANDA account.');
          return;
        }
        const hRes = await fetch(`/api/oanda/history?oanda_account_id=${encodeURIComponent(found.oanda_account_id)}`);
        const hData = await hRes.json();
        if (!hRes.ok || !hData.success) throw new Error(hData.error || 'Failed to load OANDA history');
        setHistoryData(hData.data);
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, session, accountId, router]);

  if (status === 'loading' || loading) return <div className="loading-screen">Loading...</div>;
  if (error) return <div className="section-content"><div className="accounts-error-state"><p>{error}</p></div></div>;
  if (!account) return <div className="section-content"><div className="accounts-error-state"><p>Account not found.</p></div></div>;

  const summary = historyData?.accountSummary || null;
  const trades = Array.isArray(historyData?.history) ? historyData.history : [];
  const filteredTrades = trades.filter(t => filter === 'all' ? true : t.status === filter);

  const accountSize = Number(account.account_size || 0);
  const balance = Number(summary?.balance || account.current_balance || accountSize);
  const profitLoss = balance - accountSize;
  const profitPct = accountSize > 0 ? (profitLoss / accountSize) * 100 : 0;
  const target = Number(account.profit_target || accountSize * 0.1) || 0;
  const progressPct = target > 0 ? Math.max(0, Math.min(100, (profitLoss / target) * 100)) : 0;
  const maxLoss = Number(account.max_drawdown || accountSize * 0.1) || 0;
  const peak = Number(account.max_balance || balance);
  const currentDrawdown = Math.max(0, peak - balance);
  const ddPctOfSize = accountSize > 0 ? (currentDrawdown / accountSize) * 100 : 0;
  const ddClass = currentDrawdown > 0 ? 'critical' : 'safe';
  const statusBadge = account.status === 'active'
    ? 'active'
    : account.status === 'passed'
      ? 'passed'
      : account.status === 'failed'
        ? 'failed'
        : 'inactive';

  return (
    <>
      {/* Top Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="logo">
            <div className="logo-glow"></div>
            <Link href="/">
              <img src="/logo.png" alt="Aurum Prop Firm" className="logo-image" />
            </Link>
            <div className="logo-text-container">
              <span className="logo-text">AURUM</span>
              <span className="logo-subtitle">PROP FIRM</span>
            </div>
          </div>
          <div className="nav-menu">
            <div className="nav-indicator"></div>
            <span className="nav-status">ACCOUNT DETAILS</span>
          </div>
        </div>
      </nav>

      {/* Standalone main (no sidebar) */}
      <main style={{ padding: '2rem', marginTop: '5.5rem', minHeight: '100vh', background: 'var(--dashboard-surface)' }}>
          <div className="section-content">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' }}>
                <div>
                  <h1>Account Details</h1>
                  <p>Clean overview and full trading history</p>
                </div>
                <Link href="/dashboard" className="action-btn secondary">← Back to Account History</Link>
              </div>
            </div>

      {/* Overview */}
      <div className="orders-section">
        <div className="accounts-section-header">
          <h2 className="accounts-section-title">Overview</h2>
        </div>
        <div className="accounts-table">
          <div className="accounts-table-header">
            <div className="table-col col-account">Account</div>
            <div className="table-col col-balance">Balance</div>
            <div className="table-col col-pnl">P&L</div>
            <div className="table-col col-status">Status</div>
            <div className="table-col col-actions">OANDA</div>
          </div>
          <div className={`accounts-table-row ${statusBadge}`}>
            <div className="table-col col-account">
              <div className="account-info">
                <div className="account-main">
                  <span className={`account-type-badge ${account.account_type}`}>{account.account_type}</span>
                  <span className="account-size">${accountSize.toLocaleString()}</span>
                </div>
                <div className="account-meta">
                  {account.challenge_phase && <span className="account-phase">{account.challenge_phase}</span>}
                  <span className="account-date">Since {new Date(account.start_date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="table-col col-balance">
              <div className="balance-info">
                <div className="current-balance">${balance.toLocaleString()}</div>
                <div className="max-balance">Peak: ${Number(peak).toLocaleString()}</div>
              </div>
            </div>
            <div className="table-col col-pnl">
              <div className={`pnl-value ${profitLoss >= 0 ? 'positive' : 'negative'}`}>{(profitLoss >= 0 ? '+' : '') + profitLoss.toFixed(2)}</div>
              <div className="pnl-percent">{profitPct.toFixed(2)}%</div>
            </div>
            <div className="table-col col-status">
              <div className={`status-badge ${statusBadge}`}>{account.status?.toUpperCase()}</div>
            </div>
            <div className="table-col col-actions">{account.oanda_account_id}</div>
          </div>
        </div>
      </div>

      {/* Objectives & Risk */}
      <div className="orders-section">
        <div className="accounts-section-header">
          <h2 className="accounts-section-title">Objectives & Risk</h2>
        </div>
        <div className="accounts-table">
          <div className="accounts-table-header">
            <div className="table-col col-progress">Target Progress</div>
            <div className="table-col col-risk">Drawdown</div>
            <div className="table-col col-status">Currency</div>
            <div className="table-col col-actions">NAV</div>
          </div>
          <div className="accounts-table-row active">
            <div className="table-col col-progress">
              <div className="progress-container">
                <div className="progress-bar-mini"><div className="progress-fill-mini" style={{ width: `${progressPct}%` }}></div></div>
                <div className="progress-text">{progressPct.toFixed(1)}% of ${target.toFixed(0)}</div>
              </div>
            </div>
            <div className="table-col col-risk">
              <div className={`drawdown-indicator ${ddClass}`}>
                <div className="risk-circle"></div>
                <span>{ddPctOfSize.toFixed(1)}%</span>
              </div>
              <div className="risk-text">-{`$${Number(currentDrawdown.toFixed(0)).toLocaleString()}`} / {`$${Number(maxLoss.toFixed(0)).toLocaleString()}`} (10%)</div>
            </div>
            <div className="table-col col-status">{summary?.currency || '-'}</div>
            <div className="table-col col-actions">{summary?.NAV ? `$${Number(summary.NAV).toLocaleString()}` : '-'}</div>
          </div>
        </div>
      </div>

      {/* Trading History */}
      <div className="trades-section">
        <div className="accounts-section-header">
          <h2 className="accounts-section-title">Trading History</h2>
          <div className="accounts-section-actions">
            <div className="accounts-filter-btn" role="tablist">
              <button className={`accounts-filter-btn ${filter==='all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
              <button className={`accounts-filter-btn ${filter==='open' ? 'active' : ''}`} onClick={() => setFilter('open')}>Open</button>
              <button className={`accounts-filter-btn ${filter==='closed' ? 'active' : ''}`} onClick={() => setFilter('closed')}>Closed</button>
            </div>
          </div>
        </div>
        {filteredTrades.length > 0 ? (
          <div className="trades-table">
            <div className="trades-table-header">
              <div className="table-col col-time">Opened</div>
              <div className="table-col col-instrument">Pair</div>
              <div className="table-col col-side">Side</div>
              <div className="table-col col-size">Units</div>
              <div className="table-col col-entry">Entry</div>
              <div className="table-col col-current">Close</div>
              <div className="table-col col-pnl">Realized P&L</div>
              <div className="table-col col-status">Status</div>
            </div>
            {filteredTrades.map((t, i) => (
              <div key={i} className={`trades-table-row ${t.status}`}>
                <div className="table-col col-time">{t.openedAt ? new Date(t.openedAt).toLocaleString() : '-'}</div>
                <div className="table-col col-instrument">{t.instrument?.replace('_','/')}</div>
                <div className="table-col col-side">{t.side}</div>
                <div className="table-col col-size">{Math.abs(Number(t.open?.units || t.remainingUnits || 0)).toLocaleString()}</div>
                <div className="table-col col-entry">{t.open?.price ?? '-'}</div>
                <div className="table-col col-current">{t.closes?.length ? (t.closes[t.closes.length-1]?.price ?? '-') : '-'}</div>
                <div className="table-col col-pnl">{typeof t.totals?.realizedPL === 'number' ? (t.totals.realizedPL >= 0 ? '+' : '') + t.totals.realizedPL.toFixed(2) : (t.status === 'open' && typeof t.totals?.unrealizedPL === 'number' ? (t.totals.unrealizedPL >= 0 ? '+' : '') + t.totals.unrealizedPL.toFixed(2) : '-')}</div>
                <div className="table-col col-status"><div className={`status-badge ${t.status}`}>{t.status.toUpperCase()}</div></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="trades-empty-state"><h3>No trades yet</h3></div>
        )}
          </div>
          {/* close section-content wrapper */}
          </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <p>&copy; 2025 Aurum Prop Firm. All Rights Reserved.</p>
          <div className="social-links">
            <a href="https://www.linkedin.com/company/aurum-prop-firm/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 8A6 6 0 0 1 22 14V21H18V14A2 2 0 0 0 14 14V21H10V9H14V11A6 6 0 0 1 16 8Z" fill="currentColor" />
                <rect x="2" y="9" width="4" height="12" fill="currentColor" />
                <circle cx="4" cy="4" r="2" fill="currentColor" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
