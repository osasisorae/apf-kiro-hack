import { getSql } from '../../../lib/db'

function Badge({ text, variant = 'default' }) {
  const map = {
    success: 'badge-success',
    pending: 'badge-pending',
    failed: 'badge-failed',
    default: 'badge-default'
  };
  const cls = map[variant] || map.default;
  return <span className={cls}>{text}</span>;
}

export default async function PaymentReturn({ searchParams }) {
  const reference = searchParams?.reference || null;
  const sql = getSql();

  let order = null;
  let accounts = [];
  let merchantRef = null;
  if (reference) {
    // Attempt server-side verification with Korapay to get authoritative status
    try {
      const KORAPAY_KEY = process.env.KORAPAY_SECRET_KEY || process.env.KORA_TEST_SECRET;
      if (KORAPAY_KEY) {
        try {
          const verifyUrl = (ref) => `https://api.korapay.com/merchant/api/v1/charges/verify?reference=${encodeURIComponent(ref)}`;
          let vr = null;
          let verifyResp = await fetch(verifyUrl(reference), { method: 'GET', headers: { 'Authorization': `Bearer ${KORAPAY_KEY}` } });
          if (verifyResp && verifyResp.ok) {
            vr = await verifyResp.json();
            console.debug('Korapay verify response for reference', reference, vr && vr.data && (vr.data.status || vr.data.transaction_status));
          } else {
            try {
              const maybe = await verifyResp.json().catch(() => null);
              if (maybe && maybe.data && (maybe.data.payment_reference || maybe.data.paymentReference)) {
                merchantRef = maybe.data.payment_reference || maybe.data.paymentReference;
              }
            } catch (e) {}
          }

          if (!vr) {
            try {
              const rows = await sql`SELECT * FROM orders WHERE reference = ${reference} LIMIT 1`;
              if (rows && rows.length > 0) {
                const stored = rows[0];
                if (stored && stored.reference && stored.reference !== reference) {
                  verifyResp = await fetch(verifyUrl(stored.reference), { method: 'GET', headers: { 'Authorization': `Bearer ${KORAPAY_KEY}` } });
                  if (verifyResp && verifyResp.ok) {
                    vr = await verifyResp.json();
                    console.debug('Korapay verify response for stored order reference', stored.reference, vr && vr.data && (vr.data.status || vr.data.transaction_status));
                    merchantRef = merchantRef || (vr && vr.data && (vr.data.payment_reference || vr.data.paymentReference)) || null;
                  }
                }
              }
            } catch (e) {
              // continue
            }
          }

          if (vr && vr.data) {
            const status = (vr.data.status || vr.data.transaction_status) || null;
            merchantRef = merchantRef || (vr.data.payment_reference || vr.data.paymentReference || null);
            if (status) {
              await sql`
                UPDATE orders
                SET status = ${status}, metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(vr.data)}::jsonb
                WHERE reference = ${reference} OR reference = ${merchantRef}
              `;
            }
          }

          if (!vr) {
            try {
              const maybe = verifyResp ? await verifyResp.json().catch(() => null) : null;
              merchantRef = merchantRef || (maybe && (maybe.data && (maybe.data.payment_reference || maybe.data.paymentReference))) || null;
            } catch (e) {}
          }
        } catch (e) {
          // ignore verification errors; we'll rely on webhook
        }
      }
    } catch (e) {
      // ignore
    }
    try {
      const rows = await sql`SELECT * FROM orders WHERE reference = ${reference} OR reference = ${merchantRef} LIMIT 1`;
      if (rows && rows.length > 0) {
        order = rows[0];
        // look up any created trading accounts for this order (by user_email + account_size)
        if (order.user_email && order.account_size) {
          const accs = await sql`
            SELECT ta.id, ta.account_type, ta.account_size, ta.status, ta.current_balance, ta.start_date
            FROM trading_accounts ta
            JOIN users u ON u.id = ta.user_id
            WHERE u.email = ${order.user_email} AND ta.account_size = ${order.account_size}
            ORDER BY ta.id DESC
          `;
          accounts = accs || [];
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return (
    <div className="payment-return-page">
      <div className="payment-card">
        <div className="payment-header">
          <h1 className="payment-title">Payment Result</h1>
          <div className="payment-actions">
            <a href="/dashboard" className="btn-outline">Back to dashboard</a>
            <a href={reference ? `/payments/return?reference=${reference}` : '/payments/return'} className="btn-primary">Refresh</a>
          </div>
        </div>

        {!reference && (
          <div>
            <p style={{ marginTop: 8 }}>No transaction reference provided.</p>
            <p style={{ color: '#475569' }}>Return to the dashboard and try again, or contact support with your order details.</p>
          </div>
        )}

        {reference && !order && (
          <div>
            <p style={{ fontSize: 16, fontWeight: 600 }}>Reference: {reference}</p>
            <p style={{ color: '#475569' }}>We don't have a record for this transaction yet. If you just completed payment, please wait a moment and refresh.</p>
          </div>
        )}

        {order && (
          <div>
            <div className="status-hero">
              <div className="status-left">
                <div className="kv-grid">
                  <div className="kv">
                    <div className="k">Reference</div>
                    <div className="v mono">{order.reference}</div>
                  </div>
                  <div className="kv">
                    <div className="k">Amount</div>
                    <div className="v"><strong>{order.amount} {order.currency}</strong></div>
                  </div>
                </div>
              </div>
              <div className="status-right">
                {order.status === 'success' && <Badge text="Success" variant="success" />}
                {order.status === 'pending' && <Badge text="Pending" variant="pending" />}
                {order.status === 'failed' && <Badge text="Failed" variant="failed" />}
              </div>
            </div>

                <div className="payment-body">
              {order.status === 'success' && (
                <div>
                  <h3 className="section-title">Payment successful</h3>
                  <p className="muted">
                    Your purchase is confirmed. The account will appear under “Purchased Accounts” as <strong>Provisioning</strong> in your dashboard.
                    Our team will attach your OANDA account shortly; once approved, it will move to <strong>Active Accounts</strong> and you can start trading.
                  </p>
                </div>
              )}

              {order.status === 'pending' && (
                <div>
                  <h3 className="section-title">Payment pending</h3>
                  <p className="muted">We haven't received confirmation yet. We'll update this page automatically when we do.</p>
                </div>
              )}

              {order.status === 'failed' && (
                <div>
                  <h3 className="section-title">Payment failed</h3>
                  <p className="muted">Payment was not successful. Please try again or contact support.</p>
                </div>
              )}
            </div>

            {accounts.length > 0 && (
              <div className="accounts-section">
                <h4>Created trading account(s)</h4>
                <div className="accounts-grid">
                  {accounts.map((a) => (
                    <div key={a.id} className="account-card">
                      <div>
                        <div className="account-title">#{a.id} — {a.account_type === 'challenge' ? 'Challenge' : a.account_type}</div>
                        <div className="account-meta">{a.account_size} • Balance: {a.current_balance}</div>
                      </div>
                      <div>
                        <a href="/dashboard" className="btn-primary small">View in dashboard</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
