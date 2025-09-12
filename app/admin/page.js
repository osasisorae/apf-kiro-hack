'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { getWaitlistData, exportWaitlistCSV } from '../actions'
import './admin.css'

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const [waitlistData, setWaitlistData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('timestamp')
  const [sortOrder, setSortOrder] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(25)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [creatingUser, setCreatingUser] = useState(false)
  const [createUserError, setCreateUserError] = useState('')
  const [createUserSuccess, setCreateUserSuccess] = useState(null)
  const [provLoading, setProvLoading] = useState(false)
  const [provError, setProvError] = useState('')
  const [provAccounts, setProvAccounts] = useState([])
  const [oandaAccounts, setOandaAccounts] = useState([])
  const [showOnlyUnattached, setShowOnlyUnattached] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole] = useState('user')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [showNewUserPassword, setShowNewUserPassword] = useState(false)
  const [createDefaultAccount] = useState(false)
  const [defaultAccountSize] = useState('100000')
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading
    
    if (!session) {
      router.push('/login')
      return
    }

    // Only allow admin users
    if (session.user.role !== 'admin') {
      router.push('/dashboard')
      return
    }
    
    loadWaitlistData()
  }, [session, status, router])

  const loadWaitlistData = async () => {
    try {
      const result = await getWaitlistData()
      if (result.success) {
        setWaitlistData(result.data)
      } else {
        console.error('Failed to load waitlist data:', result.error)
      }
    } catch (error) {
      console.error('Failed to load waitlist data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const result = await exportWaitlistCSV()
      if (result.success) {
        // Create and download CSV file
        const blob = new Blob([result.data], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' })
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreatingUser(true)
    setCreateUserError('')
    setCreateUserSuccess(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          role: 'user',
          password: newUserPassword
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create user')
      }
      setCreateUserSuccess({ userId: data.user_id, generatedPassword: data.generated_password, accountId: data.account_id })
      setNewUserEmail('')
      setNewUserPassword('')
    } catch (err) {
      setCreateUserError(err.message || 'Failed to create user')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleSelectWaitlist = (email) => {
    setNewUserEmail(email)
    setActiveTab('users')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Helper: refresh OANDA accounts with attachment flags
  const refreshOandaAccounts = async () => {
    try {
      const res = await fetch('/api/oanda/accounts', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setOandaAccounts(data.accounts || data.data?.accounts || [])
      }
    } catch (e) {
      // ignore
    }
  }

  // Load provisioning accounts and OANDA accounts when Accounts tab is active
  useEffect(() => {
    const load = async () => {
      if (activeTab !== 'accounts') return
      try {
        setProvLoading(true); setProvError('')
        const [provRes, oandaRes] = await Promise.all([
          fetch('/api/admin/accounts', { cache: 'no-store' }),
          fetch(`/api/oanda/accounts?ts=${Date.now()}`, { cache: 'no-store' })
        ])
        const prov = await provRes.json(); const oa = await oandaRes.json()
        if (provRes.ok && prov.success) setProvAccounts(prov.data || []); else setProvError(prov.error || 'Failed to load provisioning accounts')
        if (oandaRes.ok) setOandaAccounts(oa.accounts || oa.data?.accounts || []);
      } catch (e) {
        setProvError(e.message || 'Failed to load accounts')
      } finally {
        setProvLoading(false)
      }
    }
    load()
  }, [activeTab])

  if (status === 'loading') {
    return <div className="loading-screen">Loading...</div>
  }

  if (!session) {
    return null
  }

  // Filter and sort data
  const filteredData = waitlistData?.entries?.filter(entry =>
    entry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.source.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const sortedData = [...filteredData].sort((a, b) => {
    let aVal = a[sortBy]
    let bVal = b[sortBy]
    
    if (sortBy === 'timestamp') {
      aVal = new Date(aVal)
      bVal = new Date(bVal)
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage)

  // Authentication check is now handled by the useEffect above

  return (
    <div className="min-h-screen">
      <nav className="nav dashboard-nav">
        <div className="nav-container">
          <div className="logo">
            <div className="logo-glow"></div>
            <Link href="/">
              <img src="/logo.png" alt="Aurum Prop Firm" className="logo-image" />
            </Link>
            <div className="logo-text-container">
              <span className="logo-text">AURUM</span>
              <span className="logo-subtitle">ADMIN</span>
            </div>
          </div>
          <div className="nav-menu">
            <div className="search-container hidden md:flex mr-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="search-icon">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <input className="search-input" placeholder="Search…" />
            </div>
            <div className="user-profile">
              <div className="user-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M20 21V19A4 4 0 0 0 16 15H8A4 4 0 0 0 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <div className="user-info">
                <span className="user-name">{session?.user?.name}</span>
                <span className="user-role">Administrator</span>
              </div>
            </div>
            <button onClick={handleLogout} className="logout-button ml-4">Logout</button>
          </div>
        </div>
      </nav>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="sidebar-title">Dashboard</div>
          <ul className="sidebar-nav">
            <li className={activeTab==='overview'?'active':''} onClick={()=>setActiveTab('overview')}><span>Overview</span></li>
            <li className={activeTab==='waitlist'?'active':''} onClick={()=>setActiveTab('waitlist')}><span>Waitlist</span></li>
            <li className={activeTab==='users'?'active':''} onClick={()=>setActiveTab('users')}><span>Users</span></li>
            <li className={activeTab==='accounts'?'active':''} onClick={()=>setActiveTab('accounts')}><span>Accounts</span></li>
          </ul>
        </aside>

        <main className="admin-main">
          <div className="admin-head">
            <h1 className="admin-title">
              {activeTab === 'overview' && 'Admin Overview'}
              {activeTab === 'waitlist' && 'Waitlist Management'}
              {activeTab === 'users' && 'User Management'}
            </h1>
            <div className="head-actions">
              <p className="admin-subtitle">Monitor, onboard and manage platform access</p>
              {activeTab === 'overview' && (
                <button className="ghost-button" onClick={() => setShowAnalytics(!showAnalytics)}>
                  {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-12">
              <div className="loading-spinner"></div>
              <p className="mt-4">Loading admin data…</p>
            </div>
          ) : waitlistData ? (
            <>
              {activeTab === 'overview' && showAnalytics && (
                <div className="dashboard-card summary-card">
                  <div className="card-body">
                    <div className="summary-grid">
                      <div className="summary-item">
                        <div className="summary-label">Total Signups</div>
                        <div className="summary-value">{waitlistData.stats.total}</div>
                      </div>
                      <div className="summary-item">
                        <div className="summary-label">Today</div>
                        <div className="summary-value">{waitlistData.stats.today}</div>
                      </div>
                      <div className="summary-item">
                        <div className="summary-label">This Week</div>
                        <div className="summary-value">{waitlistData.stats.thisWeek}</div>
                      </div>
                      <div className="summary-item">
                        <div className="summary-label">Daily Average</div>
                        <div className="summary-value">{Math.round((waitlistData.stats.thisWeek / 7) * 10) / 10}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'overview' && (
                <div className="overview-sections">
                  <div className="two-col-grid">
                    {/* Recent Signups */}
                    <div className="dashboard-card">
                      <div className="card-header"><h2 className="card-title">Recent Signups</h2></div>
                      <div className="card-body">
                        <ul className="simple-list">
                          {(waitlistData.entries || []).slice(0, 8).map((e) => (
                            <li key={e.id} className="simple-list-item">
                              <div className="list-main">
                                <div className="list-primary">{e.email}</div>
                                <div className="list-secondary">{new Date(e.timestamp).toLocaleString()}</div>
                              </div>
                              <span className="source-badge">{e.source}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Top Sources */}
                    <div className="dashboard-card">
                      <div className="card-header"><h2 className="card-title">Top Sources</h2></div>
                      <div className="card-body">
                        <ul className="simple-list compact">
                          {(waitlistData.stats.sources || []).map((s, idx) => (
                            <li key={idx} className="simple-list-item">
                              <div className="list-main">
                                <div className="list-primary">{s.source || 'unknown'}</div>
                                <div className="list-secondary">Signups</div>
                              </div>
                              <div className="metric-chip">{s.count}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="dashboard-card mb-8">
                  <div className="card-header">
                    <h2 className="card-title">Create User</h2>
                    <p className="text-gray-400">Approve a waitlist email and set a password</p>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleCreateUser} className="form-grid">
                      <div className="field">
                        <label className="form-label">Email</label>
                        <input list="waitlist-emails" type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="search-input w-full" placeholder="Select or type email" required />
                        <datalist id="waitlist-emails">
                          {(waitlistData.entries || []).map((e) => (
                            <option key={e.id} value={e.email} />
                          ))}
                        </datalist>
                      </div>
                      <div className="field">
                        <label className="form-label">Password</label>
                        <div className="input-wrapper">
                          <input type={showNewUserPassword ? 'text' : 'password'} value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="search-input w-full" placeholder="Set a password" required />
                          <button type="button" className="password-toggle" onClick={()=>setShowNewUserPassword(!showNewUserPassword)}>{showNewUserPassword ? 'Hide' : 'Show'}</button>
                        </div>
                        <div className="help-note">Admin sets the initial password; users can change it later.</div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="action-button" disabled={creatingUser || !newUserEmail || !newUserPassword}>{creatingUser ? 'Creating…' : 'Create User'}</button>
                      </div>
                    </form>
                    {createUserError && <div className="error-message show mt-4">{createUserError}</div>}
                    {createUserSuccess && (
                      <div className="text-green-400 mt-4">
                        <div>Created user ID: {createUserSuccess.userId}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(activeTab === 'overview' || activeTab === 'waitlist') && (
                <div className="dashboard-card">
                  <div className="card-header flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h2 className="card-title">Waitlist Entries</h2>
                      <div className="search-container">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="search-icon"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2"/></svg>
                        <input type="text" placeholder="Search emails or sources..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
                      </div>
                    </div>
                    <div className="card-actions">
                      <button onClick={handleExportCSV} className="action-button">Export CSV</button>
                    </div>
                  </div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="sortable" onClick={() => { setSortBy('position'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}># {sortBy === 'position' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th className="sortable" onClick={() => { setSortBy('email'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>Email {sortBy === 'email' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th className="sortable" onClick={() => { setSortBy('timestamp'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>Date Joined {sortBy === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th className="sortable" onClick={() => { setSortBy('source'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>Source {sortBy === 'source' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th>IP Address</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((entry) => (
                          <tr key={entry.id}>
                            <td className="position-cell">#{entry.position}</td>
                            <td className="email-cell">{entry.email}</td>
                            <td className="date-cell">{new Date(entry.timestamp).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
                            <td className="source-cell"><span className="source-badge">{entry.source}</span></td>
                            <td className="ip-cell">{entry.ip}</td>
                          <td className="status-cell"><span className="status-badge active">Active</span></td>
                          <td><button className="action-button" onClick={() => handleSelectWaitlist(entry.email)}>Select</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="pagination-button">Previous</button>
                      <div className="pagination-info">Page {currentPage} of {totalPages} ({sortedData.length} entries)</div>
                      <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="pagination-button">Next</button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'accounts' && (
                <>
                  <div className="dashboard-card mb-8">
                    <div className="card-header"><h2 className="card-title">Provisioning Queue</h2></div>
                    <div className="card-body">
                      {provLoading ? (
                        <div className="text-gray-400">Loading…</div>
                      ) : provError ? (
                        <div className="error-message show">{provError}</div>
                      ) : provAccounts.length === 0 ? (
                        <div className="text-gray-400">No purchased accounts awaiting provisioning.</div>
                      ) : (
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>User Email</th>
                              <th>Plan</th>
                              <th>Tier</th>
                              <th>Size</th>
                              <th>Purchased</th>
                              <th>OANDA Account ID</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {provAccounts.map(acc => (
                              <tr key={acc.id}>
                                <td className="email-cell">{acc.user_email}</td>
                                <td>{acc.account_type}</td>
                                <td>{(acc.plan_tier || 'standard').charAt(0).toUpperCase() + (acc.plan_tier || 'standard').slice(1)}</td>
                                <td>${Number(acc.account_size).toLocaleString()}</td>
                                <td className="date-cell">{new Date(acc.start_date).toLocaleDateString()}</td>
                                <td>
                                  <input className="search-input" placeholder="e.g. 101-001-…" defaultValue={acc.oanda_account_id || ''} onChange={(e)=>{acc._tmp=e.target.value}} />
                                </td>
                                <td>
                                  <button className="action-button" onClick={async ()=>{
                                    const id = acc._tmp || acc.oanda_account_id
                                    if (!id) return alert('Enter an OANDA Account ID')
                                    const res = await fetch('/api/admin/accounts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ account_id: acc.id, oanda_account_id: id }) })
                                    const data = await res.json(); if (res.ok && data.success) {
                                      setProvAccounts(prev => prev.filter(a => a.id !== acc.id));
                                      // Refresh OANDA accounts so the attached flag updates in the table
                                      await refreshOandaAccounts();
                                    } else { alert(data.error || 'Failed to approve') }
                                  }}>Attach & Activate</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div className="dashboard-card">
                    <div className="card-header">
                      <h2 className="card-title">Available OANDA Accounts</h2>
                      <div className="card-actions">
                        <label className="form-label" style={{display:'flex',alignItems:'center',gap:8}}>
                          <input type="checkbox" checked={showOnlyUnattached} onChange={(e)=> setShowOnlyUnattached(e.target.checked)} />
                          Show only unattached
                        </label>
                      </div>
                    </div>
                    <div className="card-body">
                      {(oandaAccounts && oandaAccounts.length > 0) ? (
                        (() => {
                          const rows = showOnlyUnattached ? oandaAccounts.filter(a => !a.attached) : oandaAccounts
                          return (
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>OANDA Account ID</th>
                                  <th>Alias</th>
                                  <th>Currency</th>
                                  <th>Balance</th>
                                  <th>Attached</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((a) => (
                                  <tr key={a.id}>
                                    <td className="email-cell">{a.id}</td>
                                    <td>{a.alias || '—'}</td>
                                    <td>{a.currency || '—'}</td>
                                    <td>{typeof a.balance === 'number' ? `$${a.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</td>
                                    <td>{a.attached ? 'Yes' : 'No'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )
                        })()
                      ) : (
                        <div className="text-gray-400">No OANDA accounts returned (check token).</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="empty-icon"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2"/></svg>
              <h3>No Data Available</h3>
              <p>Failed to load waitlist data. Please try refreshing the page.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
