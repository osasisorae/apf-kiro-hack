import { NextResponse } from "next/server";
import OandaClient from "../../../../lib/oanda-client";

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeId(id) {
  if (id === null || id === undefined) return '';
  return String(id).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const instruments = searchParams.get("instruments");
    const oandaAccountId = normalizeId(searchParams.get("oanda_account_id"));

    console.log("📊 OANDA Pricing API called with instruments:", instruments);

    // Validate parameters
    if (!instruments || instruments.trim() === "") {
      console.log("❌ Invalid instruments parameter");
      return NextResponse.json(
        { error: "Instruments parameter is required" },
        { status: 400 },
      );
    }
    if (!oandaAccountId) {
      return NextResponse.json(
        { error: "oanda_account_id is required" },
        { status: 400 }
      );
    }

    // Initialize OANDA client
    const oanda = new OandaClient();

    // Check if OANDA credentials are available
    if (!process.env.OANDA_TOKEN) {
      console.log("❌ OANDA_TOKEN not found in environment variables");
      return NextResponse.json(
        { error: "OANDA configuration missing" },
        { status: 500 },
      );
    }

    console.log("🔄 Fetching pricing data from OANDA...");
    const response = await oanda.getPricing(instruments, oandaAccountId);

    console.log(
      "📈 OANDA response status:",
      response.success,
      "Status code:",
      response.statusCode,
    );

    if (response.success && response.data) {
      // Log successful response structure for debugging
      console.log("✅ Successfully fetched pricing data");
      console.log(
        "📊 Number of prices returned:",
        response.data.prices?.length || 0,
      );

      // Validate that we have pricing data
      if (!response.data.prices || response.data.prices.length === 0) {
        console.log("⚠️ No pricing data returned from OANDA");
        return NextResponse.json(
          { error: "No pricing data available" },
          { status: 404 },
        );
      }

      // Log each price for debugging
      response.data.prices.forEach((price) => {
        console.log(
          `💱 ${price.instrument}: Bid=${price.bids?.[0]?.price || "N/A"}, Ask=${price.asks?.[0]?.price || "N/A"}`,
        );
      });

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        ...response.data,
      });
    } else {
      console.log("❌ OANDA API error:", response.data);

      // Provide more specific error messages
      let errorMessage = "Failed to fetch pricing data";
      if (response.statusCode === 401) {
        errorMessage = "OANDA API authentication failed";
      } else if (response.statusCode === 403) {
        errorMessage = "OANDA API access forbidden";
      } else if (response.statusCode === 404) {
        errorMessage = "OANDA API endpoint not found";
      } else if (response.statusCode >= 500) {
        errorMessage = "OANDA API server error";
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: response.data,
          statusCode: response.statusCode,
        },
        { status: response.statusCode || 500 },
      );
    }
  } catch (error) {
    console.error("💥 OANDA pricing API error:", error.message);
    console.error("🔍 Error stack:", error.stack);

    // Check for specific error types
    let errorMessage = "Internal server error while fetching pricing data";
    let statusCode = 500;

    if (
      error.message.includes("ENOTFOUND") ||
      error.message.includes("network")
    ) {
      errorMessage = "Network error connecting to OANDA";
      statusCode = 503;
    } else if (error.message.includes("timeout")) {
      errorMessage = "Request timeout connecting to OANDA";
      statusCode = 504;
    } else if (error.message.includes("token")) {
      errorMessage = "OANDA API authentication error";
      statusCode = 401;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode },
    );
  }
}

// Optional: Add POST method for more complex pricing requests
export async function POST(request) {
  try {
    const body = await request.json();
    const { instruments, since } = body;

    console.log("📊 OANDA Pricing POST API called with:", {
      instruments,
      since,
    });

    if (!instruments) {
      return NextResponse.json(
        { error: "Instruments array is required" },
        { status: 400 },
      );
    }

    const oanda = new OandaClient();
    const instrumentsParam = Array.isArray(instruments)
      ? instruments.join(",")
      : instruments;

    const accountId = normalizeId(body.oanda_account_id);
    if (!accountId) {
      return NextResponse.json(
        { error: "oanda_account_id is required" },
        { status: 400 }
      );
    }

    const response = await oanda.getPricing(instrumentsParam, accountId);

    if (response.success && response.data) {
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        ...response.data,
      });
    } else {
      return NextResponse.json(
        { error: "Failed to fetch pricing data", details: response.data },
        { status: response.statusCode || 500 },
      );
    }
  } catch (error) {
    console.error("💥 OANDA pricing POST API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
