"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
// Styles moved to app/layout.js

import SpiritJournalChat from "./components/SpiritJournalChat";
import TakeTrade from "./components/TakeTrade";
import LearnAurum from "./components/LearnAurum";
import ChallengeAccounts from "./components/ChallengeAccounts";
import Support from "./components/Support";
import AccountHistory from "./components/AccountHistory";

export default function ClientDashboard() {
  const { data: session, status } = useSession();
  const [activeSection, setActiveSection] = useState("challenge-accounts");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountsData, setAccountsData] = useState(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState("EURUSD");
  const [selectedTimeframe, setSelectedTimeframe] = useState("60");
  const [activeAccounts, setActiveAccounts] = useState([]);
  const [inactiveAccounts, setInactiveAccounts] = useState([]);
  const [provisioningAccounts, setProvisioningAccounts] = useState([]);

  // Trading flow states
  const [tradingStep, setTradingStep] = useState("account-selection"); // 'account-selection', 'pair-selection', 'direction-selection'
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedPair, setSelectedPair] = useState(null);

  // Live pricing states
  const [livePrices, setLivePrices] = useState({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [isWeekend, setIsWeekend] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);

  // Trading history states
  const [tradesData, setTradesData] = useState(null);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [selectedAccountForTrades, setSelectedAccountForTrades] =
    useState(null);

  // Learning module states
  const [currentModule, setCurrentModule] = useState(null); // null for overview, 1 for module 1, etc.
  const [currentLesson, setCurrentLesson] = useState(1.1); // current lesson within module
  const [completedLessons, setCompletedLessons] = useState(new Set());

  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Still loading

    if (!session) {
      router.push("/login");
      return;
    }

    // Redirect admin users to admin dashboard
    if (session.user.role === "admin") {
      router.push("/admin");
      return;
    }

    // Load user accounts
    loadAccountsData();
  }, [session, status, router]);

  // Initialize TradingView chart
  useEffect(() => {
    if (
      activeSection === "spirit-journal" &&
      typeof window !== "undefined" &&
      window.TradingView
    ) {
      const initChart = () => {
        const container = document.getElementById("tradingview_chart");
        if (!container) return;
        new window.TradingView.widget({
          width: "100%",
          height: 500,
          symbol: `FX_IDC:${selectedSymbol}`,
          interval: selectedTimeframe,
          timezone: "Etc/UTC",
          theme: "light",
          style: "1",
          locale: "en",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: "tradingview_chart",
          studies: ["RSI@tv-basicstudies", "MASimple@tv-basicstudies"],
          show_popup_button: true,
          popup_width: "1000",
          popup_height: "650",
        });
      };

      // Small delay to ensure DOM is ready
      const timer = setTimeout(initChart, 100);
      return () => clearTimeout(timer);
    }
  }, [activeSection, selectedSymbol, selectedTimeframe]);

  const loadAccountsData = async () => {
    if (!session?.user?.email) {
      console.log("No session email available");
      return;
    }

    console.log("Loading accounts for:", session.user.email);

    try {
      setAccountsLoading(true);
      const response = await fetch(
        `/api/accounts?email=${encodeURIComponent(session.user.email)}`,
      );
      const result = await response.json();
      console.log("Accounts result:", result);

      if (result.success) {
        setAccountsData(result.data);

        const activeAccounts = result.data.filter(account => account.status === 'active');
        const provisioningAccounts = result.data.filter(account => account.status === 'provisioning');
        const inactiveAccounts = result.data.filter(account => account.status === 'inactive');

        setActiveAccounts(activeAccounts);
        setInactiveAccounts(inactiveAccounts);
        if (typeof setProvisioningAccounts === 'function') setProvisioningAccounts(provisioningAccounts);

        // Also refresh trades data if we're in the account history section
        if (activeSection === "account-history") {
          loadTradesData(selectedAccountForTrades);
        }
      } else {
        console.error("Failed to load accounts:", result.error);
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadTradesData = async (accountId = null) => {
    if (!session?.user?.email) {
      console.log("No session email available");
      return;
    }

    console.log(
      "Loading trades for:",
      session.user.email,
      "account:",
      accountId,
    );

    try {
      setTradesLoading(true);
      const params = new URLSearchParams({
        email: session.user.email,
        limit: "50",
        offset: "0",
      });

      if (accountId) {
        params.append("account_id", accountId);
      }

      const response = await fetch(`/api/trading/history?${params.toString()}`);
      const result = await response.json();
      console.log("Trades result:", result);

      if (result.success) {
        setTradesData(result.data);
      } else {
        console.error("Failed to load trades:", result.error);
        setTradesData(null);
      }
    } catch (error) {
      console.error("Error loading trades:", error);
      setTradesData(null);
    } finally {
      setTradesLoading(false);
    }
  };

  // Live pricing functions
  const checkIfWeekend = () => {
    const now = new Date();
    const utcDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const utcHour = now.getUTCHours();

    // Forex markets are closed from Friday 22:00 UTC to Sunday 22:00 UTC
    const isWeekendTime =
      (utcDay === 0 && utcHour < 22) || // Sunday before 22:00
      utcDay === 6 || // All Saturday
      (utcDay === 5 && utcHour >= 22); // Friday after 22:00

    setIsWeekend(isWeekendTime);
    return isWeekendTime;
  };

  const convertPairToInstrument = (pair) => {
    return pair.replace("/", "_");
  };

  const convertInstrumentToPair = (instrument) => {
    return instrument.replace("_", "/");
  };

  const fetchLivePrices = async (pairs = null) => {
    try {
      setPricesLoading(true);

      // Default major pairs for initial load
      const defaultPairs = [
        "EUR_USD",
        "GBP_USD",
        "USD_JPY",
        "USD_CHF",
        "AUD_USD",
        "USD_CAD",
      ];
      const instrumentsToFetch = pairs || defaultPairs;

      const instrumentsParam = Array.isArray(instrumentsToFetch)
        ? instrumentsToFetch.join(",")
        : instrumentsToFetch;

      console.log("📊 Fetching live prices for:", instrumentsParam);

      // Prefer the selected account's OANDA id; otherwise first active account's
      const oandaAccountId = selectedAccount?.oanda_account_id || activeAccounts?.[0]?.oanda_account_id || '';
      if (!oandaAccountId) {
        // No account to price against yet (e.g., before selection) — skip quietly
        setPricesLoading(false);
        return;
      }
      const response = await fetch(
        `/api/oanda/pricing?instruments=${encodeURIComponent(instrumentsParam)}&oanda_account_id=${encodeURIComponent(oandaAccountId || '')}&ts=${Date.now()}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ OANDA pricing API error:", errorData);
        throw new Error(`API Error: ${errorData.error || "Unknown error"}`);
      }

      const data = await response.json();
      console.log("📈 Pricing data received:", data);

      if (data.success && data.prices && data.prices.length > 0) {
        const pricesMap = {};
        data.prices.forEach((price) => {
          const pair = convertInstrumentToPair(price.instrument);

          // Validate that we have both bid and ask prices
          if (price.bids?.[0]?.price && price.asks?.[0]?.price) {
            const bid = parseFloat(price.bids[0].price);
            const ask = parseFloat(price.asks[0].price);

            pricesMap[pair] = {
              instrument: price.instrument,
              bid: bid.toString(),
              ask: ask.toString(),
              spread: (
                (ask - bid) *
                Math.pow(10, pair.includes("JPY") ? 2 : 4)
              ).toFixed(1),
              time: price.time || new Date().toISOString(),
              change: calculatePriceChange(
                pair,
                price.closeoutMid || ((bid + ask) / 2).toString(),
              ),
              lastUpdate: new Date().toISOString(),
            };

            console.log(
              `💱 ${pair}: Bid=${bid}, Ask=${ask}, Spread=${pricesMap[pair].spread} pips`,
            );
          } else {
            console.warn(
              `⚠️ Invalid price data for ${price.instrument}:`,
              price,
            );
          }
        });

        if (Object.keys(pricesMap).length > 0) {
          setLivePrices((prevPrices) => ({ ...prevPrices, ...pricesMap }));
          setLastPriceUpdate(new Date());
          console.log(
            "✅ Successfully updated",
            Object.keys(pricesMap).length,
            "price(s)",
          );
        } else {
          console.warn("⚠️ No valid prices extracted from response");
        }
      } else {
        console.error("❌ Invalid pricing response structure:", data);
        throw new Error("Invalid pricing data received from OANDA");
      }
    } catch (error) {
      console.error("💥 Error fetching live prices:", error.message);

      // Don't update prices on error - keep showing last valid prices
      // This prevents showing invalid/empty prices to users
      if (
        error.message.includes("Network") ||
        error.message.includes("fetch")
      ) {
        console.log("🔄 Network error - will retry on next interval");
      }
    } finally {
      setPricesLoading(false);
    }
  };

  const calculatePriceChange = (pair, currentPrice) => {
    // For demo purposes, generate a small random change
    // In real implementation, you'd compare with previous price
    const change = (Math.random() - 0.5) * 0.01;
    return change >= 0 ? `+${change.toFixed(4)}` : change.toFixed(4);
  };

  // Effect for live pricing updates
  useEffect(() => {
    if (activeSection === "take-trade") {
      // Check weekend status
      checkIfWeekend();

      // Initial price fetch
      if (!isWeekend) {
        fetchLivePrices();
      }

      // Set up periodic updates every 5 seconds (only if not weekend)
      const priceInterval = setInterval(() => {
        if (!checkIfWeekend()) {
          fetchLivePrices();
        }
      }, 5000);

      return () => clearInterval(priceInterval);
    }
  }, [activeSection, isWeekend]);

  // Effect for selected pair pricing updates
  useEffect(() => {
    if (selectedPair && tradingStep === "direction-selection" && !isWeekend) {
      const instrument = convertPairToInstrument(selectedPair);
      fetchLivePrices([instrument]);

      // More frequent updates for the selected pair (every 2 seconds)
      const selectedPairInterval = setInterval(() => {
        if (!checkIfWeekend()) {
          fetchLivePrices([instrument]);
        }
      }, 2000);

      return () => clearInterval(selectedPairInterval);
    }
  }, [selectedPair, tradingStep, isWeekend]);

  // Effect for loading trades data when account history is active
  useEffect(() => {
    if (activeSection === "account-history") {
      // Reload accounts and trades when entering account history
      loadAccountsData();
      loadTradesData();
    }
  }, [activeSection]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading") {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  const navigationItems = [
    {
      id: "challenge-accounts",
      name: "Challenge Accounts",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect
            x="2"
            y="3"
            width="20"
            height="14"
            rx="2"
            ry="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="8"
            y1="21"
            x2="16"
            y2="21"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="12"
            y1="17"
            x2="12"
            y2="21"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
      description: "Purchase and manage your trading challenges",
    },
    {
      id: "account-history",
      name: "Account History",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 3V21H21V3H3Z" stroke="currentColor" strokeWidth="2" />
          <path d="M7 8H17" stroke="currentColor" strokeWidth="2" />
          <path d="M7 12H17" stroke="currentColor" strokeWidth="2" />
          <path d="M7 16H13" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
      description: "View your active and inactive trading accounts",
    },
    {
      id: "spirit-journal",
      name: "Spirit Journal",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M14 2H6A2 2 0 0 0 4 4V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V8Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <polyline
            points="14,2 14,8 20,8"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="16"
            y1="13"
            x2="8"
            y2="13"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="16"
            y1="17"
            x2="8"
            y2="17"
            stroke="currentColor"
            strokeWidth="2"
          />
          <polyline
            points="10,9 9,9 8,9"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
      description: "AI-assisted trading journal with market insights",
    },
    {
      id: "take-trade",
      name: "Take a Trade",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <polyline
            points="23,6 13.5,15.5 8.5,10.5 1,18"
            stroke="currentColor"
            strokeWidth="2"
          />
          <polyline
            points="17,6 23,6 23,12"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
      description: "Execute trades on major currency pairs",
    },
    {
      id: "support",
      name: "Support & Feedback",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M21 15A2 2 0 0 1 19 17H7L4 20V5A2 2 0 0 1 6 3H19A2 2 0 0 1 21 5Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="9"
            y1="9"
            x2="15"
            y2="9"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="9"
            y1="13"
            x2="12"
            y2="13"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
      description: "Get help and share your feedback",
    },
    {
      id: "learn-aurum",
      name: "Learn Aurum",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M2 3H8A4 4 0 0 1 12 7A4 4 0 0 1 16 3H22V16A4 4 0 0 1 18 20H16A4 4 0 0 0 12 16A4 4 0 0 0 8 20H6A4 4 0 0 1 2 16V3Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M12 7V20" stroke="currentColor" strokeWidth="2" />
          <path d="M22 3V16" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
      description: "Master our platform and trading strategies",
    },
  ];
  // Removed broken renderContent block
  /*
  const renderContent = () => {
    switch (activeSection) {
      case "challenge-accounts":
        return (<ChallengeAccounts session={session} />);

      
        ;
                      })}
                    </div>
                </div>
              </div>
            )}


            <div className="orders-section">
                <div className="accounts-section-header">
                      <h2 className="accounts-section-title">
                        Account History
                      </h2>
                      <div className="accounts-section-actions">
                        <button className="accounts-filter-btn">
                          All Status
                        </button>
                      </div>
                </div>
                    {/* End of Active Accounts Section * /}

                    <div className="accounts-table">
                      <div className="accounts-table-header">
                        <div className="table-col col-account">Account</div>
                        <div className="table-col col-balance">
                          Final Balance
                        </div>
                        <div className="table-col col-pnl">P&L</div>
                        <div className="table-col col-performance">
                          Performance
                        </div>
                        <div className="table-col col-duration">Duration</div>
                        <div className="table-col col-status">Status</div>
                        <div className="table-col col-actions">Actions</div>
                      </div>

                      {inactiveAccounts.map((account) => {
                        const totalTrades = parseInt(account.total_trades || 0);
                        const winningTrades = parseInt(
                          account.winning_trades || 0,
                        );
                        const winRate =
                          totalTrades > 0
                            ? ((winningTrades / totalTrades) * 100).toFixed(1)
                            : "0.0";
                        const duration = account.end_date
                          ? Math.ceil(
                              (new Date(account.end_date) -
                                new Date(account.start_date)) /
                                (1000 * 60 * 60 * 24),
                            )
                          : Math.ceil(
                              (new Date() - new Date(account.start_date)) /
                                (1000 * 60 * 60 * 24),
                            );

                        return (
                          <div
                            key={account.id}
                            className={`accounts-table-row ${account.status}`}
                          >
                            <div className="table-col col-account">
                              <div className="account-info">
                                <div className="account-main">
                                  <span
                                    className={`account-type-badge ${account.account_type}`}
                                  >
                                    {account.account_type === "challenge"
                                      ? "Challenge"
                                      : account.account_type === "funded"
                                        ? "Funded"
                                        : "Demo"}
                                  </span>
                                  <span className="account-size">
                                    $
                                    {parseFloat(
                                      account.account_size,
                                    ).toLocaleString()}
                                  </span>
                                </div>
                                <div className="account-meta">
                                  {account.challenge_phase && (
                                    <span className="account-phase">
                                      {account.challenge_phase}
                                    </span>
                                  )}
                                  <span className="account-date">
                                    {new Date(
                                      account.start_date,
                                    ).toLocaleDateString()}{" "}
                                    -{" "}
                                    {account.end_date
                                      ? new Date(
                                          account.end_date,
                                        ).toLocaleDateString()
                                      : "Ongoing"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="table-col col-balance">
                              <div className="balance-info">
                                <div className="current-balance">
                                  $
                                  {parseFloat(
                                    account.current_balance,
                                  ).toLocaleString()}
                                </div>
                                <div className="max-balance">
                                  Peak: $
                                  {parseFloat(
                                    account.max_balance,
                                  ).toLocaleString()}
                                </div>
                              </div>
                            </div>

                            <div className="table-col col-pnl">
                              <div
                                className={`pnl-value ${(() => {
                                  const currentBalance = parseFloat(
                                    account.current_balance || 0,
                                  );
                                  const accountSize = parseFloat(
                                    account.account_size || 0,
                                  );
                                  return currentBalance >= accountSize
                                    ? "positive"
                                    : "negative";
                                })()}`}
                              >
                                $
                                {(() => {
                                  const currentBalance = parseFloat(
                                    account.current_balance || 0,
                                  );
                                  const accountSize = parseFloat(
                                    account.account_size || 0,
                                  );
                                  const actualProfitLoss =
                                    currentBalance - accountSize;
                                  return (
                                    (actualProfitLoss >= 0 ? "+" : "") +
                                    actualProfitLoss.toFixed(2)
                                  );
                                })()}
                              </div>
                              <div className="pnl-percent">
                                {(() => {
                                  const currentBalance = parseFloat(
                                    account.current_balance || 0,
                                  );
                                  const accountSize = parseFloat(
                                    account.account_size || 1,
                                  );
                                  const actualProfitLoss =
                                    currentBalance - accountSize;
                                  const percentage =
                                    (actualProfitLoss / accountSize) * 100;

                                  // Cap extreme values to prevent display issues
                                  const cappedPercentage = Math.max(
                                    -100,
                                    Math.min(1000, percentage),
                                  );
                                  return cappedPercentage.toFixed(2);
                                })()}
                                %
                              </div>
                            </div>

                            <div className="table-col col-performance">
                              <div className="performance-info">
                                <div className="trades-count">
                                  {account.total_trades} trades
                                </div>
                                <div className="win-rate">
                                  {winRate}% win rate
                                </div>
                                {account.profit_target > 0 && (
                                  <div className="target-info">
                                    Target: $
                                    {parseFloat(account.profit_target).toFixed(
                                      0,
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="table-col col-duration">
                              <div className="duration-info">
                                <div className="duration-days">
                                  {duration} days
                                </div>
                                <div className="duration-dates">
                                  {new Date(
                                    account.start_date,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}{" "}
                                  -{" "}
                                  {account.end_date
                                    ? new Date(
                                        account.end_date,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })
                                    : "Now"}
                                </div>
                              </div>
                            </div>

                            <div className="table-col col-status">
                              <div className={`status-badge ${account.status}`}>
                                {account.status === "passed"
                                  ? "Passed"
                                  : account.status === "failed"
                                    ? "Failed"
                                    : account.status === "inactive"
                                      ? "Inactive"
                                      : account.status}
                              </div>
                            </div>

                            <div className="table-col col-actions">
                              <div className="action-buttons">
                                <button className="action-btn secondary">
                                  Details
                                </button>
                                {account.status === "passed" && (
                                  <button className="action-btn success">
                                    Claim
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </div>
                </div>
                  {accountsData && accountsData.length === 0 && (
                    <div className="orders-empty-state">
                    <svg
                      width="80"
                      height="80"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="empty-state-icon"
                    >
                      <rect
                        x="2"
                        y="3"
                        width="20"
                        height="14"
                        rx="2"
                        ry="2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <line
                        x1="8"
                        y1="21"
                        x2="16"
                        y2="21"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <line
                        x1="12"
                        y1="17"
                        x2="12"
                        y2="21"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    <h3>No Trading Accounts Yet</h3>
                    <p>
                      Start your trading journey by purchasing a challenge
                      account.
                    </p>
                    <button
                      className="empty-state-cta"
                      onClick={() => setActiveSection("challenge-accounts")}
                    >
                      Browse Challenges
                    </button>
                  </div>
                )}

                {/* Individual Trades Section * /}
                <div className="trades-section">
                  <div className="accounts-section-header">
                    <h2 className="accounts-section-title">Trading History</h2>
                    <div className="accounts-section-actions">
                      <select
                        className="accounts-filter-btn"
                        value={selectedAccountForTrades || ""}
                        onChange={(e) => {
                          const accountId = e.target.value || null;
                          setSelectedAccountForTrades(accountId);
                          loadTradesData(accountId);
                        }}
                      >
                        <option value="">All Accounts</option>
                        {/* FIX: Corrected the map to use the 'account' variable consistently and fixed the JSX syntax * /}
                        {accountsData.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)}{" "}
                            - ${parseFloat(account.account_size).toLocaleString()}
                          </option>
                        ))}
                        {inactiveAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.account_type.charAt(0).toUpperCase() +
                              account.account_type.slice(1)}{" "}
                            - $
                            {parseFloat(account.account_size).toLocaleString()}{" "}
                            (Inactive)
                          </option>
                        ))}
                      </select>
                      <button
                        className="accounts-view-btn"
                        onClick={() => loadTradesData(selectedAccountForTrades)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M3 12L3 18.9671C3 19.2763 3.18652 19.5542 3.47803 19.6659L11.4783 22.6659C11.8045 22.7885 12.1955 22.7885 12.5217 22.6659L20.522 19.6659C20.8135 19.5542 21 19.2763 21 18.9671L21 12"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <path
                            d="M3 6L11.4783 2.33415C11.8045 2.21149 12.1955 2.21149 12.5217 2.33415L21 6L12 10.5L3 6Z"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                        Refresh
                      </button>
                    </div>
                  </div>

                  {tradesLoading ? (
                    <div className="trades-loading">
                      <div className="loading-spinner"></div>
                      <p>Loading your trades...</p>
                    </div>
                  ) : tradesData &&
                    tradesData.trades &&
                    tradesData.trades.length > 0 ? (
                    <>
                      {/* Trades Summary * /}
                      <div className="trades-summary">
                        <div className="summary-card">
                          <div className="summary-item">
                            <span className="summary-label">Total Trades:</span>
                            <span className="summary-value">
                              {tradesData.summary.total_trades}
                            </span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Open Trades:</span>
                            <span className="summary-value">
                              {tradesData.summary.open_trades}
                            </span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">
                              Closed Trades:
                            </span>
                            <span className="summary-value">
                              {tradesData.summary.closed_trades}
                            </span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">
                              Unrealized P&L:
                            </span>
                            <span
                              className={`summary-value ${tradesData.summary.total_unrealized_pnl >= 0 ? "positive" : "negative"}`}
                            >
                              {tradesData.summary.total_unrealized_pnl >= 0
                                ? "+"
                                : ""}
                              $
                              {tradesData.summary.total_unrealized_pnl.toFixed(
                                2,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Trades Table * /}
                      <div className="trades-table">
                        <div className="trades-table-header">
                          <div className="table-col col-time">Time</div>
                          <div className="table-col col-instrument">Pair</div>
                          <div className="table-col col-side">Side</div>
                          <div className="table-col col-size">Size</div>
                          <div className="table-col col-entry">Entry</div>
                          <div className="table-col col-current">Current</div>
                          <div className="table-col col-sl">Stop Loss</div>
                          <div className="table-col col-tp">Take Profit</div>
                          <div className="table-col col-pnl">P&L</div>
                          <div className="table-col col-status">Status</div>
                          <div className="table-col col-reason">Reason</div>
                        </div>

                        {tradesData.trades.map((trade) => (
                          <div
                            key={trade.id}
                            className={`trades-table-row ${trade.status}`}
                          >
                            <div className="table-col col-time">
                              <div className="time-info">
                                <div className="trade-time">
                                  {new Date(
                                    trade.timestamp,
                                  ).toLocaleDateString()}
                                </div>
                                <div className="trade-time-detail">
                                  {new Date(
                                    trade.timestamp,
                                  ).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>

                            <div className="table-col col-instrument">
                              <div className="instrument-info">
                                <div className="instrument-name">
                                  {trade.instrument.replace("_", "/")}
                                </div>
                                <div className="account-type">
                                  {trade.account_type}
                                </div>
                              </div>
                            </div>

                            <div className="table-col col-side">
                              <div
                                className={`trade-side ${trade.side.toLowerCase()}`}
                              >
                                {trade.side}
                              </div>
                            </div>

                            <div className="table-col col-size">
                              <div className="size-info">
                                <div className="units">
                                  {trade.units_formatted}
                                </div>
                                <div className="lots">
                                  {(Math.abs(trade.units) / 100000).toFixed(2)}{" "}
                                  lots
                                </div>
                              </div>
                            </div>

                            <div className="table-col col-entry">
                              <div className="price-info">
                                {trade.entry_price_formatted}
                              </div>
                            </div>

                            <div className="table-col col-current">
                              <div className="price-info">
                                {trade.status === "open" && trade.current_price
                                  ? parseFloat(trade.current_price).toFixed(
                                      trade.instrument.includes("JPY") ? 3 : 5,
                                    )
                                  : trade.status === "open"
                                    ? "Loading..."
                                    : "-"}
                              </div>
                            </div>

                            <div className="table-col col-sl">
                              <div className="price-info">
                                {trade.stop_loss_formatted || "-"}
                              </div>
                            </div>

                            <div className="table-col col-tp">
                              <div className="price-info">
                                {trade.take_profit_formatted || "-"}
                              </div>
                            </div>

                            <div className="table-col col-pnl">
                              {trade.status === "open" ? (
                                <div
                                  className={`pnl-value ${(trade.unrealized_pnl || 0) >= 0 ? "positive" : "negative"}`}
                                >
                                  {(trade.unrealized_pnl || 0) >= 0 ? "+" : ""}$
                                  {(trade.unrealized_pnl || 0).toFixed(2)}
                                  <div className="pnl-type">Unrealized</div>
                                </div>
                              ) : (
                                <div className="pnl-value">
                                  -<div className="pnl-type">Closed</div>
                                </div>
                              )}
                            </div>

                            <div className="table-col col-status">
                              <div className={`status-badge ${trade.status}`}>
                                {trade.status === "open" ? "Open" : "Closed"}
                              </div>
                            </div>

                            <div className="table-col col-reason">
                              <div className="reason-text">
                                {trade.trade_reason || "No reason provided"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination * /}
                      {tradesData.pagination &&
                        tradesData.pagination.hasMore && (
                          <div className="trades-pagination">
                            <button
                              className="load-more-btn"
                              onClick={() => {
                                // Load more trades functionality could be added here
                                console.log("Load more trades");
                              }}
                            >
                              Load More Trades
                            </button>
                          </div>
                        )}
                    </>
                  ) : (
                    <div className="trades-empty-state">
                      <svg
                        width="80"
                        height="80"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="empty-state-icon"
                      >
                        <path
                          d="M12 2L2 22H22L12 2Z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M12 9V13"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M12 17H12.01"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                      <h3>No Trades Yet</h3>
                      <p>
                        Your trading history will appear here once you start
                        placing trades.
                      </p>
                      <button
                        className="empty-state-cta"
                        onClick={() => setActiveSection("take-trade")}
                      >
                        Place Your First Trade
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="accounts-error-state">
                <p>
                  Failed to load account data. Please try refreshing the page.
                </p>
              </div>
            )}
          </div>
        </div>
        );

      default:
        return <div>Select a section from the sidebar</div>;
    }
  };
  */

  // Clean content renderer
  const renderContentSafe = () => {
    switch (activeSection) {
      case "challenge-accounts":
        return <ChallengeAccounts session={session} />;
      case "account-history":
        return (
          <AccountHistory
            accountsLoading={accountsLoading}
            accountsData={accountsData}
            activeAccounts={activeAccounts}
            provisioningAccounts={provisioningAccounts}
            inactiveAccounts={inactiveAccounts}
            tradesLoading={tradesLoading}
            tradesData={tradesData}
            selectedAccountForTrades={selectedAccountForTrades}
            setSelectedAccountForTrades={setSelectedAccountForTrades}
            loadTradesData={loadTradesData}
            setActiveSection={setActiveSection}
            setTradingStep={setTradingStep}
            setSelectedAccount={setSelectedAccount}
            setSelectedPair={setSelectedPair}
          />
        );
      case "spirit-journal":
        return (
          <SpiritJournalChat
            selectedSymbol={selectedSymbol}
            setSelectedSymbol={setSelectedSymbol}
          />
        );
      case "take-trade":
        return (
          <TakeTrade
            tradingStep={tradingStep}
            setTradingStep={setTradingStep}
            selectedAccount={selectedAccount}
            setSelectedAccount={setSelectedAccount}
            selectedPair={selectedPair}
            setSelectedPair={setSelectedPair}
            accountsLoading={accountsLoading}
            activeAccounts={activeAccounts}
            livePrices={livePrices}
            pricesLoading={pricesLoading}
            isWeekend={isWeekend}
            setActiveSection={setActiveSection}
          />
        );
      case "support":
        return <Support />;
      case "learn-aurum":
        return <LearnAurum setActiveSection={setActiveSection} />;
      default:
        return <div>Select a section from the sidebar</div>;
    }
  };

  // This check is now handled by the useEffect above

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside
        className={`dashboard-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
      >
        <div className="sidebar-header">
          <div className="logo-section">
            <Link href="/">
              <img src="/logo.png" alt="Aurum" className="sidebar-logo" />
            </Link>
            {!sidebarCollapsed && (
              <div className="logo-text">
                <span className="brand-name">AURUM</span>
                <span className="brand-subtitle">PROP FIRM</span>
              </div>
            )}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <line
                x1="3"
                y1="6"
                x2="21"
                y2="6"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="3"
                y1="12"
                x2="21"
                y2="12"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="3"
                y1="18"
                x2="21"
                y2="18"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? "active" : ""}`}
              onClick={() => setActiveSection(item.id)}
            >
              <div className="nav-icon">{item.icon}</div>
              {!sidebarCollapsed && (
                <div className="nav-content">
                  <div className="nav-name">{item.name}</div>
                  <div className="nav-description">{item.description}</div>
                </div>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-section">
            <div className="user-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 21V19A4 4 0 0 0 16 15H8A4 4 0 0 0 4 19V21"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="7"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div className="user-info">
                <div className="user-name">{session?.user?.name}</div>
                <div className="user-role">Trader</div>
              </div>
            )}
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H9"
                stroke="currentColor"
                strokeWidth="2"
              />
              <polyline
                points="16,17 21,12 16,7"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="21"
                y1="12"
                x2="9"
                y2="12"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">{renderContentSafe()}</main>
    </div>
  );
}
