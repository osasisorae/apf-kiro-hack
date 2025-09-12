"use client";

import React from "react";

export default function ChallengeAccounts({ session }) {
  const initPayment = async ({ accountSize, plan, price }) => {
    try {
      const reference = `KPY-${Date.now()}`;
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountSize,
          plan,
          price,
          currency: "USD",
          reference,
          redirect_url: window.location.origin + "/payments/return",
          customer: {
            name: session?.user?.name || "Trader",
            email: session?.user?.email || "",
          },
          userEmail: session?.user?.email || "",
        }),
      });

      const data = await res.json();
      const checkout = data.checkout_url || (data.data && data.data.data && data.data.data.checkout_url);
      if (data.success && checkout) {
        window.location.href = checkout;
      } else {
        alert("Failed to initialize payment.");
        console.error("Init response", data);
      }
    } catch (e) {
      console.error(e);
      alert("Payment initialization failed. Please try again.");
    }
  };

  const tiers = [
    {
      title: "$5,000 Challenge",
      standard: { plan: "standard", price: 50 },
      pro: { plan: "pro", price: 75 },
      size: 5000,
      badge: "Entry Level",
    },
    {
      title: "$10,000 Challenge",
      standard: { plan: "standard", price: 95 },
      pro: { plan: "pro", price: 145 },
      size: 10000,
      badge: "Popular",
    },
    {
      title: "$25,000 Challenge",
      standard: { plan: "standard", price: 185 },
      pro: { plan: "pro", price: 285 },
      size: 25000,
      badge: "Pro Level",
    },
  ];

  return (
    <div className="section-content">
      <div className="section-header">
        <h1>Challenge Accounts</h1>
        <p>Choose your trading challenge and start your journey to becoming a funded trader</p>
      </div>

      <div className="challenge-process">
        <div className="process-step"><div className="step-number">1</div><div className="step-content"><h4>Challenge Phase</h4><p>Achieve 10% profit target</p></div></div>
        <div className="process-arrow">→</div>
        <div className="process-step"><div className="step-number">2</div><div className="step-content"><h4>Verification Phase</h4><p>Achieve 5% profit target</p></div></div>
        <div className="process-arrow">→</div>
        <div className="process-step"><div className="step-number">3</div><div className="step-content"><h4>Funded Trader</h4><p>No targets, keep profits!</p></div></div>
      </div>

      <div className="challenge-grid">
        {tiers.map((t) => (
          <div key={t.size} className={`challenge-card ${t.size === 25000 ? 'pro-tier' : t.size === 10000 ? 'advanced' : 'starter'}`}>
            <div className="challenge-badge">{t.badge}</div>
            <div className="challenge-header"><h3>{t.title}</h3></div>
            <div className="challenge-pricing">
              <div className="pricing-option standard">
                <div className="pricing-header"><h4>Standard</h4><div className="price">${t.standard.price}</div></div>
              </div>
              <div className="pricing-option pro">
                <div className="pricing-header"><h4>Pro</h4><div className="price">${t.pro.price}</div></div>
              </div>
            </div>
            <div className="challenge-details">
              <div className="detail-item"><span className="detail-label">Account Size:</span><span className="detail-value">${t.size.toLocaleString()}</span></div>
              <div className="detail-item"><span className="detail-label">Challenge Target:</span><span className="detail-value">10%</span></div>
              <div className="detail-item"><span className="detail-label">Verification Target:</span><span className="detail-value">5%</span></div>
              <div className="detail-item"><span className="detail-label">Max Loss (Each Phase):</span><span className="detail-value">10%</span></div>
              <div className="detail-item"><span className="detail-label">Refund After Verification:</span><span className="detail-value">✓ Full Fee Refunded</span></div>
            </div>
            <div className="challenge-buttons">
              <button className="challenge-button standard" onClick={() => initPayment({ accountSize: t.size, plan: t.standard.plan, price: t.standard.price })}>
                Standard - ${t.standard.price}
              </button>
              <button className="challenge-button pro" onClick={() => initPayment({ accountSize: t.size, plan: t.pro.plan, price: t.pro.price })}>
                Pro - ${t.pro.price}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

