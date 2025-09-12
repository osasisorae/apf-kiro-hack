"use client";

import React, { useState, useEffect } from "react";

export default function LearnAurum({ setActiveSection }) {
  const [currentModule, setCurrentModule] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(1.1);
  const [completedLessons, setCompletedLessons] = useState(new Set());

  // Lesson maps per module for accurate progress accounting
  const moduleLessons = {
    1: [1.1, 1.2, 1.3, 1.4, 1.5],
    2: [2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8],
    3: [3.1, 3.2, 3.3, 3.4, 3.5, 3.6],
    4: [4.1, 4.2, 4.3, 4.4, 4.5],
  };

  const completedCountFor = (mod) => moduleLessons[mod].filter((id) => completedLessons.has(id)).length;

  // Persist progress locally (per browser). We store completed lesson ids and last module/lesson.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("aurum_learn_progress");
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.completed)) {
          setCompletedLessons(new Set(data.completed));
        }
        if (typeof data.currentModule === "number") {
          setCurrentModule(data.currentModule);
        }
        if (typeof data.currentLesson === "number") {
          setCurrentLesson(data.currentLesson);
        }
      }
    } catch (_) {
      // ignore
    }
  }, []);

  // Try to load server-side progress (if authenticated). Fallback to local only on 401.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/learn/progress', { cache: 'no-store' });
        if (!res.ok) return; // likely 401 when not logged in; ignore
        const data = await res.json();
        if (cancelled) return;
        if (data?.success && data.data) {
          const serverCompleted = Array.isArray(data.data.completed_lessons) ? data.data.completed_lessons : [];
          setCompletedLessons(new Set(serverCompleted));
          if (typeof data.data.current_module === 'number') setCurrentModule(data.data.current_module);
          if (typeof data.data.current_lesson === 'number') setCurrentLesson(data.data.current_lesson);
        }
      } catch (_) {
        // ignore network errors
      }
    })();
    return () => { cancelled = true };
  }, []);

  useEffect(() => {
    try {
      const payload = {
        completed: Array.from(completedLessons),
        currentModule: currentModule,
        currentLesson: currentLesson,
      };
      localStorage.setItem("aurum_learn_progress", JSON.stringify(payload));
    } catch (_) {
      // ignore
    }
  }, [completedLessons, currentModule, currentLesson]);

  // Best-effort server sync when user is authenticated. Silent no-op on 401.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = {
          completed: Array.from(completedLessons),
          current_module: currentModule,
          current_lesson: currentLesson,
        };
        const res = await fetch('/api/learn/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        // ignore response; this is best-effort
      } catch (_) {
        // ignore
      }
    })();
    return () => { cancelled = true };
  }, [completedLessons, currentModule, currentLesson]);

  const renderModule1 = () => {
    const lessons = [
      {
        id: 1.1,
        title: "Welcome to Aurum: A New Philosophy of Partnership",
        content: `
          <div class="welcome-letter">
            <h2>Congratulations on taking the first step towards becoming a disciplined, funded trader.</h2>
            <p>I know the journey that brought you here. Like most traders, you've probably experienced the frustration of prop firms that feel more like adversaries than partners. You've faced challenges designed to make you fail, rules that seem arbitrary, and a system that profits when you don't.</p>
            <p><strong>That ends today.</strong></p>
            <p>We built Aurum on a single, powerful idea: <em>we only succeed when you do</em>. This isn't just another challenge; it's a sophisticated platform and a framework designed to build the habits of elite traders.</p>
            <p>Every rule, every feature, every aspect of our platform serves as <strong>guardrails for success</strong> – carefully designed constraints that enforce the discipline you need to win in the markets.</p>
            <h3>The Goal of This Course</h3>
            <p>This initial module is your guided tour. By the end, you'll know exactly how to navigate your dashboard, understand your mission, and place your first trade with confidence.</p>
            <p>Welcome to the Aurum family. Let's begin.</p>
          </div>
        `,
      },
      {
        id: 1.2,
        title: "Your Mission Control: Navigating the Aurum Platform",
        content: `
          <div class="platform-tour">
            <p><strong>Your Aurum dashboard is your mission control.</strong> Let's do a quick tour of your main navigation sections on the left:</p>
            <div class="nav-explanation">
              <div class="nav-item-explanation">
                <h4>📊 Challenge Accounts</h4>
                <p>This is your starting point. Here you can see your 3-step path to funding and purchase new challenges.</p>
              </div>
              <div class="nav-item-explanation">
                <h4>📈 Account History</h4>
                <p>This is your command center. Once you're trading, this is where you'll track your real-time stats, P&L, and progress for all your active accounts.</p>
              </div>
              <div class="nav-item-explanation">
                <h4>🤖 Spirit Journal</h4>
                <p>Meet your AI partner. 'Spirit' is your built-in trading assistant, journal, and analysis tool.</p>
              </div>
              <div class="nav-item-explanation">
                <h4>⚡ Take a Trade</h4>
                <p>This is the execution zone. It's a dedicated, professional environment for placing your trades.</p>
              </div>
              <div class="nav-item-explanation">
                <h4>💬 Support & Feedback</h4>
                <p>We're here for you. This is your direct line to our support team.</p>
              </div>
              <div class="nav-item-explanation">
                <h4>📚 Learn Aurum</h4>
                <p>You are here! Your hub for mastering the platform and your trading psychology.</p>
              </div>
            </div>
          </div>
        `,
      },
      {
        id: 1.3,
        title: "The Path to Funding: Your 3-Step Journey",
        content: `
          <div class="funding-path">
            <p><strong>Navigate to the 'Challenge Accounts' section in your sidebar.</strong> As you can see, your journey is broken down into three clear stages:</p>
            <div class="stage-explanation">
              <div class="stage">
                <h4>Stage 1: The Challenge</h4>
                <ul>
                  <li><strong>Profit Target:</strong> 10%</li>
                  <li><strong>Max Overall Loss:</strong> 10%</li>
                  <li><strong>Objective:</strong> To demonstrate you have a profitable trading strategy.</li>
                </ul>
              </div>
              <div class="stage">
                <h4>Stage 2: The Verification</h4>
                <ul>
                  <li><strong>Profit Target:</strong> 5%</li>
                  <li><strong>Max Overall Loss:</strong> 10%</li>
                  <li><strong>Objective:</strong> To prove your consistency with a more conservative target.</li>
                </ul>
              </div>
              <div class="stage">
                <h4>Stage 3: Funded Trader</h4>
                <p><strong>The Reward:</strong> Once you successfully complete Stage 2, you're in. Your challenge fee is refunded, and you are issued a live funded account where you keep up to 80% of the profits.</p>
              </div>
            </div>
          </div>
        `,
      },
      {
        id: 1.4,
        title: "Meet 'Spirit': Your AI Trading Partner",
        content: `
          <div class="spirit-introduction">
            <p>One of our most powerful features is <strong>'Spirit'</strong>, your AI trading partner, located in the 'Spirit Journal' section. Spirit is not a simple chatbot; it's an advanced assistant designed to elevate your trading.</p>
            <h3>How to Use Spirit:</h3>
            <div class="spirit-features">
              <div class="feature">
                <h4>🔍 As a Research Assistant</h4>
                <p>Before a trade, ask Spirit to pull up a TradingView chart for any major pair. Use it to analyze RSI, moving averages, and get real-time price data without leaving the platform.</p>
              </div>
              <div class="feature">
                <h4>📝 As a Trading Journal</h4>
                <p>After a trade, you'll save your entry reasons and reflections here. Spirit can help you analyze your past trades, find patterns in your performance, and learn from every decision.</p>
              </div>
              <div class="feature">
                <h4>⚡ As a Quick-Access Tool</h4>
                <p>Spirit also has a built-in calculator for quick math and maintains your chat history so you can always pick up where you left off.</p>
              </div>
            </div>
            <p><strong>The Goal:</strong> Spirit is here to help you make smarter decisions and learn faster. We encourage you to make it a core part of your daily routine.</p>
          </div>
        `,
      },
      {
        id: 1.5,
        title: "Placing Your First Trade: The 3-Step Execution",
        content: `
          <div class="trading-walkthrough">
            <p><strong>It's time to execute.</strong> Navigate to the 'Take a Trade' section in your sidebar. You will see our professional 3-step trading workflow.</p>
            <div class="trading-steps">
              <div class="trading-step">
                <h4>Step 1: Select Your Account</h4>
                <p>First, choose the active challenge account you wish to trade from the list. You'll see its current balance and P&L to help you decide.</p>
              </div>
              <div class="trading-step">
                <h4>Step 2: Select Your Pair</h4>
                <p>Next, choose the currency pair or commodity you want to trade from the available options.</p>
              </div>
              <div class="trading-step">
                <h4>Step 3: Select Your Direction</h4>
                <p>Finally, based on your analysis, make your one decision: Buy or Sell. After you click, you will be prompted to enter your reason for the trade, which will be saved in your Spirit Journal.</p>
              </div>
            </div>
            <div class="what-happens-next">
              <h4>What Happens Next</h4>
              <p>Once you confirm, your trade is live. The system automatically manages your risk according to your plan. You can now navigate to your 'Account History' section to monitor your trade's real-time progress, P&L, and all other vital metrics.</p>
            </div>
          </div>
        `,
      },
    ];
    const currentLessonData = lessons.find((l) => l.id === currentLesson) || lessons[0];
    const completeLesson = () => {
      setCompletedLessons((prev) => new Set([...prev, currentLesson]));
    };
    const goToNextLesson = () => {
      if (currentLesson < 1.5) {
        const nextLesson = Math.round((currentLesson + 0.1) * 10) / 10;
        setCurrentLesson(nextLesson);
      }
    };
    const goToPrevLesson = () => {
      if (currentLesson > 1.1) {
        const prevLesson = Math.round((currentLesson - 0.1) * 10) / 10;
        setCurrentLesson(prevLesson);
      }
    };
    return (
      <div className="section-content">
        <div className="module-header">
          <button className="back-to-modules-btn" onClick={() => { setCurrentModule(null); setCurrentLesson(1.1); }}>
            ← Back to Modules
          </button>
          <div className="module-progress-indicator">Module 1: Getting Started ({Math.floor((currentLesson - 1) * 10) / 10 + 1}/5)</div>
        </div>
        <div className="lesson-progress-bar">
          <div className="progress-steps">
            {[1.1, 1.2, 1.3, 1.4, 1.5].map((lessonId, index) => (
              <div key={lessonId} className={`progress-step ${lessonId === currentLesson ? "active" : completedLessons.has(lessonId) ? "completed" : ""}`} onClick={() => setCurrentLesson(lessonId)}>
                <div className="step-number">{index + 1}</div>
                <div className="step-connector"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="lesson-content">
          <div className="lesson-header"><h1>{currentLessonData.title}</h1></div>
          <div className="lesson-body" dangerouslySetInnerHTML={{ __html: currentLessonData.content }} />
          <div className="lesson-actions">
            {currentLesson > 1.1 && (<button className="lesson-btn secondary" onClick={goToPrevLesson}>Previous Lesson</button>)}
            <div className="lesson-actions-right">
              {!completedLessons.has(currentLesson) && (<button className="lesson-btn complete" onClick={completeLesson}>Mark as Complete</button>)}
              {currentLesson < 1.5 ? (
                <button className="lesson-btn primary" onClick={goToNextLesson}>
                  {currentLesson === 1.1 ? "Next: Your Mission Control →" : currentLesson === 1.2 ? "Next: The Path to Funding →" : currentLesson === 1.3 ? "Next: Meet Your AI Partner →" : "Finally: Let's Place Your First Trade →"}
                </button>
              ) : (
                <button className="lesson-btn success" onClick={() => { completeLesson(); alert("Congratulations! You've completed Module 1. You're now ready to explore your dashboard and start trading!"); setCurrentModule(null); }}>
                  Congratulations! You're Ready. Explore Your Dashboard.
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderModule2 = () => {
    const lessons = [
      { id: 2.1, title: "The Aurum Philosophy on Rules", content: `<div class="philosophy-intro"><p><strong>Welcome to Module 2.</strong> In professional trading, rules are not limitations; they are the bedrock of consistency and long-term success. Every hedge fund and proprietary trading desk operates on a strict set of guidelines.</p><p>The rules at Aurum are designed with one purpose: <em>to eliminate the common causes of failure and force the habits of profitable traders</em>. They are your guardrails on the path to funding.</p><p>In this module, we will cover every rule in detail. Our goal is <strong>100% transparency</strong>. By the end, you will have a master's understanding of the evaluation criteria.</p><div class="key-principle"><h4>🎯 Key Principle</h4><p>Rules create freedom. When you understand exactly what is expected, you can focus entirely on what matters: developing and executing a profitable trading strategy.</p></div></div>` },
      { id: 2.2, title: "Your Objective: Understanding Profit Targets", content: `<div class="profit-targets"><p>Every challenge has a clear objective: <strong>to reach a specific profit target</strong>. This demonstrates that your trading strategy has a positive expectancy.</p><div class="targets-breakdown"><h3>The Targets</h3><div class="target-stage"><h4>Step 1 (Challenge): 10% Profit Target</h4><p>Your target is to achieve a <strong>10% profit</strong> on your initial account balance.</p><div class="example"><p><strong>Example:</strong> +$1,000 on a $10,000 account</p></div></div><div class="target-stage"><h4>Step 2 (Verification): 5% Profit Target</h4><p>Your target is to achieve a <strong>5% profit</strong> on your initial account balance.</p><div class="example"><p><strong>Example:</strong> +$500 on a $10,000 account</p></div></div></div><div class="tracking-info"><h4>📊 Tracking Your Progress</h4><p>You can monitor your real-time progress towards your target on your <strong>'Account History'</strong> dashboard. The progress bar gives you an at-a-glance view of how close you are to your goal.</p></div></div>` },
      { id: 2.3, title: "The Hard Deck: Max Overall Loss Explained", content: `<div class=\"hard-deck\"><p><strong>This is the most critical rule of your evaluation.</strong> The Max Overall Loss is your <em>hard deck</em> — the point at which your account is breached. It is set to <strong>10% of your initial account balance</strong>.</p><div class=\"how-it-works\"><h4>How it works</h4><p>This is a static drawdown based on your starting balance. It <em>does not</em> trail your profits. This gives you a fixed amount of risk capital to work with throughout the challenge.</p><div class=\"example\"><strong>Example:</strong> On a $10,000 challenge account, your Max Overall Loss is $1,000. Your equity must never drop below <strong>$9,000</strong> at any point.</div></div><div class=\"monitoring\"><h4>Monitoring</h4><p>Your <strong>Account History</strong> dashboard shows your current risk metrics, including remaining drawdown.</p></div></div>` },
      { id: 2.4, title: "The Agentic Advantage: No Daily Loss Limit", content: `<div class=\"no-daily-loss\"><p>Many prop firms enforce a <em>Max Daily Loss</em> that can disqualify traders in a single volatile move. <strong>We eliminated that.</strong></p><p>Our agentic trading system manages risk at the <strong>trade level</strong>. By enforcing strict risk-to-reward on every order, hitting a typical 4–5% daily loss in a single day is <em>structurally</em> avoided.</p><p><strong>Your freedom:</strong> Focus on overall drawdown and probability, not an arbitrary daily number.</p></div>` },
      { id: 2.5, title: "One Session, One Trade: A Masterclass in Patience", content: `<div class=\"one-trade-rule\"><p>As introduced in Module 1, <strong>One Session, One Trade</strong> is our discipline backbone.</p><div class=\"sessions\"><h4>Sessions (UTC)</h4><ul><li><strong>London:</strong> ~07:00–16:00</li><li><strong>New York:</strong> ~12:00–21:00</li><li><strong>Tokyo:</strong> ~23:00–08:00</li><li><strong>Sydney:</strong> ~22:00–07:00</li></ul></div><p><strong>Reset:</strong> When a session ends and the next begins, you can place another trade. Max of ~three high-quality opportunities per day.</p><p><strong>Why it works:</strong> It forces you to skip low-probability setups and wait with intention. Patience is a funded trader’s greatest asset.</p></div>` },
      { id: 2.6, title: "Standard vs. Pro: Understanding Your Risk-to-Reward", content: `<div class=\"tiers-rr\"><p>You choose your edge profile through plan tiers.</p><ul><li><strong>Standard:</strong> Structured around a 1:3 R:R profile (e.g., 7 pips SL, 21 pips TP on FX).</li><li><strong>Pro:</strong> Structured around a 1:6 R:R profile (e.g., 7 pips SL, 42 pips TP on FX).</li></ul><p>All SL/TP are enforced server-side to preserve consistency.</p></div>` },
      { id: 2.7, title: "Your Trading Universe: Permitted Instruments", content: `<div class=\"permitted-instruments\"><p>Trade only instruments supported by our execution and risk engine.</p><ul><li>Major FX pairs: <strong>EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD</strong></li></ul><p>We will expand this list over time as we verify behavior within our guardrails.</p></div>` },
      { id: 2.8, title: "Prohibited Strategies & Account Conduct", content: `<div class=\"prohibited\"><p>To protect platform integrity and counterparties, the following are prohibited:</p><ul><li>Grid/Martingale, toxic flow, or latency/arbitrage exploits</li><li>Hedging/opposing positions that violate account rules or FIFO protections</li><li>High-frequency automation intended to game fills or bypass risk controls</li><li>Account sharing, mirror/copy trading across multiple accounts to manufacture volume</li><li>Any attempt to circumvent platform risk enforcement</li></ul><p>Violations may result in immediate disqualification. When in doubt, contact Support for clarification.</p></div>` },
    ];
    const currentLessonData = lessons.find((l) => l.id === currentLesson) || lessons[0];
    const completeLesson = () => setCompletedLessons((prev) => new Set([...prev, currentLesson]));
    const goToNextLesson = () => { if (currentLesson < 2.8) { const next = Math.round((currentLesson + 0.1) * 10) / 10; setCurrentLesson(next); } };
    const goToPrevLesson = () => { if (currentLesson > 2.1) { const prev = Math.round((currentLesson - 0.1) * 10) / 10; setCurrentLesson(prev); } };
    const getButtonText = () => {
      switch (currentLesson) {
        case 2.1: return "Next: Your Objective →";
        case 2.2: return "Next: The Hard Deck →";
        case 2.3: return "Next: No Daily Loss Limit →";
        case 2.4: return "Next: One Session, One Trade →";
        case 2.5: return "Next: Standard vs. Pro →";
        case 2.6: return "Next: Permitted Instruments →";
        case 2.7: return "Next: Prohibited Strategies →";
        default: return "Module Complete! Go to Module 3: Platform Features";
      }
    };
    return (
      <div className="section-content">
        <div className="module-header">
          <button className="back-to-modules-btn" onClick={() => { setCurrentModule(null); setCurrentLesson(2.1); }}>← Back to Modules</button>
          <div className="module-progress-indicator">{
            (() => {
              const ids = moduleLessons[2];
              const step = Math.max(1, ids.indexOf(currentLesson) + 1);
              return `Module 2: Trading Rules & Guidelines (${step}/8)`;
            })()
          }</div>
        </div>
        <div className="lesson-progress-bar">
          <div className="progress-steps">
            {[2.1,2.2,2.3,2.4,2.5,2.6,2.7,2.8].map((lessonId,index)=> (
              <div key={lessonId} className={`progress-step ${lessonId===currentLesson?"active":completedLessons.has(lessonId)?"completed":""}`} onClick={()=>setCurrentLesson(lessonId)}>
                <div className="step-number">{index+1}</div>
                <div className="step-connector"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="lesson-content">
          <div className="lesson-header"><h1>{currentLessonData.title}</h1></div>
          <div className="lesson-body" dangerouslySetInnerHTML={{ __html: currentLessonData.content }} />
          <div className="lesson-actions">
            {currentLesson > 2.1 && (<button className="lesson-btn secondary" onClick={goToPrevLesson}>Previous Lesson</button>)}
            <div className="lesson-actions-right">
              {!completedLessons.has(currentLesson) && (<button className="lesson-btn complete" onClick={completeLesson}>Mark as Complete</button>)}
              {currentLesson < 2.8 ? (
                <button className="lesson-btn primary" onClick={goToNextLesson}>{getButtonText()}</button>
              ) : (
                <button className="lesson-btn success" onClick={() => { completeLesson(); alert("Congratulations! You've completed Module 2. You now have complete transparency on all evaluation rules and can trade with confidence!"); setCurrentModule(null); setCurrentLesson(2.1); }}>{getButtonText()}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderModule3 = () => {
    const lessons = [
      { id: 3.1, title: "Why We Built This: A Founder's Journey", content: `<div class="founders-story"><p><strong>The Pain:</strong> Before Aurum, there were years of wasted time and blown accounts. I was a trader with a decent strategy but no rules. I was my own worst enemy, falling into every psychological trap: fear, greed, revenge trading.</p><p><strong>The Epiphany:</strong> The turning point came when I realized consistent profitability comes from an unbreakable risk framework — making trading a science, not a gamble.</p><p><strong>The Solution:</strong> Every feature — from our Risk Engine to Spirit — was born from that journey. Aurum is the system I wish I had.</p></div>` },
      { id: 3.2, title: "The Brains of the Operation: The Aurum Risk Engine", content: `<div class="risk-engine"><p><strong>Fixed pips fail:</strong> “20 pips” means different things on volatile vs. stable pairs.</p><p><strong>Volatility-based risk:</strong> We use ATR to adapt risk to market conditions.</p><p><strong>Secret sauce:</strong> Risk Movement = <strong>23% of 4H ATR</strong> — derived from robust backtests and applied consistently.</p><p><strong>Why 4H?</strong> Balanced signal quality and achievability within a trading session.</p></div>` },
      { id: 3.3, title: "Risk in Practice: Your Exact Targets", content: `<div class="risk-in-practice"><p><strong>0.25% risk</strong> per trade is the constant.</p><table class="targets-table"><thead><tr><th>Account Size</th><th>Your Risk (0.25%)</th><th>Standard Target (1:3)</th><th>Pro Target (1:6)</th></tr></thead><tbody><tr><td>$5,000</td><td>$12.50</td><td>$37.50</td><td>$75.00</td></tr><tr><td>$10,000</td><td>$25.00</td><td>$75.00</td><td>$150.00</td></tr><tr><td>$25,000</td><td>$62.50</td><td>$187.50</td><td>$375.00</td></tr></tbody></table><p><em>How to use:</em> Find your size and plan above. The system enforces these on every trade — you focus on direction.</p></div>` },
      { id: 3.4, title: "Spirit Journal: Your AGI Performance Coach", content: `<div class="spirit-coach"><p><strong>Guardrail vs. catalyst:</strong> Risk Engine protects capital; Spirit accelerates growth.</p><h4>Today</h4><ul><li><strong>Perfect memory:</strong> Reasons logged and linked to results.</li><li><strong>Visual journaling:</strong> Save chart snapshots at entry.</li><li><strong>Integrated research:</strong> Built-in TradingView workflow.</li></ul><h4>Tomorrow</h4><ul><li><strong>Deep insights:</strong> London vs NY performance, symbol win rates.</li><li><strong>Always-on partner:</strong> Alerts and summaries.</li><li><strong>Endgame:</strong> True AGI coach with tailored feedback.</li></ul></div>` },
      { id: 3.5, title: "The Endgame: Our Commitment to Real Capital", content: `<div class="endgame-capital"><p><strong>Industry problem:</strong> Traders stuck on simulation.</p><p><strong>Our commitment:</strong> Vet on challenges, then move consistently profitable traders to <strong>live capital</strong>.</p><p><strong>Why it matters:</strong> Higher potential, true execution, professional legitimacy.</p></div>` },
      { id: 3.6, title: "Are You the Trader We're Looking For?", content: `<div class="right-fit"><p><strong>Honest question:</strong> If you want to gamble, this isn’t it. If you want enforced discipline and a professional framework, you’re our trader.</p><p><strong>Empowerment:</strong> If you’re ready for structure and consistency, we built this for you.</p><p><strong>Final nudge:</strong> The framework is here. The only missing piece is you.</p></div>` },
    ];
    const currentLessonData = lessons.find((l) => l.id === currentLesson) || lessons[0];
    const completeLesson = () => setCompletedLessons((prev) => new Set([...prev, currentLesson]));
    const goToNextLesson = () => { if (currentLesson < 3.6) { const next = Math.round((currentLesson + 0.1) * 10) / 10; setCurrentLesson(next); } };
    const goToPrevLesson = () => { if (currentLesson > 3.1) { const prev = Math.round((currentLesson - 0.1) * 10) / 10; setCurrentLesson(prev); } };
    return (
      <div className="section-content">
        <div className="module-header">
          <button className="back-to-modules-btn" onClick={() => { setCurrentModule(null); setCurrentLesson(3.1); }}>← Back to Modules</button>
          <div className="module-progress-indicator">{
            (() => {
              const ids = [3.1,3.2,3.3,3.4,3.5,3.6];
              const step = Math.max(1, ids.indexOf(currentLesson) + 1);
              return `Module 3: Platform Features (${step}/6)`;
            })()
          }</div>
        </div>
        <div className="lesson-progress-bar">
          <div className="progress-steps">
            {[3.1,3.2,3.3,3.4,3.5,3.6].map((lessonId,index)=> (
              <div key={lessonId} className={`progress-step ${lessonId===currentLesson?"active":completedLessons.has(lessonId)?"completed":""}`} onClick={()=>setCurrentLesson(lessonId)}>
                <div className="step-number">{index+1}</div>
                <div className="step-connector"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="lesson-content">
          <div className="lesson-header"><h1>{currentLessonData.title}</h1></div>
          <div className="lesson-body" dangerouslySetInnerHTML={{ __html: currentLessonData.content }} />
          <div className="lesson-actions">
            {currentLesson > 3.1 && (<button className="lesson-btn secondary" onClick={goToPrevLesson}>Previous Lesson</button>)}
            <div className="lesson-actions-right">
              {!completedLessons.has(currentLesson) && (<button className="lesson-btn complete" onClick={completeLesson}>Mark as Complete</button>)}
              {currentLesson < 3.6 ? (
                <button className="lesson-btn primary" onClick={goToNextLesson}>
                  {currentLesson === 3.1 ? "Let's Explore the Risk Engine →" : currentLesson === 3.2 ? "Next: See It In Practice →" : currentLesson === 3.3 ? "Next: Meet Your Performance Coach →" : currentLesson === 3.4 ? "Next: The Ultimate Goal →" : currentLesson === 3.5 ? "Next: Are You the Right Fit? →" : "Next"}
                </button>
              ) : (
                <button className="lesson-btn success" onClick={() => { completeLesson(); setCurrentModule(null); setCurrentLesson(3.1); }}>Finish Module</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderModule4 = () => {
    const lessons = [
      { id: 4.1, title: "The Blueprint for Success: Why These Stories Matter", content: `<div class="stories-intro"><p><strong>Welcome to the most important module in this course.</strong> So far, you've learned about the platform's features and rules. Now, you'll see the results.</p><p>A success story isn't just a testimonial; it's a blueprint. It's proof that the framework works when it's followed. The traders you're about to meet are not superhuman; they are disciplined individuals who decided to trust the system.</p><p>Pay close attention to the specific problem each trader faced. You will likely recognize your own struggles in their stories. More importantly, you will see the specific solution that led to their breakthrough. Let's begin.</p></div>` },
      { id: 4.2, title: "Case Study: Justina U. on Mastering Risk Management", content: `<div class="case-study"><blockquote>“Most traders have an inability to calculate SL and TP points. What to risk in their accounts... risk management is the main issue. Aurum Prop Firm solves that... It has helped me to minimize my losses and maximize my winning trades.”<br/>— <strong>Justina U.</strong>, Funded Trader</blockquote><h4>The Problem: The Mental Overload of Risk</h4><p>Constantly calculating risk steals energy from real analysis: How much to risk? Where should the stop go? Is the target realistic?</p><h4>The Aurum Solution: Automated Discipline</h4><p>Our Risk Engine takes the burden off: fixed <strong>0.25%</strong> risk, ATR-based stop, and automatic <strong>1:3</strong> or <strong>1:6</strong> targets — done perfectly, every time.</p><h4>The Transformation: From Calculator to Strategist</h4><p>By outsourcing risk to the system, Justina focused on finding high-quality entries. The result: minimized losses, maximized wins.</p><div class="takeaway"><strong>Key Takeaway:</strong> Focus on direction. Let the system be your risk manager.</div></div>` },
      { id: 4.3, title: "Case Study: Osarenren I. on Protecting Profits", content: `<div class="case-study"> <blockquote>“I can take my first trade and make a profit of $500 and then take more trades that just takes me back to $0 or even a bigger loss... All I needed to do was just stay away from the chart. Aurum forces this on me and it's been phenomenal.”<br/>— <strong>Osarenren I.</strong>, Founder & Funded Trader</blockquote><h4>The Problem: The Emotional Rollercoaster</h4><p>Big win euphoria → impulsive over-trading → give it all back. Not a strategy problem — an emotional control problem.</p><h4>The Aurum Solution: The Enforced “Walk Away”</h4><p><strong>One Session, One Trade</strong> is enforced by the platform. Place your one trade; then your job is done.</p><h4>The Transformation: Keeping What You Earn</h4><p>By removing the ability to over-trade, the initial, well-analyzed idea stands on its own. You keep more of what you make.</p><div class="takeaway"><strong>Key Takeaway:</strong> A profitable day is built on one good decision. The platform protects that decision.</div></div>` },
      { id: 4.4, title: "The Common Thread: Outsourcing Your Discipline", content: `<div class="common-thread"><p>What do risk calculation and emotional control have in common?</p><p><strong>The solution for both is to outsource discipline to the system.</strong></p><ul><li>Justina outsourced the complex math of risk management.</li><li>Osarenren outsourced the emotional battle of when to stop trading.</li></ul><p>Neither relied on willpower alone — which fails under pressure. This is the core philosophy of Aurum: <strong>automated discipline</strong> so you can focus on analysis.</p></div>` },
      { id: 4.5, title: "You Are Our Next Success Story", content: `<div class="next-success"><p>The Aurum “Hall of Fame” is just beginning. The stories you've read are from our first pioneers.</p><p>We’re actively searching for our next generation of funded traders — disciplined operators who understand the framework and are ready to commit.</p><p><strong>The path is laid out. The tools are in your hands.</strong> The only question left is: will your name be next?</p></div>` },
    ];
    const currentLessonData = lessons.find((l) => l.id === currentLesson) || lessons[0];
    const completeLesson = () => setCompletedLessons((prev) => new Set([...prev, currentLesson]));
    const goToNextLesson = () => { if (currentLesson < 4.5) { const next = Math.round((currentLesson + 0.1) * 10) / 10; setCurrentLesson(next); } };
    const goToPrevLesson = () => { if (currentLesson > 4.1) { const prev = Math.round((currentLesson - 0.1) * 10) / 10; setCurrentLesson(prev); } };
    const getButtonText = () => {
      switch (currentLesson) {
        case 4.1: return "Let's Meet Our First Trader: Justina →";
        case 4.2: return "Next: The Founder's Own Breakthrough →";
        case 4.3: return "Next: The Common Thread →";
        case 4.4: return "Next: Your Story Starts Now →";
        default: return "Go to My Dashboard & Apply These Lessons";
      }
    };
    return (
      <div className="section-content">
        <div className="module-header">
          <button className="back-to-modules-btn" onClick={() => { setCurrentModule(null); setCurrentLesson(4.1); }}>← Back to Modules</button>
          <div className="module-progress-indicator">{
            (() => {
              const ids = [4.1,4.2,4.3,4.4,4.5];
              const step = Math.max(1, ids.indexOf(currentLesson) + 1);
              return `Module 4: Success Stories (${step}/5)`;
            })()
          }</div>
        </div>
        <div className="lesson-progress-bar">
          <div className="progress-steps">
            {[4.1,4.2,4.3,4.4,4.5].map((lessonId,index)=> (
              <div key={lessonId} className={`progress-step ${lessonId===currentLesson?"active":completedLessons.has(lessonId)?"completed":""}`} onClick={()=>setCurrentLesson(lessonId)}>
                <div className="step-number">{index+1}</div>
                <div className="step-connector"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="lesson-content">
          <div className="lesson-header"><h1>{currentLessonData.title}</h1></div>
          <div className="lesson-body" dangerouslySetInnerHTML={{ __html: currentLessonData.content }} />
          <div className="lesson-actions">
            {currentLesson > 4.1 && (<button className="lesson-btn secondary" onClick={goToPrevLesson}>Previous Lesson</button>)}
            <div className="lesson-actions-right">
              {!completedLessons.has(currentLesson) && (<button className="lesson-btn complete" onClick={completeLesson}>Mark as Complete</button>)}
              {currentLesson < 4.5 ? (
                <button className="lesson-btn primary" onClick={goToNextLesson}>{getButtonText()}</button>
              ) : (
                <button className="lesson-btn dashboard-return" onClick={() => { completeLesson(); alert("Congratulations! You've completed all learning modules. You now have the complete blueprint for success. Time to take action!"); setActiveSection && setActiveSection("account-history"); setCurrentModule(null); setCurrentLesson(4.1); }}>{getButtonText()}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (currentModule === 1) return renderModule1();
  if (currentModule === 2) return renderModule2();
  if (currentModule === 3) return renderModule3();
  if (currentModule === 4) return renderModule4();

  return (
    <div className="section-content">
      <div className="section-header">
        <h1>Learn Aurum</h1>
        <p>Master our platform and discover why we're the best prop firm for your trading journey</p>
      </div>
      <div className="learning-modules">
        <div className="module-card">
          <div className="module-header">
            <h3>Getting Started</h3>
            <div className="module-progress">{completedCountFor(1)}/5 completed</div>
          </div>
          <p>Transform from visitor to confident trader. Learn our philosophy, navigate key sections, and execute your first trade with confidence.</p>
          <button className="module-button" onClick={() => { setCurrentModule(1); setCurrentLesson(1.1); }}>
            {completedLessons.size > 0 ? "Continue Learning" : "Start Learning"}
          </button>
        </div>

        <div className="module-card">
          <div className="module-header">
            <h3>Trading Rules & Guidelines</h3>
            <div className="module-progress">{completedCountFor(2)}/8 completed</div>
          </div>
          <p>Understand our trading rules, risk management, and evaluation criteria for complete transparency and success</p>
          <button className="module-button" onClick={() => { setCurrentModule(2); setCurrentLesson(2.1); }}>
            Start Learning
          </button>
        </div>

        <div className="module-card recommended">
          <div className="module-header">
            <h3>Platform Features</h3>
            <div className="module-progress">{completedCountFor(3)}/6 completed</div>
          </div>
          <p>Discover the sophisticated, data-driven logic behind our core features and why Aurum is your best path to funded trading</p>
          <button className="module-button" onClick={() => { setCurrentModule(3); setCurrentLesson(3.1); }}>
            Start Learning
          </button>
        </div>

        <div className="module-card">
          <div className="module-header">
            <h3>Success Stories</h3>
            <div className="module-progress">{completedCountFor(4)}/5 completed</div>
          </div>
          <p>Learn from real funded traders and see exactly how the Aurum framework created their breakthroughs</p>
          <button className="module-button" onClick={() => { setCurrentModule(4); setCurrentLesson(4.1); }}>
            Start Learning
          </button>
        </div>
      </div>
    </div>
  );
}
