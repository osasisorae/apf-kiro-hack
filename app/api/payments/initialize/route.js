import { NextResponse } from "next/server";
import { getSql } from "../../../../lib/db";
import { ACCOUNT_PLANS } from "../../../../lib/account-plans";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      accountSize,
      plan = "standard",
      price, // decimal price in USD (or currency)
      currency = "USD",
      reference,
      customer = {},
      redirect_url,
      notification_url,
      narration,
      metadata = {},
      userEmail,
    } = body;

    const KORAPAY_KEY =
      process.env.KORAPAY_SECRET_KEY || process.env.KORA_TEST_SECRET;
    if (!KORAPAY_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Korapay secret key not configured (set KORAPAY_SECRET_KEY or KORA_TEST_SECRET)",
        },
        { status: 500 },
      );
    }

    if (!reference) {
      return NextResponse.json(
        { success: false, error: "reference is required" },
        { status: 400 },
      );
    }

    const sql = getSql();
    // preserve metadata in a mutable local variable
    let finalMetadata = { ...metadata };

    // Ensure orders table exists
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

    // Insert order record (if not exists)
    try {
      const res = await sql`
        INSERT INTO orders (user_email, amount, currency, reference, plan, account_size, metadata)
          VALUES (
            ${userEmail}, ${price}, ${currency}, ${reference}, ${plan}, ${accountSize}, ${JSON.stringify(finalMetadata)}::jsonb
          ) ON CONFLICT (reference) DO NOTHING
        RETURNING id, reference, created_at
      `;
      // Log the insert result for dev tracing
      if (res && res.length > 0) console.debug("Inserted order row:", res[0]);
    } catch (e) {
      console.warn("Could not insert order:", e.message || e);
    }

    if (!price) {
      return NextResponse.json(
        { success: false, error: "price is required" },
        { status: 400 },
      );
    }
    // create trading_accounts table if not exists, then insert
    // Removed trading_accounts creation - this logic now resides in the webhook after payment confirmation

    // Normalize price to number
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json(
        { success: false, error: "price must be a positive number" },
        { status: 400 },
      );
    }

    // Determine amount and currency to send to Korapay.
    // By default we'll charge in NGN for Korapay (merchant typical flow) when the incoming currency is USD.
    // If the incoming currency is USD, call Korapay's exchange rate endpoint to get NGN equivalent.
    let chargeAmount;
    let chargeCurrency = currency;

    try {
      if (currency && currency.toUpperCase() === "USD") {
        // Call Korapay exchange rate API to get NGN amount for this USD price.
        const rateResp = await fetch(
          "https://api.korapay.com/api/v1/conversions/rates",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${KORAPAY_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from_currency: "USD",
              to_currency: "NGN",
              amount: priceNum,
            }),
          },
        );

        // Try to parse JSON only if content-type is JSON
        const ctype = rateResp.headers.get("content-type") || "";
        if (!rateResp.ok || !ctype.includes("application/json")) {
          console.warn(
            "Korapay rate lookup returned non-JSON or failed; using fallback rate",
          );
          const fallbackRate = parseFloat(
            process.env.KORA_USD_NGN_RATE || "1440",
          );
          chargeAmount = Math.round(priceNum * fallbackRate);
          chargeCurrency = "NGN";
          finalMetadata = {
            ...finalMetadata,
            kora_rate: fallbackRate,
            rate_source: "fallback",
          };
        } else {
          const rateData = await rateResp.json();
          if (!rateResp.ok || !rateData || !rateData.data) {
            console.warn(
              "Korapay rate lookup failed; using fallback rate",
              rateData,
            );
            const fallbackRate = parseFloat(
              process.env.KORA_USD_NGN_RATE || "1440",
            );
            chargeAmount = Math.round(priceNum * fallbackRate);
            chargeCurrency = "NGN";
            finalMetadata = {
              ...finalMetadata,
              kora_rate: fallbackRate,
              rate_source: "fallback",
            };
          } else {
            // rateData.data.to_amount is the NGN amount (integer) returned by Korapay
            chargeAmount = Math.round(rateData.data.to_amount);
            chargeCurrency = "NGN";
            // keep the rate in finalMetadata for auditing
            finalMetadata = {
              ...finalMetadata,
              kora_rate: rateData.data.rate,
              kora_from_amount: rateData.data.from_amount,
              kora_to_amount: rateData.data.to_amount,
              rate_source: "kora",
            };
          }
        }
      } else if (currency && currency.toUpperCase() === "NGN") {
        // If already NGN, Korapay expects an integer amount (no decimals in payload). Round to nearest integer.
        chargeAmount = Math.round(priceNum);
        chargeCurrency = "NGN";
      } else {
        // For other currencies, assume the gateway expects minor units (e.g., cents for USD)
        // We'll multiply by 100 as a reasonable default.
        chargeAmount = Math.round(priceNum * 100);
      }
    } catch (err) {
      console.warn("Error while resolving charge amount:", err);
      // as a safe fallback, charge in USD minor units
      chargeAmount = Math.round(priceNum * 100);
    }

    // If we converted USD -> NGN, use DCC to have customer pay in NGN and settle in USD.
    const initializePayload = {
      amount: chargeAmount,
      currency: chargeCurrency,
      reference,
      customer,
      narration,
      metadata: { ...finalMetadata, accountSize, plan, userEmail },
    };

    // Dynamic Currency Conversion: if incoming currency was USD but we charge NGN, set payment/settlement currencies
    try {
      if (
        currency &&
        currency.toUpperCase() === "USD" &&
        chargeCurrency === "NGN"
      ) {
        initializePayload.payment_currency = "NGN";
        initializePayload.settlement_currency = "USD";
      }
    } catch (e) {
      // no-op
    }

    // Include redirect and notification URLs when provided so Korapay will POST to our webhook
    if (redirect_url) initializePayload.redirect_url = redirect_url;
    const defaultNotification =
      process.env.KORAPAY_NOTIFICATION_URL ||
      process.env.KORA_NOTIFICATION_URL ||
      null;
    const notif = notification_url || defaultNotification;
    if (notif) {
      initializePayload.notification_url = notif;
      console.debug("Including notification_url in initialize payload:", notif);
    }

    const resp = await fetch(
      "https://api.korapay.com/merchant/api/v1/charges/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KORAPAY_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(initializePayload),
      },
    );

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Korapay initialize error:", data);
      return NextResponse.json(
        { success: false, error: data },
        { status: resp.status || 500 },
      );
    }

    // Return a normalized response with top-level checkout_url for easier client consumption,
    // but keep the original response in `raw` so existing client code doesn't break.
    const checkoutUrl =
      data?.data?.checkout_url ||
      (data?.customer && data.customer.checkout_url) ||
      null;

    // keep original `data` field for compatibility with existing client checks
    return NextResponse.json({
      success: true,
      checkout_url: checkoutUrl,
      data,
      raw: data,
    });
  } catch (err) {
    console.error("Initialize handler error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
