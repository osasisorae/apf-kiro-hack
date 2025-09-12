import { NextResponse } from "next/server";
import { getSql } from "../../../../lib/db";
import { createHmac, timingSafeEqual } from "crypto";
import { ACCOUNT_PLANS } from "../../../../lib/account-plans";

export async function POST(req) {
  try {
    // Read raw body so we can validate HMAC signatures before parsing JSON
    const raw = await req.text();

    // Webhook verification: if a secret is configured, require a valid HMAC-SHA256 signature
    const secret =
      process.env.KORAPAY_WEBHOOK_SECRET ||
      process.env.KORA_WEBHOOK_SECRET ||
      null;
    // Common header names we might receive from Korapay or proxies
    const headerCandidates = [
      "x-korapay-signature",
      "x-kora-signature",
      "x-signature",
      "x-korapay-signature-256",
      "x-hub-signature-256",
      "signature",
    ];

    // small helper: log headers for debugging (useful when troubleshooting ngrok deliveries)
    try {
      const hdrs = {};
      for (const [k, v] of req.headers.entries()) hdrs[k] = v;
      console.debug("Webhook headers:", hdrs);
    } catch (e) {}

    let receivedSig = null;
    for (const h of headerCandidates) {
      const v = req.headers.get(h);
      if (v) {
        receivedSig = v;
        break;
      }
    }

    if (secret) {
      // allow a developer override to bypass signature enforcement when testing via ngrok
      const allowInsecure =
        String(
          process.env.KORAPAY_WEBHOOK_ALLOW_INSECURE ||
            process.env.KORA_WEBHOOK_ALLOW_INSECURE ||
            "",
        ).toLowerCase() === "true";
      if (!receivedSig) {
        if (allowInsecure) {
          console.warn(
            "Webhook signature missing but KORAPAY_WEBHOOK_ALLOW_INSECURE=true; proceeding without verification (dev only)",
          );
        } else {
          console.warn("Missing webhook signature header; rejecting");
          return NextResponse.json(
            { success: false, error: "missing webhook signature" },
            { status: 400 },
          );
        }
      }

      // Normalize signature format (support `sha256=...`, hex or base64 payloads)
      let sig = receivedSig.trim();
      if (sig.startsWith("sha256=")) sig = sig.split("=")[1];

      const computed = createHmac("sha256", secret).update(raw).digest();

      let valid = false;
      try {
        if (/^[0-9a-f]+$/i.test(sig)) {
          // hex signature
          const sigBuf = Buffer.from(sig, "hex");
          valid =
            sigBuf.length === computed.length &&
            timingSafeEqual(sigBuf, computed);
        } else {
          // assume base64
          const sigBuf = Buffer.from(sig, "base64");
          valid =
            sigBuf.length === computed.length &&
            timingSafeEqual(sigBuf, computed);
        }
      } catch (e) {
        valid = false;
      }

      if (!valid) {
        return NextResponse.json(
          { success: false, error: "invalid webhook signature" },
          { status: 401 },
        );
      }
    }

    // parse payload after verification (or skip when no secret configured)
    const payload = raw ? JSON.parse(raw) : null;
    // dev log of received webhook payload (helps when using ngrok)
    try {
      console.debug(
        "Webhook received payload:",
        payload && payload.event,
        payload &&
          payload.data && {
            reference: payload.data.reference,
            payment_reference:
              payload.data.payment_reference || payload.data.paymentReference,
          },
      );
    } catch (e) {}
    // payload example: { event: 'charge.success', data: { reference, amount, currency, status, payment_method, ... } }

    const sql = getSql();

    if (!payload || !payload.data || !payload.data.reference) {
      return NextResponse.json(
        { success: false, error: "invalid payload" },
        { status: 400 },
      );
    }

    // Korapay may send both their reference and the merchant's reference (payment_reference)
    const korapayReference = payload.data.reference;
    const merchantReference =
      payload.data.payment_reference || payload.data.paymentReference || null;
    const status =
      payload.data.status || payload.data.transaction_status || null;

    // Ensure orders table exists (idempotent)
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255),
        amount NUMERIC,
        currency VARCHAR(10),
        reference VARCHAR(255) UNIQUE,
        plan VARCHAR(50),
        account_size NUMERIC,
        status VARCHAR(20) DEFAULT 'pending',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Update order status. Try matching merchantReference first, fall back to Korapay reference
    const updateRes = await sql`
      UPDATE orders SET status = ${status}, metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(payload.data)}::jsonb
      WHERE reference = ${merchantReference} OR reference = ${korapayReference}
      RETURNING id, reference, status
    `;
    if (updateRes && updateRes.length > 0)
      console.debug("Webhook updated orders:", updateRes);

    // Fetch the order so we can use stored metadata/user info if webhook metadata is missing
    const orders = await sql`
      SELECT * FROM orders WHERE reference = ${merchantReference} OR reference = ${korapayReference} LIMIT 1
    `;
    const order = orders && orders.length > 0 ? orders[0] : null;

    // If charge.success, try to create trading account for user if metadata contains userEmail and accountSize
    if (payload.event === "charge.success") {
      try {
        // Prefer webhook metadata, fall back to stored order metadata or order.user_email
        const md = payload.data.metadata || (order && order.metadata) || {};
        const userEmail =
          md.userEmail || md.email || (order && order.user_email);
        const accountSize =
          md.accountSize ||
          md.account_size ||
          (order && order.account_size) ||
          null;
        const plan = md.plan || (order && order.plan) || "standard";

        if (userEmail && accountSize) {
          // find user id
          const users =
            await sql`SELECT id FROM users WHERE email = ${userEmail} LIMIT 1`;
          if (users.length > 0) {
            const userId = users[0].id;
            // ensure we don't create duplicate accounts for the same user & size
            const existing =
              await sql`SELECT id FROM trading_accounts WHERE user_id = ${userId} AND account_type = 'challenge' AND account_size = ${accountSize} LIMIT 1`;
            if (existing.length === 0) {
              // Try to derive plan data from metadata when amount lookup fails
              const byAmount = ACCOUNT_PLANS[String(order.amount)] || null;
              const sizeNum = Number(accountSize);
              const tier = String(plan || '').toLowerCase() === 'pro' ? 'pro' : 'standard';
              const derived = !isNaN(sizeNum) && sizeNum > 0
                ? {
                    planType: tier,
                    accountSize: sizeNum,
                    challengeTarget: Math.round(sizeNum * 0.10),
                    verificationTarget: Math.round(sizeNum * 0.05),
                    maxLoss: Math.round(sizeNum * 0.10),
                    cost: Number(order.amount) || null,
                  }
                : null;

              const planData = byAmount || derived;

              if (planData) {
                const ins = await sql`
                        INSERT INTO trading_accounts (user_id, account_type, account_size, status, challenge_phase, current_balance, max_balance, start_date, profit_target, max_drawdown, plan_tier)
                        VALUES (
                          ${userId}, ${'challenge'}, ${planData.accountSize}, 'provisioning', 'phase1', ${planData.accountSize}, ${planData.accountSize}, NOW(), ${planData.challengeTarget}, ${planData.maxLoss}, ${planData.planType}
                        ) RETURNING id
                      `;
                if (ins && ins.length > 0)
                  console.debug(
                    "Created trading account id:",
                    ins[0].id,
                    "for user",
                    userId,
                    "size",
                    planData.accountSize,
                  );
              } else {
                console.warn(
                  "No plan data found; missing accountSize/plan in metadata. Order amount:",
                  order.amount,
                );
              }
            }
          }
        }
      } catch (createErr) {
        // don't spam logs in production; keep minimal warning
        console.warn("Could not create trading account from webhook");
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
